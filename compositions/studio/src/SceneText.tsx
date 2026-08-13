import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { quickEnter } from './animation';
import { FONT } from './design';
import type { Theme } from './design';
import type { PlanScene } from './types';

export const SCENE_LABELS: Record<string, string> = {
  hook: 'PEMBUKAAN',
  context: 'KONTEKS',
  source: 'KLIP',
  commentary: 'ANALISIS',
  analysis: 'ANALISIS',
  supporting: 'DUKUNGAN',
  conclusion: 'KESIMPULAN',
};

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

/** Per-scene text: big title card for `graphic`, label chip for video scenes. */
export const SceneText: React.FC<{
  scene: PlanScene;
  theme: Theme;
  labels?: Record<string, string>;
}> = ({ scene, theme, labels }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const enter = quickEnter(frame, fps);

  if (scene.visual === 'graphic') {
    const text = scene.narration || '';
    const fitted = fitTextSize(text, width * 0.76, 92);
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: 70,
          paddingRight: 70,
        }}
      >
        <div
          style={{
            fontSize: fitted,
            lineHeight: 1.15,
            textAlign: 'center',
            textTransform: 'uppercase',
            fontFamily: FONT,
            color: theme.cardText,
            WebkitTextStroke: `${Math.max(2, Math.round(fitted / 14))}px ${theme.cardStroke}`,
            paintOrder: 'stroke fill',
            opacity: interpolate(enter, [0, 1], [0, 1]),
            scale: interpolate(enter, [0, 1], [0.8, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              output: 'perceptual-scale',
            }),
            translate: interpolate(enter, [0, 1], ['0px 0px', '0px 40px']),
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    );
  }

  const label = (labels ?? SCENE_LABELS)[scene.type] ?? 'ANALISIS';
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        left: 56,
        opacity: interpolate(enter, [0, 1], [0, 1]),
        translate: interpolate(enter, [0, 1], ['0px 0px', '0px -30px']),
      }}
    >
      <span
        style={{
          display: 'inline-block',
          backgroundColor: theme.accent,
          color: '#0A0A0A',
          fontFamily: FONT,
          fontSize: 34,
          letterSpacing: 3,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 22,
          paddingRight: 22,
          rotate: '-2deg',
        }}
      >
        {label}
      </span>
    </div>
  );
};
