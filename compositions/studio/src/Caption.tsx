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
  /** Subtitle style preset: 'beast' | 'hormozi' | 'clean' */
  subtitleStyle?: string;
}> = ({ caption, theme, durationFrames, absoluteStartFrame, subtitleStyle = 'beast' }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const enter = quickEnter(frame, fps);

  const highlightSet = new Set(
    (caption.highlightWords ?? []).map((w) => w.toLowerCase()),
  );

  const isHormozi = subtitleStyle === 'hormozi';
  const isClean = subtitleStyle === 'clean';
  const isBeast = !isHormozi && !isClean;

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
  const captionFont = isHormozi
    ? 'Impact, "Arial Black", sans-serif'
    : isClean
    ? 'Inter, system-ui, -apple-system, sans-serif'
    : isSports
    ? SPORTS_FONT
    : FONT;

  const renderTokens = (text: string, syncWords = false) => {
    let wordIdx = 0;
    return text.split(/(\s+)/).map((token, i) => {
      const trimmed = token.trim();
      const isWord = trimmed.length > 0;
      const spoken = syncWords && isWord && wordIdx < spokenCount;
      const isHighlight = highlightSet.has(trimmed.toLowerCase());
      const isEmphasized = isHighlight || spoken;

      let color: string | undefined;
      if (isEmphasized) {
        if (isHormozi) {
          color = isHighlight ? '#FFE500' : '#FFFFFF';
        } else if (isClean) {
          color = isHighlight ? '#A3E635' : '#00E5FF';
        } else {
          color = isHighlight ? '#00E5FF' : '#FFE500';
        }
      } else {
        color = isClean ? 'rgba(255, 255, 255, 0.7)' : undefined;
      }

      if (isWord) {
        wordIdx += 1;
      }

      return (
        <span
          key={i}
          style={{
            ...(color ? { color } : {}),
            ...(isHormozi && isEmphasized
              ? {
                  backgroundColor: isHighlight ? 'transparent' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  padding: '0 4px',
                  display: 'inline-block',
                }
              : {}),
            ...(isBeast && isEmphasized
              ? {
                  textShadow: '0 0 20px rgba(255, 230, 0, 0.6)',
                  display: 'inline-block',
                  transform: 'scale(1.06)',
                }
              : {}),
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

  const baseMax = isHormozi ? 92 : isClean ? 80 : isSports ? 104 : 96;
  const fitted = fitTextSize(caption.text, captionFont, width * 0.88, baseMax, 42);

  // Stroke logic per preset
  const strokeStyle = isHormozi
    ? 'none'
    : isClean
    ? 'none'
    : isSports
    ? `${Math.max(4, Math.round(fitted / 9))}px #000000`
    : `${Math.max(3, Math.round(fitted / 11))}px #000000`;

  const shadowStyle = isHormozi
    ? '0 8px 24px rgba(0, 0, 0, 0.9)'
    : isClean
    ? '0 4px 16px rgba(0, 0, 0, 0.8), 0 1px 3px rgba(0, 0, 0, 0.9)'
    : undefined;

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: SAFE_AREA.bottom }}
    >
      <div
        style={{
          fontSize: fitted,
          lineHeight: isHormozi ? 1.08 : 1.18,
          textAlign: 'center',
          textTransform: isClean ? 'none' : 'uppercase',
          fontFamily: captionFont,
          fontWeight: isClean ? 600 : 900,
          fontStyle: isSports ? 'italic' : 'normal',
          letterSpacing: isSports ? 2 : isHormozi ? 1.5 : undefined,
          color: isClean ? '#FFFFFF' : theme.fill,
          WebkitTextStroke: strokeStyle,
          paintOrder: 'stroke fill',
          maxWidth: width * 0.92,
          whiteSpace: 'normal',
          textShadow: shadowStyle,
          ...(isHormozi
            ? {
                backgroundColor: '#000000',
                padding: '12px 24px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85)',
              }
            : isClean
            ? {
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(10px)',
                padding: '10px 22px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }
            : {}),
          opacity: interpolate(enter, [0, 1], [0, 1]),
          scale: interpolate(enter, [0, 1], [isClean ? 0.95 : 0.82, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            output: 'perceptual-scale',
          }),
          translate: interpolate(enter, [0, 1], ['0px 16px', '0px 0px'], {
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
