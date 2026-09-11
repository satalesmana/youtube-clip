import { AppError } from './errors.js';

export interface RetryOptions {
  /** Maximum number of attempts, including the first one. Defaults to 3. */
  attempts?: number;
  /** Base delay in milliseconds between attempts, doubled on each subsequent retry. Defaults to 1000. */
  delayMs?: number;
  /** Maximum delay cap in milliseconds. Defaults to 60000 (60s). */
  maxDelayMs?: number;
  /** Base delay in milliseconds when a rate limit (HTTP 429) is detected without a Retry-After header. Defaults to 5000. */
  rateLimitDelayMs?: number;
  /** Called after a failed attempt, before waiting to retry. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Return `false` to abort retrying immediately (e.g. for non-retryable errors). */
  shouldRetry?: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts rate-limit delay in milliseconds from an error if present.
 * Checks `AppError.retryAfterMs`, code `'RATE_LIMIT_EXCEEDED'`, or HTTP 429 indicators.
 */
function extractRateLimitDelay(
  error: unknown,
  fallbackRateLimitMs: number,
  maxDelayMs: number,
): number | null {
  if (error instanceof AppError && error.code === 'RATE_LIMIT_EXCEEDED') {
    if (typeof error.retryAfterMs === 'number' && error.retryAfterMs > 0) {
      return Math.min(error.retryAfterMs, maxDelayMs);
    }
    return fallbackRateLimitMs;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.retryAfterMs === 'number' && err.retryAfterMs > 0) {
      return Math.min(err.retryAfterMs, maxDelayMs);
    }
    const message = typeof err.message === 'string' ? err.message : '';
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return fallbackRateLimitMs;
    }
  }

  return null;
}

/**
 * Runs `fn` with exponential-backoff retries and jitter.
 * Intelligently backs off for HTTP 429 / Rate Limit errors according to
 * `retryAfterMs` or `rateLimitDelayMs`.
 * Rethrows the last error once attempts are exhausted or `shouldRetry` returns false.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    delayMs = 1000,
    maxDelayMs = 60_000,
    rateLimitDelayMs = 5000,
    onRetry,
    shouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const retryable = shouldRetry ? shouldRetry(error) : true;
      if (!retryable || attempt === attempts) {
        throw error;
      }

      // Calculate sleep delay with jitter
      const rateLimitMs = extractRateLimitDelay(error, rateLimitDelayMs, maxDelayMs);
      let waitMs: number;

      if (rateLimitMs !== null) {
        // Rate limit: scale with attempt and add jitter to prevent retry storms
        const scaled = Math.min(rateLimitMs * (1.5 ** (attempt - 1)), maxDelayMs);
        const jitter = Math.random() * 1000;
        waitMs = Math.min(scaled + jitter, maxDelayMs);
      } else {
        // Standard exponential backoff with full jitter (75% - 125%)
        const exp = Math.min(delayMs * (2 ** (attempt - 1)), maxDelayMs);
        const jitterMultiplier = 0.75 + Math.random() * 0.5;
        waitMs = Math.min(Math.round(exp * jitterMultiplier), maxDelayMs);
      }

      onRetry?.(error, attempt, waitMs);
      await sleep(waitMs);
    }
  }

  throw lastError;
}
