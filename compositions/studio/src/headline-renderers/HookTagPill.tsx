import * as React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { HookIcon, parseHookTag } from '../icons/HookIcon';

export type BadgePresetId =
  | 'neon-outline'
  | 'solid-impact'
  | 'highlight-chip'
  | 'editorial-label'
  | 'price-tag'
  | 'speech-bubble'
  | 'burst-stamp'
  | 'diagonal-slash';
export type BadgeColorVariant = 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto';

interface HookTagPillProps {
  tag?: string;
  presetId?: BadgePresetId;
  badgePresetId?: BadgePresetId;
  colorVariant?: BadgeColorVariant | string;
  badgeColor?: BadgeColorVariant | string;
  fontFamily?: string;
  fallbackAccent?: string;
  marginBottom?: number;
}

interface TagVisualConfig {
  borderColor: string;
  textColor: string;
  glowColor: string;
  bgColor: string;
}

/**
 * Resolves fallback semantic colors from tag keywords when variant is 'auto'.
 */
export function resolveTagVisual(tag?: string, fallbackAccent = '#38BDF8'): TagVisualConfig {
  if (!tag) {
    return {
      borderColor: fallbackAccent,
      textColor: fallbackAccent,
      glowColor: `${fallbackAccent}40`,
      bgColor: 'rgba(8, 14, 26, 0.94)',
    };
  }

  const upper = tag.toUpperCase();

  // 1. Warning & Danger (Red / Amber)
  if (
    upper.includes('⚠️') ||
    upper.includes('🚨') ||
    upper.includes('💣') ||
    upper.includes('AWAS') ||
    upper.includes('PERINGATAN') ||
    upper.includes('SALAH') ||
    upper.includes('BAHAYA') ||
    upper.includes('FATAL')
  ) {
    return {
      borderColor: '#FF1744',
      textColor: '#FF4D4D',
      glowColor: 'rgba(255, 23, 68, 0.55)',
      bgColor: 'rgba(26, 8, 8, 0.94)',
    };
  }

  // 2. High-Impact Scroll Stopper (Electric Cyan)
  if (
    upper.includes('👀') ||
    upper.includes('JANGAN DI-SKIP') ||
    upper.includes('STOP') ||
    upper.includes('TUNGGU')
  ) {
    return {
      borderColor: '#00F0FF',
      textColor: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.55)',
      bgColor: 'rgba(6, 16, 26, 0.94)',
    };
  }

  // 3. Fire / Viral (Coral Flame)
  if (upper.includes('🔥') || upper.includes('VIRAL') || upper.includes('MOMEN')) {
    return {
      borderColor: '#FF5722',
      textColor: '#FF7043',
      glowColor: 'rgba(255, 87, 34, 0.55)',
      bgColor: 'rgba(28, 10, 6, 0.94)',
    };
  }

  // 4. Gold / Secrets / Hacks (Golden Amber)
  if (
    upper.includes('💡') ||
    upper.includes('🤫') ||
    upper.includes('💎') ||
    upper.includes('RAHASIA') ||
    upper.includes('TRIK') ||
    upper.includes('HACK') ||
    upper.includes('SUKSES')
  ) {
    return {
      borderColor: '#FACC15',
      textColor: '#FDE047',
      glowColor: 'rgba(250, 204, 21, 0.55)',
      bgColor: 'rgba(28, 20, 6, 0.94)',
    };
  }

  // 5. Data & Statistics (Mint Emerald)
  if (
    upper.includes('📊') ||
    upper.includes('📈') ||
    upper.includes('99%') ||
    upper.includes('STATISTIK') ||
    upper.includes('BUKTI') ||
    upper.includes('DATA')
  ) {
    return {
      borderColor: '#10B981',
      textColor: '#34D399',
      glowColor: 'rgba(16, 185, 129, 0.55)',
      bgColor: 'rgba(6, 26, 18, 0.94)',
    };
  }

  // 6. Relatability & Social (Violet / Purple)
  if (
    upper.includes('🤔') ||
    upper.includes('🚩') ||
    upper.includes('💔') ||
    upper.includes('POV') ||
    upper.includes('REALITA') ||
    upper.includes('RED FLAG')
  ) {
    return {
      borderColor: '#8B5CF6',
      textColor: '#C084FC',
      glowColor: 'rgba(139, 92, 246, 0.55)',
      bgColor: 'rgba(20, 8, 30, 0.94)',
    };
  }

  // Fallback
  return {
    borderColor: fallbackAccent,
    textColor: fallbackAccent,
    glowColor: `${fallbackAccent}40`,
    bgColor: 'rgba(8, 14, 26, 0.94)',
  };
}

