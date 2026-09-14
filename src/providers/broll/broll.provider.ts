import type { BrollAsset } from '../../types/b-roll.js';
import type { Logger } from '../../utils/logger.js';

/**
 * Port/Gateway for stock footage retrieval (Clean Architecture - Layer 3).
 *
 * Adheres to:
 * - ISP (Interface Segregation): Minimal, focused contract for footage searching.
 * - DIP (Dependency Inversion): High-level video services depend on this interface.
 */
export interface IBrollProvider {
  readonly name: string;
  searchFootage(query: string, options?: { minDurationSeconds?: number; maxResults?: number }): Promise<BrollAsset[]>;
  downloadAsset?(asset: BrollAsset, destPath: string): Promise<string>;
}

/** Fallback no-op B-roll provider when no external provider is configured. */
export class NoOpBrollProvider implements IBrollProvider {
  readonly name = 'noop';

  async searchFootage(_query: string): Promise<BrollAsset[]> {
    return [];
  }
}

export interface PexelsProviderOptions {
  apiKey?: string;
  logger: Logger;
  baseUrl?: string;
}

/**
 * Pexels Video API adapter for royalty-free stock B-roll footage.
 */
export class PexelsBrollProvider implements IBrollProvider {
  readonly name = 'pexels';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(options: PexelsProviderOptions) {
    this.apiKey = options.apiKey ?? process.env.PEXELS_API_KEY ?? '';
    this.baseUrl = options.baseUrl ?? 'https://api.pexels.com/videos';
    this.logger = options.logger;
  }

  async searchFootage(
    query: string,
    options?: { minDurationSeconds?: number; maxResults?: number },
  ): Promise<BrollAsset[]> {
    if (!this.apiKey) {
      this.logger.debug('Pexels API key not configured; skipping B-roll search');
      return [];
    }

    const maxResults = options?.maxResults ?? 5;
    const minDuration = options?.minDurationSeconds ?? 2;
    const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=${maxResults}&orientation=portrait`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!res.ok) {
        this.logger.warn({ status: res.status, query }, 'Pexels API returned non-OK status');
        return [];
      }

      const data = (await res.json()) as {
        videos?: Array<{
          id: number;
          duration: number;
          image: string;
          video_files?: Array<{
            id: number;
            quality: string;
            link: string;
            width: number;
            height: number;
          }>;
        }>;
      };

      if (!data.videos || data.videos.length === 0) {
        return [];
      }

      const results: BrollAsset[] = [];
      for (const video of data.videos) {
        if (video.duration < minDuration) continue;

        // Find HD portrait or best matching file
        const files = video.video_files ?? [];
        const chosenFile = files.find((f) => f.quality === 'hd') ?? files[0];
        if (!chosenFile) continue;

        results.push({
          id: String(video.id),
          source: 'pexels',
          previewUrl: video.image,
          downloadUrl: chosenFile.link,
          durationSeconds: video.duration,
          width: chosenFile.width,
          height: chosenFile.height,
        });
      }

      return results;
    } catch (error) {
      this.logger.warn({ error, query }, 'Failed to query Pexels API');
      return [];
    }
  }

  async downloadAsset(asset: BrollAsset, destPath: string): Promise<string> {
    const { writeFile } = await import('node:fs/promises');
    const res = await fetch(asset.downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download B-roll asset ${asset.id}: HTTP ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(destPath, buffer);
    asset.localFilePath = destPath;
    return destPath;
  }
}
