/**
 * BoldCapsRenderer — Full-width scale-burst with chip highlights.
 *
 * Visual preset: bold-impact, data-punch
 * Animation:     scale-burst (1.28 → 1.0 heavy overshoot spring)
 * Highlight:     background-chip (filled accent chip around highlight words)
 * Decoration:    number-badge (📊 badge prepended to first number-like word)
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from '../design';
import type { Theme } from '../design';
import { scaleBurstProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';

const MAX_WORDS = 8;

interface BoldCapsRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const BoldCapsRenderer: React.FC<BoldCapsRendererProps> = ({
  text,
  theme,
  tag,
  highlightWords,
  visualPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = scaleBurstProgress(frame, fps);
  const opacity = interpolate(progress, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(progress, [0, 1], [1.28, 1.0]);
  const hasNumberBadge = visualPreset.decoration === 'number-badge';

  const allWords = text.toUpperCase().split(/\s+/).filter(Boolean);
  const tokens = allWords.slice(0, MAX_WORDS);

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const isKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    return keywordSet.has(t) || /^\d/.test(t);
  };

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.92,
  });
  const headlineSize = Math.max(52, Math.min(84, Math.round(fitted.fontSize)));
  const strokeWidth = Math.max(4, Math.round(headlineSize / 8));

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: height * 0.16,
        paddingLeft: 24,
        paddingRight: 24,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.96,
          gap: 14,
        }}
      >
        {/* Tag pill */}
        {tag ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(10, 14, 24, 0.8)',
              backdropFilter: 'blur(16px)',
              border: `2px solid ${theme.accent}`,
              borderRadius: 9999,
              padding: '6px 20px',
              boxShadow: `0 8px 24px rgba(0,0,0,0.6)`,
            }}
          >
            <span
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: '1.5px',
                color: theme.accent,
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          </div>
        ) : null}

        {/* Bold caps headline */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: 10,
            rowGap: 6,
            filter: 'drop-shadow(0 14px 32px rgba(0,0,0,0.98))',
          }}
        >
          {tokens.map((token, i) => {
            const keyword = isKeyword(token);
            // Number badge: show 📊 before the first numeric token
            const showBadge = hasNumberBadge && keyword && /^\d/.test(token) && i === tokens.findIndex((t) => /^\d/.test(t));

            if (keyword) {
              // Chip-style highlighted word
              return (
                <span
                  key={`${token}-${i}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: theme.accent,
                    borderRadius: 8,
                    padding: `4px 14px`,
                    fontFamily: HOOK_FONT,
                    fontSize: headlineSize,
                    lineHeight: 1.15,
                    fontWeight: 900,
                    color: '#000000',
                    letterSpacing: '0.5px',
                    boxShadow: `0 0 28px ${theme.accent}60`,
                  }}
                >
                  {showBadge && <span style={{ fontSize: headlineSize * 0.7 }}>📊</span>}
                  {token}
                </span>
              );
            }

            return (
              <span
                key={`${token}-${i}`}
                style={{
                  fontFamily: HOOK_FONT,
                  fontSize: headlineSize,
                  lineHeight: 1.15,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  WebkitTextStroke: `${strokeWidth}px #000000`,
                  paintOrder: 'stroke fill',
                  letterSpacing: '0.5px',
                  textShadow: '0 6px 18px rgba(0,0,0,0.95)',
                }}
              >
                {token}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
