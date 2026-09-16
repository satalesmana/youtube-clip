import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { fadeProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill } from './HookTagPill';

const MAX_WORDS = 12;

interface FadeRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const FadeRenderer: React.FC<FadeRendererProps> = ({
  text,
  theme,
  tag,
  highlightWords,
  visualPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const font = getPresetFont(visualPreset.id, visualPreset.typography);
  const opacity = fadeProgress(frame, fps, 10);

  const allWords = text.trim().split(/\s+/).filter(Boolean);
  const tokens = allWords.slice(0, MAX_WORDS);

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const explicitKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    return keywordSet.has(t);
  };

  const hasExplicitMatch = tokens.some((t) => explicitKeyword(t));
  const isKeyword = (token: string, i: number): boolean => {
    if (hasExplicitMatch) {
      return explicitKeyword(token);
    }
    // Default fallback: highlight middle/last key phrase
    return tokens.length > 2 ? i >= tokens.length - 2 : i === tokens.length - 1;
  };

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: font,
    withinWidth: width * 0.86,
  });
  const headlineSize = Math.max(44, Math.min(70, Math.round(fitted.fontSize)));
  const strokeWidth = Math.max(3, Math.round(headlineSize / 9));

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: height * 0.11,
        paddingLeft: 32,
        paddingRight: 32,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.94,
          gap: 14,
          padding: '28px 40px',
          borderRadius: 24,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.4) 60%, rgba(0, 0, 0, 0) 90%)',
        }}
      >
        {/* Optional Corner Frame Decoration enclosing the card */}
        {visualPreset.decoration === 'corner-frame' && (
          <HookDecoration kind="corner-frame" theme={theme} />
        )}

        {/* Tag pill */}
        <HookTagPill tag={tag} fontFamily={font} fallbackAccent={theme.accent} marginBottom={6} />

        {/* Headline Words */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: 14,
            rowGap: 8,
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.95))',
          }}
        >
          {tokens.map((token, i) => (
            <HighlightWord
              key={`${token}-${i}`}
              token={token}
              isKeyword={isKeyword(token, i)}
              highlightMode={visualPreset.highlight}
              theme={theme}
              font={font}
              fontSize={headlineSize}
              strokeWidth={strokeWidth}
              isUppercase={visualPreset.typography === 'bold-caps' || visualPreset.typography === 'kinetic'}
            />
          ))}
        </div>

        {/* Other Decoration (e.g. spark, burst, arrow, scribble) */}
        {visualPreset.decoration && visualPreset.decoration !== 'corner-frame' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <HookDecoration kind={visualPreset.decoration} theme={theme} size={46} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
