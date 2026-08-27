import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { hashSeed } from '../utils/seed.js';
import { hookAccuracyResponseSchema } from '../schemas/hook.schema.js';
import {
  HOOK_ACCURACY_SYSTEM_PROMPT,
  buildHookAccuracyUserPrompt,
} from './hook.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { AccuracyResult, HookCandidate } from './hook.types.js';

export interface HookEvaluatorOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  /**
   * Candidates with risk === "high" are always rejected. When true,
   * "medium" risk candidates are rejected as well (stricter guard).
   */
  rejectMediumRisk?: boolean;
}

/** Result of running the accuracy guard over a candidate batch. */
export interface AccuracyGuardResult {
  /** Candidates that passed the guard (supported + acceptable risk). */
  accepted: HookCandidate[];
  /** Candidates rejected as misleading/clickbait. */
  rejected: HookCandidate[];
}

/** Validates hook candidates against the source transcript (Plan Phase 4). */
export interface IHookEvaluator {
  guard(candidates: HookCandidate[], segments: TranscriptSegment[]): Promise<AccuracyGuardResult>;
}

/**
 * Accuracy guard: one batched LLM call verifies every candidate against the
 * source transcript. Unsupported or high-risk hooks are rejected so the
 * recommendation list never contains clickbait the source can't back up.
 */
export class HookEvaluator implements IHookEvaluator {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: HookEvaluatorOptions,
    private readonly logger: Logger,
  ) {}

  async guard(
    candidates: HookCandidate[],
    segments: TranscriptSegment[],
  ): Promise<AccuracyGuardResult> {
    if (candidates.length === 0) return { accepted: [], rejected: [] };

    return retry(
      async () => {
        this.logger.info({ candidateCount: candidates.length }, 'Running accuracy guard');

        const fullTranscript = segments
          .map((s) => `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`)
          .join('\n');

        const raw = await this.provider.chat({
          model: this.options.model,
          system: HOOK_ACCURACY_SYSTEM_PROMPT,
          prompt: buildHookAccuracyUserPrompt(
            candidates.map((c) => ({
              id: c.id,
              headline: c.headline.text,
              spokenHook: c.spokenHook.text,
              sourceTranscript: c.source.transcript,
            })),
            fullTranscript,
          ),
          // Fact-checking must be conservative.
          temperature: Math.max(0, this.options.temperature - 0.2),
          timeoutMs: this.options.timeoutMs,
          seed: hashSeed('hook-accuracy', ...candidates.map((c) => c.id)),
        });

        const parsed = parseLlmJson(raw);
        const result = hookAccuracyResponseSchema.safeParse(parsed);
        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `Accuracy guard returned an invalid response: ${result.error.message}`,
          );
        }

        const verdicts = new Map(result.data.results.map((r) => [r.id, r]));
        const accepted: HookCandidate[] = [];
        const rejected: HookCandidate[] = [];

        for (const candidate of candidates) {
          const verdict = verdicts.get(candidate.id);

          // Missing verdict → treat as unsupported (fail closed).
          const accuracy: AccuracyResult = verdict
            ? {
                score: verdict.score,
                supported: verdict.supported,
                confidence: verdict.confidence,
                risk: verdict.risk,
                explanation: verdict.explanation,
              }
            : {
                score: 0,
                supported: false,
                confidence: 0,
                risk: 'high',
                explanation: 'Accuracy guard returned no verdict for this candidate.',
              };

          const enriched: HookCandidate = { ...candidate, accuracy };

          const rejectMedium = this.options.rejectMediumRisk ?? false;
          const acceptable =
            accuracy.supported &&
            (accuracy.risk === 'low' || (accuracy.risk === 'medium' && !rejectMedium));

          if (acceptable) {
            accepted.push(enriched);
          } else {
            this.logger.info(
              { hookId: candidate.id, risk: accuracy.risk, explanation: accuracy.explanation },
              'Hook candidate rejected by accuracy guard',
            );
            rejected.push(enriched);
          }
        }

        this.logger.info(
          { accepted: accepted.length, rejected: rejected.length },
          'Accuracy guard completed',
        );
        return { accepted, rejected };
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn({ attempt, err: error }, 'Retrying accuracy guard');
        },
      },
    );
  }
}
