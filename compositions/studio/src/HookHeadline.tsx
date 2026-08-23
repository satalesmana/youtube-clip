import { AbsoluteFill, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

const MAX_WORDS = 9;

/**
 * Modern Hook Quote Card.
 * - Positioned in the lower-left area (slightly raised).
 * - Instant full text display without word popping delay.
 * - Styled quotation icon with glowing accent border.
 */
export const HookHeadline: React.FC<{
  text: string;
  theme: Theme;
  highlightWords?: string[];
  wordTimings?: PlanCaption['wordTimings'];
  /** Absolute frame where the hook scene starts on the output timeline. */
  absoluteStartFrame?: number;
  /** Duration of the hook scene in frames. */
  durationFrames?: number;
}> = ({
  text,
  theme,
  highlightWords,
}) => {
  const { width, height } = useVideoConfig();

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

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.78,
  });
  const headlineSize = Math.max(38, Math.min(68, Math.round(fitted.fontSize)));

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        paddingBottom: height * 0.22,
        paddingLeft: 48,
        paddingRight: 48,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(8, 8, 14, 0.90)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderLeft: `6px solid ${theme.accent}`,
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 18,
          padding: '20px 28px 22px 24px',
          boxShadow: `0 20px 48px rgba(0,0,0,0.92), 0 0 28px ${theme.accent}30`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
          maxWidth: width * 0.88,
        }}
      >
        {/* Modern Glowing Quotation Mark Icon */}
        <svg
          width="34"
          height="26"
          viewBox="0 0 24 20"
          fill={theme.accent}
          style={{
            filter: `drop-shadow(0 0 10px ${theme.accent}90)`,
            flexShrink: 0,
          }}
        >
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.324 1.487-4.49 3.65-4.667 5.37C5.84 11.23 6.64 11 7.42 11c2.14 0 3.83 1.71 3.83 3.89 0 2.21-1.74 3.99-3.88 3.99-1.07 0-2.03-.54-2.787-1.559zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.324 1.487-4.49 3.65-4.667 5.37C15.84 11.23 16.64 11 17.42 11c2.14 0 3.83 1.71 3.83 3.89 0 2.21-1.74 3.99-3.88 3.99-1.07 0-2.03-.54-2.787-1.559z" />
        </svg>

        {/* Static, instantly displayed hook text */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'baseline',
            columnGap: 12,
            rowGap: 6,
            textAlign: 'left',
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
                  color: keyword ? theme.accent : '#FFFFFF',
                  WebkitTextStroke: `${Math.max(2, Math.round(headlineSize / 16))}px #000000`,
                  paintOrder: 'stroke fill',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                  textShadow: keyword
                    ? `0 0 20px ${theme.accent}, 0 4px 12px rgba(0,0,0,0.8)`
                    : '0 4px 16px rgba(0,0,0,0.9)',
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