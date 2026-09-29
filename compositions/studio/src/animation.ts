import { Easing, interpolate, spring } from 'remotion';

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
export const fadeProgress = (frame: number, _fps: number, durationFrames = 8): number =>
  interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// ─── 3-Phase Animation Choreography (Oren Remotion Physics Standard) ────────

export interface MicroLifeOptions {
  amplitudeY?: number;   // px offset vertical bobbing (default: 4)
  frequency?: number;    // cycles per second (default: 1.6)
  scaleBreathing?: boolean; // subtle scale oscillation (default: true)
}

/**
 * Micro-Life (Hold Phase):
 * During the hold phase, maintains subtle visual life (gentle floating bob, soft glow pulse)
 * so elements never look frozen or robotic.
 */
export const microLifeHold = (
  frame: number,
  fps: number,
  options?: MicroLifeOptions,
): { translateY: number; scale: number; glowPulse: number } => {
  const amp = options?.amplitudeY ?? 4;
  const freq = options?.frequency ?? 1.6;
  const enableScale = options?.scaleBreathing ?? true;

  const cycle = (frame / Math.max(1, fps)) * Math.PI * freq;
  const translateY = Math.sin(cycle) * amp;
  const scale = enableScale ? 1 + Math.sin(cycle * 0.8) * 0.012 : 1;
  const glowPulse = 0.85 + 0.15 * Math.sin(cycle * 1.2);

  return { translateY, scale, glowPulse };
};

export interface SmoothExitOptions {
  exitFrames?: number;   // default 18 frames (~0.6s at 30fps)
  translateYDelta?: number; // px shift during exit (default -28)
  scaleTarget?: number;  // scale factor at exit end (default 0.92)
}

/**
 * Smooth 18-20 Frame Exit Cycle:
 * Executes a deterministic, smooth exit curve using Easing.inOut(Easing.cubic)
 * before the clip ends, ensuring zero abrupt cuts on headline cards and badges.
 */
export const smoothExitProgress = (
  frame: number,
  durationFrames: number,
  fps: number,
  options?: SmoothExitOptions,
): {
  exitProgress: number; // 0 = fully visible hold phase, 1 = fully exited
  opacity: number;      // 1 down to 0
  scale: number;        // 1 down to scaleTarget (e.g. 0.92)
  translateY: number;   // 0 down to translateYDelta (e.g. -28)
} => {
  const exitFrames = options?.exitFrames ?? Math.min(20, Math.max(12, Math.round(0.6 * fps)));
  const exitStart = Math.max(0, durationFrames - exitFrames);

  if (frame < exitStart || durationFrames <= exitFrames) {
    return { exitProgress: 0, opacity: 1, scale: 1, translateY: 0 };
  }

  const exitProgress = interpolate(
    frame,
    [exitStart, durationFrames],
    [0, 1],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const opacity = interpolate(exitProgress, [0, 1], [1, 0]);
  const scale = interpolate(exitProgress, [0, 1], [1, options?.scaleTarget ?? 0.92]);
  const translateY = interpolate(exitProgress, [0, 1], [0, options?.translateYDelta ?? -28]);

  return { exitProgress, opacity, scale, translateY };
};

/**
 * Frame 0 Off-Screen Anti-Flash:
 * Prevents single-frame flash artifacts before motion springs engage.
 */
export const antiFlashOffset = (frame: number, initialOffset = -180): number => {
  return frame === 0 ? initialOffset : 0;
};
