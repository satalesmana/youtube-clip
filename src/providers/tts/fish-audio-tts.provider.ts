import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { probeDurationSeconds } from '../../utils/ffmpeg.js';
import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider, TTSProviderOptions } from './tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from './tts.types.js';

export type FishAudioFormat = 'mp3' | 'wav' | 'opus' | 'pcm16';
export type FishAudioLatency = 'normal' | 'balanced' | 'low';

export interface FishAudioTtsProviderOptions extends TTSProviderOptions {
  /** Fish Audio API key (fish.audio → API keys). */
  apiKey: string;
  /** Fish Audio base URL (default https://api.fish.audio). */
  baseUrl?: string;
  /** Fish TTS model, e.g. "s2.1-pro-free", "s2.1-pro" (default "s2.1-pro-free"). */
  model?: string;
  /** Output audio format (default "mp3"). */
  format?: FishAudioFormat;
  /** Expressiveness, 0-1 (default 0.7). Higher = more varied delivery. */
  temperature?: number;
  /** Diversity via nucleus sampling, 0-1 (default 0.7). */
  topP?: number;
  /** Prosody speed multiplier (default 1). The `rate` option ("+10%") maps here. */
  speed?: number;
  /** Prosody volume offset (default 0). */
  volume?: number;
  /** Sample rate in Hz (default 44100). */
  sampleRate?: number;
  /** Latency/quality trade-off (default "normal"). */
  latency?: FishAudioLatency;
}

const FISH_AUDIO_DEFAULT_BASE = 'https://api.fish.audio';
const FISH_AUDIO_DEFAULT_MODEL = 's2.1-pro-free';
const FORMAT_EXT: Record<FishAudioFormat, string> = {
  mp3: 'mp3',
  wav: 'wav',
  opus: 'opus',
  pcm16: 'pcm',
};

/**
 * Direct Fish Audio TTS provider (bypasses the 9Router gateway).
 *
 * POSTs to `https://api.fish.audio/v1/tts` with the full parameter surface the
 * gateway does not expose: `temperature`, `top_p`, `prosody` (speed/volume),
 * `sample_rate` and `latency`. The voice maps to `reference_id`; emotional
 * tags (`[excited]`, `[soft]`, ...) work inline in `text` on S2 models.
 *
 * The response is raw audio bytes (not JSON), written to `outputDir` with the
 * extension matching `format`.
 */
export class FishAudioTtsProvider implements ITTSProvider {
  readonly kind = 'fish-audio';

  constructor(private readonly options: FishAudioTtsProviderOptions) {}

  async synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const { text, voice, rate = this.options.rate ?? '+0%', outputPath } = request;

    if (!text.trim()) {
      throw AppError.validation('TTS request text must not be empty.');
    }

    const format = this.options.format ?? 'mp3';
    const model = this.options.model ?? FISH_AUDIO_DEFAULT_MODEL;
    const outPath =
      outputPath ??
      join(this.options.outputDir, `narration-${Date.now()}.${FORMAT_EXT[format]}`);
    const base = (this.options.baseUrl ?? FISH_AUDIO_DEFAULT_BASE).replace(/\/+$/, '');

    const body: Record<string, unknown> = {
      text,
      temperature: this.options.temperature ?? 0.7,
      top_p: this.options.topP ?? 0.7,
      prosody: {
        speed: this.options.speed ?? parseRateMultiplier(rate),
        volume: this.options.volume ?? 0,
      },
      format,
      sample_rate: this.options.sampleRate ?? 44100,
      latency: this.options.latency ?? 'normal',
      normalize: true,
    };
    const ref = voice?.trim();
    if (ref) body.reference_id = ref;

    this.options.logger.info(
      {
        provider: 'fish-audio',
        model,
        voice: ref || '(default)',
        temperature: body.temperature,
        topP: body.top_p,
        format,
        outPath,
      },
      'Synthesizing narration (Fish Audio direct)',
    );

    try {
      const response = await fetch(`${base}/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
          model,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = (await response.text()).trim();
        throw AppError.internal(
          `Fish Audio responded with HTTP ${response.status}${errText ? `: ${errText}` : ''}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outPath, Buffer.from(arrayBuffer));
      await verifyOutput(outPath);

      const durationSeconds = await probeDurationSafe(outPath, this.options.logger);
      return { outputPath: outPath, durationSeconds, provider: 'fish-audio' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(`Fish Audio TTS synthesis failed for voice "${voice}".`, error);
    }
  }
}

/** Converts "+10%" / "-5%" to the numeric prosody speed multiplier Fish Audio expects. */
function parseRateMultiplier(rate: string): number {
  const match = /([+-]?\d+(?:\.\d+)?)%/.exec(rate);
  if (!match) return 1;
  return Math.max(0.25, Math.min(4, 1 + Number(match[1]) / 100));
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
