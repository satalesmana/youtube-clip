import { retry } from '../utils/retry.js';
import { AppError } from '../utils/errors.js';
import { highlightChunkResponseSchema } from '../schemas/highlight.schema.js';
import {
  buildViralHighlightSystemPrompt,
  buildViralHighlightUserPrompt,
  buildGoalHighlightSystemPrompt,
  buildMotoGpSystemPrompt,
} from '../prompts/viral-highlight.prompt.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptChunk } from '../types/transcript.js';
import type { HighlightClip } from '../types/highlight.js';

export interface OllamaServiceOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
}

/** Analyzes transcript chunks with an LLM to find candidate viral clips. */
export interface IOllamaService {
  analyzeChunk(chunk: TranscriptChunk, actingAs?: string): Promise<HighlightClip[]>;
}

/**
 * Sends transcript chunks to Ollama using the viral-highlight prompt,
 * validating and retrying on malformed responses.
 */
export class OllamaService implements IOllamaService {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: OllamaServiceOptions,
    private readonly logger: Logger,
  ) {}

  /** Analyzes one transcript chunk and returns its candidate viral clips. */
  async analyzeChunk(chunk: TranscriptChunk, actingAs?: string): Promise<HighlightClip[]> {
    const systemPrompt = resolveSystemPrompt(actingAs);
    const userPrompt = buildViralHighlightUserPrompt(chunk);

    return retry(
      async () => {
        this.logger.info({ chunkIndex: chunk.index }, 'Calling Ollama');

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
            `Ollama returned an invalid highlight response for chunk ${chunk.index}: ${result.error.message}`,
          );
        }

        return result.data.clips;
      },
      {
        attempts: this.options.maxRetries,
        onRetry: (error, attempt) => {
          this.logger.warn(
            { chunkIndex: chunk.index, attempt, err: error },
            'Retrying Ollama analysis',
          );
        },
      },
    );
  }
}

/** Parses `text` as JSON, falling back to extracting the first `{...}` block. */
function resolveSystemPrompt(actingAs?: string): string {
  const normalized = actingAs?.trim().toLowerCase();

  switch (normalized) {
    case 'goal':
    case 'football':
      return buildGoalHighlightSystemPrompt();
    case 'motogp':
    case 'moto':
    case 'moto-gp':
    case 'moto_gp':
      return buildMotoGpSystemPrompt();
    case 'viral':
    case '':
    case undefined:
    default:
      return buildViralHighlightSystemPrompt();
  }
}

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
    throw AppError.llmInvalidResponse('Ollama response was not valid JSON.');
  }
}
