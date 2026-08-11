import { basename, join, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { parseShellArgs } from '../utils/shell-args.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptResult, TranscriptSegment, WordTimestamp } from '../types/transcript.js';
import type { JobWorkspace } from '../types/job.js';

export type WhisperProvider = 'faster-whisper' | 'whisper-cpp' | 'whisperx';

export interface WhisperServiceOptions {
  provider: WhisperProvider;
  binaryPath: string;
  model: string;
  language: string;
  outputDir: string;
  /** Extra CLI args passed straight through to the whisper binary. */
  extraArgs?: string;
}

/** Transcribes audio into a timestamped transcript. */
export interface IWhisperService {
  transcribe(
    audioPath: string,
    workspace?: Pick<JobWorkspace, 'temp'>,
  ): Promise<TranscriptResult>;
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

/** Excludes whisper.cpp's special/control tokens (e.g. `[_BEG_]`, `[_TT_1234]`). */
function isRealWordToken(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !trimmed.startsWith('[');
}

/**
 * Speech-to-text service. Supports three backends:
 *
 * - **faster-whisper** (default): `whisper-ctranslate2` CLI with word-level
 *   timestamps. Fast and accurate on GPU.
 * - **whisperx**: WhisperX CLI with forced alignment for more accurate
 *   word-level timestamps. Ideal when alignment precision matters.
 * - **whisper-cpp**: whisper.cpp `main`/`whisper-cli` binary. CPU-only
 *   fallback, widest hardware compatibility.
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
        default:
          return await this.transcribeWithFasterWhisper(audioPath, outputDir);
      }
    } catch (error) {
      throw AppError.whisperFailed(`Failed to transcribe audio "${audioPath}".`, error);
    }
  }

  /**
   * Uses a Faster Whisper CLI (e.g. `whisper-ctranslate2`) with JSON output
   * and word-level timestamps enabled.
   */
  private async transcribeWithFasterWhisper(audioPath: string, outputDir: string): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;

    const args = [
      audioPath,
      '--model', model,
      '--output_format', 'json',
      '--output_dir', outputDir,
      '--word_timestamps', 'True',
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
      words: segment.words?.map(
        (word): WordTimestamp => ({ word: word.word.trim(), start: word.start, end: word.end }),
      ),
    }));

    return {
      language: raw.language ?? language,
      durationSeconds: raw.duration ?? (segments.at(-1)?.end ?? 0),
      segments,
    };
  }

  /**
   * Uses whisper.cpp's `main`/`whisper-cli` binary with `-oj -ojf`
   * (full JSON output), which yields sentence-level segments each carrying
   * a nested `tokens` array with word-level timestamps.
   */
  private async transcribeWithWhisperCpp(audioPath: string, outputDir: string): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;
    const outputPrefix = join(outputDir, basename(audioPath, extname(audioPath)));

    const args = ['-m', model, '-f', audioPath, '-oj', '-ojf', '-of', outputPrefix,
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
        .map(
          (token): WordTimestamp => ({
            word: token.text.trim(),
            start: token.offsets.from / 1000,
            end: token.offsets.to / 1000,
          }),
        ),
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
  private async transcribeWithWhisperX(audioPath: string, outputDir: string): Promise<TranscriptResult> {
    const { binaryPath, model, language } = this.options;

    const args = [
      audioPath,
      '--model', model,
      '--output_format', 'json',
      '--output_dir', outputDir,
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
      words: segment.words?.map(
        (w): WordTimestamp => ({ word: w.word.trim(), start: w.start, end: w.end }),
      ),
    }));

    return {
      language: raw.language ?? language,
      durationSeconds: raw.duration ?? (segments.at(-1)?.end ?? 0),
      segments,
    };
  }

  /** Parses `extraArgs` shell string into an array, returning `[]` when empty. */
  private extraCliArgs(): string[] {
    return parseShellArgs(this.options.extraArgs ?? '');
  }
}
