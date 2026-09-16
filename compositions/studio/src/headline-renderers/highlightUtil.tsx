import React from 'react';
import type { HighlightMode } from '../visual-preset/index';
import type { Theme } from '../design';

interface HighlightWordProps {
  token: string;
  isKeyword: boolean;
  highlightMode: HighlightMode;
  theme: Theme;
  font: string;
  fontSize: number;
  strokeWidth: number;
  underlineProgress?: number;
  isUppercase?: boolean;
  style?: React.CSSProperties;
}

/**
 * Renders a word token with the appropriate visual highlight effect:
 * - neon-glow: luminous accent color with multi-layer glow shadow
 * - underline: sleek sliding underline bar
 * - background-chip: rounded pill background
 * - brush: artistic brush-stroke background SVG underlay
 * - stroke: prominent border outline with colored text stroke
 * - box: high-contrast rounded box frame enclosing the keyword
 * - none: standard high-contrast text
 */
/**
 * Produces a clean outline style for text.
 *
 * CRITICAL FIX:
 * Fonts like Montserrat, Poppins, and Inter are variable fonts with overlapping
 * component contours (e.g. crossbar of 'A', diagonals of 'M', arms of 'E').
 * In Chromium / Skia, `-webkit-text-stroke` strokes raw vector contours directly,
 * which draws black intersecting lines/crosses inside the white letter fill.
 *
 * For overlapping-contour fonts, we use a circular 16-point `text-shadow` outline.
 * Because `text-shadow` is rasterized from the merged composite silhouette,
 * it produces a smooth, solid outer stroke with ZERO internal wireframe lines.
 */
export function getTextOutlineStyle(
  font: string,
  strokeWidth: number,
  strokeColor = '#000000',
  baseDropShadow = '0 4px 16px rgba(0,0,0,0.95)'
): React.CSSProperties {
  if (strokeWidth <= 0) {
    return {
      WebkitTextStroke: '0px transparent',
      textShadow: baseDropShadow,
    };
  }

  const fontLower = font.toLowerCase();
  const isBebasNeue = fontLower.includes('bebas');

  if (isBebasNeue) {
    const sw = Math.min(strokeWidth, 4.5);
    const shadows: string[] = [];
    const numPoints = 16;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      const x = Math.round(Math.cos(angle) * sw * 10) / 10;
      const y = Math.round(Math.sin(angle) * sw * 10) / 10;
      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
    }
    if (baseDropShadow) {
      shadows.push(baseDropShadow);
    }
    return {
      WebkitTextStroke: '1.4px currentColor',
      paintOrder: 'fill stroke',
      textShadow: shadows.join(', '),
    };
  }

  const isOverlappingContourFont =
    fontLower.includes('montserrat') ||
    fontLower.includes('poppins') ||
    fontLower.includes('inter');

  if (isOverlappingContourFont) {
    const sw = Math.min(strokeWidth, 5.5);
    const shadows: string[] = [];
    const numPoints = 16;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      const x = Math.round(Math.cos(angle) * sw * 10) / 10;
      const y = Math.round(Math.sin(angle) * sw * 10) / 10;
      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
    }
    if (baseDropShadow) {
      shadows.push(baseDropShadow);
    }
    return {
      WebkitTextStroke: '0px transparent',
      textShadow: shadows.join(', '),
    };
  }

  return {
    WebkitTextStroke: `${strokeWidth}px ${strokeColor}`,
    paintOrder: 'stroke fill',
    textShadow: baseDropShadow,
  };
}

