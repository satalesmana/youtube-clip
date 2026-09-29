import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import * as React from 'react';
import { FONT, HOOK_FONT } from './design';
import type { Theme } from './design';
import { toAssetUrl } from './assetUrl';

export interface OutroProps {
  theme: Theme;
  channelName?: string;
  durationFrames: number;
  logoSrc?: string;
  preset?: string;
  ctaText?: string;
  buttonText?: string;
}

interface PresetThemeConfig {
  badgeText: string;
  badgeIcon: string;
  badgeBg: string;
  badgeColor: string;
  defaultCta: string;
  defaultBtn: string;
  cardBg: string;
  cardBorder: string;
  cardBorderTop: string;
  cardGlow: string;
  btnBg: string;
  btnColor: string;
  btnBorder?: string;
  btnShadow: string;
  ringGradient: string;
  vignetteDarkness: number;
  verifiedIcon: string;
  verifiedBg: string;
  verifiedColor: string;
}

function getPresetConfig(presetId: string | undefined, _theme: Theme): PresetThemeConfig {
  switch (presetId) {
    case 'viral-neon':
      return {
        badgeText: 'TRENDING VIRAL',
        badgeIcon: '⚡',
        badgeBg: 'rgba(255, 0, 127, 0.25)',
        badgeColor: '#00F0FF',
        defaultCta: 'Ikuti agar tak ketinggalan momen viral.',
        defaultBtn: 'IKUTI',
        cardBg: 'rgba(10, 12, 22, 0.92)',
        cardBorder: '2px solid #00F0FF',
        cardBorderTop: '4px solid #FF007F',
        cardGlow: '0 0 50px rgba(255, 0, 127, 0.45), 0 25px 65px rgba(0,0,0,0.95)',
        btnBg: 'linear-gradient(135deg, #FF007F 0%, #00F0FF 100%)',
        btnColor: '#FFFFFF',
        btnShadow: '0 0 32px rgba(255, 0, 127, 0.7), 0 8px 24px rgba(0,0,0,0.6)',
        ringGradient: 'linear-gradient(135deg, #FF007F, #00F0FF)',
        vignetteDarkness: 0.88,
        verifiedIcon: '⚡',
        verifiedBg: '#00F0FF',
        verifiedColor: '#05070E',
      };

    case 'minimal-clean':
      return {
        badgeText: 'INSIGHT HARIAN',
        badgeIcon: '✦',
        badgeBg: 'rgba(255, 255, 255, 0.08)',
        badgeColor: '#E2E8F0',
        defaultCta: 'Ikuti untuk insight praktis berikutnya.',
        defaultBtn: 'LANGGANAN',
        cardBg: 'rgba(15, 23, 42, 0.94)',
        cardBorder: '1px solid rgba(255, 255, 255, 0.2)',
        cardBorderTop: '2px solid #F8FAFC',
        cardGlow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(255,255,255,0.06)',
        btnBg: '#F8FAFC',
        btnColor: '#0F172A',
        btnShadow: '0 4px 20px rgba(255,255,255,0.15), 0 6px 20px rgba(0,0,0,0.4)',
        ringGradient: 'linear-gradient(135deg, #FFFFFF, #94A3B8)',
        vignetteDarkness: 0.80,
        verifiedIcon: '✓',
        verifiedBg: '#F8FAFC',
        verifiedColor: '#0F172A',
      };

    case 'comment-debate':
      return {
        badgeText: 'DISKUSI & KOMENTAR',
        badgeIcon: '💬',
        badgeBg: 'rgba(255, 229, 0, 0.2)',
        badgeColor: '#FFE500',
        defaultCta: 'Punya pendapat? Tulis di komentar.',
        defaultBtn: 'KOMENTAR',
        cardBg: 'rgba(18, 20, 28, 0.92)',
        cardBorder: '1.5px solid rgba(255, 229, 0, 0.45)',
        cardBorderTop: '4px solid #FFE500',
        cardGlow: '0 25px 65px rgba(0,0,0,0.85), 0 0 40px rgba(255, 229, 0, 0.35)',
        btnBg: 'linear-gradient(135deg, #FFE500 0%, #FF6B00 100%)',
        btnColor: '#080A0E',
        btnShadow: '0 0 32px rgba(255, 229, 0, 0.65), 0 8px 24px rgba(0,0,0,0.5)',
        ringGradient: 'linear-gradient(135deg, #FFE500, #FF6B00)',
        vignetteDarkness: 0.85,
        verifiedIcon: '💬',
        verifiedBg: '#FFE500',
        verifiedColor: '#080A0E',
      };

    case 'subscribe-bell':
      return {
        badgeText: 'DUKUNG CHANNEL',
        badgeIcon: '🔔',
        badgeBg: 'rgba(255, 0, 0, 0.25)',
        badgeColor: '#FFD700',
        defaultCta: 'Ikuti untuk video berikutnya.',
        defaultBtn: 'SUBSCRIBE',
        cardBg: 'rgba(20, 14, 18, 0.92)',
        cardBorder: '1.5px solid rgba(255, 0, 0, 0.5)',
        cardBorderTop: '4px solid #FF0000',
        cardGlow: '0 25px 65px rgba(0,0,0,0.85), 0 0 40px rgba(255, 0, 0, 0.4)',
        btnBg: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
        btnColor: '#FFFFFF',
        btnShadow: '0 0 35px rgba(255, 0, 0, 0.7), 0 8px 24px rgba(0,0,0,0.6)',
        ringGradient: 'linear-gradient(135deg, #FF0000, #FFD700)',
        vignetteDarkness: 0.86,
        verifiedIcon: '🔔',
        verifiedBg: '#FF0000',
        verifiedColor: '#FFFFFF',
      };

    case 'link-in-bio':
      return {
        badgeText: 'LINK LENGKAP',
        badgeIcon: '🔗',
        badgeBg: 'rgba(16, 185, 129, 0.25)',
        badgeColor: '#10B981',
        defaultCta: 'Lihat panduan lengkap di bio.',
        defaultBtn: 'CEK LINK DI BIO',
        cardBg: 'rgba(12, 24, 22, 0.92)',
        cardBorder: '1.5px solid rgba(16, 185, 129, 0.5)',
        cardBorderTop: '4px solid #10B981',
        cardGlow: '0 25px 65px rgba(0,0,0,0.85), 0 0 38px rgba(16, 185, 129, 0.35)',
        btnBg: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
        btnColor: '#021F17',
        btnShadow: '0 0 32px rgba(16, 185, 129, 0.65), 0 8px 24px rgba(0,0,0,0.5)',
        ringGradient: 'linear-gradient(135deg, #10B981, #06B6D4)',
        vignetteDarkness: 0.84,
        verifiedIcon: '🔗',
        verifiedBg: '#10B981',
        verifiedColor: '#021F17',
      };

    case 'creator-glass':
    default:
      return {
        badgeText: 'KREATOR PILIHAN',
        badgeIcon: '✨',
        badgeBg: 'rgba(0, 242, 254, 0.18)',
        badgeColor: '#00F2FE',
        defaultCta: 'Ikuti untuk tips berikutnya.',
        defaultBtn: 'IKUTI',
        cardBg: 'rgba(15, 18, 28, 0.88)',
        cardBorder: '1.5px solid rgba(255, 255, 255, 0.14)',
        cardBorderTop: '3.5px solid #00F2FE',
        cardGlow: '0 24px 60px rgba(0,0,0,0.85), 0 0 35px rgba(0, 242, 254, 0.35)',
        btnBg: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
        btnColor: '#07090E',
        btnShadow: '0 0 28px rgba(0, 242, 254, 0.7), 0 8px 24px rgba(0,0,0,0.5)',
        ringGradient: 'linear-gradient(135deg, #00F2FE, #4FACFE)',
        vignetteDarkness: 0.82,
        verifiedIcon: '✓',
        verifiedBg: '#00F2FE',
        verifiedColor: '#000000',
      };
  }
}

