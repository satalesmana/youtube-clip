import { runCommand } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem } from '../types/media.js';

export interface XProviderOptions {
  /** Search query passed to `xurl search`, e.g. `breaking lang:en`. Empty disables X. */
  searchQuery: string;
  maxPosts: number;
}

export interface IXProvider {
  /** Returns `false` when X is unavailable (not authenticated); callers skip the source. */
  isAvailable(): Promise<boolean>;
  /** Searches X posts matching the configured query. Returns `null` when unavailable. */
  fetchRecentPosts(): Promise<ResearchSourceItem[] | null>;
}

interface XSearchResult {
  data?: { id?: string; text?: string; created_at?: string; public_metrics?: { like_count?: number } }[];
  errors?: { message?: string }[];
}

/**
 * X/Twitter provider backed by the `xurl` CLI (official X API). Availability
 * is checked via `xurl auth status` — when xurl is missing or not
 * authenticated, the source is skipped gracefully instead of failing the
 * research pipeline.
 */
export class XProvider implements IXProvider {
  constructor(
    private readonly options: XProviderOptions,
    private readonly logger: Logger,
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.options.searchQuery.trim()) return false;
    try {
      const { stdout } = await runCommand('xurl', ['auth', 'status']);
      return !/no apps|not authenticated|no tokens/i.test(stdout);
    } catch {
      return false;
    }
  }

  async fetchRecentPosts(): Promise<ResearchSourceItem[] | null> {
    if (!(await this.isAvailable())) return null;

    const { searchQuery, maxPosts } = this.options;
    try {
      const { stdout } = await runCommand('xurl', ['search', searchQuery, '-n', String(maxPosts)], {
        logger: this.logger,
      });
      const result = parseSearchResult(stdout);

      if (!result) {
        this.logger.warn('xurl search returned an error payload, skipping X source');
        return null;
      }

      return (result.data ?? []).map((post) => ({
        source: 'x',
        origin: 'X/Twitter',
        title: post.text ?? `X post ${post.id ?? ''}`.trim(),
        url: post.id ? `https://x.com/i/status/${post.id}` : undefined,
        engagement: post.public_metrics?.like_count,
        publishedAt: post.created_at,
      }));
    } catch (error) {
      this.logger.warn({ err: error }, 'X search failed, skipping X source');
      return null;
    }
  }
}

function parseSearchResult(stdout: string): XSearchResult | null {
  try {
    const parsed = JSON.parse(stdout) as XSearchResult;
    if (parsed.errors && parsed.errors.length > 0 && !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}
