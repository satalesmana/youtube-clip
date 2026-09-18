import * as React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export type BadgePresetId = 'neon-outline' | 'solid-impact' | 'highlight-chip' | 'editorial-label';
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
          border: `1.5px solid ${accentHex}`,
          borderRadius: 9999,
          padding: '4px 14px',
          marginBottom,
          boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 ${Math.round(14 * glowIntensity)}px ${accentHex}80`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.6px',
            color: accentHex,
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </span>
      </div>
    );
  }

  // ─── 2. SOLID IMPACT (Urgency) ────────────────────────────────────────────
  if (activePresetId === 'solid-impact') {
    let bgHex = '#D90000';
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
    const shakeAmp = interpolate(frame, [2, 14], [4, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const shakeX = Math.sin(frame * 3.2) * shakeAmp;

    // Split tag into lines: emoji+first word → top, rest → bottom
    const rawTag = tag || '';
    const parts = rawTag.trim().split(/\s+/);
    // Detect leading emoji
    const emojiMatch = parts[0]?.match(/^\p{Emoji}/u);
    let iconEmoji = '';
    let topWords: string[] = [];
    let bottomWords: string[] = [];

    if (emojiMatch) {
      iconEmoji = parts[0];
      topWords = parts.slice(1, 2);
      bottomWords = parts.slice(2);
    } else {
      topWords = parts.slice(0, 1);
      bottomWords = parts.slice(1);
    }

    const topText = topWords.join(' ');
    const bottomText = bottomWords.join(' ');

    // Accent stroke animation (strokes appear after badge)
    const strokeOpacity = interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const strokeScale = interpolate(frame, [8, 18], [0.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    const AccentStrokes: React.FC<{ side: 'left' | 'right' }> = ({ side }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          opacity: strokeOpacity,
          transform: `scaleX(${strokeScale})`,
          transformOrigin: side === 'left' ? 'right center' : 'left center',
          marginLeft: side === 'left' ? 0 : 10,
          marginRight: side === 'right' ? 0 : 10,
        }}
      >
        {[22, 16, 10].map((w, i) => (
          <div
            key={i}
            style={{
              width: w,
              height: 4,
              borderRadius: 3,
              backgroundColor: bgHex,
              boxShadow: `0 0 6px ${bgHex}CC`,
            }}
          />
        ))}
      </div>
    );

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
        {/* Left accent strokes */}
        <AccentStrokes side="left" />

        {/* Main badge body */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: bgHex,
            borderRadius: 16,
            padding: '10px 22px 10px 14px',
            boxShadow: `0 0 0 2.5px rgba(255,255,255,0.2), 0 10px 32px rgba(0,0,0,0.75), 0 0 32px ${bgHex}AA`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle inner highlight top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)',
              borderRadius: '16px 16px 0 0',
              pointerEvents: 'none',
            }}
          />

          {/* Icon block */}
          {iconEmoji && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 46,
                height: 46,
                backgroundColor: accentYellow,
                borderRadius: 10,
                flexShrink: 0,
                boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{iconEmoji}</span>
            </div>
          )}

          {/* Text block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            {/* Top line — white */}
            {topText && (
              <span
                style={{
                  fontFamily: fontFamily || 'inherit',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '0.8px',
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                  lineHeight: 1.15,
                  textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                }}
              >
                {topText}
              </span>
            )}
            {/* Bottom line — yellow bold */}
            {bottomText && (
              <span
                style={{
                  fontFamily: fontFamily || 'inherit',
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '0.4px',
                  color: accentYellow,
                  textTransform: 'uppercase',
                  lineHeight: 1.15,
                  textShadow: `0 0 12px ${accentYellow}90, 0 1px 6px rgba(0,0,0,0.65)`,
                }}
              >
                {bottomText}
              </span>
            )}
          </div>
        </div>

        {/* Right accent strokes */}
        <AccentStrokes side="right" />
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
          border: `1.5px solid ${accentHex}`,
          borderRadius: 10,
          padding: '4px 14px',
          marginBottom,
          boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 12px ${accentHex}40`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.7px',
            color: accentHex,
            textTransform: 'uppercase',
          }}
        >
          {tag}
        </span>
      </div>
    );
  }

  // ─── 4. EDITORIAL LABEL (Context) ─────────────────────────────────────────
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        border: `1.2px solid ${accentHex}D0`,
        borderRadius: 9999,
        padding: '3px 14px',
        marginBottom,
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
      }}
    >
      <span
        style={{
          fontFamily: fontFamily || 'inherit',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '1.4px',
          color: accentHex,
          textTransform: 'uppercase',
        }}
      >
        {tag}
      </span>
    </div>
  );
};
