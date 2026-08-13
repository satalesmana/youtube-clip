/** Single source of truth for converting seconds to frames. */
export const toFrame = (seconds: number, fps: number): number =>
  Math.max(0, Math.round(seconds * fps));
