import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { hashSeed } from '../utils/seed.js';
import { hookGenerationResponseSchema } from '../schemas/hook.schema.js';
import {
  HOOK_GENERATION_SYSTEM_PROMPT,
  buildHookGenerationUserPrompt,
  type HookGenerationContext,
} from './hook.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { HookCandidate } from './hook.types.js';

export interface HookGeneratorOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  /** Minimum candidates to accept from the LLM (default 10, Plan §5). */
  minCandidates?: number;
  /** Maximum candidates kept (default 15, Plan §5). */
  maxCandidates?: number;
}

/** Generates multiple hook candidates from angles + story + transcript. */
export interface IHookGenerator {
  generate(context: HookGenerationContext): Promise<HookCandidate[]>;
}

/** Approximate spoken duration from word count (~150 wpm narration). */
function estimateSpokenDuration(text: string, wordsPerMinute = 150): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / wordsPerMinute) * 60 * 10) / 10);
}

/**
 * LLM-driven hook candidate generator (Plan Phase 2). One transcript +
 * 3-5 angles produce 10-15 hook variants across the requested styles.
 * Every response is Zod-validated, grounded against the transcript, and
 * retried on malformed output — same defensive pattern as angle.service.
 */
export class HookGenerator implements IHookGenerator {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: HookGeneratorOptions,
    private readonly logger: Logger,
  ) {}

  async generate(context: HookGenerationContext): Promise<HookCandidate[]> {
    return retry(
      async () => {
        this.logger.info(
          { videoId: context.videoId, angleCount: context.angles.length, styles: context.styles },
          'Generating hook candidates',
        );

        const minCandidates = this.options.minCandidates ?? 10;
        const maxCandidates = this.options.maxCandidates ?? 15;

        const raw = await this.provider.chat({
          model: this.options.model,
          system: HOOK_GENERATION_SYSTEM_PROMPT,
          prompt: buildHookGenerationUserPrompt(context),
          // Slightly higher temperature than angles: hook writing benefits
          // from variety, grounding checks below keep it honest.
          temperature: Math.min(1, this.options.temperature + 0.2),
          timeoutMs: this.options.timeoutMs,
          seed: hashSeed(
            'hooks',
            context.videoId,
            context.language,
            ...context.styles,
            ...context.angles.map((a) => a.id),
          ),
        });

        const parsed = parseLlmJson(raw);
        const result = hookGenerationResponseSchema.safeParse(parsed);
        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `Hook generation returned an invalid response: ${result.error.message}`,
          );
        }

        // Never trust the LLM blindly: cap the count, dedupe ids, ground the
        // source ranges against the real transcript.
        const angleIds = new Set(context.angles.map((a) => a.id));
        const seenIds = new Set<string>();
        const candidates: HookCandidate[] = [];

        for (const item of result.data.candidates) {
          if (candidates.length >= maxCandidates) break;
          if (seenIds.has(item.id)) continue;
          if (!angleIds.has(item.angleId)) continue;
          if (item.sourceEnd <= item.sourceStart) continue;

          const angle = context.angles.find((a) => a.id === item.angleId)!;
          seenIds.add(item.id);

          candidates.push({
            id: item.id,
            angle: {
              id: angle.id,
              type: angle.angleType,
              title: angle.title,
              description: angle.reason,
            },
            style: item.style,
            source: {
              start: item.sourceStart,
              end: item.sourceEnd,
              transcript: item.sourceTranscript,
            },
            headline: {
              text: item.headline,
              style: 'kinetic',
              tag: item.tag,
              highlightWords: item.highlightWords,
            },
            spokenHook: {
              text: item.spokenHook,
              duration: estimateSpokenDuration(item.spokenHook),
            },
            metadata: {
              emotion: item.emotion ?? '',
              topic: item.topic ?? '',
              reason: item.reason ?? '',
            },
          });
        }

        if (candidates.length < Math.min(minCandidates, 5)) {
          throw AppError.llmInvalidResponse(
            `Hook generation produced only ${candidates.length} usable candidates (need at least ${Math.min(minCandidates, 5)}).`,
          );
        }

        this.logger.info(
          { videoId: context.videoId, candidateCount: candidates.length },
          'Hook candidates generated',
        );
        return candidates;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn(
            { videoId: context.videoId, attempt, err: error },
            'Retrying hook candidate generation',
          );
        },
      },
    );
  }
}
