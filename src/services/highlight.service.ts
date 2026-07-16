import { overlapRatio } from '../utils/timestamp.js';
import type { Logger } from '../utils/logger.js';
import type { HighlightClip } from '../types/highlight.js';

/** Clips whose time ranges overlap by more than this fraction are merged. */
const OVERLAP_MERGE_THRESHOLD = 0.5;

export interface HighlightServiceOptions {
  minClipSeconds: number;
  maxClipSeconds: number;
  topN: number;
}

/** Combines per-chunk highlight candidates into a single ranked list. */
export interface IHighlightService {
  mergeAndRank(clipGroups: HighlightClip[][]): HighlightClip[];
}

/**
 * Merges highlight clips found across all transcript chunks: deduplicates
 * overlapping candidates (keeping the highest-scoring version), clamps
 * clip duration to the configured range, and returns the top-N by score.
 */
export class HighlightService implements IHighlightService {
  constructor(
    private readonly options: HighlightServiceOptions,
    private readonly logger: Logger,
  ) {}

  mergeAndRank(clipGroups: HighlightClip[][]): HighlightClip[] {
    const { minClipSeconds, maxClipSeconds, topN } = this.options;

    const allClips = clipGroups
      .flat()
      .filter((clip) => clip.end > clip.start)
      .sort((a, b) => b.score - a.score);

    const merged: HighlightClip[] = [];

    for (const clip of allClips) {
      const existing = merged.find(
        (candidate) => overlapRatio(candidate.start, candidate.end, clip.start, clip.end) > OVERLAP_MERGE_THRESHOLD,
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

    const ranked = clamped.sort((a, b) => b.score - a.score).slice(0, topN);

    this.logger.info(
      { candidateCount: allClips.length, mergedCount: merged.length, finalCount: ranked.length },
      'Merging highlights',
    );

    return ranked;
  }

  private clampDuration(clip: HighlightClip, maxClipSeconds: number): HighlightClip {
    if (clip.end - clip.start <= maxClipSeconds) return clip;
    return { ...clip, end: clip.start + maxClipSeconds };
  }
}
