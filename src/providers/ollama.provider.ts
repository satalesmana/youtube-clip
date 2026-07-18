import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';

export interface OllamaChatOptions {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
}

interface OllamaChatResponseBody {
  choices?: { message?: { role: string; content: string } }[];
}

/** Thin transport-layer abstraction over Ollama's `/api/chat` HTTP endpoint. */
export interface IOllamaProvider {
  chat(options: OllamaChatOptions): Promise<string>;
}

/** Ollama HTTP client. Talks to a local or remote Ollama server via native `fetch`. */
export class OllamaProvider implements IOllamaProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: Logger,
  ) {}

  /** Sends a single-turn chat request and returns the assistant's raw text content. */
  async chat(options: OllamaChatOptions): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.debug({ model: options.model, baseUrl: this.baseUrl }, 'Calling Ollama');

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          messages: [
            ...(options.system ? [{ role: 'system', content: options.system }] : []),
            { role: 'user', content: options.prompt },
          ],
          options: { temperature: options.temperature ?? 0.2 },
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        throw AppError.networkError(
          `Ollama responded with HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
        );
      }

      const data = parseResponseBody(bodyText);
      return data.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.llmTimeout(`Ollama request timed out after ${timeoutMs}ms.`, error);
      }

      throw AppError.networkError('Failed to reach the Ollama server.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Parses the response body as a single JSON object. Falls back to reading it as
 * SSE-style `data: {...}` chunks (concatenating streamed content deltas) in case
 * the server ignores `stream: false` and streams anyway.
 */
function parseResponseBody(bodyText: string): OllamaChatResponseBody {
  try {
    return JSON.parse(bodyText) as OllamaChatResponseBody;
  } catch (error) {
    const chunks = bodyText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter((line) => line.length > 0 && line !== '[DONE]');

    if (chunks.length === 0) {
      throw error;
    }

    const content = chunks
      .map((chunk) => {
        try {
          const parsed = JSON.parse(chunk) as {
            choices?: { delta?: { content?: string }; message?: { content?: string } }[];
          };
          const choice = parsed.choices?.[0];
          return choice?.delta?.content ?? choice?.message?.content ?? '';
        } catch {
          return '';
        }
      })
      .join('');

    return { choices: [{ message: { role: 'assistant', content } }] };
  }
}
