/** A single word with its own timing, as produced by word-level Whisper timestamps. */
export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

/** A single transcribed segment (roughly a sentence or utterance). */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

/** Full transcription result for one video, as produced by the speech-to-text service. */
export interface TranscriptResult {
  language: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
}

/** Persisted transcript document, as stored under `outputs/{videoId}/transcripts/`. */
export interface TranscriptDocument extends TranscriptResult {
  videoId: string;
  sourceUrl: string;
  createdAt: string;
}

/**
 * A contiguous slice of the transcript sized to fit within an LLM context window,
 * with a small overlap into the previous chunk to preserve narrative continuity.
 */
export interface TranscriptChunk {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  segments: TranscriptSegment[];
  approxTokens: number;
}
