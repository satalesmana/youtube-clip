import { AppError } from '../utils/errors.js';
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

    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        const delayMs = Math.min(1_000 * 2 ** (attempt - 1), 8_000) + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        return await this.request(options, timeoutMs);
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
      }
    }

    throw AppError.researchAnalysisFailed('Failed to reach the research LLM.', lastError);
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
        throw new Error(`Research LLM responded with HTTP ${response.status}: ${bodyText}`);
      }

      const data = JSON.parse(bodyText) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? '';
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
