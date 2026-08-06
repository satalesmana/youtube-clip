import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { ResearchSourceItem, YouTubeVideoResult } from '../types/media.js';
import type { ResearchResult, ResearchTrend } from '../types/research.js';
import type { IRedditProvider } from './reddit.provider.js';
import type { IRssProvider } from './rss.provider.js';
import type { ITrendsProvider } from './trends.provider.js';
import type { IXProvider } from './x.provider.js';
import type { IYouTubeSearchProvider } from './youtube-search.provider.js';
import { buildResearchPrompt, parseResearchLlmResponse } from './research.prompt.js';

export interface ResearchServiceOptions {
  maxTrends: number;
  language: string;
  /** Optional dedicated LLM config; falls back to the main provider when unset. */
  llm?: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
    temperature: number;
    timeoutMs: number;
    maxRetries: number;
  };
}

export interface IResearchService {
  /** Runs the full research pipeline: collect signals → analyze → match videos. */
  research(): Promise<ResearchResult>;
}

interface LlmProvider {
  chat(options: { system?: string; prompt: string; model?: string; temperature?: number; timeoutMs?: number }): Promise<string>;
}

/** Adapter that maps the main `IOllamaProvider` to the research LLM interface. */
class ProviderAdapter implements LlmProvider {
  constructor(private readonly provider: IOllamaProvider) {}
  chat(options: {
    system?: string;
    prompt: string;
    model?: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<string> {
    return this.provider.chat({
      model: options.model ?? '',
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
    });
  }
}

/** OpenAI-compatible provider used when a dedicated research LLM is configured. */
class OpenAiCompatibleLlm implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly logger: Logger,
  ) {}

  async chat(options: {
    system?: string;
    prompt: string;
    model?: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          messages: [
            ...(options.system ? [{ role: 'system', content: options.system }] : []),
            { role: 'user', content: options.prompt },
          ],
        }),
        signal: controller.signal,
      });

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
      throw AppError.researchAnalysisFailed('Failed to reach the research LLM.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
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
    private readonly mainProvider: IOllamaProvider,
    private readonly logger: Logger,
  ) {}

  async research(): Promise<ResearchResult> {
    const skippedSources: { source: string; reason: string }[] = [];
    const collected = await this.collectSignals(skippedSources);

    if (collected.length === 0) {
      throw AppError.researchSourceFailed(
        'All research sources returned no signals. Check network access and source configuration in .env.',
      );
    }

    this.logger.info({ signalCount: collected.length }, 'Research signals collected');

    const trends = await this.analyzeAndRank(collected);
    this.logger.info({ trendCount: trends.length }, 'Research trends ranked');

    // Attach YouTube videos to each trend (bounded concurrency).
    const maxTrends = this.options.maxTrends;
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
  ): Promise<ResearchSourceItem[]> {
    const sources: { name: string; fetch: () => Promise<ResearchSourceItem[] | null> }[] = [
      { name: 'rss', fetch: () => this.rssProvider.fetchLatest() },
      { name: 'reddit', fetch: () => this.redditProvider.fetchHotPosts() },
      { name: 'trends', fetch: () => this.trendsProvider.fetchTrendingQueries() },
      { name: 'x', fetch: () => this.xProvider.fetchRecentPosts() },
    ];

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

  private async analyzeAndRank(signals: ResearchSourceItem[]): Promise<ResearchTrend[]> {
    const prompt = buildResearchPrompt(signals, this.options.language, this.options.maxTrends);
    const llm = this.resolveLlm();
    const llmOptions = this.options.llm;

    try {
      const raw = await llm.chat({
        system: 'You are a viral-trend analyst for a short-video content studio. Respond with strict JSON only, no markdown, no commentary.',
        prompt,
        model: llmOptions?.model,
        temperature: llmOptions?.temperature,
        timeoutMs: llmOptions?.timeoutMs,
      });

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

  private resolveLlm(): LlmProvider {
    const llm = this.options.llm;
    if (llm?.baseUrl) {
      return new OpenAiCompatibleLlm(llm.baseUrl, llm.apiKey, this.logger);
    }
    return new ProviderAdapter(this.mainProvider);
  }

  private async attachVideos(trends: ResearchTrend[]): Promise<ResearchTrend[]> {
    return Promise.all(
      trends.map(async (trend) => {
        try {
          const videos = await this.searchVideosForTrend(trend);
          return { ...trend, videos };
        } catch (error) {
          this.logger.warn({ slug: trend.slug, err: error }, 'YouTube search failed for trend');
          return { ...trend, videos: [] };
        }
      }),
    );
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
    const results: YouTubeVideoResult[] = await this.youtubeSearchProvider.search(primary ?? trend.title);
    if (secondary && results.length === 0) {
      const fallback = await this.youtubeSearchProvider.search(secondary);
      results.push(...fallback);
    }
    return results;
  }
}
