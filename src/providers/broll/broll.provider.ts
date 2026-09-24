import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  private apiKey?: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(options: PexelsProviderOptions) {
    this.apiKey = options.apiKey?.trim();
    this.baseUrl = options.baseUrl ?? 'https://api.pexels.com/videos';
    this.logger = options.logger;
  }

  private resolveApiKey(): string {
    if (this.apiKey) return this.apiKey;
    if (process.env.PEXELS_API_KEY?.trim()) {
      this.apiKey = process.env.PEXELS_API_KEY.trim();
      return this.apiKey;
    }
    try {
      const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
      const match = content.match(/^PEXELS_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match?.[1]) {
        const keyVal = match[1].trim();
        this.apiKey = keyVal;
        process.env.PEXELS_API_KEY = keyVal;
        return keyVal;
      }
    } catch {
      // Ignore
    }
    return '';
  }

  async searchFootage(
    query: string,
    options?: { minDurationSeconds?: number; maxResults?: number },
  ): Promise<BrollAsset[]> {
    const key = this.resolveApiKey();
    if (!key) {
      this.logger.debug('Pexels API key not configured; skipping B-roll search');
      return [];
    }

    const cleanQuery = query
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanQuery) return [];

    const maxResults = options?.maxResults ?? 5;
    const minDuration = options?.minDurationSeconds ?? 2;
    const url = `${this.baseUrl}/search?query=${encodeURIComponent(cleanQuery)}&per_page=${maxResults}&orientation=portrait`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: key,
        },
      });

      if (!res.ok) {
        this.logger.warn({ status: res.status, query: cleanQuery }, 'Pexels API returned non-OK status');
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

        const files = video.video_files ?? [];
        // Prioritize vertical 9:16 videos (height > width)
        const portraitFiles = files.filter((f) => f.height > f.width);
        const pool = portraitFiles.length > 0 ? portraitFiles : files;

        // Pick crisp standard HD (1080p/720p) to avoid huge 4K downloads
        const chosenFile =
          pool.find((f) => f.height === 1920 && f.width === 1080) ??
          pool.find((f) => f.height === 1280 && f.width === 720) ??
          pool.find((f) => f.quality === 'hd' && f.height <= 1920) ??
          pool[0];

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
      this.logger.warn({ error, query: cleanQuery }, 'Failed to query Pexels API');
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

import { searchCuratedCatalog } from './stock-catalog.js';

/**
 * High-quality curated stock footage provider.
 * Requires zero API keys and serves as an instant fallback with verified playable MP4s.
 */
export class CuratedStockBrollProvider implements IBrollProvider {
  readonly name = 'curated';

  constructor(private readonly logger?: Logger) {}

  async searchFootage(
    query: string,
    options?: { minDurationSeconds?: number; maxResults?: number },
  ): Promise<BrollAsset[]> {
    const maxResults = options?.maxResults ?? 5;
    const assets = searchCuratedCatalog(query, maxResults);
    this.logger?.debug({ query, count: assets.length }, 'Curated stock footage searched');
    return assets;
  }

  async downloadAsset(asset: BrollAsset, destPath: string): Promise<string> {
    const { writeFile, copyFile, access } = await import('node:fs/promises');
    const { resolve } = await import('node:path');

    // Fast-path: local stock broll in client/public/stock-broll/
    if (asset.downloadUrl.startsWith('/stock-broll/')) {
      const filename = asset.downloadUrl.replace('/stock-broll/', '');
      const localFile = resolve(process.cwd(), 'client/public/stock-broll', filename);
      const exists = await access(localFile).then(() => true).catch(() => false);
      if (exists) {
        await copyFile(localFile, destPath);
        asset.localFilePath = destPath;
        return destPath;
      }
    }

    let fetchUrl = asset.downloadUrl;
    if (fetchUrl.startsWith('/')) {
      fetchUrl = `http://localhost:3000${fetchUrl}`;
    }

    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to download curated B-roll asset ${asset.id}: HTTP ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(destPath, buffer);
    asset.localFilePath = destPath;
    return destPath;
  }
}

/**
 * Smart hybrid B-roll provider:
 * 1. Checks Pexels API if PEXELS_API_KEY is configured.
 * 2. If Pexels returns results, returns them.
 * 3. Falls back seamlessly to curated royalty-free catalog if Pexels has no key or 0 results.
 */
export class SmartBrollProvider implements IBrollProvider {
  readonly name = 'smart-hybrid';
  private readonly pexels: PexelsBrollProvider;
  private readonly curated: CuratedStockBrollProvider;

  constructor(options?: { apiKey?: string; logger?: Logger }) {
    const fallbackLogger: Logger =
      options?.logger ??
      ({
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
        trace: () => {},
        child: () => fallbackLogger,
      } as unknown as Logger);
    this.pexels = new PexelsBrollProvider({ apiKey: options?.apiKey, logger: fallbackLogger });
    this.curated = new CuratedStockBrollProvider(options?.logger);
  }

  async searchFootage(
    query: string,
    options?: { minDurationSeconds?: number; maxResults?: number },
  ): Promise<BrollAsset[]> {
    const pexelsResults = await this.pexels.searchFootage(query, options);
    if (pexelsResults.length > 0) {
      return pexelsResults;
    }
    return this.curated.searchFootage(query, options);
  }

  async downloadAsset(asset: BrollAsset, destPath: string): Promise<string> {
    if (asset.source === 'pexels') {
      return this.pexels.downloadAsset(asset, destPath);
    }
    return this.curated.downloadAsset(asset, destPath);
  }
}

