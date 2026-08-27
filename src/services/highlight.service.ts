import { rangesOverlap } from '../utils/timestamp.js';
import type { Logger } from '../utils/logger.js';
import type { HighlightClip } from '../types/highlight.js';

export interface HighlightServiceOptions {
  minClipSeconds: number;
  maxClipSeconds: number;
  topN: number;
}

/** Combines per-chunk highlight candidates into a single ranked list. */
export interface IHighlightService {
  /**
   * `limit` overrides the configured top-N for one call — used by the
   * two-pass flow to keep a larger rerank pool than the final output size.
   */
  mergeAndRank(clipGroups: HighlightClip[][], limit?: number): HighlightClip[];
  /** Sorts by score descending and cuts to the configured top-N. */
  cutToTopN(clips: HighlightClip[]): HighlightClip[];
}

/**
 * Merges highlight clips found across all transcript chunks: normalizes the
 * per-chunk scores onto one comparable scale, deduplicates overlapping
 * candidates (keeping the highest-scoring version), clamps clip duration to
 * the configured range, and returns the top-N by score.
 */
export class HighlightService implements IHighlightService {
  constructor(
    private readonly options: HighlightServiceOptions,
    private readonly logger: Logger,
  ) {}

  mergeAndRank(clipGroups: HighlightClip[][], limit?: number): HighlightClip[] {
    const { minClipSeconds, maxClipSeconds, topN } = this.options;
    const keepCount = limit ?? topN;

    const allClips = this.normalizeChunks(clipGroups)
      .filter((clip) => clip.end > clip.start)
      .sort((a, b) => b.score - a.score);

    const merged: HighlightClip[] = [];

    for (const clip of allClips) {
      // ANY overlap (even 1 second) merges the candidate into an existing
      // clip — concatenated reels must never repeat source seconds.
      const existing = merged.find((candidate) =>
        rangesOverlap(candidate.start, candidate.end, clip.start, clip.end),
      );

      if (!existing) {
        merged.push({ ...clip });
        continue;
      }

      // `existing` already has the higher (or equal) score since `allClips` is
      // sorted descending; only widen its time range to absorb the overlap.
      existing.start = Math.min(existing.start, clip.start);
      existing.end = Math.max(existing.end, clip.end);
    }

    const clamped = merged
      .map((clip) => this.clampDuration(clip, maxClipSeconds))
      .filter((clip) => clip.end - clip.start >= minClipSeconds);

    const ranked = this.ensureDisjoint(
      clamped.sort((a, b) => b.score - a.score).slice(0, keepCount),
      minClipSeconds,
    );

    this.logger.info(
      { candidateCount: allClips.length, mergedCount: merged.length, finalCount: ranked.length },
      'Merging highlights',
    );

    return ranked;
  }

  /**
   * Puts every chunk's scores on the same comparable scale before merging.
   *
   * Two repairs, applied per chunk:
   * 1. Scale repair — some models emit 0.0–1.0 scores regardless of the
   *    requested 0–100 scale; without correction a "legendary" 0.95 loses to
   *    a mediocre 55 from another chunk.
   * 2. Tendency repair — different calls rate on different curves (one chunk
   *    everything 80+, another caps at 60). With enough samples in a chunk,
   *    stretching its spread onto the full 0–100 scale makes the chunks
   *    comparable; with too few samples the distribution says nothing, so the
   *    (scale-repaired) raw scores pass through untouched.
   */
  private normalizeChunks(clipGroups: HighlightClip[][]): HighlightClip[] {
    return clipGroups.flatMap((group) => {
      if (group.length === 0) return [];

      // 1. Scale repair: whole group sits in the unit interval → rescale.
      const unitScale = group.every((clip) => clip.score >= 0 && clip.score <= 1);
      const rescored = unitScale
        ? group.map((clip) => ({ ...clip, score: clip.score * 100 }))
        : group;

      // 2. Tendency repair: needs enough samples AND an actual spread.
      if (rescored.length < 3) return rescored;
      const scores = rescored.map((clip) => clip.score);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      if (max - min < 1e-6) return rescored;

      return rescored.map((clip) => ({
        ...clip,
        score: ((clip.score - min) / (max - min)) * 100,
      }));
    });
  }

  /** Sorts by score descending and cuts to the configured top-N. */
  cutToTopN(clips: HighlightClip[]): HighlightClip[] {
    return [...clips].sort((a, b) => b.score - a.score).slice(0, this.options.topN);
  }

  /**
   * Final guarantee that the selected clips never share source seconds:
   * walks the list in rank order and trims any residual overlap against
   * already-accepted clips (dropping clips that fall below `minClipSeconds`).
   * This catches overlaps introduced after merging — e.g. by duration
   * clamping or range widening.
   */
  private ensureDisjoint(clips: HighlightClip[], minClipSeconds: number): HighlightClip[] {
    const accepted: HighlightClip[] = [];

    for (const clip of clips) {
      let { start, end } = clip;

      for (const kept of accepted) {
        if (!rangesOverlap(start, end, kept.start, kept.end)) continue;
        // Keep the LARGER side of this clip (the part outside the kept range).
        if (start < kept.start) end = Math.min(end, kept.start);
        else start = Math.max(start, kept.end);
      }

      if (end - start >= minClipSeconds) {
        accepted.push({ ...clip, start, end });
      }
    }

    return accepted;
  }

  /**
   * Clamps an over-long clip to `maxClipSeconds`. When the model flagged the
   * most intense sentence (`peak`), the kept window is centered on that peak
   * — cutting the tail of a clip whose payoff sits at the end used to throw
   * away exactly the moment that made it viral. Without a usable peak the
   * legacy head-of-clip cut applies.
   */
  private clampDuration(clip: HighlightClip, maxClipSeconds: number): HighlightClip {
    if (clip.end - clip.start <= maxClipSeconds) return clip;

    if (
      typeof clip.peak === 'number' &&
      Number.isFinite(clip.peak) &&
      clip.peak >= clip.start &&
      clip.peak <= clip.end
    ) {
      const half = maxClipSeconds / 2;
      // Slide the window so the peak stays inside, clamped to the clip bounds.
      const start = Math.max(clip.start, Math.min(clip.peak - half, clip.end - maxClipSeconds));
      return { ...clip, start, end: start + maxClipSeconds };
    }

    return { ...clip, end: clip.start + maxClipSeconds };
  }
}
