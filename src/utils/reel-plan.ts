/**
 * Plans the final segment list of a reel by inserting the optional hook intro
 * at an output-time position in the selected clips. Hook and clips are
 * independent segments: when their source ranges overlap, that footage
 * intentionally appears twice.
 *
 * **Clip ordering:** clips appear in the output in the same order as the
 * caller's `input.clips` array (i.e. the user's selection order), NOT sorted
 * by their timestamp in the source video.
 */
export interface PlannedReelSegment {
  start: number;
  end: number;
  /** `intro` = the chosen hook's source range; `clip` = a selected viral clip. */
  kind: 'intro' | 'clip' | 'gap';
}

export interface PlanReelSegmentsInput {
  /** Hook source range (absolute seconds) — inserted at introStartSec in output time. */
  intro?: { start: number; end: number };
  /** Position in the concatenated clip timeline where the hook segment begins. Defaults to 0. */
  introStartSec?: number;
  /** Empty timeline space before the selected footage, in output seconds. */
  timelineOffsetSec?: number;
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
  const intro =
    input.intro && input.intro.end > input.intro.start ? { ...input.intro } : undefined;
  const clips: PlannedReelSegment[] = [];
  const offset = Math.max(0, input.timelineOffsetSec ?? 0);
  if (offset > 0) clips.push({ start: 0, end: offset, kind: 'gap' });
  for (const rawClip of input.clips) {
    if (rawClip.end <= rawClip.start) continue; // degenerate range
    const { start, end } = rawClip;
    if (end - start < minSegmentSeconds) continue;
    clips.push({ start, end, kind: 'clip' });
  }
  if (!intro) return clips;

  const introPart: PlannedReelSegment = { ...intro, kind: 'intro' };
  let remaining = Math.max(0, input.introStartSec ?? 0);
  const parts: PlannedReelSegment[] = [];
  let inserted = false;
  for (const clip of clips) {
    const duration = clip.end - clip.start;
    if (!inserted && remaining <= duration) {
      if (remaining < minSegmentSeconds) {
        parts.push(introPart, clip);
      } else if (duration - remaining < minSegmentSeconds) {
        parts.push(clip, introPart);
      } else {
        parts.push(
          { start: clip.start, end: clip.start + remaining, kind: 'clip' },
          introPart,
          { start: clip.start + remaining, end: clip.end, kind: 'clip' },
        );
      }
      inserted = true;
      remaining = 0;
    } else {
      parts.push(clip);
      remaining -= duration;
    }
  }
  if (!inserted) parts.push(introPart);
  return parts;
}
