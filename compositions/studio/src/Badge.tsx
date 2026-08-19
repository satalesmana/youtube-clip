import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';

/**
 * Social-proof badge shown during the first ~2s of the hook. Builds instant
 * authority (e.g. "🔥 10RB+ Views"). Sits at the top of the safe area so
 * platform UI (Like button etc.) never covers it.
 */
export const Badge: React.FC<{
  text: string;
  theme: Theme;
  durationFrames: number;
}> = ({ text, theme, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const enter = interpolate(frame, [0, Math.round(0.25 * 30)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationFrames - Math.round(0.4 * 30)), durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 300 }}
    >
      <div
        style={{
          fontFamily: HOOK_FONT,
          fontSize: 40,
          letterSpacing: 1,
          color: '#0A0A0A',
          backgroundColor: theme.accent,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 32,
          paddingRight: 32,
          borderRadius: 999,
          boxShadow: `0 0 40px ${theme.accent}`,
          textTransform: 'uppercase',
          maxWidth: width * 0.86,
          textAlign: 'center',
          opacity: enter * exit,
          scale: interpolate(enter, [0, 1], [0.7, 1]),
          translate: interpolate(enter, [0, 1], ['0px 0px', '0px -16px']),
          rotate: '-2deg',
        }}
      >
        🔥 {text}
      </div>
    </AbsoluteFill>
  );
};