import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { probeDurationSeconds } from '../../utils/ffmpeg.js';
import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider, TTSProviderOptions } from './tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from './tts.types.js';

export interface OpenAiTtsProviderOptions extends TTSProviderOptions {
  /** OpenAI-compatible base URL (e.g. https://api.openai.com/v1). */
  baseUrl: string;
  /** API key for the endpoint. */
  apiKey: string;
  /** TTS model name (default "tts-1"). */
  model?: string;
}

/**
 * OpenAI-compatible TTS provider (speech endpoint). Supports any server
 * exposing the OpenAI `/v1/audio/speech` API (OpenAI, Azure, local gateways).
 */
export class OpenAiTtsProvider implements ITTSProvider {
  readonly kind = 'openai';

  constructor(private readonly options: OpenAiTtsProviderOptions) {}

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const { text, voice, rate = this.options.rate ?? '+0%', outputPath } = request;

    if (!text.trim()) {
      throw AppError.validation('TTS request text must not be empty.');
    }

    const outPath = outputPath ?? join(this.options.outputDir, `narration-${Date.now()}.mp3`);

    this.options.logger.info(
      { provider: 'openai', model: this.options.model ?? 'tts-1', voice, rate, outPath },
      'Synthesizing narration',
    );

    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model: this.options.model ?? 'tts-1',
          input: text,
          voice,
          response_format: 'mp3',
          speed: parseRate(rate),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw AppError.internal(
          `OpenAI TTS responded with HTTP ${response.status}${body ? `: ${body}` : ''}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outPath, Buffer.from(arrayBuffer));
      await verifyOutput(outPath);

      const durationSeconds = await probeDurationSafe(outPath, this.options.logger);
      return { outputPath: outPath, durationSeconds, provider: 'openai' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(`OpenAI TTS synthesis failed for voice "${voice}".`, error);
    }
  }
}

/** Converts "+10%" / "-5%" to a numeric multiplier OpenAI understands. */
function parseRate(rate: string): number {
  const match = /([+-]?\d+(?:\.\d+)?)%/.exec(rate);
  if (!match) return 1;
  return 1 + Number(match[1]) / 100;
}

async function verifyOutput(outPath: string): Promise<void> {
  const info = await stat(outPath);
  if (!info.isFile() || info.size === 0) {
    throw AppError.internal('OpenAI TTS produced an empty output file.');
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
