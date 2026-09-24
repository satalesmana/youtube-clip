import type { SilenceInterval } from '../utils/ffmpeg.js';
import type { TranscriptResult, TranscriptSegment } from '../types/transcript.js';
import type { RefinedRange } from '../types/render.js';

export interface ClipRefinementOptions {
  /** Target lead-in cushion before speech, in seconds (default 0.12s cushion into silence). */
  leadInSeconds?: number;
  /** Target trailing cushion after speech, in seconds (default 0.20s cushion into silence). */
  trailingSeconds?: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

/**
 * Turns raw AI-suggested `{start, end}` into natural, complete clip boundaries:
 * - NEVER cuts mid-word or mid-sentence.
 * - Always allows the opening sentence to start cleanly without clipped initial consonants.
 * - Always allows the closing sentence to finish completely without cut-off words.
 * - Leaves a gentle acoustic cushion (80-150ms lead-in, 150-250ms trailing) in silence,
 *   strictly bounded so it never bleeds into adjacent sentences.
 * - Enforces target duration [minDuration, maxDuration] in whole-sentence steps.
 */
export interface IClipRefinementService {
  refine(
    clip: { start: number; end: number; peak?: number },
    transcript: TranscriptResult,
    silences?: SilenceInterval[],
  ): RefinedRange;
}

const DEFAULT_LEAD_IN_CUSHION = 0.12;
const DEFAULT_TRAILING_CUSHION = 0.20;

export class ClipRefinementService implements IClipRefinementService {
  constructor(private readonly options: ClipRefinementOptions) {}

  refine(
    clip: { start: number; end: number; peak?: number },
    transcript: TranscriptResult,
    silences: SilenceInterval[] = [],
  ): RefinedRange {
    const rawSegments = transcript.segments || [];
    if (rawSegments.length === 0) {
      const s = Math.max(0, clip.start);
      const e = Math.max(s + 1, clip.end);
      return { start: Number(s.toFixed(2)), end: Number(e.toFixed(2)) };
    }

    // Ensure segments are sorted chronologically
    const segments = [...rawSegments].sort((a, b) => a.start - b.start);

    // 1. Locate start segment
    let startIdx = this.findStartSegmentIndex(segments, clip.start);

    // 2. Locate end segment
    let endIdx = this.findEndSegmentIndex(segments, clip.end, startIdx);

    if (endIdx < startIdx) {
      endIdx = startIdx;
    }

    // 3. Enforce target duration bounds in whole-sentence steps
    const { minDurationSeconds, maxDurationSeconds } = this.options;

    // If over max duration: trim in whole-sentence steps
    if (segments[endIdx]!.end - segments[startIdx]!.start > maxDurationSeconds) {
      const peak = clip.peak;
      if (typeof peak === 'number' && Number.isFinite(peak) && peak >= segments[startIdx]!.start) {
        // Find segment index containing the viral peak
        let peakIdx = startIdx;
        for (let i = startIdx; i <= endIdx; i++) {
          if (peak >= segments[i]!.start && peak <= segments[i]!.end) {
            peakIdx = i;
            break;
          }
        }

        // Expand outwards around the peak while duration <= maxDurationSeconds
        let s = peakIdx;
        let e = peakIdx;
        while (s > startIdx || e < endIdx) {
          const tryS = s > startIdx ? s - 1 : s;
          const tryE = e < endIdx ? e + 1 : e;
          const durIfExpandS = segments[e]!.end - segments[tryS]!.start;
          const durIfExpandE = segments[tryE]!.end - segments[s]!.start;

          if (s > startIdx && durIfExpandS <= maxDurationSeconds) {
            s = tryS;
          } else if (e < endIdx && durIfExpandE <= maxDurationSeconds) {
            e = tryE;
          } else {
            break;
          }
        }
        startIdx = s;
        endIdx = e;
      } else {
        // Without a peak, trim from the end so the hook remains intact
        while (
          segments[endIdx]!.end - segments[startIdx]!.start > maxDurationSeconds &&
          endIdx > startIdx
        ) {
          endIdx--;
        }
      }
    }

    // If under min duration: expand in whole-sentence steps
    while (
      segments[endIdx]!.end - segments[startIdx]!.start < minDurationSeconds &&
      (endIdx + 1 < segments.length || startIdx > 0)
    ) {
      if (endIdx + 1 < segments.length) {
        endIdx++;
      } else if (startIdx > 0) {
        startIdx--;
      } else {
        break;
      }
    }

    const startSegment = segments[startIdx]!;
    const endSegment = segments[endIdx]!;
    const prevSegment = startIdx > 0 ? segments[startIdx - 1] : undefined;
    const nextSegment = endIdx + 1 < segments.length ? segments[endIdx + 1] : undefined;

    // 4. Calculate clean acoustic cushions without bleeding into neighboring speech
    const prevEnd = prevSegment ? prevSegment.end : 0;
    const gapBefore = Math.max(0, startSegment.start - prevEnd);
    const maxLeadIn = this.options.leadInSeconds ?? DEFAULT_LEAD_IN_CUSHION;
    let leadInCushion = Math.min(maxLeadIn, gapBefore / 2);

    const nextStart = nextSegment ? nextSegment.start : Infinity;
    const gapAfter = Number.isFinite(nextStart) ? Math.max(0, nextStart - endSegment.end) : 1.0;
    const maxTrailing = this.options.trailingSeconds ?? DEFAULT_TRAILING_CUSHION;
    let trailingCushion = Math.min(maxTrailing, gapAfter / 2);

    // If adding cushions exceeds maxDurationSeconds slightly, adjust the cushions
    const totalWithCushions = endSegment.end + trailingCushion - (startSegment.start - leadInCushion);
    if (totalWithCushions > maxDurationSeconds) {
      const overflow = totalWithCushions - maxDurationSeconds;
      const reduceTrailing = Math.min(overflow, trailingCushion);
      trailingCushion -= reduceTrailing;
      const remainingOverflow = overflow - reduceTrailing;
      if (remainingOverflow > 0) {
        leadInCushion = Math.max(0, leadInCushion - remainingOverflow);
      }
    }

    // 5. If measured silence intervals are provided, refine within the silence interval
    if (silences.length > 0) {
      const startSilence = silences.find(
        (s) => s.start <= startSegment.start && s.end >= prevEnd,
      );
      if (startSilence) {
        // Place start cleanly inside the silence interval before speech
        const safeStart = Math.max(startSilence.start, startSegment.start - maxLeadIn);
        leadInCushion = Math.max(0, startSegment.start - safeStart);
      }

      const endSilence = silences.find(
        (s) => s.start <= endSegment.end && s.end >= endSegment.end,
      );
      if (endSilence) {
        // Place end cleanly inside the silence interval after speech
        const safeEnd = Math.min(endSilence.end, endSegment.end + maxTrailing);
        trailingCushion = Math.max(0, safeEnd - endSegment.end);
      }
    }

    const finalStart = Math.max(0, Number((startSegment.start - leadInCushion).toFixed(2)));
    const finalEnd = Number((endSegment.end + trailingCushion).toFixed(2));

    return {
      start: finalStart,
      end: Math.max(finalStart + 0.5, finalEnd),
    };
  }

