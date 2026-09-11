import { AppError } from '../utils/errors.js';
import { retry } from '../utils/retry.js';
import type { Logger } from '../utils/logger.js';

/** Chat interface expected by the research pipeline's LLM calls. */
export interface LlmProvider {
  chat(options: {
    system?: string;
    prompt: string;
    model?: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<string>;
}

export interface OpenAiCompatibleLlmOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  logger: Logger;
}

/** OpenAI-compatible provider used by the research pipeline. */
export class OpenAiCompatibleLlm implements LlmProvider {
  constructor(private readonly options: OpenAiCompatibleLlmOptions) {}

  async chat(options: {
    system?: string;
    prompt: string;
    model?: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs;
    const attempts = this.options.maxRetries + 1;

    try {
      return await retry(
        () => this.request(options, timeoutMs),
        {
          attempts,
          onRetry: (error, attempt, waitMs) => {
            this.options.logger.warn(
              { attempt, waitMs, err: error },
              'Retrying research LLM request',
            );
          },
        },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.researchAnalysisFailed('Failed to reach the research LLM.', error);
    }
  }

  private async request(
    options: { system?: string; prompt: string; model?: string; temperature?: number },
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${this.options.baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Viral Highlight Generator',
          },
          body: JSON.stringify({
            model: options.model ?? this.options.model,
            stream: false,
            messages: [
              ...(options.system ? [{ role: 'system', content: options.system }] : []),
              { role: 'user', content: options.prompt },
            ],
          }),
          signal: controller.signal,
        },
      );

      const bodyText = await response.text();
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const seconds = retryAfter ? Number(retryAfter) : NaN;
          const retryAfterMs = !Number.isNaN(seconds) && seconds > 0 ? seconds * 1000 : undefined;
          throw AppError.rateLimit(`Research LLM rate limit exceeded (HTTP 429): ${bodyText}`, retryAfterMs);
        }
        throw new Error(`Research LLM responded with HTTP ${response.status}: ${bodyText}`);
      }

      const data = JSON.parse(bodyText) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      this.options.logger.debug(
        { promptLength: options.prompt.length, responseLength: content.length, model: options.model ?? this.options.model },
        'LLM response received',
      );
      this.options.logger.trace({ content }, 'LLM raw response');
      return content;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.llmTimeout(`Research LLM request timed out after ${timeoutMs}ms.`, error);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
