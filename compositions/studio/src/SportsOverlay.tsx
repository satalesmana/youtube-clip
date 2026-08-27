import { interpolate, useCurrentFrame } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

/** Modern minimalist sports badge (sleek floating glass capsule). */
export const SportsOverlay: React.FC<{
  theme: Theme;
  durationFrames: number;
  engagementScore?: number;
}> = ({ theme }) => {
  const frame = useCurrentFrame();
  const livePulse = interpolate(frame % 30, [0, 15, 30], [1, 0.4, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 48,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(10, 15, 28, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 999,
        padding: '8px 20px 8px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#EF4444',
          boxShadow: '0 0 10px #EF4444',
          opacity: livePulse,
          display: 'inline-block',
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 2,
          color: theme.accent,
          textTransform: 'uppercase',
        }}
      >
        SPORTS HIGHLIGHT
      </span>
    </div>
  );
};
