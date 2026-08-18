import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

const TICKER = ' SPORTS NEWS  •  BREAKING HIGHLIGHTS  •  VIRAL MOMENTS  •  TOP PLAYS  •';

/** Broadcast skin overlay: header bar + LIVE badge + scrolling ticker. */
export const SportsOverlay: React.FC<{
  theme: Theme;
  durationFrames: number;
}> = ({ theme, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const livePulse = interpolate(frame % 30, [0, 15, 30], [1, 0.35, 1]);
  const tileWidth = width * 1.7;
  const offset = -((frame * 7) % tileWidth);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: 108,
          backgroundColor: theme.accent,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 56,
          paddingRight: 56,
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 46,
            letterSpacing: 4,
            color: '#0A0A0A',
          }}
        >
          SPORTS NEWS
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#E63946',
            color: '#FFFFFF',
            fontFamily: FONT,
            fontSize: 34,
            letterSpacing: 3,
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 20,
            paddingRight: 20,
            borderRadius: 6,
            opacity: livePulse,
          }}
        >
          LIVE
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 0,
          width,
          height: 86,
          backgroundColor: 'rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            whiteSpace: 'pre',
            fontFamily: FONT,
            fontSize: 40,
            letterSpacing: 2,
            color: theme.accent,
            translate: `${offset}px 0px`,
          }}
        >
          <span>{TICKER}</span>
          <span>{TICKER}</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 108,
          left: 0,
          width,
          height: 8,
          backgroundColor: theme.accent2,
        }}
      />
    </>
  );
};
