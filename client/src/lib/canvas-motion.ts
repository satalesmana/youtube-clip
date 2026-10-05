/**
 * canvas-motion.ts — Organic Physics & Motion Engine for Remotion Canvas Elements
 *
 * Implements fluid, non-rigid animations following motion design standards:
 * - Spring physics with configurable damping, stiffness, and mass
 * - Overshoot entrance (anticipation -> pop -> settle)
 * - Micro-Life / Idle breathing (dual-harmonic wave so elements never sit dead)
 * - Natural physical behaviors for pulse (heartbeat), bounce (squash & stretch), and spin
 * - Graceful exit deceleration (eases out before the cut instead of hard disappearance)
 */

import { interpolate, spring, Easing } from 'remotion';

export type MotionPersonality = 'snappy' | 'smooth' | 'editorial' | 'floating';
export type OverlayAnimationType = 'none' | 'bounce' | 'pulse' | 'fade' | 'slide' | 'spin';

export interface OrganicMotionInput {
  /** Current Remotion frame (useCurrentFrame()) */
  frame: number;
  /** Video FPS (typically 30) */
  fps: number;
  /** Relative start time of the overlay in seconds */
  startSec: number;
  /** Relative end time of the overlay in seconds */
  endSec: number;
  /** Current content playback time in seconds */
  currentTimeSec: number;
  /** Selected animation archetype */
  animation?: OverlayAnimationType;
  /** Motion feel persona (default: 'snappy') */
  personality?: MotionPersonality;
}

export interface OrganicMotionOutput {
  /** Complete CSS transform string ready to apply */
  transform: string;
  /** Computed opacity (0 - 1) factoring entrance and graceful exit */
  opacity: number;
  /** Optional filter string (e.g. motion blur on rapid exit) */
  filter?: string;
  /** Internal progress for debugging / custom chaining */
  phase: 'entering' | 'holding' | 'exiting';
}

const SPRING_PROFILES: Record<MotionPersonality, { damping: number; stiffness: number; mass: number }> = {
  snappy: { damping: 13, stiffness: 180, mass: 0.65 },
  smooth: { damping: 20, stiffness: 125, mass: 0.95 },
  editorial: { damping: 28, stiffness: 95, mass: 1.2 },
  floating: { damping: 16, stiffness: 140, mass: 0.8 },
};

/**
 * Computes fluid, non-rigid motion for any canvas overlay element.
 */
