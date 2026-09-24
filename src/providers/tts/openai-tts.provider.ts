import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { probeDurationSeconds } from '../../utils/ffmpeg.js';
import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider, TTSProviderOptions } from './tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from './tts.types.js';

export interface OpenAiTtsProviderOptions extends TTSProviderOptions {
  /** OpenAI-compatible base URL (e.g. http://127.0.0.1:20128/v1). */
  baseUrl: string;
  /** API key for the endpoint. */
  apiKey: string;
  /** TTS model name (default "fish/s2.1-pro-free"). */
  model?: string;
}

const FISH_AUDIO_BASE = 'fish/s2.1-pro-free';

/**
 * OpenAI-compatible TTS provider backed by 9Router's Fish Audio backend.
 *
 * 9Router exposes `/v1/audio/speech` and routes `fish/*` models to
 * api.fish.audio. The voice (Fish Audio `reference_id`) is NOT a separate body
 * field — 9Router derives it from the model string, so the reference id must
 * be appended after the model id:
 *
 *   "fish/s2.1-pro-free"                    -> no reference (uses default voice)
 *   "fish/s2.1-pro-free/<reference_id>"     -> uses that Fish Audio reference
 *
 * `reference_id` must match [A-Za-z0-9_-]{1,128} or Fish Audio rejects the
 * request.
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
    const model = buildFishModel(this.options.model ?? FISH_AUDIO_BASE, voice);

    this.options.logger.info(
      { provider: 'openai', model, voice, rate, outPath },
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
          model,
          input: text,
          response_format: 'mp3',
          speed: parseRate(rate),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw AppError.internal(
          `Fish Audio TTS responded with HTTP ${response.status}${body ? `: ${body}` : ''}`,
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
      throw AppError.internal(`Fish Audio TTS synthesis failed for voice "${voice}".`, error);
    }
  }
}

/**
 * Embeds the voice (Fish Audio `reference_id`) into the 9Router model string.
 * `model` may already contain a reference suffix; `voice` wins when provided
 * and is not already the suffix.
 */
function buildFishModel(model: string, voice: string | undefined): string {
  const ref = voice?.trim();
  if (!ref) return model;
  const lastSlash = model.lastIndexOf('/');
  if (lastSlash >= 0 && model.slice(lastSlash + 1) === ref) return model;
  return `${model}/${ref}`;
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
    throw AppError.internal('Fish Audio TTS produced an empty output file.');
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
