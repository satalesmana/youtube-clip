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
import { FONT, HOOK_FONT, selectTheme } from './design';
import type { Theme } from './design';
import { toAssetUrl } from './assetUrl';
import type { OutroCardShortProps } from './types';

/**
 * Animated High-Converting Creator Outro Card Short (9:16).
 * - Kinetic animated gradient backdrop
 * - Glassmorphism surface with glowing accent border
 * - Channel avatar with verified check
 * - Channel handle & follow CTA
 * - Animated bouncing Follow button
 */
export const OutroCardShort: React.FC<OutroCardShortProps> = ({
  channelName = 'kreator',
  ctaText = 'Suka konten ini? Ikuti untuk update harian & momen viral berikutnya!',
  handle,
  creatorLogoUrl,
  durationSeconds = 3,
  themeSeed = 'default:outro',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const theme: Theme = selectTheme(themeSeed, 'outro');

  // Entrance spring animation
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.85, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [60, 0]);
  const fadeIn = interpolate(cardSpring, [0, 1], [0, 1]);

  // Subtle breathing pulse on the CTA button
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.96, 1.04],
  );

  // Gentle fade-to-black on the last 10 frames
  const fadeOut = interpolate(
    frame,
    [Math.max(0, durationFrames - 10), durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const displayHandle = handle || channelName.replace(/^@/, '');
  const resolvedLogoSrc = creatorLogoUrl ? toAssetUrl(creatorLogoUrl) : staticFile('creator-logo.png');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#07090e' }}>
      {/* Dynamic ambient radial gradients */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(circle at 50% 30%, ${theme.accent}25 0%, transparent 60%),
            radial-gradient(circle at 80% 80%, ${theme.accent2 || '#ff3b5c'}20 0%, transparent 50%),
            #0b0e14
          `,
        }}
      />

      {/* Floating Glassmorphic CTA Card */}
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
            backgroundColor: 'rgba(17, 22, 34, 0.88)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            borderTop: `4px solid ${theme.accent}`,
            borderRadius: 36,
            padding: '44px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: `0 30px 70px rgba(0,0,0,0.85), 0 0 40px ${theme.accent}30`,
            gap: 24,
          }}
        >
          {/* Avatar Ring with Verified Badge */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2 || '#FFFFFF'})`,
                padding: 3,
                boxShadow: `0 0 30px ${theme.accent}60`,
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
            {/* Verified icon */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: theme.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}
            >
              ✓
            </div>
          </div>

          {/* Channel Name & Call to Action Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                fontFamily: HOOK_FONT,
                fontSize: 38,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.5px',
                textShadow: '0 2px 12px rgba(0,0,0,0.8)',
              }}
            >
              @{displayHandle}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 24,
                color: 'rgba(255, 255, 255, 0.78)',
                maxWidth: 500,
                lineHeight: 1.35,
              }}
            >
              {ctaText}
            </div>
          </div>

          {/* High-Converting Animated Follow Button */}
          <div
            style={{
              marginTop: 8,
              transform: `scale(${pulse})`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backgroundColor: theme.accent,
              color: '#0A0E17',
              fontFamily: HOOK_FONT,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: '1px',
              padding: '18px 48px',
              borderRadius: 9999,
              boxShadow: `0 0 32px ${theme.accent}70, 0 10px 28px rgba(0,0,0,0.5)`,
              textTransform: 'uppercase',
            }}
          >
            <span>+</span>
            <span>IKUTI SEKARANG</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* Gentle End Fade */}
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: fadeOut, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
