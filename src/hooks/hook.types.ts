/**
 * Hook Recommendation Engine — unified hook model (Plan M1).
 *
 * `HookCandidate` unifies the outputs of the three existing pipeline stages
 * (angle generation, story beat / hook moment detection, script generation)
 * into a single entity that the engine can validate, score, and rank.
 *
 * Separation of concerns (Plan §23):
 * - LLM decides WHAT (angles, hooks, source moments)
 * - Hook Engine decides WHICH (validate, score, rank)
 * - Remotion decides HOW TO SHOW (layout, animation, rendering)
 */

/** Hook presentation style. The MVP set is the first four. */
export type HookStyle =
  | 'curiosity'
  | 'controversial'
  | 'question'
  | 'shock'
  | 'contrarian'
  | 'prediction'
  | 'story'
  | 'statistic'
  | 'fear'
  | 'opportunity';

/** Styles requested by default (Plan §5 MVP). */
export const MVP_HOOK_STYLES: HookStyle[] = [
  'curiosity',
  'controversial',
  'question',
  'shock',
];

/**
 * Objective quality metrics for one candidate (Plan §5).
 * Every metric is 0-100; `final` is the weighted sum:
 *   curiosity×0.20 + retention×0.20 + emotional×0.15 + visual×0.15
 *   + clarity×0.10 + relevance×0.10 + accuracy×0.10
 */
export interface HookScore {
  curiosity: number;
  retention: number;
  emotional: number;
  visual: number;
  clarity: number;
  relevance: number;
  /** Injected from the accuracy guard, not scored by the scorer LLM. */
  accuracy: number;
  final: number;
}

/** Verdict of the accuracy guard for one candidate (Plan §4). */
export interface AccuracyResult {
  /** 0-100 — how well the hook is supported by the source evidence. */
  score: number;
  /** False → the hook is misleading/clickbait and must be rejected. */
  supported: boolean;
  /** 0-100 confidence of the evaluation itself. */
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  explanation: string;
}

/** The unified hook entity produced by the candidate generation stage. */
export interface HookCandidate {
  id: string;

  /** The editorial angle this candidate was derived from. */
  angle: {
    /** Id of the source angle (traceability back to angle generation). */
    id: string;
    type: string;
    title: string;
    description: string;
  };

  /** Presentation style of this hook variant. */
  style: HookStyle;

  /** Best source footage for this hook (absolute seconds in the source video). */
  source: {
    start: number;
    end: number;
    /** Verbatim transcript text covering the source range. */
    transcript: string;
  };

  /** On-screen kinetic headline (from story.suggestedLine in the legacy path). */
  headline: {
    text: string;
    /** Visual treatment hint for the rendering engine (e.g. "kinetic"). */
    style: string;
    /** Category tag pill (e.g. "🔥 MOMEN VIRAL", "⚡ DETIK KRUSIAL"). */
    tag?: string;
    /** Words inside the headline to highlight in accent color. */
    highlightWords?: string[];
  };

  /**
   * Playable preview of `source`, rendered by the API layer after ranking.
   * Optional: absent when previews are disabled or the render failed.
   */
  previewUrl?: string;

  /**
   * Duration in seconds of the styled final preview (`previewUrl`) when it
   * was rendered clipper-style (HookIntroShort). Absent for raw-cut previews
   * and for cached results saved before styled previews existed.
   */
  finalDurationSeconds?: number;

  /** Spoken opening line (from script hook / angle hook in the legacy path). */
  spokenHook: {
    text: string;
    /** Estimated spoken duration in seconds. */
    duration: number;
  };

  /** Filled by the scoring stage. */
  score?: HookScore;

  /** Filled by the accuracy guard. */
  accuracy?: AccuracyResult;

  /** Editorial metadata explaining why this hook should perform. */
  metadata?: {
    emotion: string;
    topic: string;
    reason: string;
  };
}

/** A scored, ranked hook ready for preview/selection (Plan §6 output). */
export interface RankedHook extends HookCandidate {
  /** 1-based position in the recommendation list. */
  rank: number;
  /** Final score after the diversity penalty — drives the ordering. */
  rankScore: number;
  /**
   * Absolute server path of the styled final intro video (`final-hook-NN.mp4`
   * under outputs/{videoId}/hook-previews/). Present only when the styled
   * preview rendered successfully; the reel uses this file as its intro.
   */
  previewPath?: string;
}

/** Full result of one hook recommendation run. */
export interface HookRecommendationResult {
  videoId: string;
  /** Top hooks (max 5), best first. */
  hooks: RankedHook[];
  /** How many candidates were generated before filtering. */
  candidateCount: number;
  /** How many candidates the accuracy guard rejected. */
  rejectedCount: number;
  /** How many candidates were dropped as semantic duplicates. */
  duplicateCount: number;
  generatedAt: string;
}
