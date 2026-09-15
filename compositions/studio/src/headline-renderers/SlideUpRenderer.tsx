/**
 * SlideUpRenderer — Smooth block slide-up with optional question-mark decoration.
 *
 * Visual preset: story-slide, minimal-question
 * Animation:     slide-up (full block translateY 80px → 0)
 * Highlight:     underline (accent sliding bar under highlighted words)
 * Decoration:    question-mark (appended after the last word)
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as React from 'react';
import { HOOK_FONT } from '../design';
import type { Theme } from '../design';
import { slideUpProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';

const MAX_WORDS = 12;

interface SlideUpRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const SlideUpRenderer: React.FC<SlideUpRendererProps> = ({
  text,
  theme,
  tag,
  highlightWords,
  visualPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = slideUpProgress(frame, fps);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(progress, [0, 1], [80, 0]);
  const hasQuestionMark = visualPreset.decoration === 'question-mark';

  const allWords = text.split(/\s+/).filter(Boolean);
  const tokens = allWords.slice(0, MAX_WORDS);

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const isKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    return keywordSet.has(t);
  };

  // Underline bar animation: enters after the block slides in
  const underlineProgress = interpolate(progress, [0.6, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: height * 0.18,
        paddingLeft: 36,
        paddingRight: 36,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.9,
          gap: 12,
        }}
      >
        {/* Tag pill */}
        {tag ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(10, 14, 24, 0.7)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${theme.accent}80`,
              borderRadius: 9999,
              padding: '5px 18px',
            }}
          >
            <span
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: theme.accent,
              }}
            >
              {tag}
            </span>
          </div>
        ) : null}

        {/* Text block — mixed case, softer weight than kinetic */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-end',
            columnGap: 10,
            rowGap: 8,
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.9))',
          }}
        >
          {tokens.map((token, i) => {
            const keyword = isKeyword(token);
            return (
              <div
                key={`${token}-${i}`}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: HOOK_FONT,
                    fontSize: 54,
                    lineHeight: 1.18,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    WebkitTextStroke: '2.5px #000000',
                    paintOrder: 'stroke fill',
                    letterSpacing: '0.3px',
                    textShadow: '0 4px 14px rgba(0,0,0,0.9)',
                  }}
                >
                  {token}
                  {/* Inline question mark on last word */}
                  {hasQuestionMark && i === tokens.length - 1 && (
                    <span style={{ color: theme.accent, marginLeft: 2 }}>?</span>
                  )}
                </span>
                {/* Sliding underline bar on highlighted words */}
                {keyword && (
                  <div
                    style={{
                      height: 3,
                      width: `${underlineProgress * 100}%`,
                      background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}cc)`,
                      borderRadius: 2,
                      boxShadow: `0 0 10px ${theme.accent}70`,
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
