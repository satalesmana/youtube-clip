/** A single candidate viral clip identified by the AI model. */
export interface HighlightClip {
  start: number;
  end: number;
  score: number;
  title: string;
  reason: string;
  hook: string;
  /**
   * Timestamp (seconds) of the most intense/quotable sentence inside the clip,
   * as flagged by the LLM. Drives peak-aware duration clamping; absent when
   * the model omitted it.
   */
  peak?: number;
}
