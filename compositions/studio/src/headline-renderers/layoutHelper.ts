import type React from 'react';
import type { CompositionLayout } from '../visual-preset/index';

export type HookCardBackdrop =
  | 'cinematic-banner'
  | 'frosted-glass'
  | 'solid-dark'
  | 'neon-glow'
  | 'minimal-shadow';

export interface HeadlineLayoutConfig {
  containerStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
  alignItems: 'center' | 'flex-start' | 'flex-end';
  textAlign: 'center' | 'left' | 'right';
  background?: string;
  fontSizeFactor: number;
}

/**
 * Resolves container & card styles for the selected hook backdrop mode.
 * Defaults to 'cinematic-banner' styled as a sleek, compact floating card (max 80% / fit-content).
 */
export function resolveCardBackdropStyle(
  backdrop: HookCardBackdrop = 'cinematic-banner',
  theme: { accent?: string },
  width: number,
  baseCardStyle?: React.CSSProperties,
): React.CSSProperties {
  const accent = theme?.accent || '#38BDF8';
  const cardMaxWidth = Math.min(840, Math.round(width * 0.80));

  switch (backdrop) {
    case 'cinematic-banner':
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        padding: '18px 28px',
        borderRadius: 22,
        alignSelf: 'center',
        background:
          'linear-gradient(180deg, rgba(8, 12, 22, 0.94) 0%, rgba(4, 7, 15, 0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255, 255, 255, 0.16)',
        boxShadow:
          '0 20px 48px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      };

    case 'frosted-glass':
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        borderRadius: 22,
        padding: '18px 28px',
        alignSelf: 'center',
        background: 'rgba(10, 15, 28, 0.78)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow:
          '0 20px 48px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
      };

    case 'solid-dark':
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        borderRadius: 22,
        padding: '18px 28px',
        alignSelf: 'center',
        background: 'rgba(6, 9, 17, 0.96)',
        border: '1.5px solid rgba(255, 255, 255, 0.20)',
        boxShadow:
          '0 24px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      };

    case 'neon-glow':
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        borderRadius: 22,
        padding: '18px 28px',
        alignSelf: 'center',
        background: 'rgba(8, 12, 22, 0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1.5px solid ${accent}99`,
        boxShadow: `0 16px 40px rgba(0, 0, 0, 0.9), 0 0 35px ${accent}35, inset 0 0 16px ${accent}15`,
      };

    case 'minimal-shadow':
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        alignSelf: 'center',
        background: 'none',
        border: 'none',
        boxShadow: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      };

    default:
      return {
        ...baseCardStyle,
        width: 'fit-content',
        maxWidth: cardMaxWidth,
        padding: '18px 28px',
        borderRadius: 22,
        alignSelf: 'center',
        background:
          'linear-gradient(180deg, rgba(8, 12, 22, 0.94) 0%, rgba(4, 7, 15, 0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255, 255, 255, 0.16)',
        boxShadow:
          '0 20px 48px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      };
  }
}

/**
 * Platform-aligned Safe Zone & Layout positioning for vertical video (9:16).
 * Follows TikTok Creative Codes & YouTube Shorts guidelines:
 * - Upper UI buffer: 8-14% (protects search, following/for you tabs)
 * - Lower UI buffer: 25-30% (protects caption, username, sound title, scrubber)
 * - Right UI buffer: 18-20% on lower half (protects like, comment, bookmark, share buttons)
 *
 * Specific Layout Behaviors:
 * - 'top-heavy': Positioned high in the upper safe area (~11-12%), leaving maximum room for subject/action.
 * - 'centered': Positioned at optical center (~28-36%), commanding attention while staying above lower UI.
 * - 'subject-first': Pushed to upper header band (~7.5%) with compact footprint so subject's face is unobstructed.
 * - 'split-proof': Left-aligned dynamic split layout (~12% top, left-aligned) for comparison or asymmetrical proof.
 * - 'full-screen-text': Large, high-impact centered text with stronger backdrop contrast for text-as-hook formats.
 * - 'data-focus': Stat-focused positioning (~12.5% top) with accented card background framing numbers/metrics.
 * - 'question-focus': Centered upper-band (~10.5% top) with generous spacing for question hooks.
 */
export function getHeadlineLayout(
  layout: CompositionLayout = 'centered',
  width: number,
  height: number,
): HeadlineLayoutConfig {
  switch (layout) {
    case 'top-heavy':
      return {
        containerStyle: {
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: Math.round(height * 0.11),
          paddingLeft: Math.round(width * 0.06),
          paddingRight: Math.round(width * 0.06),
        },
        cardStyle: {
          maxWidth: width * 0.92,
          padding: '20px 30px',
        },
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 1.0,
      };

    case 'subject-first':
      return {
        containerStyle: {
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: Math.round(height * 0.075),
          paddingLeft: Math.round(width * 0.05),
          paddingRight: Math.round(width * 0.05),
        },
        cardStyle: {
          maxWidth: width * 0.90,
          padding: '16px 26px',
        },
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 0.96,
      };

    case 'split-proof':
      return {
        containerStyle: {
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          paddingTop: Math.round(height * 0.12),
          paddingLeft: Math.round(width * 0.07),
          paddingRight: Math.round(width * 0.07),
        },
        cardStyle: {
          maxWidth: width * 0.88,
          padding: '22px 30px',
          borderLeft: '4px solid rgba(250, 204, 21, 0.85)',
          borderRadius: 20,
        },
        alignItems: 'flex-start',
        textAlign: 'left',
        fontSizeFactor: 0.98,
      };

    case 'full-screen-text':
      return {
        containerStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 0,
          paddingLeft: Math.round(width * 0.04),
          paddingRight: Math.round(width * 0.04),
        },
        cardStyle: {
          maxWidth: width * 0.95,
          padding: '32px 28px',
        },
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 0) 95%)',
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 1.08,
      };

    case 'data-focus':
      return {
        containerStyle: {
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: Math.round(height * 0.125),
          paddingLeft: Math.round(width * 0.06),
          paddingRight: Math.round(width * 0.06),
        },
        cardStyle: {
          maxWidth: width * 0.92,
          padding: '22px 32px',
          boxShadow: '0 0 35px rgba(0,0,0,0.85), 0 0 25px rgba(56,189,248,0.22)',
        },
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 1.02,
      };

    case 'question-focus':
      return {
        containerStyle: {
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: Math.round(height * 0.105),
          paddingLeft: Math.round(width * 0.06),
          paddingRight: Math.round(width * 0.06),
        },
        cardStyle: {
          maxWidth: width * 0.92,
          padding: '22px 32px',
        },
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 1.0,
      };

    case 'centered':
    default:
      return {
        containerStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: Math.round(height * 0.08),
          paddingLeft: Math.round(width * 0.06),
          paddingRight: Math.round(width * 0.06),
        },
        cardStyle: {
          maxWidth: width * 0.92,
          padding: '24px 34px',
        },
        alignItems: 'center',
        textAlign: 'center',
        fontSizeFactor: 1.0,
      };
  }
}
