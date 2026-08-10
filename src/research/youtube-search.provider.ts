import { AppError } from '../utils/errors.js';
import { runCommand } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import type { YouTubeVideoResult } from '../types/media.js';

export interface YouTubeSearchProviderOptions {
  /** YouTube Data API v3 key. When empty, falls back to yt-dlp search. */
  apiKey?: string;
  maxResults: number;
  /** Timeout per search request in milliseconds. */
  timeoutMs: number;
  /** yt-dlp binary path (used for the fallback search). */
  ytDlpBinaryPath: string;
}

export interface IYouTubeSearchProvider {
  /** Searches YouTube for videos matching `query`. */
  search(query: string): Promise<YouTubeVideoResult[]>;
}

interface YouTubeSearchApiResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; publishedAt?: string; description?: string };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }[];
  error?: { message?: string; code?: number };
}

/** Separator used to delimit fields printed by `yt-dlp --print`. */
const FIELD_SEPARATOR = '␟';

/**
 * Searches YouTube for videos matching a topic's keywords. Uses the YouTube
 * Data API v3 when `YOUTUBE_API_KEY` is configured, otherwise falls back to
 * `yt-dlp ytsearch`. Returns normalized {@link YouTubeVideoResult}s.
 */
export class YouTubeSearchProvider implements IYouTubeSearchProvider {
  constructor(
    private readonly options: YouTubeSearchProviderOptions,
    private readonly logger: Logger,
  ) {}

  async search(query: string): Promise<YouTubeVideoResult[]> {
    if (this.options.apiKey) {
      const viaApi = await this.searchViaApi(query).catch((error) => {
        this.logger.warn({ err: error }, 'YouTube Data API search failed, falling back to yt-dlp');
        return null;
      });
      if (viaApi) return viaApi;
    }
    return this.searchViaYtDlp(query);
  }

  /** Primary: YouTube Data API v3 `search.list` + `videos.list` for details. */
  private async searchViaApi(query: string): Promise<YouTubeVideoResult[] | null> {
    const { apiKey, maxResults, timeoutMs } = this.options;
    const baseUrl = 'https://www.googleapis.com/youtube/v3';
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const searchUrl =
        `${baseUrl}/search?part=snippet&type=video&maxResults=${maxResults}` +
        `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey!)}`;

      const searchResponse = await fetch(searchUrl, { signal: controller.signal });
      const searchBody = (await searchResponse.json()) as YouTubeSearchApiResponse;

      if (!searchResponse.ok || searchBody.error) {
        throw AppError.youtubeApiFailed(
          `YouTube Data API search failed: ${searchBody.error?.message ?? `HTTP ${searchResponse.status}`}`,
        );
      }

      const items = searchBody.items ?? [];
      const videoIds = items
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id));

      if (videoIds.length === 0) return [];

      // Fetch duration + viewCount for each video (1 videos.list call).
      const detailsUrl =
        `${baseUrl}/videos?part=contentDetails,statistics&id=${videoIds.join(',')}` +
        `&key=${encodeURIComponent(apiKey!)}`;

      const detailsResponse = await fetch(detailsUrl, { signal: controller.signal });
      const detailsBody = (await detailsResponse.json()) as YouTubeSearchApiResponse;

      if (!detailsResponse.ok || detailsBody.error) {
        throw AppError.youtubeApiFailed(
          `YouTube Data API videos.list failed: ${detailsBody.error?.message ?? `HTTP ${detailsResponse.status}`}`,
        );
      }

      const detailsById = new Map(
        (detailsBody.items ?? []).map((item) => [item.id?.videoId, item]),
      );

      return items
        .map((item): YouTubeVideoResult | undefined => {
          const videoId = item.id?.videoId;
          if (!videoId) return undefined;

          const details = detailsById.get(videoId);
          return {
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: item.snippet?.title ?? query,
            channel: item.snippet?.channelTitle ?? '',
            durationSeconds: parseIso8601Duration(details?.contentDetails?.duration),
            viewCount: details?.statistics?.viewCount
              ? Number(details.statistics.viewCount)
              : undefined,
            publishedAt: item.snippet?.publishedAt,
          };
        })
        .filter((video): video is YouTubeVideoResult => video !== undefined);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw AppError.youtubeApiFailed(`YouTube search timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /** Fallback: `yt-dlp "ytsearchN:query" --print` with flat-playlist. */
  private async searchViaYtDlp(query: string): Promise<YouTubeVideoResult[]> {
    const { maxResults } = this.options;
    const template = ['%(id)s', '%(title)s', '%(channel)s', '%(duration)s', '%(view_count)s', '%(upload_date)s'].join(
      FIELD_SEPARATOR,
    );

    try {
      const { stdout } = await runCommand(
        this.options.ytDlpBinaryPath,
        [
          `ytsearch${maxResults}:${query}`,
          '--flat-playlist',
          '--no-warnings',
          '--print',
          template,
        ],
        { logger: this.logger },
      );

      return stdout
        .trim()
        .split('\n')
        .map((line): YouTubeVideoResult | undefined => {
          const [videoId, title, channel, duration, viewCount, uploadDate] = line.split(FIELD_SEPARATOR);
          if (!videoId || !title) return undefined;

          return {
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title,
            channel: channel ?? '',
            durationSeconds: Number(duration) || undefined,
            viewCount: viewCount ? Number(viewCount) : undefined,
            publishedAt: uploadDate ? parseYtDlpDate(uploadDate) : undefined,
          };
        })
        .filter((video): video is YouTubeVideoResult => video !== undefined);
    } catch (error) {
      throw AppError.youtubeApiFailed(
        `yt-dlp search failed for query "${query}". ` +
          '(Configure YOUTUBE_API_KEY in .env to use the YouTube Data API instead.)',
        error,
      );
    }
  }
}

/** Parses an ISO 8601 duration (`PT1H2M3S`) into total seconds. */
export function parseIso8601Duration(duration?: string): number | undefined {
  if (!duration) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Converts a yt-dlp `YYYYMMDD` upload date to an ISO 8601 timestamp. */
function parseYtDlpDate(uploadDate: string): string | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(uploadDate);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`;
}
