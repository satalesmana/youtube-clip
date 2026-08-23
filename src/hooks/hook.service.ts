import type { Logger } from '../utils/logger.js';
import type { ContentAngle } from '../types/angle.js';
import type { SourceStory } from '../types/story.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { HookGenerationContext } from './hook.prompt.js';
import type { IHookGenerator } from './hook.generator.js';
import type { IHookEvaluator } from './hook.evaluator.js';
import type { IHookScorer } from './hook.scorer.js';
import type { IHookRanker } from './hook.ranker.js';
import type { HookCandidate, HookRecommendationResult, HookStyle } from './hook.types.js';
import { MVP_HOOK_STYLES } from './hook.types.js';

export interface HookServiceOptions {
  /** Preferred source-clip duration window (Plan §3: ideal 1.5-5s). */
  durationMin?: number;
  durationMax?: number;
  /** How many hooks to recommend (default 5). */
  topN?: number;
}

/** Input for one hook recommendation run. */
export interface HookRecommendationInput {
  videoId: string;
  sourceTitle: string;
  /** Angles from the existing angle-generation stage. */
  angles: ContentAngle[];
  /** Story beats + hook moment from the existing story stage (optional). */
  story?: SourceStory;
  /** Transcript segments with timestamps. */
  segments: TranscriptSegment[];
  /** Requested hook styles (defaults to the MVP four). */
  styles?: HookStyle[];
  /** Target language for the hooks (e.g. "id", "en"). */
  language?: string;
  /** Per-request source-clip duration override (seconds). */
  duration?: { min?: number; max?: number };
}

/** Runs the full hook recommendation pipeline for one video. */
export interface IHookService {
  recommend(input: HookRecommendationInput): Promise<HookRecommendationResult>;
}

/**
 * Hook Recommendation Engine orchestrator (Plan §23 "Hook Engine — decides
 * WHICH"). Chains the four engine stages over material produced by the
 * existing editorial pipeline:
 *
 *   angles + story + transcript
 *     → generate 10-15 candidates   (LLM decides WHAT)
 *     → accuracy guard              (reject misleading/clickbait)
 *     → score (7 metrics)           (objective quality card)
 *     → rank with diversity penalty (Top-N)
 *
 * The existing angle/story/script services are untouched — this engine
 * consumes their outputs.
 */
export class HookService implements IHookService {
  constructor(
    private readonly generator: IHookGenerator,
    private readonly evaluator: IHookEvaluator,
    private readonly scorer: IHookScorer,
    private readonly ranker: IHookRanker,
    private readonly options: HookServiceOptions,
    private readonly logger: Logger,
  ) {}

  async recommend(input: HookRecommendationInput): Promise<HookRecommendationResult> {
    const styles = input.styles?.length ? input.styles : MVP_HOOK_STYLES;
    const startedAt = Date.now();

    this.logger.info(
      { videoId: input.videoId, styles, angleCount: input.angles.length },
      'Hook recommendation started',
    );

    // Stage 1: generate 10-15 candidates across angles × styles.
    const context: HookGenerationContext = {
      videoId: input.videoId,
      sourceTitle: input.sourceTitle,
      angles: input.angles,
      story: input.story,
      segments: input.segments,
      styles,
      language: input.language,
      durationMin: input.duration?.min ?? this.options.durationMin ?? 1.5,
      durationMax: input.duration?.max ?? this.options.durationMax ?? 5,
    };
    const candidates = await this.generator.generate(context);

    // Stage 2: accuracy guard — reject hooks the source can't support.
    const { accepted, rejected } = await this.evaluator.guard(candidates, input.segments);

    // Stage 3: score the survivors on the 7-metric quality card.
    const scored = await this.scorer.score(accepted);

    // Stage 4: rank with duplicate removal + diversity penalty → Top-N.
    const { ranked, duplicateCount } = this.ranker.rank(scored);

    const result: HookRecommendationResult = {
      videoId: input.videoId,
      hooks: ranked,
      candidateCount: candidates.length,
      rejectedCount: rejected.length,
      duplicateCount,
      generatedAt: new Date().toISOString(),
    };

    this.logger.info(
      {
        videoId: input.videoId,
        candidateCount: candidates.length,
        rejectedCount: rejected.length,
        duplicateCount,
        topCount: ranked.length,
        durationMs: Date.now() - startedAt,
      },
      'Hook recommendation completed',
    );

    return result;
  }
}

/** Re-exported for the controller layer that persists intermediate output. */
export type { HookCandidate };
