import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { quickEnter } from './animation';
import { FONT, SPORTS_FONT } from './design';
import type { Theme } from './design';
import type { PlanCaption } from './types';

/**
 * Safe area constants for vertical layout coordination.
 * All components must use these to avoid overlap with platform UI
 * (Like, Comment, Share buttons on TikTok/Reels, dynamic island, etc).
 */
export const SAFE_AREA = {
  /** Top safe zone: below notch/dynamic island. */
  top: 200,
  /** Bottom safe zone: above platform action buttons. */
  bottom: 420,
  /** Channel watermark lives at this distance from the bottom. */
  channelBottom: 140,
};

const fitTextSize = (
  text: string,
  fontFamily: string,
  withinWidth: number,
  cap: number,
  min: number,
): number => {
  if (!text) {
    return cap;
  }
  const { fontSize } = fitText({
    text,
    fontFamily,
    withinWidth,
  });
  return Math.max(min, Math.min(fontSize, cap));
};

/** TikTok-style stroke caption with word highlight synced to the voice. */
export const Caption: React.FC<{
  caption: PlanCaption;
  theme: Theme;
  durationFrames: number;
  /** Absolute frame where this caption starts on the output timeline. */
  absoluteStartFrame?: number;
}> = ({ caption, theme, durationFrames, absoluteStartFrame }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const enter = quickEnter(frame, fps);

  const highlightSet = new Set(
    (caption.highlightWords ?? []).map((w) => w.toLowerCase()),
  );

  // Word-sync karaoke: word timings are ABSOLUTE output seconds, so the
  // comparison must use the global timeline position (start frame + local
  // frame), not the local frame inside this caption's Sequence. Without real
  // word timings, fall back to distributing the caption's duration evenly.
  const words = caption.text.split(/\s+/).filter(Boolean);
  const nWords = Math.max(1, words.length);
  const currentTime =
    absoluteStartFrame !== undefined
      ? (absoluteStartFrame + frame) / fps
      : frame / fps;
  const spokenCount = caption.wordTimings
    ? Math.min(
        nWords,
        caption.wordTimings.filter((w) => currentTime >= w.start).length,
      )
    : Math.min(
        nWords,
        Math.floor((frame / Math.max(1, durationFrames)) * nWords) + 1,
      );

  const isSports = theme.id === 'sports';
  const captionFont = isSports ? SPORTS_FONT : FONT;

  const renderTokens = (text: string, syncWords = false) => {
    let wordIdx = 0;
    return text.split(/(\s+)/).map((token, i) => {
      const trimmed = token.trim();
      const isWord = trimmed.length > 0;
      const spoken = syncWords && isWord && wordIdx < spokenCount;
      const isHighlight = highlightSet.has(trimmed.toLowerCase());
      const isEmphasized = isHighlight || spoken;
      const color = isEmphasized ? theme.accent : undefined;
      if (isWord) {
        wordIdx += 1;
      }
      return (
        <span
          key={i}
          style={{
            ...(color ? { color } : {}),
            ...(isSports && isEmphasized
              ? {
                  textShadow: `0 0 20px ${theme.accent}, 0 0 35px rgba(255, 230, 0, 0.4)`,
                  display: 'inline-block',
                  transform: 'scale(1.05)',
                }
              : {}),
          }}
        >
          {token}
        </span>
      );
    });
  };

  if (caption.type === 'quote') {
    return null;
  }

  const fitted = fitTextSize(caption.text, captionFont, width * 0.9, isSports ? 104 : 96, 44);

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: SAFE_AREA.bottom }}
    >
      <div
        style={{
          fontSize: fitted,
          lineHeight: 1.12,
          textAlign: 'center',
          textTransform: 'uppercase',
          fontFamily: captionFont,
          fontStyle: isSports ? 'italic' : 'normal',
          letterSpacing: isSports ? 2 : undefined,
          color: theme.fill,
          WebkitTextStroke: isSports
            ? `${Math.max(4, Math.round(fitted / 9))}px #000000`
            : `${Math.max(2, Math.round(fitted / 12))}px ${theme.stroke}`,
          paintOrder: 'stroke fill',
          maxWidth: width * 0.92,
          whiteSpace: 'normal',
          opacity: interpolate(enter, [0, 1], [0, 1]),
          scale: interpolate(enter, [0, 1], [0.82, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            output: 'perceptual-scale',
          }),
          translate: interpolate(enter, [0, 1], ['0px 20px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {renderTokens(caption.text, true)}
      </div>
    </AbsoluteFill>
  );
};