  /**
   * Finds the best sentence index to begin the clip.
   * If time falls in a pause between sentences, picks the upcoming sentence.
   * If time falls inside a sentence near the tail, advances to the next sentence.
   */
  private findStartSegmentIndex(segments: TranscriptSegment[], time: number): number {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (time < seg.start) {
        // Time falls before this segment or in the gap preceding it
        return i;
      }
      if (time >= seg.start && time <= seg.end) {
        // If time is within the last 350ms of the segment and next exists, pick next
        if (time >= seg.end - 0.35 && i + 1 < segments.length) {
          return i + 1;
        }
        return i;
      }
    }
    return Math.max(0, segments.length - 1);
  }

  /**
   * Finds the best sentence index to end the clip.
   * If time falls in a pause between sentences, picks the sentence that just finished.
   * If time barely reached into the next sentence (within 350ms), rolls back to previous.
   * Otherwise, lets the current sentence finish completely.
   */
  private findEndSegmentIndex(
    segments: TranscriptSegment[],
    time: number,
    minStartIdx: number,
  ): number {
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]!;
      if (time > seg.end) {
        // Time falls after this segment or in the gap following it
        return Math.max(minStartIdx, i);
      }
      if (time >= seg.start && time <= seg.end) {
        // If time is within the first 350ms of this segment and prev is valid, roll back to prev
        if (time <= seg.start + 0.35 && i > minStartIdx) {
          return i - 1;
        }
        // Otherwise, this sentence must be allowed to complete!
        return Math.max(minStartIdx, i);
      }
    }
    return minStartIdx;
  }
}
