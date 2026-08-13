import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { quickEnter } from './animation';
import { FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

const fitTextSize = (text: string, withinWidth: number, cap: number): number => {
  if (!text) {
    return cap;
  }
  const { fontSize } = fitText({
    text,
    fontFamily: FONT,
    withinWidth,
  });
  return Math.min(fontSize, cap);
};

/** TikTok-style stroke caption with word highlight + karaoke progress bar. */
export const Caption: React.FC<{
  caption: PlanCaption;
  theme: Theme;
  durationFrames: number;
}> = ({ caption, theme, durationFrames }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const enter = quickEnter(frame, fps);

  const fitted = fitTextSize(caption.text, width * 0.86, 96);
  const highlightSet = new Set(
    (caption.highlightWords ?? []).map((w) => w.toLowerCase()),
  );

  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 340 }}
    >
      <div
        style={{
          fontSize: fitted,
          lineHeight: 1.12,
          textAlign: 'center',
          textTransform: 'uppercase',
          fontFamily: FONT,
          color: theme.fill,
          WebkitTextStroke: `${Math.max(2, Math.round(fitted / 12))}px ${theme.stroke}`,
          paintOrder: 'stroke fill',
          whiteSpace: 'pre',
          opacity: interpolate(enter, [0, 1], [0, 1]),
          scale: interpolate(enter, [0, 1], [0.82, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            output: 'perceptual-scale',
          }),
          translate: interpolate(enter, [0, 1], ['0px 0px', '0px 40px']),
        }}
      >
        {caption.text.split(/(\s+)/).map((token, i) => {
          const isHighlight = highlightSet.has(token.trim().toLowerCase());
          return (
            <span key={i} style={isHighlight ? { color: theme.accent } : undefined}>
              {token}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 270,
          width: width * 0.55,
          height: 10,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: theme.accent,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
