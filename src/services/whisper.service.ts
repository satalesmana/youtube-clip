import { basename, join, extname } from 'node:path';
import { readFile, stat, mkdir, rm } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { parseShellArgs } from '../utils/shell-args.js';
import { extractCompressedAudio, probeDurationSeconds } from '../utils/ffmpeg.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptResult, TranscriptSegment, WordTimestamp } from '../types/transcript.js';
import type { JobWorkspace } from '../types/job.js';

export type WhisperProvider = 'faster-whisper' | 'whisper-cpp' | 'whisperx' | 'openai';

export interface OpenAiWhisperOptions {
  /** OpenAI-compatible base URL (e.g. https://api.openai.com/v1). */
  baseUrl: string;
  /** API key for the endpoint. */
  apiKey: string;
  /** STT model name (default "gpt-4o-transcribe"). */
  model?: string;
  /**
   * Upload size limit in MB. Audio above this is split into sequential
   * chunks, transcribed separately, and re-stitched onto the original
   * timeline. Default 24 (the API hard cap is 25 MB).
   */
  maxUploadMb?: number;
  /** FFmpeg binary used to split oversized audio into compressed chunks. */
  ffmpegBinaryPath?: string;
}

export interface WhisperServiceOptions {
  provider: WhisperProvider;
  binaryPath: string;
  model: string;
  language: string;
  outputDir: string;
  /** Extra CLI args passed straight through to the whisper binary. */
  extraArgs?: string;
  /** OpenAI-compatible endpoint config (used only when provider === 'openai'). */
  openai?: OpenAiWhisperOptions;
}

/** Transcribes audio into a timestamped transcript. */
export interface IWhisperService {
  transcribe(audioPath: string, workspace?: Pick<JobWorkspace, 'temp'>): Promise<TranscriptResult>;
}

// ── Faster Whisper JSON shapes ──────────────────────────────────────────

interface FasterWhisperWord {
  start: number;
  end: number;
  word: string;
}

interface FasterWhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: FasterWhisperWord[];
}

interface FasterWhisperJson {
  language?: string;
  duration?: number;
  segments: FasterWhisperSegment[];
}

// ── whisper.cpp JSON shapes ─────────────────────────────────────────────

interface WhisperCppToken {
  text: string;
  offsets: { from: number; to: number };
}

interface WhisperCppSegment {
  offsets: { from: number; to: number };
  text: string;
  tokens?: WhisperCppToken[];
}

interface WhisperCppJson {
  result?: { language?: string };
  transcription: WhisperCppSegment[];
}

// ── WhisperX JSON shapes ───────────────────────────────────────────────
// WhisperX output is structurally similar to faster-whisper but adds a
// per-word alignment `score` field produced by forced alignment.

interface WhisperXWord {
  word: string;
  start: number;
  end: number;
  score: number;
}

interface WhisperXSegment {
  start: number;
  end: number;
  text: string;
  words?: WhisperXWord[];
}

interface WhisperXJson {
  segments: WhisperXSegment[];
  language?: string;
  duration?: number;
}

// ── OpenAI Audio API (transcriptions) JSON shapes ───────────────────────
// `gpt-4o-transcribe` / `whisper-1` with `response_format=verbose_json` and
// `timestamp_granularities[]=word&timestamp_granularities[]=segment`.

interface OpenAiWhisperWord {
  word: string;
  start: number;
  end: number;
}

interface OpenAiWhisperSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  words?: OpenAiWhisperWord[];
}

interface OpenAiWhisperResponse {
  language?: string;
  duration?: number;
  segments?: OpenAiWhisperSegment[];
}

/** Excludes whisper.cpp's special/control tokens (e.g. `[_BEG_]`, `[_TT_1234]`). */
function isRealWordToken(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !trimmed.startsWith('[');
}

// ── OpenAI STT oversized-audio chunking ─────────────────────────────────
// The /audio/transcriptions endpoint rejects uploads above 25 MB (HTTP 413).
const DEFAULT_MAX_UPLOAD_MB = 24;
/** MP3 bitrate used for chunk files — 64 kbps mono is plenty for STT. */
const CHUNK_BITRATE_KBPS = 64;
/** Headroom multiplier so chunks never flirt with the exact limit. */
const CHUNK_SAFETY_FACTOR = 0.9;

