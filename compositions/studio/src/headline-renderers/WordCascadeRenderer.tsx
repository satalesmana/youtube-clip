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
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { wordCascadeProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';

const MAX_WORDS = 10;

interface WordCascadeRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const WordCascadeRenderer: React.FC<WordCascadeRendererProps> = ({
  text,
  theme,
  tag,
  badgePresetId,
  badgeColor,
  highlightWords,
  visualPreset,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const font = getPresetFont(visualPreset.id, visualPreset.typography);
  const isOpportunityGlow = visualPreset.id === 'opportunity-glow';

  // Keep natural sentence case for opportunity-glow, uppercase for curiosity-stack
  const allWords = text.split(/\s+/).filter(Boolean);
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
    // Fallback: 2nd word for opportunity-glow ("This [changed] everything"),
    // 3rd word for curiosity-stack ("DID YOU [KNOW] THAT")
    if (isOpportunityGlow) {
      return tokens.length >= 2 ? i === 1 : i === 0;
    }
    return tokens.length >= 3 ? i === 2 : i === 0;
  };

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: font,
    withinWidth: width * 0.88,
  });
  const headlineSize = Math.max(42, Math.min(70, Math.round(fitted.fontSize)));
  const strokeWidth = isOpportunityGlow ? 2 : Math.max(3, Math.round(headlineSize / 10));
  const useGlow = visualPreset.highlight === 'neon-glow';

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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.94,
          gap: 12,
          padding: '24px 36px',
          borderRadius: 24,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 55%, rgba(0, 0, 0, 0) 85%)',
        }}
      >
        {/* Tag pill */}
        <HookTagPill
          tag={tag}
          fontFamily={font}
          fallbackAccent={theme.accent}
          marginBottom={6}
          badgePresetId={badgePresetId}
          badgeColor={badgeColor}
        />

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
            const cascadeDecay = isOpportunityGlow ? Math.max(0.75, 1 - i * 0.08) : Math.max(0.65, 1 - i * 0.09);
            const wordOpacity = interpolate(progress, [0, 0.4], [0, cascadeDecay], { extrapolateRight: 'clamp' });
            const translateY = interpolate(progress, [0, 1], [32, 0]);
            const keyword = isKeyword(token, i);
            const underlineProg = interpolate(progress, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' });

            return (
              <div
                key={`${token}-${i}`}
                style={{
                  display: 'inline-flex',
                  opacity: wordOpacity,
                  transform: `translateY(${translateY}px)`,
                }}
              >
                <HighlightWord
                  token={token}
                  isKeyword={keyword}
                  highlightMode={visualPreset.highlight}
                  theme={theme}
                  font={font}
                  fontSize={headlineSize}
                  strokeWidth={strokeWidth}
                  underlineProgress={underlineProg}
                  isUppercase={!isOpportunityGlow}
                />
              </div>
            );
          })}
        </div>

        {/* Decoration (e.g. scribble, spark, etc.) */}
        {visualPreset.decoration && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <HookDecoration kind={visualPreset.decoration} theme={theme} size={50} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
