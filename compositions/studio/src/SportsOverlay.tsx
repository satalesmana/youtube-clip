import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import * as React from 'react';
import { SPORTS_FONT, FONT } from './design';
import type { Theme } from './design';

/**
 * Professional Sports Broadcast & Match Context HUD:
 * - Ambient stadium top & bottom gradient vignettes to focus viewer eyes on the central action.
 * - Scoreboard / Match Context bar with pulsing live indicator.
 * - High-energy italic typography & neon yellow accents.
 */
export const SportsOverlay: React.FC<{
  theme: Theme;
  durationFrames: number;
  engagementScore?: number;
}> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation for the HUD bar
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const hudTranslateY = interpolate(enterSpring, [0, 1], [-40, 0]);
  const hudOpacity = interpolate(enterSpring, [0, 1], [0, 1]);

  // Pulsing live indicator
  const livePulse = interpolate(frame % 24, [0, 12, 24], [1, 0.35, 1]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Layer 1: Stadium Vignette Gradients (Darkens top and bottom to frame 16:9 action) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '24%',
          background: 'linear-gradient(to bottom, rgba(7, 10, 20, 0.92) 0%, rgba(7, 10, 20, 0.6) 50%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '26%',
          background: 'linear-gradient(to top, rgba(7, 10, 20, 0.94) 0%, rgba(7, 10, 20, 0.65) 55%, transparent 100%)',
        }}
      />

      {/* Layer 2: Top Scoreboard / Match Context HUD Bar */}
      <div
        style={{
          position: 'absolute',
          top: 65,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translateY(${hudTranslateY}px)`,
          opacity: hudOpacity,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(9, 13, 24, 0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(255, 230, 0, 0.35)',
            borderRadius: 14,
            padding: '7px 18px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(255, 230, 0, 0.15)',
            gap: 12,
          }}
        >
          {/* Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: theme.accent2 || '#FF2A2A',
                boxShadow: `0 0 10px ${theme.accent2 || '#FF2A2A'}`,
                opacity: livePulse,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: SPORTS_FONT,
                fontSize: 21,
                letterSpacing: 1.5,
                color: '#FFFFFF',
                fontStyle: 'italic',
                textTransform: 'uppercase',
              }}
            >
              SPORTS
            </span>
          </div>

          {/* Vertical Divider */}
          <div
            style={{
              width: 1.5,
              height: 18,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          />

          {/* Center Match Highlight Tag */}
          <span
            style={{
              fontFamily: SPORTS_FONT,
              fontSize: 22,
              letterSpacing: 2,
              color: theme.accent || '#FFE600',
              fontStyle: 'italic',
              textTransform: 'uppercase',
              textShadow: '0 0 12px rgba(255, 230, 0, 0.4)',
            }}
          >
            ⚡ CLUTCH HIGHLIGHT
          </span>

          {/* Vertical Divider */}
          <div
            style={{
              width: 1.5,
              height: 18,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          />

          {/* Right Status Badge */}
          <div
            style={{
              backgroundColor: 'rgba(255, 230, 0, 0.15)',
              border: '1px solid rgba(255, 230, 0, 0.4)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 1,
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              HD 4K
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
