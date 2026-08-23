import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';
import { SAFE_AREA } from './Caption';

/** Channel branding watermark with readable pill background. */
export const ProgressBar: React.FC<{
  theme: Theme;
  channelName?: string;
  durationFrames: number;
}> = ({ theme, channelName, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Subtle fade-in over first 0.5s, fade-out over last 0.4s
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationFrames - 12), durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacity = fadeIn * fadeOut;

  // Thin accent line at very top as a subtle brand marker
  return (
    <>
      {/* Thin accent hairline at top edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: 4,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
          opacity: 0.7,
        }}
      />

      {/* Channel watermark pill — readable on any background */}
      {channelName ? (
        <div
          style={{
            position: 'absolute',
            bottom: SAFE_AREA.channelBottom,
            left: 48,
            opacity,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Accent dot */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: theme.accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT,
              fontSize: 30,
              color: '#FFFFFF',
              letterSpacing: 1,
              backgroundColor: 'rgba(0,0,0,0.55)',
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 14,
              paddingRight: 14,
              borderRadius: 8,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            {channelName}
          </span>
        </div>
      ) : null}
    </>
  );
};
