/**
 * WordCascadeRenderer — Staggered word-by-word spring cascade.
 *
 * Visual preset: curiosity-stack, opportunity-glow
 * Animation:     word-cascade (4-frame stagger per word)
 * Highlight:     neon-glow (accent color + glow text-shadow)
 *                OR underline (sliding underline bar under accent words)
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from '../design';
import type { Theme } from '../design';
import { wordCascadeProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';

const MAX_WORDS = 10;

interface WordCascadeRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const WordCascadeRenderer: React.FC<WordCascadeRendererProps> = ({
  text,
  theme,
  tag,
  highlightWords,
  visualPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const allWords = text.split(/\s+/).filter(Boolean);
  const tokens = allWords.slice(0, MAX_WORDS);

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const isKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    return keywordSet.has(t);
  };

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.88,
  });
  const headlineSize = Math.max(42, Math.min(70, Math.round(fitted.fontSize)));
  const strokeWidth = Math.max(3, Math.round(headlineSize / 10));
  const useGlow = visualPreset.highlight === 'neon-glow';

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: height * 0.17,
        paddingLeft: 32,
        paddingRight: 32,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.94,
          gap: 14,
        }}
      >
        {/* Tag pill */}
        {tag ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(10, 14, 24, 0.75)',
              backdropFilter: 'blur(16px)',
              border: `1.5px solid ${theme.accent}`,
              borderRadius: 9999,
              padding: '6px 20px',
              boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${theme.accent}45`,
            }}
          >
            <span
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: '1.2px',
                color: theme.accent,
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          </div>
        ) : null}

        {/* Cascading words */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-end',
            columnGap: 10,
            rowGap: 6,
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.9))',
          }}
        >
          {tokens.map((token, i) => {
            const progress = wordCascadeProgress(frame, fps, i);
            const wordOpacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });
            const translateY = interpolate(progress, [0, 1], [32, 0]);
            const keyword = isKeyword(token);

            return (
              <div
                key={`${token}-${i}`}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  opacity: wordOpacity,
                  transform: `translateY(${translateY}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: HOOK_FONT,
                    fontSize: headlineSize,
                    lineHeight: 1.15,
                    fontWeight: 900,
                    color: keyword ? theme.accent : '#FFFFFF',
                    WebkitTextStroke: `${strokeWidth}px #000000`,
                    paintOrder: 'stroke fill',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    textShadow: useGlow && keyword
                      ? `0 0 28px ${theme.accent}, 0 4px 14px rgba(0,0,0,0.9)`
                      : '0 4px 14px rgba(0,0,0,0.9)',
                  }}
                >
                  {token}
                </span>
                {/* Underline bar for highlight mode */}
                {!useGlow && keyword && (
                  <div
                    style={{
                      height: 3,
                      width: `${interpolate(progress, [0.5, 1], [0, 100], { extrapolateRight: 'clamp' })}%`,
                      background: theme.accent,
                      borderRadius: 2,
                      boxShadow: `0 0 8px ${theme.accent}80`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
