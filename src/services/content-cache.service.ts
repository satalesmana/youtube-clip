import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface ContentCacheOptions {
  /** Directory where cache entries (JSON files) are stored. */
  dir: string;
}

/**
 * Filesystem-backed JSON cache for LLM pipeline stage outputs.
 *
 * Each entry is keyed by a stable content hash (videoId + candidateId + stage),
 * so regenerating the same video always returns the identical angle/story/script
 * instead of re-rolling the LLM. Keys are hex hashes — safe for filenames.
 */
export class ContentCache {
  constructor(private readonly options: ContentCacheOptions) {}

  /** Reads a cached entry. Returns `undefined` on any miss/read error. */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await readFile(this.path(key), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  /** Writes (or overwrites) a cache entry. */
  async set<T>(key: string, value: T): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
  }

  private path(key: string): string {
    return join(this.options.dir, `${key}.json`);
  }
}