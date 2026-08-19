import { useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

/** Channel branding overlay (progress bar removed). */
export const ProgressBar: React.FC<{
  theme: Theme;
  channelName?: string;
  durationFrames: number;
}> = ({ channelName }) => {
  const { width } = useVideoConfig();

  return (
    <>
      {channelName ? (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
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
