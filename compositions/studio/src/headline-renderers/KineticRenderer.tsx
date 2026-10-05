/**
 * KineticRenderer — High-Impact Kinetic Typography.
 *
 * Extracted from HookHeadline (zero behavior change).
 * Visual preset: kinetic-punch
 * Animation:     spring-punch (1.12 → 1.0 scale)
 * Highlight:     neon-glow (accent color + text-shadow glow)
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { microLifeHold, smoothExitProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';
import { getHeadlineLayout, resolveCardBackdropStyle, type HookCardBackdrop } from './layoutHelper';

const MAX_WORDS = 10;

interface KineticRendererProps {
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

export const KineticRenderer: React.FC<KineticRendererProps> = ({
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

  const allWords = text.split(/\s+/).filter(Boolean);
  const displayWords = allWords.slice(0, MAX_WORDS);
  const hasMore = displayWords.length < allWords.length;
  const tokens = hasMore ? [...displayWords, '…'] : displayWords;

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const explicitKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    if (keywordSet.has(t)) return true;
    return /\b(\d+([.,]\d+)?%?|gila|heboh|viral|kaget|rahasia|tercepat|terakhir|terbesar|terbaik|menegangkan|mustahil|ternyata|bahaya|penting|jangan|stop|never|always|secret|mistake|shock|insane|best|truth|hidden|exposed)\b/.test(t);
  };

  const hasExplicitMatch = tokens.some((t) => explicitKeyword(t));
  const isKeyword = (token: string, i: number): boolean => {
    if (hasExplicitMatch) {
      return explicitKeyword(token);
    }
    // Fallback: alternate glow (odd indices) like the preset preview ("YOU'RE [DOING] THIS [WRONG]")
    return i % 2 === 1;
  };

  // Phase 1: Spring punch-in (1.12 → 1.0)
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140, mass: 0.8 },
  });
  const entryScale = interpolate(entrySpring, [0, 1], [1.12, 1]);
  const entryOpacity = interpolate(entrySpring, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  // Phase 2: Micro-Life (Sustained hold with subtle floating bob & scale breathing)
  const microLife = microLifeHold(frame, fps, { amplitudeY: 3, frequency: 1.5 });

  // Phase 3: Smooth Exit Cycle (18-20 frames before end)
  const exit = durationFrames
    ? smoothExitProgress(frame, durationFrames, fps, { exitFrames: 18, scaleTarget: 0.94, translateYDelta: -20 })
    : { exitProgress: 0, opacity: 1, scale: 1, translateY: 0 };

  const finalScale = entryScale * microLife.scale * exit.scale;
  const finalOpacity = entryOpacity * exit.opacity;
  const finalTranslateY = microLife.translateY + exit.translateY;

  const mid = Math.ceil(tokens.length / 2);
  const longestLine = tokens.length > 4
    ? (tokens.slice(0, mid).join(' ').length > tokens.slice(mid).join(' ').length
        ? tokens.slice(0, mid).join(' ')
        : tokens.slice(mid).join(' '))
    : tokens.join(' ');

  const layoutStyle = getHeadlineLayout(visualPreset.layout, width, height);

  const fitted = fitText({
    text: longestLine,
    fontFamily: font,
    withinWidth: width * (visualPreset.layout === 'split-proof' ? 0.70 : 0.76),
  });
  const baseSize = Math.max(52, Math.min(76, Math.round(fitted.fontSize)));
  const headlineSize = Math.round(baseSize * layoutStyle.fontSizeFactor);
  const strokeWidth = Math.max(4, Math.round(headlineSize / 9));

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
          transform: `translateY(${finalTranslateY}px) scale(${finalScale})`,
          opacity: finalOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: layoutStyle.alignItems,
          textAlign: layoutStyle.textAlign,
          gap: 10,
        }}
      >
        {/* Floating Social Pill Tag */}
        <HookTagPill
          tag={tag}
          presetId={badgePresetId}
          colorVariant={badgeColor}
          fontFamily={font}
          fallbackAccent={theme.accent}
          marginBottom={6}
        />

        {/* High-Impact Kinetic Headline */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: layoutStyle.alignItems === 'flex-start' ? 'flex-start' : 'center',
            alignItems: 'center',
            columnGap: 12,
            rowGap: 8,
            textAlign: layoutStyle.textAlign,
            filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.95))',
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
              isUppercase={true}
            />
          ))}
        </div>

        {/* Decoration (e.g. spark, burst, etc.) */}
        {visualPreset.decoration && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <HookDecoration kind={visualPreset.decoration} theme={theme} size={48} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
