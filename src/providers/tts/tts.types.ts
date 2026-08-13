/** Shared TTS request/result shapes used by every provider implementation. */

export interface TTSSynthesisRequest {
  /** The narration text to synthesize. */
  text: string;
  /** Provider-specific voice identifier (e.g. "id-ID-ArdiNeural"). */
  voice: string;
  /** Optional speaking-rate adjustment (e.g. "+10%"). */
  rate?: string;
  /** Optional output file path; providers default to their own naming. */
  outputPath?: string;
  /** Optional language hint (e.g. "id", "en"). */
  language?: string;
}

export interface TTSSynthesisResult {
  /** Absolute or project-relative path to the synthesized audio file. */
  outputPath: string;
  /** Measured duration of the audio in seconds (0 when unknown). */
  durationSeconds: number;
  /** Provider identifier, for logging/debugging. */
  provider: string;
}