export const HighlightWord: React.FC<HighlightWordProps> = ({
  token,
  isKeyword,
  highlightMode,
  theme,
  font,
  fontSize,
  strokeWidth,
  underlineProgress = 1,
  isUppercase = false,
  style,
}) => {
  const accent = theme.accent || '#38BDF8';
  const textTransform = isUppercase ? 'uppercase' : 'none';

  if (!isKeyword || highlightMode === 'none') {
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          fontFamily: font,
          fontSize,
          lineHeight: 1.15,
          fontWeight: 900,
          color: '#FFFFFF',
          textTransform,
          letterSpacing: '0.4px',
          ...getTextOutlineStyle(font, strokeWidth, '#000000', '0 4px 16px rgba(0,0,0,0.95)'),
          ...style,
        }}
      >
        {token}
      </span>
    );
  }

  switch (highlightMode) {
    case 'neon-glow':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#BBE1FA',
            textTransform,
            letterSpacing: '0.5px',
            ...getTextOutlineStyle(
              font,
              strokeWidth,
              '#000000',
              `0 0 28px #BBE1FA, 0 0 14px ${accent}, 0 6px 16px rgba(0,0,0,0.95)`
            ),
            ...style,
          }}
        >
          {token}
        </span>
      );

    case 'underline':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform,
            letterSpacing: '0.4px',
            ...getTextOutlineStyle(font, strokeWidth, '#000000', '0 4px 16px rgba(0,0,0,0.95)'),
            ...style,
          }}
        >
          {token}
          <span
            style={{
              position: 'absolute',
              bottom: -6,
              left: 0,
              height: Math.max(4, Math.round(fontSize * 0.08)),
              width: `${Math.min(100, Math.max(0, underlineProgress * 100))}%`,
              background: accent,
              borderRadius: 4,
              boxShadow: `0 0 14px ${accent}, 0 2px 6px rgba(0,0,0,0.8)`,
            }}
          />
        </span>
      );

    case 'background-chip':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent,
            borderRadius: 10,
            padding: '2px 14px',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: '0.5px',
            boxShadow: `0 0 28px ${accent}90, 0 4px 14px rgba(0,0,0,0.7)`,
            WebkitTextStroke: '0px transparent',
            textTransform,
            ...style,
          }}
        >
          {token}
        </span>
      );

    case 'brush':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform,
            letterSpacing: '0.5px',
            padding: '2px 10px',
            ...getTextOutlineStyle(font, strokeWidth, '#000000', '0 4px 16px rgba(0,0,0,0.95)'),
            ...style,
          }}
        >
          {/* Brush stroke SVG underlay */}
          <svg
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: '-8% -6%',
              width: '112%',
              height: '116%',
              zIndex: -1,
              filter: `drop-shadow(0 0 16px ${accent}99)`,
              transform: 'rotate(-1.5deg)',
            }}
          >
            <path
              d="M4 22C24 10 52 8 82 11C102 13 114 17 118 24C114 31 92 34 66 33C38 32 16 35 3 28C-1 25 1 23 4 22Z"
              fill={accent}
              opacity="0.92"
            />
          </svg>
          {token}
        </span>
      );

    case 'stroke':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform,
            letterSpacing: '0.6px',
            ...getTextOutlineStyle(
              font,
              Math.max(4, strokeWidth + 2),
              accent,
              `0 0 20px ${accent}90, 0 4px 14px rgba(0,0,0,0.9)`
            ),
            ...style,
          }}
        >
          {token}
        </span>
      );

    case 'box':
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform,
            letterSpacing: '0.5px',
            border: `3px solid ${accent}`,
            borderRadius: 8,
            padding: '2px 12px',
            boxShadow: `0 0 16px ${accent}70, inset 0 0 12px ${accent}25, 0 4px 14px rgba(0,0,0,0.8)`,
            ...getTextOutlineStyle(font, strokeWidth, '#000000', '0 4px 14px rgba(0,0,0,0.8)'),
            ...style,
          }}
        >
          {token}
        </span>
      );

    default:
      return (
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: font,
            fontSize,
            lineHeight: 1.15,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform,
            ...getTextOutlineStyle(font, strokeWidth, '#000000', '0 4px 16px rgba(0,0,0,0.95)'),
            ...style,
          }}
        >
          {token}
        </span>
      );
  }
};
