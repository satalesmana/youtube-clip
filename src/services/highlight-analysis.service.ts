import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import {
  highlightChunkResponseSchema,
  rerankResponseSchema,
  type RerankedClip,
} from '../schemas/highlight.schema.js';
import {
  buildViralHighlightSystemPrompt,
  buildViralHighlightUserPrompt,
  buildRerankSystemPrompt,
  buildRerankUserPrompt,
  type RerankCandidateInput,
} from '../prompts/viral-highlight.prompt.js';
import type { IAiProvider } from '../providers/ai.provider.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptChunk } from '../types/transcript.js';
import type { HighlightClip } from '../types/highlight.js';

export interface HighlightAnalysisOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  /** Clip duration bounds injected into the prompt so it matches the pipeline clamp. */
  minClipSeconds: number;
  maxClipSeconds: number;
}

/** Analyzes transcript chunks with an LLM to find candidate viral clips. */
export interface IHighlightAnalysisService {
  /** First pass: scan one transcript chunk for candidate viral clips. */
  analyzeChunk(chunk: TranscriptChunk, language?: string, genre?: string): Promise<HighlightClip[]>;
  /**
   * Second pass: compare the pooled top candidates against each other and
   * return only the publish-worthy ones with fresh, globally calibrated scores.
   */
  rerankCandidates(params: {
    videoTitle: string;
    candidates: RerankCandidateInput[];
    excerptById: Record<string, string>;
    language?: string;
    genre?: string;
  }): Promise<RerankedClip[]>;
}

const JSON_ONLY_INSTRUCTION =
  'Return ONLY valid JSON matching this schema, with no other text. Never return Markdown. Never explain. Return JSON only.';

/**
 * Sends transcript chunks to the AI provider using the viral-highlight prompt,
 * validating and retrying on malformed responses.
 */
export class HighlightAnalysisService implements IHighlightAnalysisService {
  constructor(
    private readonly provider: IAiProvider,
    private readonly options: HighlightAnalysisOptions,
    private readonly logger: Logger,
  ) {}

  /** Analyzes one transcript chunk and returns its candidate viral clips. */
  async analyzeChunk(chunk: TranscriptChunk, language?: string, genre?: string): Promise<HighlightClip[]> {
    const systemPrompt = [
      buildViralHighlightSystemPrompt({
        minSeconds: this.options.minClipSeconds,
        maxSeconds: this.options.maxClipSeconds,
        language,
        genre,
      }),
      JSON_ONLY_INSTRUCTION,
      '{"clips": [{"start": 0, "end": 0, "score": 95, "title": "", "reason": "", "hook": "", "peak": 0}]}',
    ].join(' ');

    const userPrompt = buildViralHighlightUserPrompt(chunk);

    return retry(
      async () => {
        this.logger.info({ chunkIndex: chunk.index }, 'Calling AI provider for highlight analysis');

        const raw = await this.provider.chat({
          model: this.options.model,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: this.options.temperature,
          timeoutMs: this.options.timeoutMs,
        });

        this.logger.debug({ chunkIndex: chunk.index }, 'Validating response');
        const parsed = parseJsonLoosely(raw);
        const result = highlightChunkResponseSchema.safeParse(parsed);

        if (!result.success) {
          throw AppError.llmInvalidResponse(
            `AI provider returned an invalid highlight response for chunk ${chunk.index}: ${result.error.message}`,
          );
        }

        return result.data.clips;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn(
            { chunkIndex: chunk.index, attempt, err: error },
            'Retrying highlight analysis',
          );
        },
      },
    );
  }

  /**
   * Second pass: global comparison of the pooled top candidates. A malformed
   * or failed rerank is surfaced to the caller via `null` after exhausting
   * retries — first-pass ranking remains usable in that case.
   */
  async rerankCandidates(params: {
    videoTitle: string;
    candidates: RerankCandidateInput[];
    excerptById: Record<string, string>;
    language?: string;
    genre?: string;
  }): Promise<RerankedClip[]> {
    if (params.candidates.length === 0) return [];

    const systemPrompt = [
      buildRerankSystemPrompt(params.language, params.genre),
      JSON_ONLY_INSTRUCTION,
      '{"clips": [{"id": "", "score": 95, "title": "", "reason": "", "hook": ""}]}',
    ].join(' ');
    const userPrompt = buildRerankUserPrompt(params);

    return retry(
      async () => {
        this.logger.info({ candidateCount: params.candidates.length }, 'Reranking clip candidates');

        const raw = await this.provider.chat({
          model: this.options.model,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: this.options.temperature,
          timeoutMs: this.options.timeoutMs,
        });

        const parsed = parseJsonLoosely(raw);
        const result = rerankResponseSchema.safeParse(parsed);
        if (!result.success) {
          throw AppError.llmInvalidResponse(`AI provider returned an invalid rerank response: ${result.error.message}`);
        }
        return result.data.clips;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn({ attempt, err: error }, 'Retrying clip rerank');
        },
      },
    );
  }
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
    throw AppError.llmInvalidResponse('AI provider response was not valid JSON.');
  }
}
