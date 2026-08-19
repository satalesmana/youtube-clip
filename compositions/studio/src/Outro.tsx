import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

const OUTRO_TEXT = 'IKUTI UNTUK LEBIH BANYAK';

/** End-of-video CTA: dark card with "follow" call-to-action + channel name, fading in, then fade-to-black. */
export const Outro: React.FC<{
  theme: Theme;
  channelName?: string;
  durationFrames: number;
}> = ({ theme, channelName, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, Math.round(0.5 * 30)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeToBlack = interpolate(
    frame,
    [Math.max(0, durationFrames - 12), durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const accentPulse = interpolate(frame % 30, [0, 15, 30], [1, 0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
          opacity: 0.35,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeIn,
          translate: interpolate(frame, [0, 12], ['0px 40px', '0px 0px']),
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 108,
            letterSpacing: 4,
            color: theme.accent,
            textTransform: 'uppercase',
            textAlign: 'center',
            lineHeight: 1.1,
            textShadow: `0 6px 30px ${theme.stroke}`,
            opacity: accentPulse,
          }}
        >
          {OUTRO_TEXT}
        </div>
        {channelName ? (
          <div
            style={{
              marginTop: 40,
              fontFamily: FONT,
              fontSize: 52,
              letterSpacing: 2,
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            @{channelName}
          </div>
        ) : null}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: fadeToBlack }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: 6,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width,
          height: 6,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
