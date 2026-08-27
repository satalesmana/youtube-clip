import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

const MAX_WORDS = 10;

/**
 * Modern Viral Hook Headline Card for Video Clippers.
 * - Positioned in the Upper-Middle safe zone (top ~18-28%) avoiding TikTok/Reels UI.
 * - Pattern Interrupt: Dynamic spring punch-in scale on opening.
 * - Pattern Interrupt Pill Tag: Optional top tag (e.g. "🔥 MOMEN VIRAL", "⚡ DETIK KRUSIAL").
 * - High-Contrast Typography: Heavy bold sans, text stroke, neon glow on keywords.
 * - Premium Frosted Glass Container with glowing accent highlights.
 */
export const HookHeadline: React.FC<{
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  wordTimings?: PlanCaption['wordTimings'];
  /** Absolute frame where the hook scene starts on the output timeline. */
  absoluteStartFrame?: number;
  /** Duration of the hook scene in frames. */
  durationFrames?: number;
}> = ({
  text,
  theme,
  tag,
  highlightWords,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const allWords = text.split(/\s+/).filter(Boolean);
  const displayWords = allWords.slice(0, MAX_WORDS);
  const hasMore = displayWords.length < allWords.length;
  const tokens = hasMore ? [...displayWords, '…'] : displayWords;

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase().trim()),
  );
  const isKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    if (keywordSet.has(t)) return true;
    // Numbers, percentages, rankings, and universal emotional/curiosity trigger words (ID & EN).
    return /\b(\d+([.,]\d+)?%?|gila|heboh|viral|kaget|rahasia|tercepat|terakhir|terbesar|terbaik|menegangkan|mustahil|ternyata|bahaya|penting|jangan|stop|never|always|secret|mistake|shock|insane|best|truth|hidden|exposed)\b/.test(t);
  };

  // Kinetic spring punch-in on entry
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
  });
  const scale = interpolate(entrySpring, [0, 1], [0.88, 1]);
  const opacity = interpolate(entrySpring, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.78,
  });
  const headlineSize = Math.max(38, Math.min(62, Math.round(fitted.fontSize)));

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
          transform: `scale(${scale})`,
          opacity,
          backgroundColor: 'rgba(10, 12, 22, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `3px solid ${theme.accent}`,
          borderLeft: '1px solid rgba(255, 255, 255, 0.16)',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 22,
          padding: '20px 26px 22px 26px',
          boxShadow: `0 24px 50px rgba(0,0,0,0.92), 0 0 32px ${theme.accent}35`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.90,
          gap: 12,
        }}
      >
        {/* Optional Pattern Interrupt Pill Tag */}
        {tag ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              border: `1.5px solid ${theme.accent}`,
              borderRadius: 9999,
              padding: '5px 16px',
              boxShadow: `0 0 16px ${theme.accent}45`,
            }}
          >
            <span
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 17,
                fontWeight: 900,
                letterSpacing: '1px',
                color: theme.accent,
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          </div>
        ) : null}

        {/* Hook Headline Text with Accent Highlighting */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: 10,
            rowGap: 6,
            textAlign: 'center',
          }}
        >
          {tokens.map((token, i) => {
            const keyword = isKeyword(token);
            return (
              <span
                key={`${token}-${i}`}
                style={{
                  fontFamily: HOOK_FONT,
                  fontSize: headlineSize,
                  lineHeight: 1.18,
                  color: keyword ? theme.accent : '#FFFFFF',
                  WebkitTextStroke: `${Math.max(2, Math.round(headlineSize / 16))}px #000000`,
                  paintOrder: 'stroke fill',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                  textShadow: keyword
                    ? `0 0 22px ${theme.accent}, 0 4px 12px rgba(0,0,0,0.9)`
                    : '0 4px 14px rgba(0,0,0,0.95)',
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