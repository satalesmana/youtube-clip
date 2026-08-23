import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';
import { SAFE_AREA } from './Caption';

/**
 * Sleek Broadcast Chyron Stamp:
 * A premium glassmorphic badge pinned to the top-right corner.
 * Slides in dynamically and provides a modern broadcast aesthetic.
 */
export const ClipStamp: React.FC<{
  theme: Theme;
  /** Label inside the stamp. Defaults to "TOP HOOK". */
  label?: string;
}> = ({ theme, label = 'TOP HOOK' }) => {
  const frame = useCurrentFrame();
  const fps = 30;

  const introEnd = Math.round(1.5 * fps);
  const shrinkEnd = Math.round(3 * fps);

  // Slide in from right on enter
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.7 },
  });

  // Full stamp → compact pill
  const shrinkProgress = interpolate(frame, [introEnd, shrinkEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stampFontSize = interpolate(shrinkProgress, [0, 1], [22, 18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stampPadV = interpolate(shrinkProgress, [0, 1], [8, 6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stampPadH = interpolate(shrinkProgress, [0, 1], [18, 12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateX = interpolate(slideIn, [0, 1], [120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: SAFE_AREA.top + 8,
        paddingRight: 40,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: slideIn,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(10, 10, 16, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingTop: stampPadV,
          paddingBottom: stampPadV,
          paddingLeft: stampPadH,
          paddingRight: stampPadH,
          borderRadius: 999,
          border: `1.5px solid ${theme.accent}80`,
          boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 16px ${theme.accent}30`,
        }}
      >
        {/* Pulsing indicator dot / flash icon */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: theme.accent,
            boxShadow: `0 0 8px ${theme.accent}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontSize: stampFontSize,
            fontWeight: 800,
            letterSpacing: 2,
            color: '#FFFFFF',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
    </AbsoluteFill>
  );
};
