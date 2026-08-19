import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { hashSeed } from '../utils/seed.js';
import { angleGenerationResponseSchema } from '../schemas/angle.schema.js';
import {
  CONTENT_ANGLE_SYSTEM_PROMPT,
  buildContentAngleUserPrompt,
} from './content.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { AngleGenerationResult, ContentAngle } from '../types/angle.js';

export interface ContentAngleServiceOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  /** Max angles the LLM should propose (defaults to 5). */
  maxAngles?: number;
}

/** Everything the angle generator needs to reason about one viral moment. */
export interface ContentAngleContext {
  candidateId: string;
  /** The candidate clip itself, verbatim. */
  momentSegments: TranscriptSegment[];
  /** Segments around the moment (before/after) for context understanding. */
  contextSegments: TranscriptSegment[];
  /** The candidate's original title/hook/reason from the highlight stage. */
  candidateTitle: string;
  candidateHook: string;
  candidateReason: string;
  clipStart: number;
  clipEnd: number;
  sourceTitle: string;
  sourceChannel: string;
  /** Optional target language for the angles (e.g. "id", "en"). */
  sourceLanguage?: string;
}

/** Proposes multiple editorial angles for a single viral moment. */
export interface IContentAngleService {
  generateAngles(context: ContentAngleContext): Promise<AngleGenerationResult>;
}

/**
 * LLM-driven content angle generator. One viral moment produces 3-5 distinct
 * editorial angles; the LLM selects the strongest. Every LLM response is
 * validated against a Zod schema and retried on malformed output.
 */
export class ContentAngleService implements IContentAngleService {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: ContentAngleServiceOptions,
    private readonly logger: Logger,
  ) {}

  async generateAngles(context: ContentAngleContext): Promise<AngleGenerationResult> {
    return retry(
      async () => {
        this.logger.info({ candidateId: context.candidateId }, 'Generating content angles');

        const maxAngles = this.options.maxAngles ?? 5;
        const systemPrompt = `${CONTENT_ANGLE_SYSTEM_PROMPT}\n\nGenerate at most ${maxAngles} angles.`;

        const raw = await this.provider.chat({
          model: this.options.model,
          system: systemPrompt,
          prompt: buildContentAngleUserPrompt(context),
          temperature: this.options.temperature,
          timeoutMs: this.options.timeoutMs,
          // Deterministic output: same moment + same context → same angles.
          seed: hashSeed(
            'angle',
            context.sourceTitle,
            context.candidateId,
            context.clipStart,
            context.clipEnd,
            ...context.momentSegments.map((segment) => `${segment.start}|${segment.end}|${segment.text}`),
          ),
        });

        this.logger.debug({ candidateId: context.candidateId }, 'Validating angle response');
        const parsed = parseJsonLoosely(raw);
        const result = angleGenerationResponseSchema.safeParse(parsed);

        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `Angle generation returned an invalid response: ${result.error.message}`,
          );
        }

        // Never trust the LLM blindly: cap the angle count (models may ignore
        // the prompt), then validate the selectedAngleId.
        const angles = result.data.angles.slice(0, this.options.maxAngles ?? 5);
        const selected = angles.find((angle) => angle.id === result.data.selectedAngleId);
        if (!selected) {
          throw AppError.llmInvalidResponse(
            'Angle response did not include the selectedAngleId among its angles.',
          );
        }

        return {
          candidateId: context.candidateId,
          angles: angles.map(normalizeAngle),
          selectedAngleId: selected.id,
        };
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn(
            { candidateId: context.candidateId, attempt, err: error },
            'Retrying content angle generation',
          );
        },
      },
    );
  }
}

/** Maps a validated LLM angle onto the shared domain type. */
function normalizeAngle(angle: { id: string; title: string; angleType: string; hook: string; reason: string; score: number }): ContentAngle {
  return {
    id: angle.id,
    title: angle.title,
    angleType: angle.angleType as ContentAngle['angleType'],
    hook: angle.hook,
    reason: angle.reason,
    score: angle.score,
  };
}

/** Parses `text` as JSON, falling back to extracting the first `{...}` block. */
function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through to the error below.
      }
    }
    throw AppError.llmInvalidResponse('Content angle response was not valid JSON.');
  }
}
