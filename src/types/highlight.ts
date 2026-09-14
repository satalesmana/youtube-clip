/** Detailed dimensional breakdown of virality potential. */
export interface ViralityScoreBreakdown {
  /** Overall aggregated virality score (0-100). */
  overall: number;
  /** Impact of opening 3 seconds (0-100). */
  hookStrength: number;
  /** Pacing, speech rate, and conversational flow (0-100). */
  engagementFlow: number;
  /** Alignment with trending themes and popular search queries (0-100). */
  trendRelevance: number;
  /** Comprehensibility without watching the full video (0-100). */
  standaloneValue: number;
  /** Key strengths and viral retention triggers. */
  reasons: string[];
}

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
  /** Detailed multi-dimensional breakdown (OpusClip benchmark). */
  virality?: ViralityScoreBreakdown;
}
