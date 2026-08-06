import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem } from '../types/media.js';

export interface RssFeedConfig {
  /** Feed URL. */
  url: string;
  /** Human-readable origin label, e.g. `cnn-indonesia`. */
  label?: string;
  /** ISO 639-1 language code, e.g. `id`. */
  language?: string;
}

export interface RssProviderOptions {
  feeds: RssFeedConfig[];
  maxItemsPerFeed: number;
  timeoutMs: number;
}

export interface IRssProvider {
  /** Collects the most recent items from every configured feed. */
  fetchLatest(): Promise<ResearchSourceItem[]>;
}

interface FeedItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
}

/**
 * Minimal XML parser for RSS 2.0 and Atom feeds. No external dependency: only
 * the fields we care about are extracted (title, link, description, date).
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
  // Look for <item> (RSS) or <entry> (Atom) blocks.
  const itemBlocks: { content: string; tag: string }[] = [];

  const itemRegex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const tag = (itemMatch[1] ?? '').toLowerCase();
    itemBlocks.push({ content: itemMatch[2] ?? '', tag });
  }

  for (const block of itemBlocks) {
    const titleTags = extractTag(block.content, 'title');
    const linkTags = extractTag(block.content, 'link');
    const descriptionTags = extractTag(block.content, 'description');
    const pubDateTags = extractTag(block.content, 'pubDate');
    const publishedTags = extractTag(block.content, 'published');
    const updatedTags = extractTag(block.content, 'updated');

    items.push({
      title: titleTags[0] ? stripTags(titleTags[0]) : undefined,
      // Atom feeds use <link href="..."> (attribute), RSS uses <link>text</link>.
      link:
        linkTags[0] !== undefined
          ? stripTags(linkTags[0]) ||
            (/href="([^"]+)"/.exec(block.content)?.[1] ?? undefined)
          : (/<link\b[^>]*href="([^"]+)"/i.exec(block.content)?.[1] ?? undefined),
      description: descriptionTags[0] ? stripTags(descriptionTags[0]) : undefined,
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
 * Fetches news from RSS 2.0 / Atom feeds and normalizes entries into
 * {@link ResearchSourceItem}s. Each feed failure is logged and skipped so one
 * dead feed never blocks the rest of the research pipeline.
 */
export class RssProvider implements IRssProvider {
  constructor(
    private readonly options: RssProviderOptions,
    private readonly logger: Logger,
  ) {}

  async fetchLatest(): Promise<ResearchSourceItem[]> {
    const { feeds, maxItemsPerFeed, timeoutMs } = this.options;

    const settled = await Promise.allSettled(
      feeds.map((feed) => this.fetchFeed(feed, maxItemsPerFeed, timeoutMs)),
    );

    const items: ResearchSourceItem[] = [];
    settled.forEach((outcome, index) => {
      const feed = feeds[index];
      if (outcome.status === 'fulfilled') {
        items.push(...outcome.value);
        return;
      }
      this.logger.warn(
        { feed: feed?.url, err: outcome.reason },
        'RSS feed fetch failed, skipping',
      );
    });

    return items;
  }

  private async fetchFeed(
    feed: RssFeedConfig,
    maxItems: number,
    timeoutMs: number,
  ): Promise<ResearchSourceItem[]> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'viral-highlight-generator/0.1 (research pipeline)' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RSS feed responded with HTTP ${response.status}`);
      }

      const xml = await response.text();
      const parsed = parseFeedXml(xml);
      const origin = feed.label ?? parsed.title ?? new URL(feed.url).hostname;

      return (parsed.items ?? []).slice(0, maxItems).map((item): ResearchSourceItem => {
        const publishedAt = item.pubDate ?? item.published ?? item.updated;
        return {
          source: 'rss',
          origin,
          title: item.title ?? '(untitled)',
          text: item.description,
          url: item.link,
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
          language: feed.language,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.researchSourceFailed(`RSS fetch timed out after ${timeoutMs}ms.`, error);
      }
      throw AppError.researchSourceFailed(`Failed to fetch RSS feed "${feed.url}".`, error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
