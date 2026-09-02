import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { hashSeed } from '../utils/seed.js';
import { originalScriptResponseSchema } from '../schemas/script.schema.js';
import {
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  buildOriginalScript,
  type ScriptContext,
} from './content.prompt.js';
import { mapBeatRoleToSectionType } from '../types/story.js';
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
          system: buildScriptSystemPrompt(effectiveContext.targetDurationSeconds ?? 60, effectiveContext.genre),
          prompt: buildScriptUserPrompt(effectiveContext),
          temperature: this.options.temperature ?? 0.1,
          timeoutMs: this.options.timeoutMs,
          responseFormat: 'json_object',
          // Deterministic output: same moment + angle + language → same script.
          seed: hashSeed(
            'script',
            effectiveContext.sourceTitle,
            effectiveContext.candidateId,
            effectiveContext.angleId,
            effectiveContext.angleTitle,
            effectiveContext.targetLanguage,
            ...effectiveContext.momentSegments.map((segment) => `${segment.start}|${segment.end}|${segment.text}`),
          ),
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
        enforceFixedHook(sections, context);
        validateTranscriptGrounding(sections, context, this.logger);
        attachStorySources(sections, context, this.logger);

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

function attachStorySources(sections: ScriptSection[], context: ScriptContext, logger?: Logger): void {
  if (!context.story) return;
  const beats = new Map(context.story.beats.map((beat) => [beat.id, beat]));
  for (const section of sections) {
    // Hook section doesn't need a beat reference — it's just an attention-grabber
    if (section.type === 'hook') continue;
    // Allow sections without beatId (LLM may omit it for non-beat-mapped sections)
    if (!section.beatId) continue;
    const beat = beats.get(section.beatId);
    if (!beat) {
      logger?.debug({ beatId: section.beatId }, 'Script section references unknown story beat; skipping source link');
      continue;
    }
    // Map story beat role to script section type for validation
    const mappedSectionType = mapBeatRoleToSectionType(beat.role);
    if (mappedSectionType !== section.type) {
      logger?.debug({ beatId: section.beatId, role: beat.role, sectionType: section.type }, 'Story beat role does not strictly match section type; skipping strict mapping');
      continue;
    }
    section.source = { start: beat.start, end: beat.end };
    if (!section.evidence?.length) section.evidence = beat.evidence;
  }
}

/** Rejects generic drafts whose claimed evidence is absent from the supplied transcript. */
function validateTranscriptGrounding(sections: ScriptSection[], context: ScriptContext, logger?: Logger): void {
  const isCrossLingual = Boolean(
    context.targetLanguage &&
    context.sourceLanguage &&
    context.targetLanguage.toLowerCase() !== context.sourceLanguage.toLowerCase(),
  );

  const transcript = [...context.momentSegments, ...(context.contextSegments ?? [])]
    .map((segment) => normalizeForMatch(segment.text))
    .join(' ');
  const groundedTypes = new Set(['context', 'source', 'commentary', 'analysis', 'supporting']);
  const evidenceUsed = new Set<string>();

  for (const section of sections) {
    if (!groundedTypes.has(section.type)) continue;
    const evidence = section.evidence ?? [];
    if (evidence.length === 0 && !isCrossLingual) {
      throw AppError.llmInvalidResponse(`Script section "${section.type}" is missing transcript evidence.`);
    }
    for (const quote of evidence) {
      const normalizedQuote = normalizeForMatch(quote);
      if (!transcript.includes(normalizedQuote)) {
        if (isCrossLingual) {
          logger?.debug({ quote, sectionType: section.type }, 'Evidence quote in cross-lingual mode differs from source transcript');
        } else {
          throw AppError.llmInvalidResponse(
            `Script section "${section.type}" contains evidence not found in the supplied transcript.`,
          );
        }
      } else {
        evidenceUsed.add(normalizedQuote);
      }
    }
  }

  const source = sections.find((section) => section.type === 'source');
  if (source?.sourceQuote && !transcript.includes(normalizeForMatch(source.sourceQuote))) {
    if (isCrossLingual) {
      logger?.debug({ sourceQuote: source.sourceQuote }, 'Source quote in cross-lingual mode translated or adapted');
    } else {
      throw AppError.llmInvalidResponse('The source section must include a verbatim sourceQuote from the transcript.');
    }
  }
  // Note: source.text should naturally include sourceQuote, but we don't enforce
  // strict inclusion here to avoid false negatives from minor formatting differences.
  if (logger && source?.text && source?.sourceQuote && !normalizeForMatch(source.text).includes(normalizeForMatch(source.sourceQuote))) {
    logger.warn({ sourceQuote: source.sourceQuote }, 'Source section text does not include sourceQuote verbatim — TTS narration may be less specific');
  }
  if (!isCrossLingual && evidenceUsed.size < 2) {
    throw AppError.llmInvalidResponse('Script must use at least two distinct transcript details as evidence.');
  }
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
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

/**
 * When the user selected a recommended hook, the "hook" section must carry
 * that exact text — the LLM only writes the rest of the script around it.
 * Applied after validation so the fixed hook is never lost to LLM drift.
 * No-op when no hook was selected (existing behaviour).
 */
function enforceFixedHook(sections: ScriptSection[], context: ScriptContext): void {
  const fixedHook = context.fixedHook?.trim();
  if (!fixedHook) return;
  const hook = sections.find((section) => section.type === 'hook');
  if (!hook) {
    sections.unshift({ type: 'hook', text: fixedHook });
    return;
  }
  // When targetLanguage is specified and differs from sourceLanguage, preserve the LLM's
  // translated/adapted hook text instead of overwriting it with the original language string.
  const isCrossLingual = Boolean(
    context.targetLanguage &&
    context.sourceLanguage &&
    context.targetLanguage.toLowerCase() !== context.sourceLanguage.toLowerCase(),
  );
  if (!isCrossLingual || !hook.text?.trim()) {
    hook.text = fixedHook;
  }
  // A user-selected hook is not a verbatim source quote — drop stale
  // grounding metadata that no longer matches the replaced text.
  delete hook.beatId;
  delete hook.evidence;
  delete hook.sourceQuote;
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
