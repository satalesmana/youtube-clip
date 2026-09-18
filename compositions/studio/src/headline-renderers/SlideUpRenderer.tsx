import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as React from 'react';
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { slideUpProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';

const MAX_WORDS = 12;

interface SlideUpRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const SlideUpRenderer: React.FC<SlideUpRendererProps> = ({
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
  const isQuestion = visualPreset.id === 'minimal-question';
  const hasQuestionMark = visualPreset.decoration === 'question-mark' || isQuestion;

  const progress = slideUpProgress(frame, fps);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(progress, [0, 1], [80, 0]);

  // Strip trailing question marks from text when question decoration is active
  const cleanedText = hasQuestionMark ? text.replace(/[?]+$/, '').trim() : text.trim();
  const allWords = cleanedText.split(/\s+/).filter(Boolean);
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
    // Fallback:
    // If Question: underline first 1-2 words ("Have you" ever wondered)
    // If Story Slide: underline last 1-2 words ("This happened" "to me")
    if (isQuestion) {
      return tokens.length > 2 ? i < 2 : i === 0;
    }
    return tokens.length > 2 ? i >= tokens.length - 2 : i === tokens.length - 1;
  };

  // Underline bar animation: enters after the block slides in
  const underlineProgress = interpolate(progress, [0.6, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Split tokens into 2 balanced stacked lines to match the preset card layout
  let line1: string[] = tokens;
  let line2: string[] = [];

  if (tokens.length >= 3) {
    if (isQuestion) {
      // Question preset: line 1 has the hook prompt ("Have you"), line 2 has the question body
      line1 = tokens.slice(0, 2);
      line2 = tokens.slice(2);
    } else {
      // Story slide: line 1 has story setup ("This happened"), line 2 has key punch ("to me")
      const splitAt = Math.max(1, tokens.length <= 4 ? tokens.length - 2 : Math.ceil(tokens.length / 2));
      line1 = tokens.slice(0, splitAt);
      line2 = tokens.slice(splitAt);
    }
  }

  const renderTokenRow = (rowTokens: string[], offsetIdx: number) => (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'baseline',
        columnGap: 14,
        rowGap: 8,
      }}
    >
      {rowTokens.map((token, rowI) => {
        const i = offsetIdx + rowI;
        const keyword = isKeyword(token, i);
        return (
          <HighlightWord
            key={`${token}-${i}`}
            token={token}
            isKeyword={keyword}
            highlightMode={visualPreset.highlight}
            theme={theme}
            font={font}
            fontSize={54}
            strokeWidth={2}
            underlineProgress={underlineProgress}
          />
        );
      })}
    </div>
  );

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
          transform: `translateY(${translateY}px)`,
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
        <HookTagPill
          tag={tag}
          presetId={badgePresetId}
          colorVariant={badgeColor}
          fontFamily={font}
          fallbackAccent={theme.accent}
          marginBottom={6}
        />

        {/* Text block — 2 balanced stacked lines */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.9))',
          }}
        >
          {renderTokenRow(line1, 0)}
          {line2.length > 0 && renderTokenRow(line2, line1.length)}
        </div>

        {/* Decoration (question-mark or custom decoration) */}
        {hasQuestionMark ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 2,
            }}
          >
            <HookDecoration kind={visualPreset.decoration ?? 'question-mark'} theme={theme} size={78} />
          </div>
        ) : visualPreset.decoration ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <HookDecoration kind={visualPreset.decoration} theme={theme} size={48} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

