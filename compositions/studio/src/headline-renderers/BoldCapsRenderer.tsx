import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { getPresetFont } from '../design';
import type { Theme } from '../design';
import { microLifeHold, scaleBurstProgress, smoothExitProgress } from '../animation';
import type { VisualPreset } from '../visual-preset/index';
import { HookDecoration } from '../decorations/HookDecoration';
import { HighlightWord, getTextOutlineStyle } from './highlightUtil';
import { HookTagPill, type BadgePresetId } from './HookTagPill';
import { getHeadlineLayout } from './layoutHelper';

const MAX_WORDS = 10;

interface BoldCapsRendererProps {
  text: string;
  theme: Theme;
  tag?: string;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  highlightWords?: string[];
  visualPreset: VisualPreset;
  durationFrames?: number;
}

export const BoldCapsRenderer: React.FC<BoldCapsRendererProps> = ({
  text,
  theme,
  tag,
  badgePresetId,
  badgeColor,
  highlightWords,
  visualPreset,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const font = getPresetFont(visualPreset.id, visualPreset.typography);
  const isDataPunch = visualPreset.id === 'data-punch' || visualPreset.decoration === 'number-badge';

  // Phase 1: Heavy overshoot scale-burst
  const progress = scaleBurstProgress(frame, fps);
  const entryOpacity = interpolate(progress, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' });
  const entryScale = interpolate(progress, [0, 1], [1.28, 1.0]);

  // Phase 2: Micro-Life (Sustained hold with subtle floating bob & scale breathing)
  const microLife = microLifeHold(frame, fps, { amplitudeY: 3, frequency: 1.5 });

  // Phase 3: Smooth Exit Cycle (18-20 frames before end)
  const exit = durationFrames
    ? smoothExitProgress(frame, durationFrames, fps, { exitFrames: 18, scaleTarget: 0.94, translateYDelta: -20 })
    : { exitProgress: 0, opacity: 1, scale: 1, translateY: 0 };

  const finalScale = entryScale * microLife.scale * exit.scale;
  const finalOpacity = entryOpacity * exit.opacity;
  const finalTranslateY = microLife.translateY + exit.translateY;

  const allWords = text.toUpperCase().split(/\s+/).filter(Boolean);
  const tokens = allWords.slice(0, MAX_WORDS);

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );

  // Determine which token gets the chip/badge
  let chipIndex = -1;

  if (isDataPunch) {
    // Look for number/stat token first (e.g. 97%, $100, #1, 10)
    chipIndex = tokens.findIndex((t) => /\d/.test(t));
    if (chipIndex === -1) {
      // Fallback: use first token
      chipIndex = 0;
    }
  } else {
    // Bold impact: check explicit keyword, then trigger words, then middle token
    chipIndex = tokens.findIndex((t) => {
      const clean = t.toLowerCase().replace(/[.,!?…]/g, '');
      return keywordSet.has(clean);
    });
    if (chipIndex === -1) {
      chipIndex = tokens.findIndex((t) => {
        const clean = t.toLowerCase().replace(/[.,!?…]/g, '');
        return /\b(gila|heboh|viral|kaget|rahasia|tercepat|terakhir|terbesar|terbaik|menegangkan|mustahil|ternyata|bahaya|penting|jangan|stop|never|always|secret|mistake|shock|insane|best|truth|wrong)\b/.test(clean);
      });
    }
    if (chipIndex === -1) {
      // Fallback to middle word
      chipIndex = Math.max(0, Math.floor(tokens.length / 2));
    }
  }

  // Format into 3-part stacked layout: [beforeLine, chipText, afterLine]
  let beforeLine = '';
  const chipText = tokens[chipIndex] ?? '';
  let afterLine = '';
  let afterLine2 = '';

  if (isDataPunch && chipIndex === 0) {
    // If badge is first (e.g. "97% OF PEOPLE FAIL")
    const remaining = tokens.slice(1);
    if (remaining.length <= 2) {
      afterLine = remaining.join(' ');
    } else {
      const mid = Math.ceil(remaining.length / 2);
      afterLine = remaining.slice(0, mid).join(' ');
      afterLine2 = remaining.slice(mid).join(' ');
    }
  } else {
    beforeLine = tokens.slice(0, chipIndex).join(' ');
    const after = tokens.slice(chipIndex + 1);
    if (after.length <= 2) {
      afterLine = after.join(' ');
    } else {
      const mid = Math.ceil(after.length / 2);
      afterLine = after.slice(0, mid).join(' ');
      afterLine2 = after.slice(mid).join(' ');
    }
  }

  const layoutStyle = getHeadlineLayout(visualPreset.layout, width, height);

  const longestLine = [beforeLine, chipText, afterLine, afterLine2].sort((a, b) => b.length - a.length)[0] || 'A';
  const fitted = fitText({
    text: longestLine,
    fontFamily: font,
    withinWidth: width * (visualPreset.layout === 'split-proof' ? 0.78 : 0.85),
  });
  const baseHeadlineSize = Math.max(46, Math.min(78, Math.round(fitted.fontSize)));
  const headlineSize = Math.round(baseHeadlineSize * layoutStyle.fontSizeFactor);
  const strokeWidth = Math.max(3, Math.round(headlineSize / 9));
  const outlineStyle = getTextOutlineStyle(font, strokeWidth, '#000000', '0 6px 18px rgba(0,0,0,0.95)');

  return (
    <AbsoluteFill
      style={{
        ...layoutStyle.containerStyle,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...layoutStyle.cardStyle,
          opacity: finalOpacity,
          transform: `translateY(${finalTranslateY}px) scale(${finalScale})`,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: layoutStyle.alignItems,
          textAlign: layoutStyle.textAlign,
          gap: 12,
          borderRadius: 24,
          background: layoutStyle.background || 'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 55%, rgba(0, 0, 0, 0) 85%)',
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

        {/* Stacked 3-part Bold Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            filter: 'drop-shadow(0 14px 32px rgba(0,0,0,0.98))',
          }}
        >
          {/* Top Line */}
          {beforeLine ? (
            <span
              style={{
                fontFamily: font,
                fontSize: headlineSize,
                lineHeight: 1.15,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.6px',
                textAlign: 'center',
                ...outlineStyle,
              }}
            >
              {beforeLine}
            </span>
          ) : null}

          {/* Center Highlight Line */}
          {chipText ? (
            <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
              <HighlightWord
                token={chipText}
                isKeyword={true}
                highlightMode={visualPreset.highlight}
                theme={theme}
                font={font}
                fontSize={headlineSize}
                strokeWidth={strokeWidth}
                isUppercase={true}
              />
            </div>
          ) : null}

          {/* Bottom Line 1 */}
          {afterLine ? (
            <span
              style={{
                fontFamily: font,
                fontSize: headlineSize,
                lineHeight: 1.15,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.6px',
                textAlign: 'center',
                ...outlineStyle,
              }}
            >
              {afterLine}
            </span>
          ) : null}

          {/* Bottom Line 2 (if longer text) */}
          {afterLine2 ? (
            <span
              style={{
                fontFamily: font,
                fontSize: headlineSize,
                lineHeight: 1.15,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.6px',
                textAlign: 'center',
                ...outlineStyle,
              }}
            >
              {afterLine2}
            </span>
          ) : null}
        </div>

        {/* Decoration (e.g. number-badge, arrow, burst, etc.) */}
        {visualPreset.decoration && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <HookDecoration kind={visualPreset.decoration} theme={theme} size={54} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

