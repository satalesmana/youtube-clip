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

    const requestBody = {
      model: options.model,
      stream: false,
      ...(options.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
      temperature: options.temperature ?? 0.2,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      // Keep reasoning short: without this, deepseek-style reasoning models
      // burn the whole budget thinking and return an empty `content`.
      reasoning_effort: 'low',
      max_tokens: 8192,
      messages: [
        // ...(options.system ? [{ role: 'system', content: options.system }] : []),
        { role: 'user', content: `${options.system} ${options.prompt}` },
      ],
    };

    this.logger.info({ model: options.model, messages: requestBody.messages }, 'LLM request');

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        throw AppError.networkError(
          `AI router responded with HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
        );
      }

      const data = parseResponseBody(bodyText);

      this.logger.info(
        { status: response.status, content: data.choices?.[0]?.message?.content ?? '' },
        'LLM response',
      );

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

  /** Sends a vision chat request with an image file or buffer and returns the raw response. */
  async chatVision(options: {
    model?: string;
    prompt: string;
    imagePath?: string;
    imageBuffer?: Buffer;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let base64 = '';
    if (options.imageBuffer) {
      base64 = options.imageBuffer.toString('base64');
    } else if (options.imagePath) {
      const fs = await import('node:fs/promises');
      base64 = await fs.readFile(options.imagePath, 'base64');
    }

    const requestBody = {
      model: options.model ?? 'auto',
      stream: false,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: options.prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
    };

    this.logger.debug({ model: requestBody.model, baseUrl: this.baseUrl }, 'Calling AI router (Vision)');

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        throw AppError.networkError(
          `AI router vision responded with HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''}`,
        );
      }

      const data = parseResponseBody(bodyText);
      return data.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.llmTimeout(`AI router vision request timed out after ${timeoutMs}ms.`, error);
      }

      throw AppError.networkError('Failed to reach the AI router for vision request.', error);
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