export function computeOrganicTransform({
  frame,
  fps,
  startSec,
  endSec,
  currentTimeSec,
  animation = 'none',
  personality = 'snappy',
}: OrganicMotionInput): OrganicMotionOutput {
  const startFrame = Math.round(startSec * fps);
  const endFrame = Math.round(endSec * fps);
  const currentFrame = Math.round(currentTimeSec * fps);
  const durationFrames = Math.max(1, endFrame - startFrame);
  const localFrame = Math.max(0, currentFrame - startFrame);

  const config = SPRING_PROFILES[personality] || SPRING_PROFILES.snappy;

  // -------------------------------------------------------------------------
  // 1. Entrance Spring (Overshoot & Pop)
  // -------------------------------------------------------------------------
  const entrySpring = spring({
    frame: localFrame,
    fps,
    config,
  });

  // Scale: 0.85 -> 1.07 -> 1.0 (satisfying tactile pop)
  const entryScale = interpolate(entrySpring, [0, 0.7, 1], [0.85, 1.07, 1.0]);
  const entryTranslateY = interpolate(entrySpring, [0, 1], [24, 0]);
  const entryOpacity = interpolate(entrySpring, [0, 0.35], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // -------------------------------------------------------------------------
  // 2. Micro-Life (Continuous subtle breathing so element stays alive)
  // -------------------------------------------------------------------------
  // Use dual harmonic frequencies (irrational ratio 2.1 : 3.7) to prevent visible looping repetition
  const lifeCycle = frame / fps;
  const idleScale = 1 + 0.012 * Math.sin(lifeCycle * 2.1) + 0.006 * Math.cos(lifeCycle * 3.7);
  const idleBobY = 2.0 * Math.sin(lifeCycle * 1.8);

  // -------------------------------------------------------------------------
  // 3. Specialized Organic Animation Archetypes
  // -------------------------------------------------------------------------
  let animScale = 1;
  let animTranslateY = 0;
  let animRotate = 0;

  if (animation === 'pulse') {
    // Heartbeat rhythm: rapid diastolic pulse + soft elastic settling
    const pulseCycle = (frame % (fps * 1.2)) / (fps * 1.2); // Every 1.2 seconds
    const pulseSpring = Math.pow(Math.sin(pulseCycle * Math.PI), 4);
    animScale = 1 + 0.12 * pulseSpring;
  } else if (animation === 'bounce') {
    // Physics gravity bounce with slight squash & stretch
    const bounceCycle = (frame % (fps * 1.0)) / (fps * 1.0);
    // Parabolic arc for realistic gravity: y = 4 * h * x * (1 - x)
    const arc = 4 * bounceCycle * (1 - bounceCycle);
    animTranslateY = -12 * arc;
    // Squash on impact (when arc is close to 0)
    animScale = 1 + (arc < 0.15 ? 0.04 * (1 - arc / 0.15) : 0);
  } else if (animation === 'spin') {
    // Smooth inertial spin with gentle speed breathing
    const baseRot = (frame * 2.5) % 360;
    const speedWobble = 4 * Math.sin(lifeCycle * 3);
    animRotate = baseRot + speedWobble;
  } else if (animation === 'slide') {
    // Dynamic slide-in from bottom with natural spring settle
    const slideOffset = interpolate(entrySpring, [0, 1], [40, 0]);
    animTranslateY += slideOffset;
  } else if (animation === 'fade') {
    // Soft elegant float
    const floatY = 3 * Math.sin(lifeCycle * 1.4);
    animTranslateY += floatY;
  }

  // -------------------------------------------------------------------------
  // 4. Graceful Exit Deceleration (16 frames before overlay end)
  // -------------------------------------------------------------------------
  const exitFrames = 16;
  const framesRemaining = durationFrames - localFrame;
  const isExiting = framesRemaining <= exitFrames && framesRemaining > 0;
  const exitProgress = isExiting ? (exitFrames - framesRemaining) / exitFrames : 0;

  let exitOpacity = 1;
  let exitScale = 1;
  let exitTranslateY = 0;
  let exitBlur = 0;

  if (isExiting) {
    const exitEase = Easing.bezier(0.16, 1, 0.3, 1)(exitProgress);
    exitOpacity = 1 - exitEase;
    exitScale = interpolate(exitEase, [0, 1], [1, 0.93]);
    exitTranslateY = interpolate(exitEase, [0, 1], [0, -18]);
    exitBlur = interpolate(exitEase, [0, 1], [0, 3]);
  }

  // Phase indicator
  const phase = localFrame < 10 ? 'entering' : isExiting ? 'exiting' : 'holding';

  // Combined final transform
  const finalScale = (entryScale * idleScale * animScale * exitScale).toFixed(4);
  const finalTranslateY = (entryTranslateY + idleBobY + animTranslateY + exitTranslateY).toFixed(2);
  const finalTranslateX = -50; // Optical anchor centered on element
  const finalOpacity = Math.max(0, Math.min(1, entryOpacity * exitOpacity));

  let transform = `translate(${finalTranslateX}%, -50%) translateY(${finalTranslateY}px) scale(${finalScale})`;
  if (animRotate !== 0) {
    transform += ` rotate(${animRotate.toFixed(1)}deg)`;
  }

  return {
    transform,
    opacity: finalOpacity,
    filter: exitBlur > 0.5 ? `blur(${exitBlur.toFixed(1)}px)` : undefined,
    phase,
  };
}
