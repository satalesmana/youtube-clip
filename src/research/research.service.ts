import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem, YouTubeVideoResult } from '../types/media.js';
import type { ResearchResult, ResearchTrend } from '../types/research.js';
import type { IRedditProvider } from './reddit.provider.js';
import type { IRssProvider } from './rss.provider.js';
import type { ITrendsProvider } from './trends.provider.js';
import type { IXProvider } from './x.provider.js';
import type { IYouTubeSearchProvider } from './youtube-search.provider.js';
import type { LlmProvider } from './llm.provider.js';
import { buildResearchPrompt, parseResearchLlmResponse } from './research.prompt.js';

export interface ResearchServiceOptions {
  maxTrends: number;
  /** Max signals sent to the LLM (keeps prompt size manageable). */
  maxSignalsForLlm: number;
  language: string;
  /** Enabled providers: 'rss', 'reddit', 'trends', 'x'. Default: all. */
  enabledProviders?: ('rss' | 'reddit' | 'trends' | 'x')[];
}

export interface IResearchService {
  /** Runs the full research pipeline: collect signals → analyze → match videos. */
  research(options?: {
    enabledProviders?: ('rss' | 'reddit' | 'trends' | 'x')[];
    maxTrends?: number;
    keyword?: string;
  }): Promise<ResearchResult>;
}

/**
 * Orchestrates the research pipeline:
 *
 * 1. Collect raw signals from RSS, Reddit, Google Trends and X (in parallel).
 * 2. Ask the LLM to identify and rank the most viral topics (strict JSON).
 * 3. Search YouTube for each ranked topic and attach matching videos.
 *
 * Source failures are isolated: a dead feed never fails the whole request.
 */
export class ResearchService implements IResearchService {
  constructor(
    private readonly options: ResearchServiceOptions,
    private readonly rssProvider: IRssProvider,
    private readonly redditProvider: IRedditProvider,
    private readonly trendsProvider: ITrendsProvider,
    private readonly xProvider: IXProvider,
    private readonly youtubeSearchProvider: IYouTubeSearchProvider,
    private readonly llm: LlmProvider,
    private readonly logger: Logger,
  ) {}

  async research(options?: {
    enabledProviders?: ('rss' | 'reddit' | 'trends' | 'x')[];
    maxTrends?: number;
    keyword?: string;
  }): Promise<ResearchResult> {
    const skippedSources: { source: string; reason: string }[] = [];
    const collected = await this.collectSignals(skippedSources, options?.enabledProviders, options?.keyword);

    if (collected.length === 0) {
      throw AppError.researchSourceFailed(
        'All research sources returned no signals. Check network access and source configuration in .env.',
      );
    }

    this.logger.info({ signalCount: collected.length }, 'Research signals collected');

    const maxTrends = options?.maxTrends ?? this.options.maxTrends;
    const trends = await this.analyzeAndRank(collected, maxTrends);
    this.logger.info({ trendCount: trends.length }, 'Research trends ranked');

    // Attach YouTube videos to each trend (bounded concurrency).
    const ranked = trends.slice(0, maxTrends);
    const withVideos = await this.attachVideos(ranked);

    return {
      generatedAt: new Date().toISOString(),
      signalCount: collected.length,
      trends: withVideos,
      skippedSources,
    };
  }

  private async collectSignals(
    skippedSources: { source: string; reason: string }[],
    enabledProviders?: ('rss' | 'reddit' | 'trends' | 'x')[],
    keyword?: string,
  ): Promise<ResearchSourceItem[]> {
    const providerSet = new Set(
      enabledProviders ?? this.options.enabledProviders ?? ['rss', 'reddit', 'trends', 'x'],
    );

    const sources: { name: string; fetch: () => Promise<ResearchSourceItem[] | null> }[] = [
      { name: 'rss', fetch: () => this.rssProvider.fetchLatest() },
      { name: 'reddit', fetch: () => this.redditProvider.fetchHotPosts() },
      { name: 'trends', fetch: () => this.trendsProvider.fetchTrendingQueries(keyword) },
      { name: 'x', fetch: () => this.xProvider.fetchRecentPosts() },
    ].filter((s) => providerSet.has(s.name));

    const settled = await Promise.allSettled(
      sources.map(async ({ name, fetch }) => {
        const result = await fetch();
        if (result === null) {
          skippedSources.push({ source: name, reason: 'unavailable or disabled' });
          return [];
        }
        return result;
      }),
    );

    const collected: ResearchSourceItem[] = [];
    settled.forEach((outcome, index) => {
      const name = sources[index]?.name ?? 'unknown';
      if (outcome.status === 'fulfilled') {
        collected.push(...outcome.value);
      } else {
        skippedSources.push({
          source: name,
          reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
        this.logger.warn({ source: name, err: outcome.reason }, 'Research source failed');
      }
    });

    return collected;
  }

  private async analyzeAndRank(signals: ResearchSourceItem[], maxTrends: number): Promise<ResearchTrend[]> {
    // Cap signals to keep prompt size manageable for local models.
    // Prioritize recent signals and those with engagement data.
    const capped = signals
      .slice()
      .sort((a, b) => {
        // Prefer signals with engagement data (higher = better).
        const aScore = a.engagement ?? 0;
        const bScore = b.engagement ?? 0;
        if (aScore !== bScore) return bScore - aScore;
        // Then by recency (newer = better).
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, this.options.maxSignalsForLlm);

    const prompt = buildResearchPrompt(capped, this.options.language, maxTrends);
    this.logger.debug({ signalCount: capped.length, promptLength: prompt.length }, 'Sending signals to LLM');

    try {
      const raw = await this.llm.chat({
        system:
          'You are a viral-trend analyst for a short-video content studio. Respond with strict JSON only, no markdown, no commentary.',
        prompt,
      });

      this.logger.info({ rawResponseLength: raw.length }, 'Raw LLM response received');
      this.logger.debug({ raw }, 'LLM raw response content');

      const trends = parseResearchLlmResponse(raw);
      if (trends.length === 0) {
        throw AppError.researchAnalysisFailed('LLM returned no trends for the collected signals.');
      }
      return trends;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.researchAnalysisFailed('Failed to analyze research signals.', error);
    }
  }

  private async attachVideos(trends: ResearchTrend[]): Promise<ResearchTrend[]> {
    // Bounded concurrency: max 3 concurrent YouTube searches to avoid
    // overwhelming yt-dlp subprocesses or hitting API rate limits.
    const MAX_CONCURRENT = 3;
    const results: ResearchTrend[] = new Array(trends.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < trends.length) {
        const i = nextIndex++;
        const trend = trends[i]!;
        try {
          const videos = await this.searchVideosForTrend(trend);
          results[i] = { ...trend, videos };
        } catch (error) {
          this.logger.warn({ slug: trend.slug, err: error }, 'YouTube search failed for trend');
          results[i] = { ...trend, videos: [] };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, trends.length) }, () => worker()));
    return results;
  }

  private async searchVideosForTrend(trend: ResearchTrend): Promise<YouTubeVideoResult[]> {
    const keywordVariants = trend.keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const queries = keywordVariants.length > 0 ? keywordVariants : [trend.title];

    // Search with the first (most specific) keyword, then fill remaining slots
    // with the second keyword if provided.
    const [primary, secondary] = queries;
    const results: YouTubeVideoResult[] = await this.youtubeSearchProvider.search(
      primary ?? trend.title,
    );
    if (secondary && results.length === 0) {
      const fallback = await this.youtubeSearchProvider.search(secondary);
      results.push(...fallback);
    }
    return results;
  }
}
