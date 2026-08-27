import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { quickEnter } from './animation';
import { FONT } from './design';
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

const fitTextSize = (text: string, withinWidth: number, cap: number, min: number): number => {
  if (!text) {
    return cap;
  }
  const { fontSize } = fitText({
    text,
    fontFamily: FONT,
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

  const renderTokens = (text: string, syncWords = false) => {
    let wordIdx = 0;
    return text.split(/(\s+)/).map((token, i) => {
      const trimmed = token.trim();
      const isWord = trimmed.length > 0;
      const spoken = syncWords && isWord && wordIdx < spokenCount;
      const isHighlight = highlightSet.has(trimmed.toLowerCase());
      const color = isHighlight || spoken ? theme.accent : undefined;
      if (isWord) {
        wordIdx += 1;
      }
      return (
        <span key={i} style={color ? { color } : undefined}>
          {token}
        </span>
      );
    });
  };

  if (caption.type === 'quote') {
    return null;
  }

  const fitted = fitTextSize(caption.text, width * 0.9, 96, 44);

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
          fontFamily: FONT,
          color: theme.fill,
          WebkitTextStroke: `${Math.max(2, Math.round(fitted / 12))}px ${theme.stroke}`,
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
