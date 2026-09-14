import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';
import { AppError } from '../utils/errors.js';
import { brollResponseSchema } from '../schemas/b-roll.schema.js';
import { buildBrollSystemPrompt, buildBrollUserPrompt } from '../prompts/b-roll.prompt.js';
import type { IAiProvider } from '../providers/ai.provider.js';
import type { IBrollProvider } from '../providers/broll/index.js';
import type { Logger } from '../utils/logger.js';
import type { BrollCue, BrollPlacement } from '../types/b-roll.js';

export interface BrollServiceOptions {
  model: string;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Use Case / Application Service for B-Roll extraction & placement (Layer 2).
 *
 * Adheres to:
 * - DIP: Injected with IAiProvider and IBrollProvider.
 * - SRP: Exclusively coordinates cue extraction and asset caching.
 */
export interface IBrollService {
  extractCues(segmentText: string, start: number, end: number): Promise<BrollCue[]>;
  resolvePlacements(cues: BrollCue[], cacheDir: string): Promise<BrollPlacement[]>;
}

export class BrollService implements IBrollService {
  constructor(
    private readonly aiProvider: IAiProvider,
    private readonly brollProvider: IBrollProvider,
    private readonly options: BrollServiceOptions,
    private readonly logger: Logger,
  ) {}

  /**
   * Prompts the AI provider to identify suitable visual moments in the dialogue.
   */
  async extractCues(segmentText: string, start: number, end: number): Promise<BrollCue[]> {
    if (!segmentText.trim() || end <= start) {
      return [];
    }

    try {
      this.logger.info({ start, end }, 'Extracting B-roll cues from transcript segment');

      const system = buildBrollSystemPrompt({ segmentStart: start, segmentEnd: end });
      const prompt = buildBrollUserPrompt({ segmentText, start, end });

      const raw = await this.aiProvider.chat({
        model: this.options.model,
        system,
        prompt,
        temperature: this.options.temperature ?? 0.3,
        timeoutMs: this.options.timeoutMs ?? 15000,
      });

      const parsed = parseJson(raw);
      const result = brollResponseSchema.safeParse(parsed);

      if (!result.success) {
        this.logger.warn({ err: result.error.message }, 'Failed to parse B-roll cues from AI response');
        return [];
      }

      // Clamp cue boundaries within segment start and end
      return result.data.cues
        .filter((c) => c.end > c.start && c.start < end && c.end > start)
        .map((c) => ({
          start: Math.max(start, Number(c.start.toFixed(2))),
          end: Math.min(end, Number(c.end.toFixed(2))),
          query: c.query.trim(),
          mood: c.mood?.trim(),
        }));
    } catch (err) {
      this.logger.warn({ err }, 'B-roll cue extraction failed — proceeding without B-roll');
      return [];
    }
  }

  /**
   * Searches for stock footage for each cue and downloads assets into the cache directory.
   */
  async resolvePlacements(cues: BrollCue[], cacheDir: string): Promise<BrollPlacement[]> {
    if (cues.length === 0) return [];
    await ensureDir(cacheDir);

    const placements: BrollPlacement[] = [];

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i]!;
      try {
        const assets = await this.brollProvider.searchFootage(cue.query, {
          minDurationSeconds: Math.ceil(cue.end - cue.start),
          maxResults: 3,
        });

        if (assets.length === 0) {
          this.logger.debug({ query: cue.query }, 'No B-roll assets found for cue');
          continue;
        }

        const chosen = assets[0]!;
        const destPath = join(cacheDir, `broll-${chosen.source}-${chosen.id}.mp4`);

        const exists = await access(destPath).then(() => true).catch(() => false);
        if (!exists && this.brollProvider.downloadAsset) {
          this.logger.info({ id: chosen.id, query: cue.query }, 'Downloading B-roll asset');
          await this.brollProvider.downloadAsset(chosen, destPath);
        } else {
          chosen.localFilePath = destPath;
        }

        placements.push({
          cue,
          asset: chosen,
          transition: 'crossfade',
        });
      } catch (err) {
        this.logger.warn({ err, cue }, 'Failed to resolve B-roll asset placement');
      }
    }

    return placements;
  }
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through
      }
    }
    throw AppError.llmInvalidResponse('Could not parse JSON from AI response');
  }
}
