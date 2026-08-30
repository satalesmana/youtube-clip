import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

const MAX_WORDS = 10;

/**
 * Modern High-Impact Kinetic Creator Hook (Reels / TikTok / Shorts style).
 * - Kinetic Typography: High-contrast stroke + deep shadow directly over video.
 * - Dynamic Neon Keyword Highlighting: Trigger words glow vibrantly in theme accent.
 * - Clean Floating Pill Tag: Modern social media sticker style instead of dev terminal box.
 * - Pattern Interrupt: Spring punch-in entrance (1.12x -> 1.0x).
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
    config: { damping: 13, stiffness: 140, mass: 0.8 },
  });
  const scale = interpolate(entrySpring, [0, 1], [1.12, 1]);
  const opacity = interpolate(entrySpring, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.88,
  });
  const headlineSize = Math.max(46, Math.min(74, Math.round(fitted.fontSize)));
  const strokeWidth = Math.max(4, Math.round(headlineSize / 9));

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
          transform: `scale(${scale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: width * 0.94,
          gap: 16,
        }}
      >
        {/* Floating Social Pill Tag (Minimalist & Punchy) */}
        {tag ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(10, 14, 24, 0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
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

        {/* High-Impact Kinetic Headline Typography */}
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
          {tokens.map((token, i) => {
            const keyword = isKeyword(token);
            return (
              <span
                key={`${token}-${i}`}
                style={{
                  fontFamily: HOOK_FONT,
                  fontSize: headlineSize,
                  lineHeight: 1.15,
                  fontWeight: 900,
                  color: keyword ? theme.accent : '#FFFFFF',
                  WebkitTextStroke: `${strokeWidth}px #000000`,
                  paintOrder: 'stroke fill',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                  letterSpacing: '0.5px',
                  textShadow: keyword
                    ? `0 0 28px ${theme.accent}, 0 6px 16px rgba(0,0,0,0.9)`
                    : '0 6px 16px rgba(0,0,0,0.95)',
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