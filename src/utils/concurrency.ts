/**
 * Runs `worker` over every item with at most `limit` running concurrently.
 * Behaves like `Promise.allSettled` (one item failing never aborts the
 * others) but caps how many run at once, queuing the rest until a slot
 * frees up.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;

      try {
        const value = await worker(items[currentIndex] as T, currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));

  return results;
}
