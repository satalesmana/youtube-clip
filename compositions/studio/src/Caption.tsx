import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import * as React from 'react';
import { quickEnter } from './animation';
import { FONT, SPORTS_FONT, FONT_INTER, FONT_ARCHIVO_BLACK, FONT_MONTSERRAT } from './design';
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

  // Normalize preset id ('mrbeast' -> 'beast')
  const normalizedStyle = subtitleStyle === 'mrbeast' ? 'beast' : (subtitleStyle || 'beast');
  const isHormozi = normalizedStyle === 'hormozi';
  const isClean = normalizedStyle === 'clean';
  const isBeast = !isHormozi && !isClean;

  // Word-sync karaoke: word timings are ABSOLUTE output seconds, so the
  // comparison must use the global timeline position (start frame + local
  // frame), not the local frame inside this caption's Sequence.
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

  const currentActiveIdx = spokenCount > 0 ? spokenCount - 1 : -1;

  const isSports = theme.id === 'sports';

  // Fonts explicitly matched to Step 3 design system:
  // - Beast: Archivo Black (heavy punchy display sans)
  // - Hormozi: Anton (Impact equivalent, ultra-bold tall sans)
  // - Clean: Inter (modern clean humanist sans)
  const captionFont = isHormozi
    ? SPORTS_FONT
    : isClean
    ? FONT_INTER
    : isSports
    ? SPORTS_FONT
    : FONT_ARCHIVO_BLACK;

  if (caption.type === 'quote') {
    return null;
  }

  const baseMax = isHormozi ? 92 : isClean ? 78 : isSports ? 104 : 96;
  const fitted = fitTextSize(caption.text, captionFont, width * 0.88, baseMax, 40);
  const strokeSize = Math.max(3, Math.round(fitted / 18));

  const renderTokens = (text: string, syncWords = false) => {
    let wordIdx = 0;
    return text.split(/(\s+)/).map((token, i) => {
      const trimmed = token.trim();
      const isWord = trimmed.length > 0;
      const thisIdx = wordIdx;

      if (isWord) {
        wordIdx += 1;
      }

      if (!isWord) {
        return <span key={i}>{token}</span>;
      }

      const isCurrent = syncWords && thisIdx === currentActiveIdx;
      const isPast = syncWords && thisIdx < currentActiveIdx;
      const isHighlight = highlightSet.has(trimmed.toLowerCase());

      // ─────────────────────────────────────────────────────────────────
      // Preset 1: Hormozi High Contrast Black Box
      // ─────────────────────────────────────────────────────────────────
      if (isHormozi) {
        let color = 'rgba(255, 255, 255, 0.45)'; // upcoming
        if (isCurrent || isHighlight) {
          color = '#FFE500'; // energetic yellow
        } else if (isPast) {
          color = '#FFFFFF'; // solid crisp white
        }

        return (
          <span
            key={i}
            style={{
              color,
              display: 'inline-block',
              transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.08s ease',
              textShadow: isCurrent ? '0 0 16px rgba(255, 229, 0, 0.5)' : undefined,
            }}
          >
            {token}
          </span>
        );
      }

      // ─────────────────────────────────────────────────────────────────
      // Preset 2: Clean Modern Minimalist
      // ─────────────────────────────────────────────────────────────────
      if (isClean) {
        let color = 'rgba(243, 244, 246, 0.45)'; // upcoming
        if (isCurrent || isHighlight) {
          color = '#A3E635'; // vibrant lime green
        } else if (isPast) {
          color = '#F3F4F6'; // soft white
        }

        return (
          <span
            key={i}
            style={{
              color,
              display: 'inline-block',
              transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.08s ease',
              textShadow: isCurrent
                ? '0 0 14px rgba(163, 230, 53, 0.6), 0 2px 8px rgba(0, 0, 0, 0.9)'
                : '0 2px 8px rgba(0, 0, 0, 0.85)',
            }}
          >
            {token}
          </span>
        );
      }

      // ─────────────────────────────────────────────────────────────────
      // Preset 3: Pop Dinamis (MrBeast / Viral Style)
      // ─────────────────────────────────────────────────────────────────
      let color = 'rgba(255, 255, 255, 0.85)'; // upcoming
      let shadowGlow = '';
      let scale = 'scale(1)';

      if (isCurrent) {
        color = isHighlight ? '#00E5FF' : '#FFE500';
        shadowGlow = isHighlight
          ? '0 0 26px rgba(0, 229, 255, 0.9), '
          : '0 0 26px rgba(255, 229, 0, 0.9), ';
        scale = 'scale(1.16)';
      } else if (isHighlight) {
        color = '#00E5FF';
        shadowGlow = '0 0 14px rgba(0, 229, 255, 0.6), ';
      } else if (isPast) {
        color = '#FFFFFF';
      }

      if (isSports && isCurrent) {
        shadowGlow = `0 0 26px ${theme.accent}, 0 0 35px rgba(255, 230, 0, 0.5), `;
      }

      const outline = `-${strokeSize}px -${strokeSize}px 0 #000, ${strokeSize}px -${strokeSize}px 0 #000, -${strokeSize}px ${strokeSize}px 0 #000, ${strokeSize}px ${strokeSize}px 0 #000, 0 ${strokeSize * 1.5}px ${strokeSize * 2.5}px rgba(0,0,0,0.95)`;

      return (
        <span
          key={i}
          style={{
            color,
            display: 'inline-block',
            transform: scale,
            transition: 'transform 0.08s ease',
            textShadow: `${shadowGlow}${outline}`,
          }}
        >
          {token}
        </span>
      );
    });
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: SAFE_AREA.bottom,
      }}
    >
      <div
        style={{
          fontSize: fitted,
          lineHeight: isHormozi ? 1.1 : isClean ? 1.25 : 1.16,
          textAlign: 'center',
          textTransform: isClean ? 'none' : 'uppercase',
          fontFamily: captionFont,
          fontWeight: isClean ? 600 : 900,
          fontStyle: isSports ? 'italic' : 'normal',
          letterSpacing: isSports ? 2 : isHormozi ? 1.5 : isClean ? 0.2 : 0.8,
          color: '#FFFFFF',
          maxWidth: width * 0.92,
          whiteSpace: 'normal',
          ...(isHormozi
            ? {
                backgroundColor: '#000000',
                padding: '14px 28px',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.95)',
              }
            : isClean
            ? {
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '12px 26px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }
            : {}),
          opacity: interpolate(enter, [0, 1], [0, 1]),
          scale: interpolate(enter, [0, 1], [isClean ? 0.95 : 0.85, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            output: 'perceptual-scale',
          }),
          translate: interpolate(enter, [0, 1], ['0px 14px', '0px 0px'], {
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
