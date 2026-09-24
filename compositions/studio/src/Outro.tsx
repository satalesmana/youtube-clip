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
        defaultCta: 'Jangan lewatkan momen seru berikutnya! Aktifkan notifikasi sekarang.',
        defaultBtn: '⚡ IKUTI & NOTIFIKASI',
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
        defaultCta: 'Dapatkan rangkuman wawasan mendalam dan perspektif baru setiap hari.',
        defaultBtn: 'Langganan Sekarang →',
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
        defaultCta: 'Bagaimana menurutmu? Tulis pendapat atau pengalamanmu di kolom komentar!',
        defaultBtn: '💬 TULIS KOMENTAR SEKARANG',
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
        defaultCta: 'Dukung channel ini agar terus berkembang! Klik tombol subscribe sekarang.',
        defaultBtn: '🔔 SUBSCRIBE SEKARANG',
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
        defaultCta: 'Mau akses materi lengkap dan panduan praktisnya? Tonton link lengkapnya di bio!',
        defaultBtn: '🔗 CEK LINK DI BIO 👇',
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
        defaultCta: 'Suka konten ini? Ikuti untuk update harian!',
        defaultBtn: '+ IKUTI SEKARANG',
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
 * - Floating glassmorphic / neon / editorial card with smooth entrance spring
 * - Custom creator avatar & verified badge
 * - Customizable headline CTA text and kinetic pulsing action button
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

  // Spring animation for the floating card pop-in
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 130, mass: 0.8 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.85, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [50, 0]);

  // Subtle breathing pulse on the action button
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2.2),
    [-1, 1],
    [0.97, 1.03],
  );

  // Gentle fade-to-black on the very last 8 frames
  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationFrames - 8), durationFrames],
    [0, 0.75],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const displayHandle = channelName ? channelName.replace(/^@/, '') : 'kreator';
  const resolvedLogoSrc = logoSrc ? toAssetUrl(logoSrc) : staticFile('creator-logo.png');
  const finalCtaText = ctaText?.trim() || cfg.defaultCta;
  const finalButtonText = buttonText?.trim() || cfg.defaultBtn;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Layer 1: Cinematic dark vignette backdrop (non-destructive, preserves video underneath) */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,${cfg.vignetteDarkness}) 100%)`,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
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
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: width * 0.88,
            backgroundColor: cfg.cardBg,
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            border: cfg.cardBorder,
            borderTop: cfg.cardBorderTop,
            borderRadius: 34,
            padding: '36px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: cfg.cardGlow,
            gap: 18,
          }}
        >
          {/* Top Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: cfg.badgeBg,
              color: cfg.badgeColor,
              padding: '6px 14px',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              fontFamily: HOOK_FONT,
            }}
          >
            <span>{cfg.badgeIcon}</span>
            <span>{cfg.badgeText}</span>
          </div>

          {/* Avatar Ring with Verified Icon */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 104,
                height: 104,
                borderRadius: '50%',
                background: cfg.ringGradient,
                padding: 3.5,
                boxShadow: `0 0 26px ${cfg.badgeColor}55`,
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
            {/* Verified badge icon */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 30,
                height: 30,
                borderRadius: '50%',
                backgroundColor: cfg.verifiedBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: cfg.verifiedColor,
                fontSize: 16,
                fontWeight: 900,
                boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
              }}
            >
              {cfg.verifiedIcon}
            </div>
          </div>

          {/* Channel Name & Call to Action Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <div
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 36,
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
                fontSize: 23,
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
              marginTop: 6,
              transform: `scale(${pulse})`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: cfg.btnBg,
              color: cfg.btnColor,
              fontFamily: HOOK_FONT,
              fontSize: 27,
              fontWeight: 900,
              letterSpacing: '1px',
              padding: '16px 42px',
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

      {/* Layer 3: Ultra subtle end fade */}
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
