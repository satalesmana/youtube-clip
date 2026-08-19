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

/** One spoken word with its boundaries on the narration timeline (seconds). */
export interface TTSWordTiming {
  word: string;
  /** Start offset in seconds (relative to the owning audio file). */
  start: number;
  /** End offset in seconds (relative to the owning audio file). */
  end: number;
}

/** Timing info for one synthesized script section, mapped onto the combined narration. */
export interface TTSSectionTiming {
  /** Script section type, e.g. "hook", "commentary". */
  type: string;
  /** Measured duration of this section's audio in seconds. */
  durationSeconds: number;
  /** Word boundaries on the COMBINED narration timeline (already offset). */
  wordTimings: TTSWordTiming[];
}

export interface TTSSynthesisResult {
  /** Absolute or project-relative path to the synthesized audio file. */
  outputPath: string;
  /** Measured duration of the audio in seconds (0 when unknown). */
  durationSeconds: number;
  /** Provider identifier, for logging/debugging. */
  provider: string;
  /** Word boundaries relative to this audio file, when the provider exposes them. */
  wordTimings?: TTSWordTiming[];
  /**
   * Per-section timing on the combined narration timeline. Present when the
   * provider can expose word boundaries (e.g. edge-tts VTT); drives accurate
   * caption/word-highlight sync in the composition.
   */
  sections?: TTSSectionTiming[];
}
