import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem } from '../types/media.js';

export interface TrendsProviderOptions {
  /** Google News RSS feed URL, e.g. the NATION topic for a country. */
  feedUrl: string;
  /** Max items to collect per fetch. */
  maxQueries: number;
  /** Fetch timeout in milliseconds. */
  timeoutMs: number;
}

export interface ITrendsProvider {
  /**
   * Collects trending / rising search queries from Google News RSS.
   * @param keyword Optional search keyword — when provided, uses the search
   *   endpoint (`/rss/search?q={keyword}`) instead of the default topic feed.
   */
  fetchTrendingQueries(keyword?: string): Promise<ResearchSourceItem[]>;
}

interface FeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
}

/**
 * Minimal XML parser for RSS 2.0 / Atom — same shape as the one in
 * `rss.provider.ts` (no external dependency), extracting only the fields
 * the research pipeline needs.
 */
function parseFeedXml(xml: string): { title?: string; items: FeedItem[] } {
  const stripTags = (text: string): string =>
    text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const extractTag = (xml: string, tag: string): string[] => {
    const matches: string[] = [];
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1] ?? '');
    }
    return matches;
  };

  const items: FeedItem[] = [];
  const itemRegex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const content = itemMatch[2] ?? '';
    const titleTags = extractTag(content, 'title');
    const linkTags = extractTag(content, 'link');
    const pubDateTags = extractTag(content, 'pubDate');
    const publishedTags = extractTag(content, 'published');
    const updatedTags = extractTag(content, 'updated');

    items.push({
      title: titleTags[0] ? stripTags(titleTags[0]) : undefined,
      link:
        linkTags[0] !== undefined
          ? stripTags(linkTags[0]) || (/href="([^"]+)"/.exec(content)?.[1] ?? undefined)
          : (/<link\b[^>]*href="([^"]+)"/i.exec(content)?.[1] ?? undefined),
      pubDate: pubDateTags[0] ? stripTags(pubDateTags[0]) : undefined,
      published: publishedTags[0] ? stripTags(publishedTags[0]) : undefined,
      updated: updatedTags[0] ? stripTags(updatedTags[0]) : undefined,
    });
  }

  const channelTitleTag = /<channel\b[^>]*>([\s\S]*?)<\/channel>/i.exec(xml)?.[1];
  const title = channelTitleTag ? extractTag(channelTitleTag, 'title')[0] : undefined;

  return { title: title ? stripTags(title) : undefined, items };
}

/**
 * Google Trends provider backed by the Google News RSS feed (no API key, no
 * Python). Fetches the configured topic feed (e.g. `NATION` for Indonesia)
 * and normalizes the headline items into {@link ResearchSourceItem}s, so the
 * research pipeline treats Google News like any other optional source.
 */
export class TrendsProvider implements ITrendsProvider {
  constructor(
    private readonly options: TrendsProviderOptions,
    private readonly logger: Logger,
  ) {}

  async fetchTrendingQueries(keyword?: string): Promise<ResearchSourceItem[]> {
    // If a keyword is provided, use the search endpoint; otherwise use the default topic feed.
    const feedUrl = keyword
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=id&gl=ID&ceid=ID:id`
      : this.options.feedUrl;
    const { maxQueries, timeoutMs } = this.options;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'viral-highlight-generator/0.1 (research pipeline)' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Google News RSS responded with HTTP ${response.status}`);
      }

      const xml = await response.text();
      const parsed = parseFeedXml(xml);
      const origin = parsed.title ?? new URL(feedUrl).hostname;

      return (parsed.items ?? []).slice(0, maxQueries).map((item): ResearchSourceItem => {
        const publishedAt = item.pubDate ?? item.published ?? item.updated;
        return {
          source: 'trends',
          origin,
          title: item.title ?? '(untitled)',
          url: item.link,
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
          language: 'id',
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.researchSourceFailed(
          `Google News RSS fetch timed out after ${timeoutMs}ms.`,
          error,
        );
      }
      throw AppError.researchSourceFailed(`Failed to fetch Google News RSS "${feedUrl}".`, error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
