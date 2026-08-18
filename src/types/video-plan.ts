/** Video plan types for the AI Viral Content Transformer pipeline. */

/** Scene types in a generated short-form video plan. */
export type SceneType =
  | 'hook'
  | 'context'
  | 'source'
  | 'commentary'
  | 'analysis'
  | 'supporting'
  | 'conclusion';

/** One scene of the planned video. */
export interface PlanScene {
  type: SceneType;
  /** Planned start offset in the final video (seconds). */
  start: number;
  /** Planned end offset in the final video (seconds). */
  end: number;
  /** The narration text that plays during this scene. */
  narration: string;
  /** For source scenes: the trim range into the source video. */
  source?: { start: number; end: number };
  /** Visual hint for composition engines (e.g. "speaker", "b-roll", "graphic"). */
  visual?: string;
}

/** A caption event with word-level timing for the composition engines. */
export interface PlanCaption {
  start: number;
  end: number;
  text: string;
  /** Words to emphasize (keyword highlighting). */
  highlightWords?: string[];
}

/** The complete scene plan for one short-form video. */
export interface VideoPlan {
  candidateId: string;
  angleId: string;
  /** Total planned duration in seconds. */
  duration: number;
  scenes: PlanScene[];
  captions: PlanCaption[];
  audio: {
    /** Path to the narration audio file (if synthesized). */
    narration?: string;
    /** Whether the source audio should be underlaid under narration. */
    sourceUnderlay: boolean;
    /** Whether to duck source audio under narration (future). */
    ducking: boolean;
  };
}
