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

// ─── Visual preset renderer animation helpers ────────────────────────────────

/**
 * Per-word staggered spring entrance for WordCascadeRenderer.
 * Each word starts 4 frames later than the previous.
 * Returns a 0→1 progress value for the word at `wordIndex`.
 */
export const wordCascadeProgress = (
  frame: number,
  fps: number,
  wordIndex: number,
): number => {
  const staggerFrames = 4;
  const delayedFrame = Math.max(0, frame - wordIndex * staggerFrames);
  return spring({
    frame: delayedFrame,
    fps,
    config: { damping: 14, stiffness: 130, mass: 0.85 },
  });
};

/**
 * Single block slide-up spring for SlideUpRenderer.
 * Use the returned value to drive `translateY(${interpolate(v,[0,1],[80,0])}px)`.
 */
export const slideUpProgress = (frame: number, fps: number): number =>
  spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.9 },
  });

/**
 * Heavy overshoot scale-burst spring for BoldCapsRenderer.
 * Maps to scale: `interpolate(v, [0,1], [1.28, 1.0])`.
 * High stiffness + low damping creates a punchy overshoot feel.
 */
export const scaleBurstProgress = (frame: number, fps: number): number =>
  spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 260, mass: 0.75 },
  });

/**
 * Smooth fade entrance for FadeRenderer / fade animation preset.
 * Eases opacity from 0 to 1 over ~8 frames with clamp.
 */
export const fadeProgress = (frame: number, fps: number, durationFrames = 8): number =>
  interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
