import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { hashSeed } from '../utils/seed.js';
import { hookScoringResponseSchema } from '../schemas/hook.schema.js';
import { HOOK_SCORING_SYSTEM_PROMPT, buildHookScoringUserPrompt } from './hook.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { HookCandidate, HookScore } from './hook.types.js';

export interface HookScorerOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
}

/** Scores hook candidates on the 7-metric quality card (Plan Phase 5). */
export interface IHookScorer {
  score(candidates: HookCandidate[]): Promise<HookCandidate[]>;
}

/** Metric weights from Plan §5 — must sum to 1.0. */
const SCORE_WEIGHTS = {
  curiosity: 0.2,
  retention: 0.2,
  emotional: 0.15,
  visual: 0.15,
  clarity: 0.1,
  relevance: 0.1,
  accuracy: 0.1,
} as const;

/** Computes the weighted final score from the 7 metrics. */
export function computeFinalScore(score: Omit<HookScore, 'final'>): number {
  const final =
    score.curiosity * SCORE_WEIGHTS.curiosity +
    score.retention * SCORE_WEIGHTS.retention +
    score.emotional * SCORE_WEIGHTS.emotional +
    score.visual * SCORE_WEIGHTS.visual +
    score.clarity * SCORE_WEIGHTS.clarity +
    score.relevance * SCORE_WEIGHTS.relevance +
    score.accuracy * SCORE_WEIGHTS.accuracy;
  return Math.round(final * 10) / 10;
}

/**
 * Hook scorer: one batched LLM call scores six qualitative metrics per
 * candidate; the seventh (accuracy) is carried over from the accuracy
 * guard. The weighted final score is computed deterministically here —
 * the LLM never decides the final ranking number itself.
 */
export class HookScorer implements IHookScorer {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: HookScorerOptions,
    private readonly logger: Logger,
  ) {}

  async score(candidates: HookCandidate[]): Promise<HookCandidate[]> {
    if (candidates.length === 0) return [];

    return retry(
      async () => {
        this.logger.info({ candidateCount: candidates.length }, 'Scoring hook candidates');

        const raw = await this.provider.chat({
          model: this.options.model,
          system: HOOK_SCORING_SYSTEM_PROMPT,
          prompt: buildHookScoringUserPrompt(
            candidates.map((c) => ({
              id: c.id,
              style: c.style,
              headline: c.headline.text,
              spokenHook: c.spokenHook.text,
              sourceTranscript: c.source.transcript,
              reason: c.metadata?.reason,
            })),
          ),
          temperature: Math.max(0, this.options.temperature - 0.1),
          timeoutMs: this.options.timeoutMs,
          responseFormat: 'json_object',
          seed: hashSeed('hook-score', ...candidates.map((c) => c.id)),
        });

        const parsed = parseLlmJson(raw);
        const result = hookScoringResponseSchema.safeParse(parsed);
        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `Hook scoring returned an invalid response: ${result.error.message}`,
          );
        }

        const scoreById = new Map(result.data.scores.map((s) => [s.id, s]));
        const scored: HookCandidate[] = [];

        for (const candidate of candidates) {
          const llmScore = scoreById.get(candidate.id);
          // Missing score card → neutral 50s so a partial LLM response never
          // silently drops an accepted candidate from the ranking.
          const accuracyScore = candidate.accuracy?.score ?? 50;
          const score: HookScore = {
            curiosity: llmScore?.curiosity ?? 50,
            retention: llmScore?.retention ?? 50,
            emotional: llmScore?.emotional ?? 50,
            visual: llmScore?.visual ?? 50,
            clarity: llmScore?.clarity ?? 50,
            relevance: llmScore?.relevance ?? 50,
            accuracy: accuracyScore,
            final: 0,
          };
          score.final = computeFinalScore(score);
          scored.push({ ...candidate, score });
        }

        this.logger.info({ scoredCount: scored.length }, 'Hook scoring completed');
        return scored;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn({ attempt, err: error }, 'Retrying hook scoring');
        },
      },
    );
  }
}
