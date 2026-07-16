/** Formats a duration in seconds as `HH:MM:SS.mmm`. */
export function formatTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;

  const pad = (value: number, size = 2): string => value.toString().padStart(size, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(millis, 3)}`;
}

/** Clamps `value` to the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Returns true when two `[start, end]` ranges overlap at all. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Fraction of the smaller range that is covered by the intersection of the two ranges. */
export function overlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  const smallerDuration = Math.min(aEnd - aStart, bEnd - bStart);
  if (smallerDuration <= 0) return 0;

  return overlap / smallerDuration;
}

/** Rough token estimate for English text, ~4 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
