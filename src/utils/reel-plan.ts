import { rangesOverlap } from './timestamp.js';

/**
 * Plans the final segment list of a reel: an optional hook intro followed by
 * the selected viral clips — guaranteeing no source second ever plays twice
 * (the same anti-repeat rule applied to generated clips upstream).
 *
 * The intro always plays FIRST in the output regardless of where its seconds
 * sit in the source video, so overlap against it is resolved independently
 * per clip; clips are then made mutually disjoint in time order.
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
  /** Selected viral clips (absolute seconds, any order). */
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

  const orderedClips = input.clips
    .map((clip) => ({ start: clip.start, end: clip.end }))
    .filter((clip) => clip.end > clip.start)
    .sort((a, b) => a.start - b.start);

  let previousEnd = -Infinity;
  for (const clip of orderedClips) {
    let { start, end } = clip;

    // Anti-repeat vs the intro: keep only footage the intro does not replay.
    if (intro && rangesOverlap(start, end, intro.start, intro.end)) {
      if (start >= intro.start) {
        // Clip begins inside the intro — drop the duplicated head.
        start = intro.end;
      } else if (end <= intro.end) {
        // Clip fully covered by the intro — nothing unique left.
        start = end;
      } else {
        // Clip spans the whole intro — keep only its unique head.
        end = intro.start;
      }
    }

    // Anti-repeat vs the previously kept clip (clips are time-ordered, so a
    // single running boundary suffices — mirrors HighlightService.ensureDisjoint).
    if (start < previousEnd) {
      if (end <= previousEnd) continue;
      start = previousEnd;
    }
    if (end - start < minSegmentSeconds) continue;

    parts.push({ start, end, kind: 'clip' });
    previousEnd = end;
  }

  return parts;
}
