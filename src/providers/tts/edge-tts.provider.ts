import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { runCommand } from '../../utils/exec.js';
import { probeDurationSeconds } from '../../utils/ffmpeg.js';
import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider } from './tts.provider.js';
import type { TTSProviderOptions } from './tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from './tts.types.js';

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

    const args = [
      '--voice', voice,
      '--rate', rate,
      '--write-media', outPath,
      '--write-subtitles', `${outPath}.vtt`,
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
      return { outputPath: outPath, durationSeconds, provider: 'edge-tts' };
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
