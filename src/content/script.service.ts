import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { originalScriptResponseSchema } from '../schemas/script.schema.js';
import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptUserPrompt,
  buildOriginalScript,
  type ScriptContext,
} from './content.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { OriginalScript, ScriptSection } from '../types/script.js';

export interface ScriptServiceOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  /** Target language override (e.g. "id", "en"). Defaults to the moment's language. */
  targetLanguage?: string;
}

/** Generates an original editorial script from a chosen content angle. */
export interface IScriptService {
  generateScript(context: ScriptContext): Promise<OriginalScript>;
}

/**
 * LLM-driven script engine. Turns a viral moment + content angle into an
 * original short-form narration script with built-in originality rules.
 * Every LLM response is validated against a Zod schema and retried on
 * malformed output; the response also carries a self-assessed originality
 * status (PASS/WARNING/FAIL).
 */
export class ScriptService implements IScriptService {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: ScriptServiceOptions,
    private readonly logger: Logger,
  ) {}

  async generateScript(context: ScriptContext): Promise<OriginalScript> {
    return retry(
      async () => {
        this.logger.info({ candidateId: context.candidateId, angleId: context.angleId }, 'Generating script');

        const effectiveContext: ScriptContext = this.options.targetLanguage
          ? { ...context, targetLanguage: this.options.targetLanguage }
          : context;

        const raw = await this.provider.chat({
          model: this.options.model,
          system: SCRIPT_SYSTEM_PROMPT,
          prompt: buildScriptUserPrompt(effectiveContext),
          temperature: this.options.temperature,
          timeoutMs: this.options.timeoutMs,
        });

        this.logger.debug({ candidateId: context.candidateId }, 'Validating script response');
        const parsed = parseLlmJson(raw);
        const result = originalScriptResponseSchema.safeParse(parsed);

        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `Script generation returned an invalid response: ${result.error.message}`,
          );
        }

        const data = result.data;
        const sections = normalizeSections(data.sections);

        if (sections.length < 3) {
          throw AppError.llmInvalidResponse('Script response contained too few sections.');
        }

        // Basic originality smoke-check: the narration body must not be a
        // near-verbatim copy of the moment transcript.
        const transcriptText = context.momentSegments
          .map((segment) => segment.text)
          .join(' ')
          .toLowerCase();
        const narrationText = sections
          .filter((s) => s.type !== 'source')
          .map((s) => s.text)
          .join(' ')
          .toLowerCase();

        if (narrationText.length > 80 && transcriptText.length > 80) {
          const overlap = longestCommonSubstringLength(narrationText, transcriptText);
          const ratio = overlap / narrationText.length;
          if (ratio > 0.5) {
            this.logger.warn(
              { candidateId: context.candidateId, overlapRatio: ratio },
              'Script narration overlaps heavily with the source transcript',
            );
          }
        }

        const script = buildOriginalScript(
          context.candidateId,
          context.angleId,
          context.angleTitle,
          data.language,
          sections,
          data.originality,
        );

        this.logger.info(
          {
            candidateId: context.candidateId,
            sectionCount: sections.length,
            estimatedDurationSeconds: script.estimatedDurationSeconds,
            originalityStatus: data.originality.status,
          },
          'Script generated',
        );

        return script;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn(
            { candidateId: context.candidateId, attempt, err: error },
            'Retrying script generation',
          );
        },
      },
    );
  }
}

/** Ensures required section types exist, defaulting missing ones gracefully. */
function normalizeSections(sections: ScriptSection[]): ScriptSection[] {
  const required = ['hook', 'context', 'commentary', 'analysis', 'conclusion'] as const;
  const present = new Set(sections.map((section) => section.type));
  const missing = required.filter((type) => !present.has(type));

  if (missing.length > 0) {
    // The schema already requires a source section when present; missing
    // core sections make the script unusable for narration.
    throw AppError.llmInvalidResponse(
      `Script response missing required sections: ${missing.join(', ')}`,
    );
  }

  return sections;
}

/** Length of the longest common substring between two strings (plain JS). */
function longestCommonSubstringLength(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;

  // DP table; keep only two rows to stay O(min(n,m)) memory.
  const dp: number[] = new Array(m + 1).fill(0);
  let best = 0;

  for (let i = 1; i <= n; i++) {
    let prev = 0;
    for (let j = 1; j <= m; j++) {
      const current = dp[j]!;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
        if (dp[j]! > best) best = dp[j]!;
      } else {
        dp[j] = 0;
      }
      prev = current;
    }
  }

  return best;
}
