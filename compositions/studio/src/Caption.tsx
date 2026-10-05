import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { quickEnter } from './animation';
import { SPORTS_FONT, FONT_INTER, FONT_ARCHIVO_BLACK } from './design';
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

/** TikTok-style stroke caption with word highlight synced to the voice. */
export const Caption: React.FC<{
  caption: PlanCaption;
  theme: Theme;
  durationFrames: number;
  /** Absolute frame where this caption starts on the output timeline. */
  absoluteStartFrame?: number;
  /** Subtitle style preset: 'beast' | 'hormozi' | 'clean' */
  subtitleStyle?: string;
  /** Subtitle font size preset: 'sm' | 'md' | 'lg' | 'xl' */
  subtitleSize?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ caption, theme, durationFrames, absoluteStartFrame, subtitleStyle = 'beast', subtitleSize = 'md' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Animate the caption block as one unit while keeping the existing per-word
  // karaoke pop independent. Keep very short captions readable by shortening
  // both transitions, and omit the exit entirely when there is no hold time.
  const transitionFrames = Math.min(6, Math.max(1, Math.round(fps * 0.2)));
  const enterFrames = Math.min(transitionFrames, Math.max(1, Math.floor(durationFrames / 2)));
  const canExit = durationFrames > enterFrames + 2;
  const exitFrames = canExit
    ? Math.min(4, transitionFrames, Math.max(1, Math.floor((durationFrames - enterFrames) / 2)))
    : 0;
  const enter = quickEnter(frame, fps);
  const enterProgress = interpolate(frame, [0, enterFrames], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitProgress = exitFrames > 0
    ? interpolate(frame, [durationFrames - exitFrames, durationFrames], [0, 1], {
        easing: Easing.in(Easing.cubic),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const blockOpacity = enterProgress * (1 - exitProgress);
  const blockTranslateY = interpolate(enterProgress, [0, 1], [12, 0]) - exitProgress * 4;

  const highlightSet = new Set(
    (caption.highlightWords ?? []).map((w) => w.toLowerCase()),
  );

  // Normalize preset id ('mrbeast' -> 'beast')
  const normalizedStyle = subtitleStyle === 'mrbeast' ? 'beast' : (subtitleStyle || 'beast');
  const isHormozi = normalizedStyle === 'hormozi';
  const isClean = normalizedStyle === 'clean';
  const isBeast = !isHormozi && !isClean;
  const springScale = interpolate(enter, [0, 1], [isClean ? 0.97 : 0.96, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    output: 'perceptual-scale',
  });
  const blockScale = springScale - exitProgress * 0.01;

  // Word-sync karaoke: word timings are ABSOLUTE output seconds, so the
  // comparison must use the global timeline position (start frame + local
  // frame), not the local frame inside this caption's Sequence.
  const words = caption.text.split(/\s+/).filter(Boolean);
  const nWords = Math.max(1, words.length);
  const currentTime =
    absoluteStartFrame !== undefined
      ? (absoluteStartFrame + frame) / fps
      : frame / fps;

  const realActiveWordIdx = caption.wordTimings
    ? caption.wordTimings.findIndex((word) => currentTime >= word.start && currentTime <= word.end)
    : -1;
  const currentActiveIdx = realActiveWordIdx !== -1
    ? realActiveWordIdx
    : caption.wordTimings
      ? caption.wordTimings.filter((word) => currentTime >= word.start).length - 1
      : Math.min(nWords - 1, Math.floor((frame / Math.max(1, durationFrames)) * nWords));

  // Word relative start/end frames within this caption's local frame timeline.
  // Headless Chromium renders offline frame-by-frame; CSS transitions cannot execute.
  // Driving scale and glow through Remotion's spring() ensures smooth, frame-accurate animation.
  const wordFrames = words.map((_, k) => {
    if (caption.wordTimings && caption.wordTimings[k]) {
      const timing = caption.wordTimings[k]!;
      const relStart = Math.max(
        0,
        Math.round(timing.start * fps - (absoluteStartFrame ?? 0)),
      );
      const relEnd = Math.max(
        relStart + 1,
        Math.round(timing.end * fps - (absoluteStartFrame ?? 0)),
      );
      return { start: relStart, end: relEnd };
    }
    const perWord = durationFrames / nWords;
    return {
      start: Math.round(k * perWord),
      end: Math.round((k + 1) * perWord),
    };
  });

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

  // Match the live editor's subtitle scale exactly.
  const fitted = subtitleSize === 'sm' ? 38 : subtitleSize === 'lg' ? 58 : subtitleSize === 'xl' ? 68 : 48;

  const renderWords = () => {
    return words.map((word, k) => {
      const isCurrent = k === currentActiveIdx;
      const isPast = k < currentActiveIdx;
      const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '');
      const isHighlight = highlightSet.has(cleanWord) || highlightSet.has(word.toLowerCase());

      // Spring-driven frame-accurate zoom calculation
      const wTiming = wordFrames[k] ?? { start: 0, end: durationFrames };
      const framesSinceStart = Math.max(0, frame - wTiming.start);
      const wordSpring = spring({
        frame: framesSinceStart,
        fps,
        config: { damping: 14, mass: 0.45, stiffness: 220 },
      });

      // ─────────────────────────────────────────────────────────────────
      // Preset 1: Hormozi High Contrast Black Box
      // ─────────────────────────────────────────────────────────────────
      if (isHormozi) {
        const color = isCurrent ? '#000000' : isPast ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)';

        const scale = isCurrent
          ? interpolate(wordSpring, [0, 0.7, 1], [1.0, 1.05, 1.03], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1.0;
        const translateY = isCurrent
          ? interpolate(wordSpring, [0, 0.7, 1], [0, -4, -2], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;

        return (
          <span
            key={k}
            style={{
              background: isCurrent ? '#10B981' : isPast ? '#000000' : 'transparent',
              border: isPast ? '2px solid #334155' : 'none',
              padding: isCurrent ? '7px 15px' : '6px 14px',
              borderRadius: '10px',
              fontSize: `${Math.round(fitted * (isCurrent ? 0.99 : 0.94))}px`,
              lineHeight: 1.2,
              fontWeight: 900,
              textTransform: 'uppercase',
              boxShadow: isCurrent ? '0 8px 24px rgba(16,185,129,0.5)' : 'none',
              color,
              display: 'inline-block',
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: 'center bottom',
              margin: '0 4px',
              textShadow: isCurrent ? '0 0 16px rgba(255, 229, 0, 0.5)' : undefined,
            }}
          >
            {word}
          </span>
        );
      }

      // ─────────────────────────────────────────────────────────────────
      // Preset 2: Clean Modern Minimalist
      // ─────────────────────────────────────────────────────────────────
      if (isClean) {
        const color = isCurrent ? '#38BDF8' : isPast ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)';

        const scale = isCurrent
          ? interpolate(wordSpring, [0, 0.7, 1], [1.0, 1.04, 1.02], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1.0;
        const translateY = isCurrent
          ? interpolate(wordSpring, [0, 0.7, 1], [0, -3, -1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;

        return (
          <span
            key={k}
            style={{
              fontSize: `${Math.round(fitted * (isCurrent ? 0.92 : 0.88))}px`,
              lineHeight: 1.3,
              fontWeight: isCurrent ? 800 : 600,
              color,
              display: 'inline-block',
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: 'center bottom',
              margin: '0 3px',
              textShadow: isCurrent
                ? '0 0 16px rgba(56,189,248,0.7)'
                : 'none',
            }}
          >
            {word}
          </span>
        );
      }

      // ─────────────────────────────────────────────────────────────────
      // Preset 3: Pop Dinamis (MrBeast / Viral Style)
      // ─────────────────────────────────────────────────────────────────
      let color = 'rgba(255, 255, 255, 0.65)'; // upcoming
      let shadowGlow = '';

      const scale = isCurrent
        ? interpolate(wordSpring, [0, 0.7, 1], [1.0, 1.06, 1.04], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1.0;
      const translateY = isCurrent
        ? interpolate(wordSpring, [0, 0.7, 1], [0, -5, -2], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 0;

      if (isCurrent) {
        color = isHighlight ? '#00E5FF' : '#FFE500';
        shadowGlow = isHighlight
          ? '0 0 24px rgba(0, 229, 255, 0.9), '
          : '0 0 24px rgba(255, 229, 0, 0.9), ';
      } else if (isPast) {
        color = '#FFFFFF';
      }

      if (isSports && isCurrent) {
        shadowGlow = `0 0 24px ${theme.accent}, 0 0 35px rgba(255, 230, 0, 0.5), `;
      }

      const outline = '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 6px 16px rgba(0,0,0,0.9)';

      return (
        <span
          key={k}
          style={{
            fontSize: `${Math.round(fitted * (isCurrent ? 1.08 : 1))}px`,
            lineHeight: 1.2,
            fontWeight: 900,
            textTransform: 'uppercase',
            color,
            display: 'inline-block',
            transform: `translateY(${translateY}px) scale(${scale})`,
            transformOrigin: 'center bottom',
            margin: '0 4px',
            textShadow: `${shadowGlow}${outline}`,
          }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div style={{ position: 'absolute', bottom: '240px', left: '40px', right: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none', zIndex: 60 }}>
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: isHormozi ? 'center' : 'flex-end',
          columnGap: isClean ? '10px' : isHormozi ? '16px' : '12px',
          rowGap: isClean ? '8px' : '10px',
          fontSize: fitted,
          lineHeight: isHormozi ? 1.2 : isClean ? 1.3 : 1.2,
          textAlign: 'center',
          textTransform: isClean ? 'none' : 'uppercase',
          fontFamily: captionFont,
          fontWeight: isClean ? 600 : 900,
          letterSpacing: 0,
          color: '#FFFFFF',
          maxWidth: isClean ? '850px' : 'none',
          whiteSpace: 'normal',
          ...(isHormozi
            ? {
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '12px 24px',
                borderRadius: '16px',
                backdropFilter: 'blur(8px)',
              }
            : isClean
            ? {
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '16px 32px',
                borderRadius: '18px',
                backdropFilter: 'blur(12px)',
              }
            : {
                background: 'rgba(0, 0, 0, 0.55)',
                padding: '16px 28px',
                borderRadius: '24px',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }),
          opacity: blockOpacity,
          scale: blockScale,
          translate: `0px ${blockTranslateY}px`,
        }}
      >
        {renderWords()}
      </div>
    </div>
  );
};
