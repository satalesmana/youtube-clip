import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IAiProvider, AiChatOptions, AiVisionOptions } from './ai.provider.js';

interface RouterChatResponseBody {
  choices?: { message?: { role: string; content: string } }[];
}

/** HTTP client for an OpenAI-compatible AI router (e.g. 9Router) exposing `/v1/chat/completions`. */
export class RouterProvider implements IAiProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly logger: Logger,
  ) {}

  /** Sends a single-turn chat completion request and returns the assistant's raw text content. */
  async chat(options: AiChatOptions): Promise<string> {
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
      max_tokens: options.maxTokens ?? 4096,
      messages: options.system
        ? [
            { role: 'system', content: options.system },
            { role: 'user', content: options.prompt },
          ]
        : [{ role: 'user', content: options.prompt }],
    };

    this.logger.info({ model: options.model, messages: requestBody.messages }, 'LLM request');

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterMs = extractRetryAfterMs(response);
          this.logger.warn(
            { status: 429, retryAfterMs, model: options.model, body: bodyText },
            'AI router rate limit exceeded (HTTP 429)',
          );
          throw AppError.rateLimit(
            `AI router rate limit exceeded (HTTP 429)${bodyText ? `: ${bodyText}` : ''}`,
            retryAfterMs,
          );
        }

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
  async chatVision(options: AiVisionOptions): Promise<string> {
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
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const bodyText = await response.text();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterMs = extractRetryAfterMs(response);
          this.logger.warn(
            { status: 429, retryAfterMs, body: bodyText },
            'AI router vision rate limit exceeded (HTTP 429)',
          );
          throw AppError.rateLimit(
            `AI router vision rate limit exceeded (HTTP 429)${bodyText ? `: ${bodyText}` : ''}`,
            retryAfterMs,
          );
        }

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

  /** Builds realistic, browser-like request headers to prevent WAF / anti-bot false positives. */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Viral Highlight Generator',
    };
  }
}

function extractRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.round(seconds * 1000);
    }
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs) && dateMs > Date.now()) {
      return dateMs - Date.now();
    }
  }

  const resetHeader =
    response.headers.get('x-ratelimit-reset') ||
    response.headers.get('x-ratelimit-reset-requests') ||
    response.headers.get('x-ratelimit-reset-tokens');

  if (resetHeader) {
    if (resetHeader.endsWith('ms')) {
      const ms = Number(resetHeader.slice(0, -2));
      if (!Number.isNaN(ms) && ms > 0) return ms;
    }
    if (resetHeader.endsWith('s')) {
      const s = Number(resetHeader.slice(0, -1));
      if (!Number.isNaN(s) && s > 0) return Math.round(s * 1000);
    }
    const val = Number(resetHeader);
    if (!Number.isNaN(val) && val > 0) {
      if (val > 1_000_000_000) {
        return Math.max(0, val * 1000 - Date.now());
      }
      return Math.round(val * 1000);
    }
  }

  return undefined;
}

function parseResponseBody(bodyText: string): RouterChatResponseBody {
  try {
    return JSON.parse(bodyText) as RouterChatResponseBody;
  } catch (error) {
    throw AppError.llmInvalidResponse('AI router response was not valid JSON.', error);
  }
}
