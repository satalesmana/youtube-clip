import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { HOOK_FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

const MAX_WORDS = 7;

/**
 * Kinetic hook headline. Big bold sans-serif claim rendered word-by-word,
 * each word springing in exactly when the voiceover reaches it (real word
 * timings when available, even distribution otherwise). Keywords color-pop in
 * accent; the rest is high-contrast white-on-stroke. Lives in the upper-middle
 * "retention zone" and stays inside the 1080x1350 safe area.
 */
export const HookHeadline: React.FC<{
  text: string;
  theme: Theme;
  highlightWords?: string[];
  wordTimings?: PlanCaption['wordTimings'];
  /** Absolute frame where the hook scene starts on the output timeline. */
  absoluteStartFrame: number;
  /** Duration of the hook scene in frames. */
  durationFrames: number;
}> = ({
  text,
  theme,
  highlightWords,
  wordTimings,
  absoluteStartFrame,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const allWords = text.split(/\s+/).filter(Boolean);
  const displayWords = allWords.slice(0, MAX_WORDS);
  const hasMore = displayWords.length < allWords.length;
  const tokens = hasMore ? [...displayWords, '…'] : displayWords;

  const keywordSet = new Set(
    (highlightWords ?? []).map((w) => w.toLowerCase()),
  );
  const isKeyword = (token: string): boolean => {
    const t = token.toLowerCase().replace(/[.,!?…]/g, '');
    if (keywordSet.has(t)) return true;
    // Numbers, percentages and high-impact words pop in accent.
    return /\b(\d+([.,]\d+)?%?|ratusan|ribuan|jutaan|pertama|terakhir|terbesar|tercepat|selamat|kagum|luar biasa|never|always|mengerikan|fantastis)\b/.test(t);
  };

  const fitted = fitText({
    text: tokens.join(' '),
    fontFamily: HOOK_FONT,
    withinWidth: width * 0.88,
  });
  const headlineSize = Math.max(48, Math.min(96, Math.round(fitted.fontSize)));

  // Frame at which each token "pops" — synced to the voice when real word
  // boundaries exist, otherwise spread evenly across the scene.
  const popFrames = tokens.map((_, i) => {
    if (wordTimings && wordTimings.length === allWords.length && i < wordTimings.length) {
      return Math.round(wordTimings[i]!.start * fps) - absoluteStartFrame;
    }
    return Math.round((i / Math.max(1, tokens.length)) * durationFrames);
  });

  // The token currently being spoken (for the beat-following pulse).
  const currentIndex = popFrames.findIndex((p, i) => {
    const next = i + 1 < popFrames.length ? popFrames[i + 1]! : Number.MAX_SAFE_INTEGER;
    return frame >= p && frame < next;
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: height * 0.3,
        paddingLeft: 56,
        paddingRight: 56,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          maxWidth: width * 0.92,
          textAlign: 'center',
          columnGap: 14,
          rowGap: 8,
        }}
      >
        {tokens.map((token, i) => {
          const pop = spring({
            frame: Math.max(0, frame - popFrames[i]!),
            fps,
            config: { damping: 18, stiffness: 160, mass: 0.8 },
          });
          const keyword = isKeyword(token);
          const spoken = i === currentIndex;
          const pulse = spoken
            ? interpolate(frame % 12, [0, 6, 12], [1, 1.18, 1])
            : 1;
          return (
            <span
              key={`${token}-${i}`}
              style={{
                fontFamily: HOOK_FONT,
                fontSize: headlineSize,
                lineHeight: 1.08,
                color: keyword ? theme.accent : theme.fill,
                WebkitTextStroke: `${Math.max(3, Math.round(headlineSize / 11))}px ${theme.stroke}`,
                paintOrder: 'stroke fill',
                textTransform: 'uppercase',
                opacity: pop,
                scale: interpolate(pop, [0, 1], [0.55, 1]) * pulse,
                rotate: `${interpolate(pop, [0, 1], [-6, 0])}deg`,
                translate: interpolate(pop, [0, 1], ['0px 0px', '0px 40px']),
                textShadow: keyword
                  ? `0 0 30px ${theme.accent}`
                  : '0 4px 24px rgba(0,0,0,0.6)',
              }}
            >
              {token}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};