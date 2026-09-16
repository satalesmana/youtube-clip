import * as React from 'react';

interface HookTagPillProps {
  tag?: string;
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
 * Resolves optimal pill badge colors based on tag semantics or fallback accent.
 * Guarantees visual harmony matching the user reference style:
 * Capsule pill with dark background, crisp glowing border, and matching text color.
 */
export function resolveTagVisual(tag?: string, fallbackAccent = '#38BDF8'): TagVisualConfig {
  if (!tag) {
    return {
      borderColor: fallbackAccent,
      textColor: fallbackAccent,
      glowColor: `${fallbackAccent}40`,
      bgColor: 'rgba(8, 14, 26, 0.92)',
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
      borderColor: '#FF3B30',
      textColor: '#FF4D4D',
      glowColor: 'rgba(255, 59, 48, 0.5)',
      bgColor: 'rgba(26, 8, 8, 0.94)',
    };
  }

  // 2. High-Impact Scroll Stopper (Electric Cyan - Exact User Reference Style)
  if (
    upper.includes('👀') ||
    upper.includes('JANGAN DI-SKIP') ||
    upper.includes('STOP') ||
    upper.includes('TUNGGU')
  ) {
    return {
      borderColor: '#00F0FF',
      textColor: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.5)',
      bgColor: 'rgba(6, 16, 26, 0.94)',
    };
  }

  // 3. Fire / Viral (Coral Flame)
  if (upper.includes('🔥') || upper.includes('VIRAL') || upper.includes('MOMEN')) {
    return {
      borderColor: '#FF5722',
      textColor: '#FF7043',
      glowColor: 'rgba(255, 87, 34, 0.5)',
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
      borderColor: '#FBBF24',
      textColor: '#FDE047',
      glowColor: 'rgba(251, 191, 36, 0.5)',
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
      glowColor: 'rgba(16, 185, 129, 0.5)',
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
      borderColor: '#A855F7',
      textColor: '#C084FC',
      glowColor: 'rgba(168, 85, 247, 0.5)',
      bgColor: 'rgba(20, 8, 30, 0.94)',
    };
  }

  // 7. Lightning / Action / Focus (Sky Blue)
  if (
    upper.includes('⚡') ||
    upper.includes('🎯') ||
    upper.includes('🚀') ||
    upper.includes('🛠️') ||
    upper.includes('KRUSIAL')
  ) {
    return {
      borderColor: '#38BDF8',
      textColor: '#38BDF8',
      glowColor: 'rgba(56, 189, 248, 0.5)',
      bgColor: 'rgba(8, 16, 28, 0.94)',
    };
  }

  // Fallback
  return {
    borderColor: fallbackAccent,
    textColor: fallbackAccent,
    glowColor: `${fallbackAccent}40`,
    bgColor: 'rgba(8, 14, 26, 0.92)',
  };
}

/**
 * HookTagPill — Shared Remotion component for rendering the category pill badge
 * above the hook headline.
 */
export const HookTagPill: React.FC<HookTagPillProps> = ({
  tag,
  fontFamily,
  fallbackAccent = '#38BDF8',
  marginBottom = 16,
}) => {
  if (!tag || !tag.trim()) return null;

  const visual = resolveTagVisual(tag, fallbackAccent);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: visual.bgColor,
        border: `1.5px solid ${visual.borderColor}`,
        borderRadius: 9999,
        padding: '4px 14px',
        marginBottom,
        boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 10px ${visual.glowColor}`,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily || 'inherit',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.6px',
          color: visual.textColor,
          textTransform: 'uppercase',
        }}
      >
        {tag}
      </span>
    </div>
  );
};
