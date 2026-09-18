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
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';

const MAX_WORDS = 10;

interface KineticRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
}

export const KineticRenderer: React.FC<KineticRendererProps> = ({
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

  // Spring punch-in: 1.12 → 1.0
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140, mass: 0.8 },
  });
  const scale = interpolate(entrySpring, [0, 1], [1.12, 1]);
  const opacity = interpolate(entrySpring, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  const mid = Math.ceil(tokens.length / 2);
  const longestLine = tokens.length > 4
    ? (tokens.slice(0, mid).join(' ').length > tokens.slice(mid).join(' ').length
        ? tokens.slice(0, mid).join(' ')
        : tokens.slice(mid).join(' '))
    : tokens.join(' ');

  const fitted = fitText({
    text: longestLine,
    fontFamily: font,
    withinWidth: width * 0.86,
  });
  const headlineSize = Math.max(64, Math.min(84, Math.round(fitted.fontSize)));
  const strokeWidth = Math.max(4, Math.round(headlineSize / 9));

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
          transform: `scale(${scale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.94,
          gap: 14,
          padding: '24px 36px',
          borderRadius: 24,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 55%, rgba(0, 0, 0, 0) 85%)',
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
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: 12,
            rowGap: 8,
            textAlign: 'center',
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
