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
  message?: { role: string; content: string };
  done?: boolean;
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

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw AppError.networkError(
          `Ollama responded with HTTP ${response.status}${body ? `: ${body}` : ''}`,
        );
      }

      const data = (await response.json()) as OllamaChatResponseBody;
      return data.message?.content ?? '';
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.ollamaTimeout(`Ollama request timed out after ${timeoutMs}ms.`, error);
      }

      throw AppError.networkError('Failed to reach the Ollama server.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
