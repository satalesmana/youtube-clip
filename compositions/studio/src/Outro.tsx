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

/**
 * Modern High-Converting Creator Social CTA Card (TikTok / Reels / Shorts style).
 * - Non-destructive: Soft cinematic vignette/backdrop so background video continues visibly.
 * - Glassmorphism Floating Card with accent glow border.
 * - Channel Avatar with verified check badge & creator logo.
 * - Interactive-style animated Follow button with kinetic bounce.
 */
export const Outro: React.FC<{
  theme: Theme;
  channelName?: string;
  durationFrames: number;
  logoSrc?: string;
}> = ({ theme, channelName, durationFrames, logoSrc }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

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
  const cardY = interpolate(cardSpring, [0, 1], [60, 0]);

  // Subtle breathing pulse on the Follow button
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.97, 1.03],
  );

  // Gentle fade-to-black on the very last 8 frames
  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationFrames - 8), durationFrames],
    [0, 0.7],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const displayHandle = channelName ? channelName.replace(/^@/, '') : 'kreator';
  const resolvedLogoSrc = logoSrc ? toAssetUrl(logoSrc) : staticFile('creator-logo.png');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Layer 1: Cinematic dark vignette backdrop (non-destructive, preserves video underneath) */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.88) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
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
            maxWidth: width * 0.86,
            backgroundColor: 'rgba(15, 18, 28, 0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1.5px solid rgba(255, 255, 255, 0.14)`,
            borderTop: `3px solid ${theme.accent}`,
            borderRadius: 32,
            padding: '36px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: `0 24px 60px rgba(0,0,0,0.85), 0 0 35px ${theme.accent}35`,
            gap: 20,
          }}
        >
          {/* Avatar Ring with Glowing Accent + Creator Logo + Verified Check */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 104,
                height: 104,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2 || '#FFFFFF'})`,
                padding: 3,
                boxShadow: `0 0 26px ${theme.accent}60`,
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
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: theme.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontSize: 16,
                fontWeight: 900,
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              ✓
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
                fontSize: 24,
                color: 'rgba(255, 255, 255, 0.75)',
                maxWidth: 480,
                lineHeight: 1.3,
              }}
            >
              Suka konten seperti ini? Ikuti untuk update harian & insight menarik!
            </div>
          </div>

          {/* High-Converting Animated Follow Button */}
          <div
            style={{
              marginTop: 6,
              transform: `scale(${pulse})`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: theme.accent,
              color: '#0A0E17',
              fontFamily: HOOK_FONT,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: '1px',
              padding: '16px 44px',
              borderRadius: 9999,
              boxShadow: `0 0 28px ${theme.accent}70, 0 8px 24px rgba(0,0,0,0.5)`,
              textTransform: 'uppercase',
            }}
          >
            <span>+</span>
            <span>IKUTI SEKARANG</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* Layer 3: Ultra subtle end fade */}
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
