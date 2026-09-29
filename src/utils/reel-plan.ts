/**
 * Plans the final segment list of a reel: an optional hook intro followed by
 * the selected viral clips. Hook and clips are independent segments: when
 * their source ranges overlap, that footage intentionally appears twice.
 *
 * The intro always plays FIRST in the output regardless of where its seconds
 * sit in the source video.
 *
 * **Clip ordering:** clips appear in the output in the same order as the
 * caller's `input.clips` array (i.e. the user's selection order), NOT sorted
 * by their timestamp in the source video.
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

  for (const rawClip of input.clips) {
    if (rawClip.end <= rawClip.start) continue; // degenerate range

    const { start, end } = rawClip;

    if (end - start < minSegmentSeconds) continue;

    parts.push({ start, end, kind: 'clip' });
  }

  return parts;
}
