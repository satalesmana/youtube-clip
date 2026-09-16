import React from 'react';
import type { DecorationKind } from '../visual-preset/index';
import type { Theme } from '../design';

interface HookDecorationProps {
  kind: DecorationKind;
  theme: Theme;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const HookDecoration: React.FC<HookDecorationProps> = ({
  kind,
  theme,
  size = 48,
  color,
  style,
}) => {
  const accentColor = color || theme.accent || '#38BDF8';
  const secondaryColor = theme.accent2 || '#FBBF24';

  switch (kind) {
    case 'question-mark':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size,
            fontWeight: 900,
            color: accentColor,
            lineHeight: 1,
            textShadow: `0 0 24px ${accentColor}AA, 0 4px 16px rgba(0,0,0,0.9)`,
            WebkitTextStroke: '2px #000',
            paintOrder: 'stroke fill',
            ...style,
          }}
        >
          ?
        </span>
      );

    case 'number-badge':
      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: size * 0.9,
            height: size * 0.75,
            padding: '2px 14px',
            borderRadius: 9999,
            backgroundColor: accentColor,
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: size * 0.45,
            boxShadow: `0 0 20px ${accentColor}80, 0 4px 12px rgba(0,0,0,0.6)`,
            border: '2px solid rgba(255,255,255,0.85)',
            ...style,
          }}
        >
          #1
        </div>
      );

    case 'arrow':
      return (
        <svg
          width={size}
          height={size * 0.6}
          viewBox="0 0 64 36"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 16px ${accentColor}90) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
            ...style,
          }}
        >
          <path
            d="M6 18H56M56 18L40 6M56 18L40 30"
            stroke={accentColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'scribble':
      return (
        <svg
          width={size * 2.2}
          height={size * 0.45}
          viewBox="0 0 160 28"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 12px ${accentColor}80) drop-shadow(0 2px 4px rgba(0,0,0,0.8))`,
            ...style,
          }}
        >
          <path
            d="M4 14C35 8 70 24 105 12C122 6 142 16 156 18"
            stroke={accentColor}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 20C42 16 88 26 128 17C142 14 150 19 154 22"
            stroke={secondaryColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        </svg>
      );

    case 'spark':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 20px ${accentColor}) drop-shadow(0 2px 6px rgba(0,0,0,0.8))`,
            ...style,
          }}
        >
          <path
            d="M24 2C24 14 34 24 46 24C34 24 24 34 24 46C24 34 14 24 2 24C14 24 24 14 24 2Z"
            fill={accentColor}
          />
        </svg>
      );

    case 'burst':
      return (
        <svg
          width={size * 1.3}
          height={size * 1.3}
          viewBox="0 0 64 64"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 18px ${accentColor}AA) drop-shadow(0 4px 10px rgba(0,0,0,0.8))`,
            ...style,
          }}
        >
          <path d="M32 4V16M32 48V60M4 32H16M48 32H60M12.2 12.2L20.7 20.7M43.3 43.3L51.8 51.8M12.2 51.8L20.7 43.3M43.3 20.7L51.8 12.2"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="5" fill={secondaryColor} />
        </svg>
      );

    case 'corner-frame':
      return (
        <div
          style={{
            position: 'absolute',
            inset: -14,
            pointerEvents: 'none',
            ...style,
          }}
        >
          {/* Top-Left */}
          <span style={{ position: 'absolute', top: 0, left: 0, width: 22, height: 22, borderTop: `4px solid ${accentColor}`, borderLeft: `4px solid ${accentColor}`, borderRadius: '4px 0 0 0', filter: `drop-shadow(0 0 8px ${accentColor}80)` }} />
          {/* Top-Right */}
          <span style={{ position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderTop: `4px solid ${accentColor}`, borderRight: `4px solid ${accentColor}`, borderRadius: '0 4px 0 0', filter: `drop-shadow(0 0 8px ${accentColor}80)` }} />
          {/* Bottom-Left */}
          <span style={{ position: 'absolute', bottom: 0, left: 0, width: 22, height: 22, borderBottom: `4px solid ${accentColor}`, borderLeft: `4px solid ${accentColor}`, borderRadius: '0 0 0 4px', filter: `drop-shadow(0 0 8px ${accentColor}80)` }} />
          {/* Bottom-Right */}
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderBottom: `4px solid ${accentColor}`, borderRight: `4px solid ${accentColor}`, borderRadius: '0 0 4px 0', filter: `drop-shadow(0 0 8px ${accentColor}80)` }} />
        </div>
      );

    case 'question-doodle':
      return (
        <svg
          width={size * 0.9}
          height={size * 1.1}
          viewBox="0 0 44 60"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 16px ${accentColor}AA) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
            ...style,
          }}
        >
          <path
            d="M8 22C6 10 20 4 30 8C38 12 40 24 30 30C23 35 22 41 22 46"
            stroke={accentColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="54" r="3.5" fill={accentColor} />
        </svg>
      );

    default:
      return null;
  }
};
