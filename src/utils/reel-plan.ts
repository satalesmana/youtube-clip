import { rangesOverlap } from './timestamp.js';

/**
 * Plans the final segment list of a reel: an optional hook intro followed by
 * the selected viral clips — guaranteeing no source second ever plays twice
 * (the same anti-repeat rule applied to generated clips upstream).
 *
 * The intro always plays FIRST in the output regardless of where its seconds
 * sit in the source video, so overlap against it is resolved independently
 * per clip.
 *
 * **Clip ordering:** clips appear in the output in the same order as the
 * caller's `input.clips` array (i.e. the user's selection order), NOT sorted
 * by their timestamp in the source video.  Anti-repeat trimming is applied
 * against the intro AND against every clip that has already been planned
 * (O(n²) overlap check), so the order guarantee is fully safe.
 */
export interface PlannedReelSegment {
  start: number;
  end: number;
  /** `intro` = the chosen hook's source range; `clip` = a selected viral clip. */
  kind: 'intro' | 'clip';
}

export interface PlanReelSegmentsInput {
  /** Hook source range (absolute seconds) — becomes the opening segment. */
  intro?: { start: number; end: number };
  /**
   * Selected viral clips (absolute seconds).
   * The output preserves this order — callers should pass clips in the order
   * the user selected them so the final reel matches their intent.
   */
  clips: Array<{ start: number; end: number }>;
  /** Segments shorter than this are dropped after trimming (default 1s). */
  minSegmentSeconds?: number;
}

/**
 * Pure planner — no I/O, deterministic. Returns the ordered output segments;
 * empty when nothing usable remains.
 */
export function planReelSegments(input: PlanReelSegmentsInput): PlannedReelSegment[] {
  const minSegmentSeconds = input.minSegmentSeconds ?? 1;
  const parts: PlannedReelSegment[] = [];

  const intro =
    input.intro && input.intro.end > input.intro.start ? { ...input.intro } : undefined;
  if (intro) {
    parts.push({ ...intro, kind: 'intro' });
  }

  // Collect the planned clip ranges (after trimming) for mutual anti-repeat
  // checks without relying on a sort-based running boundary.
  const plannedRanges: Array<{ start: number; end: number }> = [];

  for (const rawClip of input.clips) {
    if (rawClip.end <= rawClip.start) continue; // degenerate range

    let { start, end } = rawClip;

    // Anti-repeat vs the intro: keep only footage the intro does not replay.
    if (intro && rangesOverlap(start, end, intro.start, intro.end)) {
      if (start >= intro.start) {
        // Clip begins inside the intro — drop the duplicated head.
        start = intro.end;
      } else if (end <= intro.end) {
        // Clip fully covered by the intro — nothing unique left.
        start = end;
      } else {
        // Clip spans the whole intro — keep only its unique tail.
        start = intro.end;
      }
    }

    // Anti-repeat vs every already-planned clip: trim any overlap away.
    // We iterate all planned ranges so the user's order is respected even when
    // a later clip overlaps an earlier one that was chosen out of timestamp order.
    for (const planned of plannedRanges) {
      if (!rangesOverlap(start, end, planned.start, planned.end)) continue;

      if (start < planned.start && end > planned.end) {
        // Current clip fully contains a planned clip: keep only the head
        // (consistent with the "first occurrence wins" rule).
        end = planned.start;
      } else if (start >= planned.start) {
        // Overlapping head — advance start past the planned range.
        start = planned.end;
      } else {
        // Overlapping tail — truncate to just before the planned range.
        end = planned.start;
      }
    }

    if (end - start < minSegmentSeconds) continue;

    parts.push({ start, end, kind: 'clip' });
    plannedRanges.push({ start, end });
  }

  return parts;
}
