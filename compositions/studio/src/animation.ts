import { interpolate, spring } from 'remotion';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Quick spring entrance used by text/captions (template pattern). */
export const quickEnter = (frame: number, fps: number): number =>
  spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });

/**
 * Blur transition between scenes: blurs in over the first `fadeFrames` frames
 * and blurs out over the last `fadeFrames` frames of a scene.
 */
export const calculateBlur = ({
  localFrame,
  sceneDurationFrames,
  fps,
  blurIn,
  blurOut,
  maxBlur = 25,
  fadeFrames = Math.round(fps * 0.7),
}: {
  localFrame: number;
  sceneDurationFrames: number;
  fps: number;
  blurIn: boolean;
  blurOut: boolean;
  maxBlur?: number;
  fadeFrames?: number;
}): number => {
  if (blurIn && localFrame < fadeFrames) {
    return (1 - localFrame / fadeFrames) * maxBlur;
  }
  if (blurOut && localFrame > sceneDurationFrames - fadeFrames) {
    return (1 - (sceneDurationFrames - localFrame) / fadeFrames) * maxBlur;
  }
  return 0;
};

/** Subtle Ken Burns zoom applied to scene video. */
export const kenBurnsScale = (
  localFrame: number,
  sceneDurationFrames: number,
): number =>
  interpolate(clamp01(localFrame / Math.max(1, sceneDurationFrames)), [0, 1], [1, 1.12]);

/** Fade in/out the whole scene content near scene boundaries (soft dip transition). */
export const sceneOpacity = (
  localFrame: number,
  sceneDurationFrames: number,
  opts: { fadeIn?: boolean; fadeOut?: boolean; fadeFrames?: number; min?: number },
): number => {
  const fadeFrames = opts.fadeFrames ?? Math.round(8);
  const min = opts.min ?? 0;
  if (opts.fadeIn && localFrame < fadeFrames) {
    return Math.max(min, localFrame / fadeFrames);
  }
  if (opts.fadeOut && localFrame > sceneDurationFrames - fadeFrames) {
    return Math.max(min, (sceneDurationFrames - localFrame) / fadeFrames);
  }
  return 1;
};
