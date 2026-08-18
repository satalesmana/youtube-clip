import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem } from '../types/media.js';

export interface RedditProviderOptions {
  subreddits: string[];
  maxPostsPerSubreddit: number;
  timeoutMs: number;
}

export interface IRedditProvider {
  /** Collects hot posts from the configured subreddits (falls back to r/popular). */
  fetchHotPosts(): Promise<ResearchSourceItem[]>;
}

interface RedditListingResponse {
  data?: {
    children?: { data?: RedditPostData }[];
  };
}

interface RedditPostData {
  title?: string;
  selftext?: string;
  url?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  subreddit?: string;
  permalink?: string;
}

/** Default reddit.json JSON-API URL, used as the `User-Agent` is sent as well. */
const REDDIT_BASE_URL = 'https://www.reddit.com';

/**
 * Fetches hot posts from Reddit's public JSON API (`/r/<sub>/hot.json`),
 * falling back to the global `/r/popular/hot.json` when no subreddits are
 * configured. No API key required; a descriptive User-Agent is recommended
 * by Reddit's API guidelines.
 */
export class RedditProvider implements IRedditProvider {
  constructor(
    private readonly options: RedditProviderOptions,
    private readonly logger: Logger,
  ) {}

  async fetchHotPosts(): Promise<ResearchSourceItem[]> {
    const { subreddits, maxPostsPerSubreddit, timeoutMs } = this.options;
    const targets = subreddits.length > 0 ? subreddits : ['popular'];

    const settled = await Promise.allSettled(
      targets.map((subreddit) => this.fetchSubreddit(subreddit, maxPostsPerSubreddit, timeoutMs)),
    );

    const items: ResearchSourceItem[] = [];
    settled.forEach((outcome, index) => {
      const subreddit = targets[index] ?? 'popular';
      if (outcome.status === 'fulfilled') {
        items.push(...outcome.value);
        return;
      }
      this.logger.warn(
        { subreddit, err: outcome.reason },
        'Reddit subreddit fetch failed, skipping',
      );
    });

    return items;
  }

  private async fetchSubreddit(
    subreddit: string,
    limit: number,
    timeoutMs: number,
  ): Promise<ResearchSourceItem[]> {
    const url = `${REDDIT_BASE_URL}/r/${encodeURIComponent(subreddit)}/hot.json?limit=${limit}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'viral-highlight-generator/0.1 (research pipeline)' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Reddit responded with HTTP ${response.status}`);
      }

      const body = (await response.json()) as RedditListingResponse;
      const children = body.data?.children ?? [];

      return children
        .map((child): ResearchSourceItem | undefined => {
          const post = child.data;
          if (!post?.title) return undefined;

          const engagement =
            typeof post.score === 'number' && typeof post.num_comments === 'number'
              ? post.score + post.num_comments
              : undefined;

          return {
            source: 'reddit',
            origin: `r/${post.subreddit ?? subreddit}`,
            title: post.title,
            text: post.selftext && post.selftext.trim().length > 0 ? post.selftext : undefined,
            url: post.url ?? (post.permalink ? `https://www.reddit.com${post.permalink}` : undefined),
            engagement,
            publishedAt:
              typeof post.created_utc === 'number'
                ? new Date(post.created_utc * 1000).toISOString()
                : undefined,
          };
        })
        .filter((item): item is ResearchSourceItem => item !== undefined);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.researchSourceFailed(`Reddit fetch timed out after ${timeoutMs}ms.`, error);
      }
      throw AppError.researchSourceFailed(`Failed to fetch Reddit r/${subreddit}.`, error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
