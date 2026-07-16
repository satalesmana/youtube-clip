export interface RetryOptions {
  /** Maximum number of attempts, including the first one. Defaults to 3. */
  attempts?: number;
  /** Base delay in milliseconds between attempts, doubled on each subsequent retry. */
  delayMs?: number;
  /** Called after a failed attempt, before waiting to retry. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Return `false` to abort retrying immediately (e.g. for non-retryable errors). */
  shouldRetry?: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` with exponential-backoff retries. Rethrows the last error once
 * attempts are exhausted or `shouldRetry` returns false.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 1000, onRetry, shouldRetry } = options;

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

      onRetry?.(error, attempt);
      await sleep(delayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
