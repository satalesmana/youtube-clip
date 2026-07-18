import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IOllamaProvider, OllamaChatOptions } from './ollama.provider.js';

interface RouterChatResponseBody {
  choices?: { message?: { role: string; content: string } }[];
}

/** HTTP client for an OpenAI-compatible AI router (e.g. 9Router) exposing `/v1/chat/completions`. */
export class RouterProvider implements IOllamaProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly logger: Logger,
  ) {}

  /** Sends a single-turn chat completion request and returns the assistant's raw text content. */
  async chat(options: OllamaChatOptions): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.debug({ model: options.model, baseUrl: this.baseUrl }, 'Calling AI router');

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          temperature: options.temperature ?? 0.2,
          messages: [
            ...(options.system ? [{ role: 'system', content: options.system }] : []),
            { role: 'user', content: options.prompt },
          ],
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        throw AppError.networkError(
          `AI router responded with HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
        );
      }

      const data = parseResponseBody(bodyText);
      return data.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.llmTimeout(`AI router request timed out after ${timeoutMs}ms.`, error);
      }

      throw AppError.networkError('Failed to reach the AI router.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

function parseResponseBody(bodyText: string): RouterChatResponseBody {
  try {
    return JSON.parse(bodyText) as RouterChatResponseBody;
  } catch (error) {
    throw AppError.llmInvalidResponse('AI router response was not valid JSON.', error);
  }
}
