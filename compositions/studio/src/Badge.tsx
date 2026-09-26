import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';
import { SAFE_AREA } from './Caption';
import { microLifeHold, smoothExitProgress } from './animation';

/**
 * Modern Social Proof Floating Badge shown during the first ~2s of the hook.
 * Builds instant authority (e.g. "🔥 10RB+ Views" or "⚡ VIRAL REELS").
 * Sits safely inside the top safe area with clean social sticker aesthetics.
 */
export const Badge: React.FC<{
  text: string;
  theme: Theme;
  durationFrames: number;
}> = ({ text, theme, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Phase 1: Spring entrance
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140, mass: 0.8 },
  });
  const enterScale = interpolate(enterSpring, [0, 1], [0.8, 1]);
  const enterY = interpolate(enterSpring, [0, 1], [-20, 0]);

  // Phase 2: Micro-life subtle breathing
  const microLife = microLifeHold(frame, fps, { amplitudeY: 2.5, frequency: 1.8 });

  // Phase 3: Smooth 18-frame exit
  const exit = smoothExitProgress(frame, durationFrames, fps, {
    exitFrames: Math.min(18, Math.round(0.4 * fps)),
    scaleTarget: 0.9,
    translateYDelta: -16,
  });

  const finalScale = enterScale * microLife.scale * exit.scale;
  const finalY = enterY + microLife.translateY + exit.translateY;
  const finalOpacity = exit.opacity;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: SAFE_AREA.top - 10,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: HOOK_FONT,
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: '1px',
          color: '#0A0E17',
          backgroundColor: theme.accent,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 28,
          paddingRight: 28,
          borderRadius: 9999,
          boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 25px ${theme.accent}60`,
          textTransform: 'uppercase',
          maxWidth: width * 0.86,
          textAlign: 'center',
          opacity: finalOpacity,
          transform: `translateY(${finalY}px) scale(${finalScale})`,
          border: '2px solid rgba(255, 255, 255, 0.4)',
        }}
      >
        🔥 {text}
      </div>
    </AbsoluteFill>
  );
};