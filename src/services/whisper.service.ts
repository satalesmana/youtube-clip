import { basename, join, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptResult, TranscriptSegment, WordTimestamp } from '../types/transcript.js';

export type WhisperProvider = 'faster-whisper' | 'whisper-cpp';

export interface WhisperServiceOptions {
  provider: WhisperProvider;
  binaryPath: string;
  model: string;
  language: string;
  outputDir: string;
}

/** Transcribes audio into a timestamped transcript. */
export interface IWhisperService {
  transcribe(audioPath: string): Promise<TranscriptResult>;
}

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

/** Excludes whisper.cpp's special/control tokens (e.g. `[_BEG_]`, `[_TT_1234]`). */
function isRealWordToken(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !trimmed.startsWith('[');
}

/**
 * Speech-to-text service. Preferentially shells out to Faster Whisper, and
 * falls back to whisper.cpp when configured to do so, normalizing either
 * tool's output into the application's internal {@link TranscriptResult} shape.
 */
export class WhisperService implements IWhisperService {
  constructor(
    private readonly options: WhisperServiceOptions,
    private readonly logger: Logger,
  ) {}

  async transcribe(audioPath: string): Promise<TranscriptResult> {
    this.logger.info({ audioPath, provider: this.options.provider }, 'Transcribing');

    try {
      return this.options.provider === 'whisper-cpp'
        ? await this.transcribeWithWhisperCpp(audioPath)
        : await this.transcribeWithFasterWhisper(audioPath);
    } catch (error) {
      throw AppError.whisperFailed(`Failed to transcribe audio "${audioPath}".`, error);
    }
  }

  /**
   * Uses a Faster Whisper CLI (e.g. `whisper-ctranslate2`) with JSON output
   * and word-level timestamps enabled.
   */
  private async transcribeWithFasterWhisper(audioPath: string): Promise<TranscriptResult> {
    const { binaryPath, model, language, outputDir } = this.options;

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
  private async transcribeWithWhisperCpp(audioPath: string): Promise<TranscriptResult> {
    const { binaryPath, model, language, outputDir } = this.options;
    const outputPrefix = join(outputDir, basename(audioPath, extname(audioPath)));

    const args = ['-m', model, '-f', audioPath, '-oj', '-ojf', '-of', outputPrefix];
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
}