/**
 * Speech-to-text service. Supports three backends:
 *
 * - **faster-whisper** (default): `whisper-ctranslate2` CLI with word-level
 *   timestamps. Fast and accurate on GPU.
 * - **whisperx**: WhisperX CLI with forced alignment for more accurate
 *   word-level timestamps. Ideal when alignment precision matters.
 * - **whisper-cpp**: whisper.cpp `main`/`whisper-cli` binary. CPU-only
 *   fallback, widest hardware compatibility.
 * - **openai**: OpenAI-compatible `/v1/audio/transcriptions` API (whisper-1 /
 *   gpt-4o-transcribe) with word-level timestamps via verbose_json. Needs
 *   `openai.baseUrl` + `openai.apiKey`.
 *
 * All outputs are normalized into the application's internal
 * {@link TranscriptResult} shape.
 */
export class WhisperService implements IWhisperService {
  constructor(
    private readonly options: WhisperServiceOptions,
    private readonly logger: Logger,
  ) {}

  async transcribe(
    audioPath: string,
    workspace?: Pick<JobWorkspace, 'temp'>,
  ): Promise<TranscriptResult> {
    this.logger.info({ audioPath, provider: this.options.provider }, 'Transcribing');
    const outputDir = workspace?.temp ?? this.options.outputDir;

    try {
      switch (this.options.provider) {
        case 'whisper-cpp':
          return await this.transcribeWithWhisperCpp(audioPath, outputDir);
        case 'whisperx':
          return await this.transcribeWithWhisperX(audioPath, outputDir);
        case 'openai':
          return await this.transcribeWithOpenAI(audioPath, outputDir);
        default:
          return await this.transcribeWithFasterWhisper(audioPath, outputDir);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw AppError.whisperFailed(`Failed to transcribe audio "${audioPath}": ${detail}`, error);
    }
  }

  /**
   * Uses a Faster Whisper CLI (e.g. `whisper-ctranslate2`) with JSON output
   * and word-level timestamps enabled.
   */
  private async transcribeWithFasterWhisper(
    audioPath: string,
    outputDir: string,
  ): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;

    const args = [
      audioPath,
      '--model',
      model,
      '--output_format',
      'json',
      '--output_dir',
      outputDir,
      '--word_timestamps',
      'True',
      ...this.extraCliArgs(),
    ];
    if (language && language !== 'auto') args.push('--language', language);

    await runCommand(binaryPath, args, { logger: this.logger });

    const jsonPath = join(outputDir, `${basename(audioPath, extname(audioPath))}.json`);
    const raw = JSON.parse(await readFile(jsonPath, 'utf-8')) as FasterWhisperJson;

    const segments: TranscriptSegment[] = raw.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      words: segment.words?.map((word): WordTimestamp => ({
        word: word.word.trim(),
        start: word.start,
        end: word.end,
      })),
    }));

    return {
      language: raw.language ?? language,
      durationSeconds: raw.duration ?? segments.at(-1)?.end ?? 0,
      segments,
    };
  }

  /**
   * Uses whisper.cpp's `main`/`whisper-cli` binary with `-oj -ojf`
   * (full JSON output), which yields sentence-level segments each carrying
   * a nested `tokens` array with word-level timestamps.
   */
  private async transcribeWithWhisperCpp(
    audioPath: string,
    outputDir: string,
  ): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;
    const outputPrefix = join(outputDir, basename(audioPath, extname(audioPath)));

    const args = [
      '-m',
      model,
      '-f',
      audioPath,
      '-oj',
      '-ojf',
      '-of',
      outputPrefix,
      ...this.extraCliArgs(),
    ];
    if (language && language !== 'auto') args.push('-l', language);

    await runCommand(binaryPath, args, { logger: this.logger });

    const raw = JSON.parse(await readFile(`${outputPrefix}.json`, 'utf-8')) as WhisperCppJson;

    const segments: TranscriptSegment[] = raw.transcription.map((segment) => ({
      start: segment.offsets.from / 1000,
      end: segment.offsets.to / 1000,
      text: segment.text.trim(),
      words: segment.tokens
        ?.filter((token) => isRealWordToken(token.text))
        .map((token): WordTimestamp => ({
          word: token.text.trim(),
          start: token.offsets.from / 1000,
          end: token.offsets.to / 1000,
        })),
    }));

    return {
      language: raw.result?.language ?? language,
      durationSeconds: segments.at(-1)?.end ?? 0,
      segments,
    };
  }

  /**
   * Uses WhisperX CLI with forced alignment for more accurate word-level
   * timestamps. WhisperX's JSON output is structurally similar to faster-
   * whisper but includes per-word alignment scores.
   *
   * CLI: `whisperx audio.wav --model base --language en --output_format json`
   */
  private async transcribeWithWhisperX(
    audioPath: string,
    outputDir: string,
  ): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;

    const args = [
      audioPath,
      '--model',
      model,
      '--output_format',
      'json',
      '--output_dir',
      outputDir,
      ...this.extraCliArgs(),
    ];
    if (language && language !== 'auto') args.push('--language', language);

    await runCommand(binaryPath, args, { logger: this.logger });

    const jsonPath = join(outputDir, `${basename(audioPath, extname(audioPath))}.json`);
    const raw = JSON.parse(await readFile(jsonPath, 'utf-8')) as WhisperXJson;

    const segments: TranscriptSegment[] = raw.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      words: segment.words?.map((w): WordTimestamp => ({
        word: w.word.trim(),
        start: w.start,
        end: w.end,
      })),
    }));

    return {
      language: raw.language ?? language,
      durationSeconds: raw.duration ?? segments.at(-1)?.end ?? 0,
      segments,
    };
  }

  /**
   * Uses an OpenAI-compatible `/v1/audio/transcriptions` API (whisper-1 or
   * gpt-4o-transcribe). Requests `verbose_json` with word + segment
   * timestamp granularities so the output normalizes to the same
   * {@link TranscriptResult} shape as the local backends.
   *
   * Audio above `maxUploadMb` (default 24 MB; the API hard cap is 25 MB) is
   * split into sequential MP3 chunks via FFmpeg, transcribed chunk by
   * chunk, and re-stitched onto the original timeline by offsetting every
   * segment/word timestamp with its chunk's start time. Chunk boundaries
   * are exact (`chunk N ends where chunk N+1 begins`), so no overlap or
   * dedup is needed.
   */
  private async transcribeWithOpenAI(
    audioPath: string,
    outputDir: string,
  ): Promise<TranscriptResult> {
    const { baseUrl, apiKey } = this.options.openai ?? {};
    if (!baseUrl || !apiKey) {
      throw AppError.validation(
        'OpenAI STT requires OPENAI_WHISPER_BASE_URL and OPENAI_WHISPER_API_KEY ' +
          '(or STT via a local provider like faster-whisper).',
      );
    }

    const maxBytes = (this.options.openai?.maxUploadMb ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
    const { size } = await stat(audioPath);

    if (size <= maxBytes) {
      this.logger.info({ audioPath, sizeBytes: size }, 'Transcribing via OpenAI');
      return await this.requestOpenAiTranscription(audioPath);
    }

    if (!this.options.openai?.ffmpegBinaryPath) {
      throw AppError.internal(
        `Audio "${audioPath}" is ${(size / 1024 / 1024).toFixed(1)} MB, above the ` +
          `${(maxBytes / 1024 / 1024).toFixed(0)} MB STT upload limit, but no FFmpeg binary is ` +
          'configured to split it. Set FFMPEG_BINARY_PATH.',
      );
    }

    // ── Oversized audio: split → transcribe per chunk → re-stitch ──
    const ffmpegBinaryPath = this.options.openai.ffmpegBinaryPath;
    const totalDuration = await probeDurationSeconds({
      binaryPath: ffmpegBinaryPath,
      inputPath: audioPath,
    });
    if (totalDuration <= 0) {
      throw AppError.internal(`Could not probe duration of oversized audio "${audioPath}".`);
    }

    const stem = basename(audioPath, extname(audioPath));
    const chunkDir = join(outputDir, `stt-chunks-${stem}-${Date.now()}`);
    await mkdir(chunkDir, { recursive: true });

    // Conservative duration budget: 64 kbps mono MP3 ≈ 8 KB/s stays far
    // below the limit even after multipart overhead (~1 KB).
    const bytesPerSecond = (CHUNK_BITRATE_KBPS * 1024) / 8;
    const secondsPerChunk = Math.max(
      1,
      Math.floor((maxBytes / bytesPerSecond) * CHUNK_SAFETY_FACTOR),
    );

    const allSegments: TranscriptSegment[] = [];
    let language: string | undefined;
    let lastEnd = 0;

    for (let start = 0, index = 0; start < totalDuration; start += secondsPerChunk, index += 1) {
      const duration = Math.min(secondsPerChunk, totalDuration - start);
      const chunkPath = join(chunkDir, `chunk-${String(index).padStart(3, '0')}.mp3`);

      await extractCompressedAudio({
        binaryPath: ffmpegBinaryPath,
        inputPath: audioPath,
        outputPath: chunkPath,
        startSeconds: start,
        durationSeconds: duration,
        audioBitrateKbps: CHUNK_BITRATE_KBPS,
        logger: this.logger,
      });

      this.logger.info(
        { chunk: index + 1, startSeconds: start, durationSeconds: duration, path: chunkPath },
        'Transcribing STT chunk via OpenAI',
      );
      const chunkResult = await this.requestOpenAiTranscription(chunkPath);
      language ??= chunkResult.language;

      for (const segment of chunkResult.segments) {
        allSegments.push({
          ...segment,
          start: segment.start + start,
          end: segment.end + start,
          words: segment.words?.map((word) => ({
            ...word,
            start: word.start + start,
            end: word.end + start,
          })),
        });
        lastEnd = Math.max(lastEnd, segment.end + start);
      }
    }

    await rm(chunkDir, { recursive: true, force: true });

    return {
      language: language ?? this.options.language,
      durationSeconds: Math.max(totalDuration, lastEnd),
      segments: allSegments,
    };
  }

  /** Single upload of one audio file to `/audio/transcriptions` with graceful format degradation. */
  private async requestOpenAiTranscription(audioPath: string): Promise<TranscriptResult> {
    const { baseUrl, apiKey, model } = this.options.openai ?? {};
    if (!baseUrl || !apiKey) {
      throw AppError.validation(
        'OpenAI STT requires OPENAI_WHISPER_BASE_URL and OPENAI_WHISPER_API_KEY ' +
          '(or STT via a local provider like faster-whisper).',
      );
    }

    const audioBuffer = await readFile(audioPath);

    // Cascade: some endpoints/models reject `verbose_json` or word-level
    // granularity (e.g. whisper-1 or gateway-routed models). Degrade
    // gracefully: verbose_json+word → verbose_json → plain json.
    const attempts: { response_format: string; wordTimestamps: boolean; granularity: string[] }[] =
      [
        { response_format: 'verbose_json', wordTimestamps: true, granularity: ['word', 'segment'] },
        { response_format: 'verbose_json', wordTimestamps: false, granularity: ['segment'] },
        { response_format: 'json', wordTimestamps: false, granularity: [] },
      ];

    let lastError: unknown;
    for (const attempt of attempts) {
      const form = new FormData();
      form.append('model', model ?? 'gpt-4o-transcribe');
      form.append('file', new Blob([audioBuffer]), basename(audioPath));
      form.append('response_format', attempt.response_format);
      for (const granularity of attempt.granularity) {
        form.append('timestamp_granularities[]', granularity);
      }
      if (this.options.language && this.options.language !== 'auto') {
        form.append('language', this.options.language);
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (response.ok) {
        return this.normalizeOpenAiResponse((await response.json()) as OpenAiWhisperResponse);
      }

      lastError = new Error(
        `OpenAI STT responded with HTTP ${response.status}: ${await response.text()}`,
      );
      // Only retry on client errors that indicate an unsupported shape.
      if (response.status !== 400) break;
      this.logger.warn(
        { status: response.status, attempt },
        'OpenAI STT format rejected, degrading',
      );
    }

    throw AppError.internal('OpenAI STT failed.', lastError);
  }

  /** Normalizes an OpenAI audio/transcriptions payload into TranscriptResult. */
  private normalizeOpenAiResponse(raw: OpenAiWhisperResponse): TranscriptResult {
    const segments: TranscriptSegment[] = (raw.segments ?? []).map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      words: segment.words?.map((word): WordTimestamp => ({
        word: word.word.trim(),
        start: word.start,
        end: word.end,
      })),
    }));

    return {
      language: raw.language ?? this.options.language,
      durationSeconds: raw.duration ?? segments.at(-1)?.end ?? 0,
      segments,
    };
  }

  /** Parses `extraArgs` shell string into an array, returning `[]` when empty. */
  private extraCliArgs(): string[] {
    return parseShellArgs(this.options.extraArgs ?? '');
  }
}
