import { interpolate, spring } from 'remotion';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Quick spring entrance used by text/captions (template pattern). */
export const quickEnter = (frame: number, fps: number): number =>
  spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });

/**
 * Clean scene cut transition. Returns 0 to keep cuts crisp and immediate
 * like modern TikTok/Reels clippers (avoiding sluggish 0.7s blur fog).
 */
export const calculateBlur = ({
  localFrame,
  sceneDurationFrames,
  fps,
  blurIn,
  blurOut,
  maxBlur = 0,
  fadeFrames = 0,
}: {
  localFrame: number;
  sceneDurationFrames: number;
  fps: number;
  blurIn: boolean;
  blurOut: boolean;
  maxBlur?: number;
  fadeFrames?: number;
}): number => {
  if (maxBlur <= 0 || fadeFrames <= 0) return 0;
  if (blurIn && localFrame < fadeFrames) {
    return (1 - localFrame / fadeFrames) * maxBlur;
  }
  if (blurOut && localFrame > sceneDurationFrames - fadeFrames) {
    return (1 - (sceneDurationFrames - localFrame) / fadeFrames) * maxBlur;
  }
  return 0;
};

/** Subtle, continuous Ken Burns zoom applied to scene video for visual momentum. */
export const kenBurnsScale = (
  localFrame: number,
  sceneDurationFrames: number,
): number =>
  interpolate(clamp01(localFrame / Math.max(1, sceneDurationFrames)), [0, 1], [1, 1.06]);

/** Crisp scene opacity: maintains full brightness without flickering black dips. */
export const sceneOpacity = (
  _localFrame: number,
  _sceneDurationFrames: number,
  _opts?: { fadeIn?: boolean; fadeOut?: boolean; fadeFrames?: number; min?: number },
): number => 1;

