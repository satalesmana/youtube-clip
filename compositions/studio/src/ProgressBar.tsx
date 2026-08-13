import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

/** Bottom progress bar + channel branding overlay. */
export const ProgressBar: React.FC<{
  theme: Theme;
  channelName?: string;
  durationFrames: number;
}> = ({ theme, channelName, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 14,
          width,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: theme.accent,
          }}
        />
      </div>
      {channelName ? (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 48,
            fontFamily: FONT,
            fontSize: 30,
            color: '#FFFFFF',
            letterSpacing: 1,
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
          }}
        >
          {channelName}
        </div>
      ) : null}
    </>
  );
};
