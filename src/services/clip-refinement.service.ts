import type { SilenceInterval } from '../utils/ffmpeg.js';
import type { HighlightClip } from '../types/highlight.js';
import type { TranscriptResult, TranscriptSegment } from '../types/transcript.js';
import type { RefinedRange } from '../types/render.js';

export interface ClipRefinementOptions {
  /** Target lead-in padding before the hook, in seconds (2-3s per spec). */
  leadInSeconds: number;
  /** Target trailing padding after the final sentence, in seconds (1-2s per spec). */
  trailingSeconds: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

/**
 * Turns a raw AI-suggested `{start, end}` into natural clip boundaries:
 * never mid-sentence, never mid-word (transcript segments are already
 * word-aligned by the speech-to-text engine), with silence-aware padding
 * and a target 20-60s duration.
 */
export interface IClipRefinementService {
  refine(clip: HighlightClip, transcript: TranscriptResult, silences: SilenceInterval[]): RefinedRange;
}

const SILENCE_MATCH_TOLERANCE_SECONDS = 0.2;

export class ClipRefinementService implements IClipRefinementService {
  constructor(private readonly options: ClipRefinementOptions) {}

  refine(clip: HighlightClip, transcript: TranscriptResult, silences: SilenceInterval[]): RefinedRange {
    const segments = transcript.segments;
    if (segments.length === 0) {
      return { start: Math.max(0, clip.start), end: Math.max(clip.start + 1, clip.end) };
    }

    const startSegment = this.findContainingOrNearestSegment(segments, clip.start);
    const endSegment = this.findContainingOrNearestSegment(segments, clip.end);

    let start = startSegment.start;
    let end = Math.max(endSegment.end, start + 0.1);

    const previousBoundary = this.previousSegmentEnd(segments, startSegment);
    const nextBoundary = this.nextSegmentStart(segments, endSegment);

    start -= this.computeSafePadding(start, previousBoundary, silences, this.options.leadInSeconds, 'before');
    end += this.computeSafePadding(end, nextBoundary, silences, this.options.trailingSeconds, 'after');

    start = Math.max(0, start);

    return this.enforceTargetDuration(start, end, segments);
  }

  /** Finds the sentence containing `time`, or the closest one if none does. */
  private findContainingOrNearestSegment(
    segments: TranscriptSegment[],
    time: number,
  ): TranscriptSegment {
    const containing = segments.find((segment) => time >= segment.start && time <= segment.end);
    if (containing) return containing;

    let nearest = segments[0] as TranscriptSegment;
    let nearestDistance = Infinity;

    for (const segment of segments) {
      const distance = time < segment.start ? segment.start - time : time - segment.end;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = segment;
      }
    }

    return nearest;
  }

  private previousSegmentEnd(segments: TranscriptSegment[], segment: TranscriptSegment): number {
    const index = segments.indexOf(segment);
    return index > 0 ? (segments[index - 1] as TranscriptSegment).end : 0;
  }

  private nextSegmentStart(segments: TranscriptSegment[], segment: TranscriptSegment): number {
    const index = segments.indexOf(segment);
    return index >= 0 && index < segments.length - 1
      ? (segments[index + 1] as TranscriptSegment).start
      : Infinity;
  }

  /**
   * Computes how much padding can safely be added at a clip boundary without
   * cutting into neighboring speech, preferring a detected silence interval
   * (the real, measured gap) over the raw sentence-to-sentence gap.
   */
  private computeSafePadding(
    boundary: number,
    neighborBoundary: number,
    silences: SilenceInterval[],
    desired: number,
    direction: 'before' | 'after',
  ): number {
    const rawGap =
      direction === 'before' ? Math.max(0, boundary - neighborBoundary) : Math.max(0, neighborBoundary - boundary);
    if (rawGap <= 0) return 0;

    const candidateSilence =
      direction === 'before'
        ? silences
            .filter(
              (s) => s.end <= boundary + SILENCE_MATCH_TOLERANCE_SECONDS && s.start >= neighborBoundary - SILENCE_MATCH_TOLERANCE_SECONDS,
            )
            .sort((a, b) => b.end - a.end)[0]
        : silences
            .filter(
              (s) => s.start >= boundary - SILENCE_MATCH_TOLERANCE_SECONDS && s.end <= neighborBoundary + SILENCE_MATCH_TOLERANCE_SECONDS,
            )
            .sort((a, b) => a.start - b.start)[0];

    const safeGap = candidateSilence
      ? direction === 'before'
        ? boundary - candidateSilence.start
        : candidateSilence.end - boundary
      : rawGap;

    return Math.max(0, Math.min(desired, rawGap, safeGap));
  }

  /**
   * Extends or trims the clip to land within [minDurationSeconds,
   * maxDurationSeconds], always moving in whole-sentence steps.
   */
  private enforceTargetDuration(start: number, end: number, segments: TranscriptSegment[]): RefinedRange {
    const { minDurationSeconds, maxDurationSeconds } = this.options;

    for (let i = 0; i < segments.length && end - start < minDurationSeconds; i++) {
      const next = segments.find((s) => s.start >= end - 0.05 && s.end > end);
      if (!next) break;
      end = next.end;
    }

    if (end - start > maxDurationSeconds) {
      const fittingSegments = segments.filter((s) => s.end <= start + maxDurationSeconds && s.end > start);
      const lastFitting = fittingSegments.at(-1);
      end = lastFitting ? lastFitting.end : start + maxDurationSeconds;
    }

    return { start, end };
  }
}
