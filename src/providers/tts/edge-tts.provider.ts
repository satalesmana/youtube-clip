import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { runCommand } from '../../utils/exec.js';
import { probeDurationSeconds } from '../../utils/ffmpeg.js';
import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider } from './tts.provider.js';
import type { TTSProviderOptions } from './tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult, TTSWordTiming } from './tts.types.js';

export interface EdgeTtsProviderOptions extends TTSProviderOptions {
  /** Path to the `edge-tts` binary or CLI (bare name resolves via PATH). */
  binaryPath?: string;
}

export class EdgeTtsProvider implements ITTSProvider {
  readonly kind = 'edge-tts';

  constructor(private readonly options: EdgeTtsProviderOptions) {}

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const { text, voice, rate = this.options.rate ?? '+0%', outputPath, language } = request;

    if (!text.trim()) {
      throw AppError.validation('TTS request text must not be empty.');
    }

    const outPath = outputPath ?? join(this.options.outputDir, `narration-${Date.now()}.mp3`);
    const vttPath = `${outPath}.vtt`;

    const args = [
      '--voice', voice,
      '--rate', rate,
      '--write-media', outPath,
      '--write-subtitles', vttPath,
      '--text', stripControlChars(text),
    ];
    if (language) args.push('--lang', language);

    this.options.logger.info({ provider: 'edge-tts', voice, rate, outPath }, 'Synthesizing narration');

    try {
      await runCommand(this.options.binaryPath ?? 'edge-tts', args, {
        logger: this.options.logger,
      });
      await verifyOutput(outPath);
      const durationSeconds = await probeDurationSafe(outPath, this.options.logger);
      const wordTimings = await parseVttWordTimingsSafe(vttPath, this.options.logger);
      return {
        outputPath: outPath,
        durationSeconds,
        provider: 'edge-tts',
        wordTimings,
      };
    } catch (error) {
      throw AppError.internal(`Edge TTS synthesis failed for voice "${voice}".`, error);
    }
  }
}

function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

async function verifyOutput(outPath: string): Promise<void> {
  const info = await stat(outPath);
  if (!info.isFile() || info.size === 0) {
    throw AppError.internal('Edge TTS produced an empty output file.');
  }
}

async function probeDurationSafe(outPath: string, logger: Logger): Promise<number> {
  try {
    return await probeDurationSeconds({ binaryPath: 'ffmpeg', inputPath: outPath });
  } catch (error) {
    logger.warn({ err: error }, 'Could not probe narration duration');
    return 0;
  }
}

/**
 * edge-tts `--write-subtitles` emits one WebVTT cue per spoken word (word
 * boundary events). Parses them into word timings; never throws so missing or
 * malformed subtitle files degrade to no-timings instead of failing the job.
 */
async function parseVttWordTimingsSafe(
  vttPath: string,
  logger: Logger,
): Promise<TTSWordTiming[]> {
  try {
    const content = await readFile(vttPath, 'utf8');
    return parseVttWordTimings(content);
  } catch (error) {
    logger.warn({ err: error, vttPath }, 'Could not parse narration word timings');
    return [];
  }
}

function parseVttWordTimings(content: string): TTSWordTiming[] {
  const timings: TTSWordTiming[] = [];
  for (const block of content.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    const timeLine = lines.find((line) => line.includes('-->'));
    if (!timeLine) continue;
    const textLine = lines
      .filter((line) => line && line !== timeLine && !/^WEBVTT/i.test(line))
      .join(' ')
      .trim();
    if (!textLine) continue;
    const parts = timeLine.split('-->');
    const from = parts[0] !== undefined ? parseVttTime(parts[0]) : null;
    const to = parts[1] !== undefined ? parseVttTime(parts[1]) : null;
    if (from == null || to == null || to <= from) continue;
    timings.push({ word: textLine, start: from, end: to });
  }
  return timings;
}

/** Parses "HH:MM:SS.mmm" (hours optional) into seconds. */
function parseVttTime(raw: string): number | null {
  const match = /(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)/.exec(raw.trim());
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}