/**
 * HookTagPill — Renders 4 high-converting badge presets from the Badge Design System:
 * 1. Neon Outline (Attention) — scale 0.85 -> 1.08 -> 1, glow pulse
 * 2. Solid Impact (Urgency) — solid background, radius 12px, scale 0.8 -> 1.12 -> 1, slight shake
 * 3. Highlight Chip (Emphasis) — radius 10px, scaleX expand, vibrant glow tint
 * 4. Editorial Label (Context) — radius 9999px, thin border, translateY 8px -> 0, letterSpacing 1.5px
 */
export const HookTagPill: React.FC<HookTagPillProps> = ({
  tag,
  presetId,
  badgePresetId,
  colorVariant,
  badgeColor,
  fontFamily,
  fallbackAccent = '#38BDF8',
  marginBottom = 12,
}) => {
  const activePresetId: BadgePresetId = badgePresetId ?? presetId ?? 'neon-outline';
  const activeColor = (badgeColor ?? colorVariant ?? 'auto') as BadgeColorVariant;
  if (!tag || !tag.trim()) return null;

  const { iconName, cleanText } = parseHookTag(tag);

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── 1. NEON OUTLINE (Attention) ──────────────────────────────────────────
  if (activePresetId === 'neon-outline') {
    let accentHex = '#00F0FF';
    if (activeColor === 'magenta') accentHex = '#EC4899';
    else if (activeColor === 'green') accentHex = '#22C55E';
    else if (activeColor === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    }

    const spr = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
    const scale = interpolate(spr, [0, 0.7, 1], [0.85, 1.08, 1]);
    const opacity = interpolate(spr, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' });
    const glowIntensity = interpolate(spr, [0, 0.6, 1], [0, 1.2, 0.75]);

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          opacity,
          backgroundColor: 'rgba(8, 14, 26, 0.94)',
          border: `2.5px solid ${accentHex}`,
          borderRadius: 9999,
          padding: '8px 24px',
          marginBottom,
          boxShadow: `0 6px 24px rgba(0,0,0,0.6), 0 0 ${Math.round(20 * glowIntensity)}px ${accentHex}80`,
        }}
      >
        <HookIcon
          name={iconName}
          size={24}
          color={accentHex}
          glow
          glowColor={`${accentHex}90`}
          style={{ marginRight: 10 }}
        />
        <span
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '1.2px',
            color: accentHex,
            textTransform: 'uppercase',
          }}
        >
          {cleanText}
        </span>
      </div>
    );
  }

  // ─── 2. SOLID IMPACT (Urgency) ────────────────────────────────────────────
  if (activePresetId === 'solid-impact') {
    let bgHex = '#FF1744';
    let accentYellow = '#FACC15';
    if (activeColor === 'yellow') {
      bgHex = '#B45309';
      accentYellow = '#FEF08A';
    } else if (activeColor === 'green') {
      bgHex = '#15803D';
      accentYellow = '#BBF7D0';
    } else if (activeColor === 'auto') {
      const v = resolveTagVisual(tag, fallbackAccent);
      bgHex = v.borderColor;
      accentYellow = '#FACC15';
    }

    const spr = spring({ frame, fps, config: { damping: 9, stiffness: 200 } });
    const scale = interpolate(spr, [0, 0.65, 1], [0.75, 1.14, 1.0]);
    const opacity = interpolate(spr, [0, 0.18], [0, 1], { extrapolateRight: 'clamp' });

    // Shake on impact (frames 2–14)
    const shakeAmp = interpolate(frame, [2, 14], [3, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const shakeX = Math.sin(frame * 3.2) * shakeAmp;

    // Accent stroke animation
    const strokeOpacity = interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const strokeScale = interpolate(frame, [8, 18], [0.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    /**
     * Scaled SVG Zigzag accent strokes for 1080x1920 video.
     */
    const SvgAccentStrokes: React.FC<{ side: 'left' | 'right' }> = ({ side }) => {
      const strokes = [
        { w: 22, offset: 0 },
        { w: 15, offset: 4 },
        { w: 9, offset: 6 },
      ];
      return (
        <svg
          width={26}
          height={32}
          viewBox="0 0 26 32"
          style={{
            opacity: strokeOpacity,
            transform: `scaleX(${side === 'left' ? -strokeScale : strokeScale})`,
            transformOrigin: side === 'left' ? 'right center' : 'left center',
            marginLeft: side === 'left' ? 0 : 8,
            marginRight: side === 'right' ? 0 : 8,
            flexShrink: 0,
            overflow: 'visible',
          }}
        >
          <defs>
            <filter id={`stroke-glow-${side}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {strokes.map(({ w, offset }, i) => {
            const y = 6 + i * 10;
            const tilt = side === 'left' ? offset * 0.25 : -offset * 0.25;
            return (
              <line
                key={i}
                x1={26 - w}
                y1={y + tilt}
                x2={26}
                y2={y - tilt}
                stroke={bgHex}
                strokeWidth={4}
                strokeLinecap="round"
                filter={`url(#stroke-glow-${side})`}
              />
            );
          })}
        </svg>
      );
    };

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale}) translateX(${shakeX}px)`,
          opacity,
          marginBottom,
        }}
      >
        <SvgAccentStrokes side="left" />

        {/* Sticker body */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: bgHex,
            borderRadius: 14,
            border: '2px solid rgba(255,255,255,0.3)',
            padding: '8px 24px',
            boxShadow: `0 6px 20px rgba(0,0,0,0.65), 0 0 20px ${bgHex}75`,
            overflow: 'hidden',
          }}
        >
          {/* Top highlight shine */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
              pointerEvents: 'none',
            }}
          />
          <HookIcon
            name={iconName}
            size={24}
            color="#FFFFFF"
            glow
            glowColor="rgba(255,255,255,0.7)"
            style={{ marginRight: 10, position: 'relative', zIndex: 1 }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: fontFamily || 'inherit',
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '1.2px',
              color: '#FFFFFF',
              textTransform: 'uppercase',
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}
          >
            {cleanText}
          </span>
        </div>

        <SvgAccentStrokes side="right" />
      </div>
    );
  }

  // ─── 3. HIGHLIGHT CHIP (Emphasis) ─────────────────────────────────────────
  if (activePresetId === 'highlight-chip') {
    let accentHex = '#8B5CF6';
    let bgTint = 'rgba(139, 92, 246, 0.22)';
    if (activeColor === 'yellow') {
      accentHex = '#FACC15';
      bgTint = 'rgba(250, 204, 21, 0.22)';
    } else if (activeColor === 'green') {
      accentHex = '#10B981';
      bgTint = 'rgba(16, 185, 129, 0.22)';
    } else if (activeColor === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      bgTint = `${accentHex}28`;
    }

    const spr = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
    const scale = interpolate(spr, [0, 1], [0.9, 1]);
    const scaleX = interpolate(spr, [0, 1], [0.85, 1]);
    const opacity = interpolate(spr, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale}) scaleX(${scaleX})`,
          opacity,
          backgroundColor: bgTint,
          border: `2.5px solid ${accentHex}`,
          borderRadius: 14,
          padding: '8px 24px',
          marginBottom,
          boxShadow: `0 6px 20px rgba(0,0,0,0.6), 0 0 20px ${accentHex}40`,
        }}
      >
        <HookIcon
          name={iconName}
          size={24}
          color={accentHex}
          glow
          glowColor={`${accentHex}80`}
          style={{ marginRight: 10 }}
        />
        <span
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '1.2px',
            color: accentHex,
            textTransform: 'uppercase',
          }}
        >
          {cleanText}
        </span>
      </div>
    );
  }

  // ─── 4. EDITORIAL LABEL (Context) ─────────────────────────────────────────
  if (activePresetId === 'editorial-label') {
    let accentHex = '#FACC15';
    if (activeColor === 'cyan') accentHex = '#38BDF8';
    else if (activeColor === 'green') accentHex = '#10B981';
    else if (activeColor === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    }

    const spr = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
    const translateY = interpolate(spr, [0, 1], [8, 0]);
    const opacity = interpolate(spr, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' });

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${translateY}px)`,
          opacity,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: `2px solid ${accentHex}D0`,
          borderRadius: 9999,
          padding: '6px 22px',
          marginBottom,
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
        }}
      >
        <HookIcon
          name={iconName}
          size={22}
          color={accentHex}
          style={{ marginRight: 10 }}
        />
        <span
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '2px',
            color: accentHex,
            textTransform: 'uppercase',
          }}
        >
          {cleanText}
        </span>
      </div>
    );
  }

  // ─── 5. PRICE TAG (Emphasis) ──────────────────────────────────────────────
  if (activePresetId === 'price-tag') {
    let bgHex = '#FACC15';
    let textHex = '#000000';
    if (activeColor === 'cyan') {
      bgHex = '#00F0FF';
      textHex = '#000000';
    } else if (activeColor === 'green') {
      bgHex = '#10B981';
      textHex = '#FFFFFF';
    } else if (activeColor === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    const spr = spring({ frame, fps, config: { damping: 11, stiffness: 180 } });
    const translateX = interpolate(spr, [0, 1], [35, 0]);
    const scale = interpolate(spr, [0, 0.7, 1], [0.85, 1.07, 1]);
    const rotate = interpolate(spr, [0, 1], [3, 0]);
    const opacity = interpolate(spr, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' });

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateX(${translateX}px) scale(${scale}) rotate(${rotate}deg)`,
          opacity,
          marginBottom,
          filter: `drop-shadow(0 6px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 20px ${bgHex}75)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: bgHex,
            clipPath: 'polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%, 0% 0%)',
            borderRadius: '8px 0 0 8px',
            padding: '8px 28px 8px 30px',
          }}
        >
          {/* Ticket punch hole on left */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: 'rgba(8, 14, 26, 0.95)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.35)',
            }}
          />
          {/* Top gloss highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
              pointerEvents: 'none',
            }}
          />
          <HookIcon
            name={iconName}
            size={24}
            color={textHex}
            style={{ marginRight: 10, position: 'relative', zIndex: 1 }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: fontFamily || 'inherit',
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '1.2px',
              color: textHex,
              textTransform: 'uppercase',
              textShadow: textHex === '#FFFFFF' ? '0 2px 6px rgba(0,0,0,0.6)' : 'none',
            }}
          >
            {cleanText}
          </span>
        </div>
      </div>
    );
  }

  // ─── 6. SPEECH BUBBLE (Context) ───────────────────────────────────────────
  if (activePresetId === 'speech-bubble') {
    let bgHex = '#00F0FF';
    let textHex = '#000000';
    if (activeColor === 'magenta') {
      bgHex = '#EC4899';
      textHex = '#FFFFFF';
    } else if (activeColor === 'gold') {
      bgHex = '#FACC15';
      textHex = '#000000';
    } else if (activeColor === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    const spr = spring({ frame, fps, config: { damping: 10, stiffness: 200 } });
    const scale = interpolate(spr, [0, 0.65, 1], [0.4, 1.16, 1.0]);
    const opacity = interpolate(spr, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' });
    const tailWobble = interpolate(frame, [4, 16], [4, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          opacity,
          marginBottom: marginBottom + 6,
          filter: `drop-shadow(0 6px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 20px ${bgHex}75)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: bgHex,
            borderRadius: 14,
            border: '2px solid rgba(255,255,255,0.35)',
            padding: '8px 24px',
          }}
        >
          {/* Top gloss highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              borderRadius: '14px 14px 0 0',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.28), transparent)',
              pointerEvents: 'none',
            }}
          />
          {/* Bubble tail at bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              left: 24,
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `9px solid ${bgHex}`,
              transform: `rotate(${tailWobble}deg)`,
              transformOrigin: 'top center',
            }}
          />
          <HookIcon
            name={iconName}
            size={24}
            color={textHex}
            style={{ marginRight: 10, position: 'relative', zIndex: 1 }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: fontFamily || 'inherit',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '1.2px',
              color: textHex,
              textTransform: 'uppercase',
              textShadow: textHex === '#FFFFFF' ? '0 2px 6px rgba(0,0,0,0.6)' : 'none',
            }}
          >
            {cleanText}
          </span>
        </div>
      </div>
    );
  }

  // ─── 7. BURST STAMP (Attention) ───────────────────────────────────────────
  if (activePresetId === 'burst-stamp') {
    let bgHex = '#FF1744';
    let textHex = '#FFFFFF';
    if (activeColor === 'yellow') {
      bgHex = '#FACC15';
      textHex = '#000000';
    } else if (activeColor === 'green') {
      bgHex = '#22C55E';
      textHex = '#FFFFFF';
    } else if (activeColor === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    const spr = spring({ frame, fps, config: { damping: 9, stiffness: 220 } });
    const scale = interpolate(spr, [0, 0.6, 1], [0.25, 1.22, 1.0]);
    const rotate = interpolate(spr, [0, 0.65, 1], [-9, 3, -1.5]);
    const opacity = interpolate(spr, [0, 0.18], [0, 1], { extrapolateRight: 'clamp' });

    // Multi-point burst polygon covering perimeter evenly
    const burstPolygon =
      'polygon(50% 0%, 56% 12%, 63% 2%, 69% 14%, 77% 4%, 82% 16%, 92% 10%, 90% 24%, 100% 25%, 93% 40%, 100% 50%, 93% 60%, 100% 75%, 90% 76%, 92% 90%, 82% 84%, 77% 96%, 69% 86%, 63% 98%, 56% 88%, 50% 100%, 44% 88%, 37% 98%, 31% 86%, 23% 96%, 18% 84%, 8% 90%, 10% 76%, 0% 75%, 7% 60%, 0% 50%, 7% 40%, 0% 25%, 10% 24%, 8% 10%, 18% 16%, 23% 4%, 31% 14%, 37% 2%, 44% 12%)';

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale}) rotate(${rotate}deg)`,
          opacity,
          marginBottom,
          filter: `drop-shadow(0 6px 22px rgba(0,0,0,0.75)) drop-shadow(0 0 22px ${bgHex}80)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: bgHex,
            clipPath: burstPolygon,
            padding: '10px 32px',
          }}
        >
          {/* Subtle top shine */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.32), transparent)',
              pointerEvents: 'none',
            }}
          />
          <HookIcon
            name={iconName}
            size={24}
            color={textHex}
            style={{ marginRight: 10, position: 'relative', zIndex: 1 }}
          />
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: fontFamily || 'inherit',
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '1.2px',
              color: textHex,
              textTransform: 'uppercase',
              textShadow: textHex === '#FFFFFF' ? '0 2px 6px rgba(0,0,0,0.7)' : 'none',
            }}
          >
            {cleanText}
          </span>
        </div>
      </div>
    );
  }

  // ─── 8. DIAGONAL SLASH (Urgency & Fallback) ────────────────────────────────
  let bgHex = '#00F0FF';
  let textHex = '#000000';
  if (activeColor === 'red') {
    bgHex = '#FF1744';
    textHex = '#FFFFFF';
  } else if (activeColor === 'yellow') {
    bgHex = '#FACC15';
    textHex = '#000000';
  } else if (activeColor === 'auto') {
    bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
  }

  const spr = spring({ frame, fps, config: { damping: 11, stiffness: 210 } });
  const translateX = interpolate(spr, [0, 1], [-35, 0]);
  const scaleX = interpolate(spr, [0, 1], [1.2, 1.0]);
  const opacity = interpolate(spr, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateX(${translateX}px) scaleX(${scaleX})`,
        opacity,
        marginBottom,
        filter: `drop-shadow(0 6px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 20px ${bgHex}60)`,
      }}
    >
      {/* Slanted twin speed strokes on the left */}
      <div
        style={{
          display: 'inline-flex',
          gap: 6,
          marginRight: 10,
          transform: 'skewX(-16deg)',
        }}
      >
        <div
          style={{
            width: 5,
            height: 32,
            backgroundColor: bgHex,
            borderRadius: 2.5,
            boxShadow: `0 0 10px ${bgHex}`,
          }}
        />
        <div
          style={{
            width: 3,
            height: 32,
            backgroundColor: bgHex,
            opacity: 0.65,
            borderRadius: 2,
            boxShadow: `0 0 8px ${bgHex}`,
          }}
        />
      </div>

      {/* Main Parallelogram Pill */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: bgHex,
          clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)',
          padding: '8px 28px',
        }}
      >
        {/* Top gloss highlight */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '45%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
            pointerEvents: 'none',
          }}
        />
        <HookIcon
          name={iconName}
          size={24}
          color={textHex}
          style={{ marginRight: 10, position: 'relative', zIndex: 1 }}
        />
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: fontFamily || 'inherit',
            fontSize: 26,
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '1.4px',
            color: textHex,
            textTransform: 'uppercase',
            textShadow: textHex === '#FFFFFF' ? '0 2px 6px rgba(0,0,0,0.6)' : 'none',
          }}
        >
          {cleanText}
        </span>
      </div>
    </div>
  );
};
