import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as React from 'react';
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { microLifeHold, slideUpProgress, smoothExitProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';
import { getHeadlineLayout, resolveCardBackdropStyle, type HookCardBackdrop } from './layoutHelper';

const MAX_WORDS = 12;

interface SlideUpRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  backdrop?: HookCardBackdrop;
  highlightWords?: string[];
  visualPreset: VisualPreset;
  durationFrames?: number;
}

export const SlideUpRenderer: React.FC<SlideUpRendererProps> = ({
  text,
  theme,
  tag,
  badgePresetId,
  badgeColor,
  backdrop,
  highlightWords,
  visualPreset,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const font = getPresetFont(visualPreset.id, visualPreset.typography);
  const isQuestion = visualPreset.id === 'minimal-question';
  const hasQuestionMark = visualPreset.decoration === 'question-mark' || isQuestion;

  // Phase 1: Entrance Slide Up
  const progress = slideUpProgress(frame, fps);
  const entryOpacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });
  const entryTranslateY = interpolate(progress, [0, 1], [80, 0]);

  // Phase 2: Micro-Life (Sustained hold with subtle floating bob & scale breathing)
  const microLife = microLifeHold(frame, fps, { amplitudeY: 3, frequency: 1.4 });

  // Phase 3: Smooth Exit Cycle (18-20 frames before end)
  const exit = durationFrames
    ? smoothExitProgress(frame, durationFrames, fps, { exitFrames: 18, scaleTarget: 0.94, translateYDelta: -20 })
    : { exitProgress: 0, opacity: 1, scale: 1, translateY: 0 };

  const finalTranslateY = entryTranslateY + microLife.translateY + exit.translateY;
  const finalOpacity = entryOpacity * exit.opacity;
  const finalScale = microLife.scale * exit.scale;

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

  const layoutStyle = getHeadlineLayout(visualPreset.layout, width, height);

  const renderTokenRow = (rowTokens: string[], offsetIdx: number) => (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: layoutStyle.alignItems === 'flex-start' ? 'flex-start' : 'center',
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
            fontSize={Math.round(48 * layoutStyle.fontSizeFactor)}
            strokeWidth={2}
            underlineProgress={underlineProgress}
          />
        );
      })}
    </div>
  );

  const containerStyle = layoutStyle.containerStyle;

  const cardBackdropStyle = resolveCardBackdropStyle(
    backdrop ?? 'cinematic-banner',
    theme,
    width,
    layoutStyle.cardStyle,
  );

  return (
    <AbsoluteFill
      style={{
        ...containerStyle,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...cardBackdropStyle,
          opacity: finalOpacity,
          transform: `translateY(${finalTranslateY}px) scale(${finalScale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: layoutStyle.alignItems,
          textAlign: layoutStyle.textAlign,
          gap: 10,
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
            alignItems: layoutStyle.alignItems,
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

