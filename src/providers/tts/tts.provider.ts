import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from './tts.types.js';

/**
 * A text-to-speech backend. Each implementation synthesizes narration audio
 * from script text and reports the resulting file path + measured duration.
 */
export interface ITTSProvider {
  readonly kind: string;
  synthesize(request: TTSSynthesisRequest): Promise<TTSSynthesisResult>;
}

/** Options shared by every TTS provider implementation. */
export interface TTSProviderOptions {
  /** Output directory for generated narration audio files. */
  outputDir: string;
  /** Speaking rate adjustment, e.g. "+10%" (provider-dependent). */
  rate?: string;
  logger: Logger;
}

/**
 * Normalizes the failure modes of every provider into a single AppError code
 * so the TTS facade (and callers) never need to know which backend failed.
 */
export function ttsError(message: string, cause?: unknown): AppError {
  return AppError.internal(`TTS synthesis failed: ${message}`, cause);
}