/**
 * Modern High-Converting Creator Outro Card with Preset Styles
 * - Soft cinematic vignette backdrop (non-destructive over video)
 * - Floating glassmorphic / neon / editorial card with a restrained entrance
 * - Custom creator avatar & verified badge
 * - Customizable headline CTA text and a one-time action button reveal
 */
export const Outro: React.FC<OutroProps> = ({
  theme,
  channelName,
  durationFrames,
  logoSrc,
  preset = 'creator-glass',
  ctaText,
  buttonText,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const cfg = getPresetConfig(preset, theme);

  // Smooth entrance interpolation
  const fadeIn = interpolate(frame, [0, Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // A restrained, one-time entrance keeps attention on the CTA without
  // making the card feel like a looping notification.
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.8 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.96, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [28, 0]);

  // Reveal the action after the card settles, then hold it still and readable.
  const buttonDelayFrames = Math.min(Math.round(0.18 * fps), Math.max(0, durationFrames - 1));
  const buttonSpring = spring({
    frame: Math.max(0, frame - buttonDelayFrames),
    fps,
    config: { damping: 24, stiffness: 150, mass: 0.75 },
  });
  const buttonScale = interpolate(buttonSpring, [0, 1], [0.96, 1]);
  const buttonOpacity = interpolate(buttonSpring, [0, 1], [0, 1]);

  const displayHandle = channelName ? channelName.replace(/^@/, '') : 'kreator';
  const resolvedLogoSrc = logoSrc ? toAssetUrl(logoSrc) : staticFile('creator-logo.png');
  const finalCtaText = ctaText?.trim() || cfg.defaultCta;
  const finalButtonText = buttonText?.trim() || cfg.defaultBtn;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Layer 1: Light contrast veil keeps the video scene visible under the CTA. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.08) 0%, rgba(0,0,0,${cfg.vignetteDarkness * 0.4}) 100%)`,
          opacity: fadeIn,
        }}
      />

      {/* Layer 2: Floating Creator Social Card */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeIn,
          transform: `translateY(${cardY}px) scale(${cardScale})`,
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: width * 0.72,
            boxSizing: 'border-box',
            backgroundColor: cfg.cardBg,
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            border: cfg.cardBorder,
            borderTop: cfg.cardBorderTop,
            borderRadius: 28,
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: cfg.cardGlow,
            gap: 12,
          }}
        >
          {/* Creator avatar and handle identify the account without a fake verification mark. */}
          <div>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: cfg.ringGradient,
                padding: 3.5,
                boxShadow: `0 0 20px ${cfg.badgeColor}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Img
                src={resolvedLogoSrc}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {/* Channel Name & Call to Action Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 29,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.5px',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              }}
            >
              @{displayHandle}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 19,
                color: 'rgba(255, 255, 255, 0.82)',
                maxWidth: 500,
                lineHeight: 1.35,
              }}
            >
              {finalCtaText}
            </div>
          </div>

          {/* High-Converting Animated Follow/Action Button */}
          <div
            style={{
              marginTop: 2,
              transform: `scale(${buttonScale})`,
              opacity: buttonOpacity,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: cfg.btnBg,
              color: cfg.btnColor,
              fontFamily: HOOK_FONT,
              fontSize: 21,
              fontWeight: 900,
              letterSpacing: '1px',
              padding: '12px 30px',
              borderRadius: 9999,
              boxShadow: cfg.btnShadow,
              border: cfg.btnBorder || 'none',
              textTransform: 'uppercase',
            }}
          >
            <span>{finalButtonText}</span>
          </div>
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
