import React, { useState, useEffect } from 'react';
import type { ClientVisualPreset } from '../../lib/visual-presets';
import { CLIENT_PRESET_MAP } from '../../lib/visual-presets';
import { resolveBadgeStyle, parseHookTag } from '../../lib/hook-tags';
import { HookIcon } from './HookIcon';
import type {
  VisualPresetSelection,
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
} from '../../types';

interface HookPresetLivePreviewProps {
  selectedPreset: VisualPresetSelection;
  overrideLayout?: CompositionLayout | 'auto';
  overrideAnimation?: AnimationPreset | 'auto';
  overrideTypography?: TypographyVariant | 'auto';
  selectedBadgePreset?: BadgePresetId;
  selectedBadgeColor?: BadgeColorVariant;
  customText?: string;
  customTag?: string;
  highlightWords?: string[];
  thumbnailUrl?: string;
  aiRecommendationId?: VisualPresetId;
}

const TYPOGRAPHY_FONT_MAP: Record<TypographyVariant, { fontName: string; fontClass: string }> = {
  kinetic: { fontName: 'Bebas Neue', fontClass: 'font-bebas-neue' },
  stacked: { fontName: 'Montserrat ExtraBold', fontClass: 'font-montserrat' },
  minimal: { fontName: 'Poppins', fontClass: 'font-poppins' },
  'bold-caps': { fontName: 'Anton', fontClass: 'font-anton' },
  'bebas-neue': { fontName: 'Bebas Neue', fontClass: 'font-bebas-neue' },
  montserrat: { fontName: 'Montserrat ExtraBold', fontClass: 'font-montserrat' },
  anton: { fontName: 'Anton', fontClass: 'font-anton' },
  'archivo-black': { fontName: 'Archivo Black', fontClass: 'font-archivo-black' },
  poppins: { fontName: 'Poppins', fontClass: 'font-poppins' },
  oswald: { fontName: 'Oswald', fontClass: 'font-oswald' },
  'barlow-condensed': { fontName: 'Barlow Condensed', fontClass: 'font-barlow-condensed' },
};

export const HookPresetLivePreview: React.FC<HookPresetLivePreviewProps> = ({
  selectedPreset,
  overrideLayout = 'auto',
  overrideAnimation = 'auto',
  overrideTypography = 'auto',
  selectedBadgePreset = 'neon-outline',
  selectedBadgeColor = 'auto',
  customText,
  customTag,
  highlightWords = [],
  thumbnailUrl,
  aiRecommendationId = 'kinetic-punch',
}) => {
  const activePresetId: VisualPresetId =
    selectedPreset === 'auto' ? aiRecommendationId : selectedPreset;

  const preset: ClientVisualPreset =
    CLIENT_PRESET_MAP[activePresetId] || CLIENT_PRESET_MAP['kinetic-punch'];

  const [replayKey, setReplayKey] = useState(0);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // Active layout, animation, & typography (honor user manual override if set, else preset native)
  const activeLayout =
    overrideLayout && overrideLayout !== 'auto'
      ? overrideLayout
      : (preset.layout.toLowerCase().replace(/\s+/g, '-') as CompositionLayout);

  const activeAnimation =
    overrideAnimation && overrideAnimation !== 'auto'
      ? overrideAnimation
      : (preset.animation.toLowerCase().replace(/\s+/g, '-') as AnimationPreset);

  const activeTypography =
    overrideTypography && overrideTypography !== 'auto'
      ? overrideTypography
      : (preset.typography.toLowerCase().replace(/\s+/g, '-') as TypographyVariant);

  const activeFont =
    TYPOGRAPHY_FONT_MAP[activeTypography] || {
      fontName: preset.fontName,
      fontClass: `font-${preset.fontName.toLowerCase().replace(/\s+/g, '-')}`,
    };

  // Trigger animation replay when preset, layout, animation, typography, or badge styling changes
  useEffect(() => {
    setReplayKey((k) => k + 1);
  }, [activePresetId, overrideLayout, overrideAnimation, overrideTypography, selectedBadgePreset, selectedBadgeColor]);

  const headlineText = customText && customText.trim() ? customText : preset.demoHeadline;
  const tagText = customTag && customTag.trim() ? customTag : preset.tag;

  const words = headlineText.split(/\s+/).filter(Boolean);

  const isWordHighlighted = (word: string, index: number): boolean => {
    const clean = word.toLowerCase().replace(/[.,!?…]/g, '');
    if (highlightWords.length > 0) {
      return highlightWords.some((hw) => hw.toLowerCase().trim() === clean);
    }
    if (preset.demoKeyword) {
      return word.toUpperCase().includes(preset.demoKeyword.toUpperCase());
    }
    return index === Math.floor(words.length / 2);
  };

  return (
    <div className="hpl-container">
      <div className="hpl-header">
        <div className="hpl-title-row">
          <span className="hpl-title">📱 Live Preview (9:16)</span>
        </div>
        <div className="hpl-controls">
          <button
            type="button"
            className={`hpl-toggle-btn ${showSafeZone ? 'active' : ''}`}
            onClick={() => setShowSafeZone(!showSafeZone)}
            title="Toggle panduan Safe Zone TikTok/Reels"
          >
            📐 Safe Zone
          </button>
          <button
            type="button"
            className="hpl-replay-btn"
            onClick={() => setReplayKey((k) => k + 1)}
            title="Putar ulang animasi intro"
          >
            ↻ Replay
          </button>
        </div>
      </div>

      <div className="hpl-body">
        {/* Phone Mockup Canvas (9:16 Aspect Ratio) */}
        <div className="hpl-phone-frame">
          <div className="hpl-screen" key={replayKey}>
            {/* Background Layer: video thumbnail or ambient blur */}
            {thumbnailUrl ? (
              <div
                className="hpl-bg-media"
                style={{ backgroundImage: `url(${thumbnailUrl})` }}
              />
            ) : (
              <div className="hpl-bg-gradient" />
            )}

            <div className="hpl-vignette-overlay" />

            {/* Safe Zone Overlay */}
            {showSafeZone && (
              <div className="hpl-safe-zone-overlay">
                <div className="hpl-sz-top">
                  <span>Top Safe Zone (120px)</span>
                </div>
                <div className="hpl-sz-center">
                  <span>Center Safe Zone (460px)</span>
                </div>
                <div className="hpl-sz-bottom">
                  <span>Bottom Safe Zone (220px)</span>
                </div>
              </div>
            )}

            {/* Hook Headline & Decoration Container */}
            <div className={`hpl-content-layer layout-${activeLayout}`}>
              {/* Corner Frame Decoration */}
              {preset.decoration === 'Corner Frame' && (
                <div className="hpl-corner-frame">
                  <span className="cf-tl" />
                  <span className="cf-tr" />
                  <span className="cf-bl" />
                  <span className="cf-br" />
                </div>
              )}

              {/* Tag Pill with Badge Design System */}
              {tagText && (() => {
                const badge = resolveBadgeStyle(selectedBadgePreset, selectedBadgeColor, tagText);
                const { iconName, cleanText } = parseHookTag(tagText);

                // ── 1. Solid Impact: Compact Single-Line SVG Sticker ──
                if (selectedBadgePreset === 'solid-impact') {
                  let bgHex = '#FF1744';
                  if (selectedBadgeColor === 'yellow') bgHex = '#B45309';
                  else if (selectedBadgeColor === 'green') bgHex = '#15803D';
                  else if (selectedBadgeColor === 'auto') bgHex = badge.bgColor;

                  const SvgStrokes = ({ side }: { side: 'left' | 'right' }) => (
                    <svg width={10} height={12} viewBox="0 0 10 12" style={{
                      flexShrink: 0,
                      marginLeft: side === 'right' ? 3 : 0,
                      marginRight: side === 'left' ? 3 : 0,
                      transform: side === 'left' ? 'scaleX(-1)' : undefined,
                      overflow: 'visible',
                    }}>
                      {[{ w: 8, y: 2 }, { w: 5, y: 6 }, { w: 3, y: 10 }].map(({ w, y }, i) => (
                        <line
                          key={i}
                          x1={10 - w} y1={y}
                          x2={10} y2={y}
                          stroke={bgHex} strokeWidth={1.8} strokeLinecap="round"
                          filter={`drop-shadow(0 0 2px ${bgHex})`}
                        />
                      ))}
                    </svg>
                  );

                  return (
                    <div className="hpl-tag-pill" style={{ background: 'none', border: 'none', boxShadow: 'none', padding: 0, marginBottom: 6 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <SvgStrokes side="left" />

                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: bgHex,
                            borderRadius: 5,
                            border: '1px solid rgba(255,255,255,0.25)',
                            padding: '2px 8px',
                            boxShadow: `0 2px 6px rgba(0,0,0,0.65), 0 0 8px ${bgHex}75`,
                            overflow: 'hidden',
                          }}
                        >
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
                            size={8}
                            color="#FFFFFF"
                            glow
                            glowColor="rgba(255,255,255,0.7)"
                            style={{ marginRight: 3, position: 'relative', zIndex: 1 }}
                          />
                          <span
                            style={{
                              position: 'relative',
                              zIndex: 1,
                              fontSize: 7.5,
                              fontWeight: 900,
                              letterSpacing: '0.4px',
                              color: '#FFFFFF',
                              textTransform: 'uppercase',
                              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                            }}
                          >
                            {cleanText}
                          </span>
                        </div>

                        <SvgStrokes side="right" />
                      </div>
                    </div>
                  );
                }

                // ── 2. Price Tag: ticket shape with hole punch ──
                if (selectedBadgePreset === 'price-tag') {
                  const bgHex = badge.bgColor;
                  const textHex = badge.textColor;
                  return (
                    <div
                      className="hpl-tag-pill"
                      style={{
                        background: 'none',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0,
                        marginBottom: 6,
                        filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.65)) drop-shadow(0 0 8px ${bgHex}80)`,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: bgHex,
                          clipPath: 'polygon(0% 0%, calc(100% - 7px) 0%, 100% 50%, calc(100% - 7px) 100%, 0% 100%, 0% 0%)',
                          borderRadius: '3px 0 0 3px',
                          padding: '2px 8px 2px 12px',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 4,
                            width: 3.5,
                            height: 3.5,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(8, 14, 26, 0.95)',
                            boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.4)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '45%',
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)',
                            pointerEvents: 'none',
                          }}
                        />
                        <HookIcon
                          name={iconName}
                          size={8}
                          color={textHex}
                          style={{ marginRight: 3, position: 'relative', zIndex: 1 }}
                        />
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            fontSize: 7.5,
                            fontWeight: 900,
                            letterSpacing: '0.4px',
                            color: textHex,
                            textTransform: 'uppercase',
                          }}
                        >
                          {cleanText}
                        </span>
                      </div>
                    </div>
                  );
                }

                // ── 3. Speech Bubble: bubble with dialog tail ──
                if (selectedBadgePreset === 'speech-bubble') {
                  const bgHex = badge.bgColor;
                  const textHex = badge.textColor;
                  return (
                    <div
                      className="hpl-tag-pill"
                      style={{
                        background: 'none',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0,
                        marginBottom: 8,
                        filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.65)) drop-shadow(0 0 8px ${bgHex}80)`,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: bgHex,
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.35)',
                          padding: '2px 8px',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '45%',
                            borderRadius: '6px 6px 0 0',
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
                            pointerEvents: 'none',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: -4,
                            left: 10,
                            width: 0,
                            height: 0,
                            borderLeft: '3px solid transparent',
                            borderRight: '3px solid transparent',
                            borderTop: `4px solid ${bgHex}`,
                          }}
                        />
                        <HookIcon
                          name={iconName}
                          size={8}
                          color={textHex}
                          style={{ marginRight: 3, position: 'relative', zIndex: 1 }}
                        />
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            fontSize: 7.5,
                            fontWeight: 800,
                            letterSpacing: '0.4px',
                            color: textHex,
                            textTransform: 'uppercase',
                          }}
                        >
                          {cleanText}
                        </span>
                      </div>
                    </div>
                  );
                }

                // ── 4. Burst Stamp: multi-point jagged burst ──
                if (selectedBadgePreset === 'burst-stamp') {
                  const bgHex = badge.bgColor;
                  const textHex = badge.textColor;
                  const burstPolygon =
                    'polygon(50% 0%, 56% 12%, 63% 2%, 69% 14%, 77% 4%, 82% 16%, 92% 10%, 90% 24%, 100% 25%, 93% 40%, 100% 50%, 93% 60%, 100% 75%, 90% 76%, 92% 90%, 82% 84%, 77% 96%, 69% 86%, 63% 98%, 56% 88%, 50% 100%, 44% 88%, 37% 98%, 31% 86%, 23% 96%, 18% 84%, 8% 90%, 10% 76%, 0% 75%, 7% 60%, 0% 50%, 7% 40%, 0% 25%, 10% 24%, 8% 10%, 18% 16%, 23% 4%, 31% 14%, 37% 2%, 44% 12%)';
                  return (
                    <div
                      className="hpl-tag-pill"
                      style={{
                        background: 'none',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0,
                        marginBottom: 6,
                        transform: 'rotate(-1.5deg)',
                        filter: `drop-shadow(0 2px 8px rgba(0,0,0,0.75)) drop-shadow(0 0 8px ${bgHex}80)`,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: bgHex,
                          clipPath: burstPolygon,
                          padding: '3px 9px',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '45%',
                            background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)',
                            pointerEvents: 'none',
                          }}
                        />
                        <HookIcon
                          name={iconName}
                          size={8}
                          color={textHex}
                          style={{ marginRight: 3, position: 'relative', zIndex: 1 }}
                        />
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            fontSize: 7.5,
                            fontWeight: 900,
                            letterSpacing: '0.4px',
                            color: textHex,
                            textTransform: 'uppercase',
                          }}
                        >
                          {cleanText}
                        </span>
                      </div>
                    </div>
                  );
                }

                // ── 5. Diagonal Slash: sporty parallelogram with speed bars ──
                if (selectedBadgePreset === 'diagonal-slash') {
                  const bgHex = badge.bgColor;
                  const textHex = badge.textColor;
                  return (
                    <div
                      className="hpl-tag-pill"
                      style={{
                        background: 'none',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0,
                        marginBottom: 6,
                        filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${bgHex}70)`,
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 2, marginRight: 3, transform: 'skewX(-16deg)' }}>
                          <div style={{ width: 2, height: 11, backgroundColor: bgHex, borderRadius: 1, boxShadow: `0 0 4px ${bgHex}` }} />
                          <div style={{ width: 1.5, height: 11, backgroundColor: bgHex, opacity: 0.65, borderRadius: 1, boxShadow: `0 0 2px ${bgHex}` }} />
                        </div>
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: bgHex,
                            clipPath: 'polygon(7px 0%, 100% 0%, calc(100% - 7px) 100%, 0% 100%)',
                            padding: '2px 9px',
                          }}
                        >
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
                            size={8}
                            color={textHex}
                            style={{ marginRight: 3, position: 'relative', zIndex: 1 }}
                          />
                          <span
                            style={{
                              position: 'relative',
                              zIndex: 1,
                              fontSize: 7.5,
                              fontWeight: 900,
                              fontStyle: 'italic',
                              letterSpacing: '0.6px',
                              color: textHex,
                              textTransform: 'uppercase',
                            }}
                          >
                            {cleanText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Other presets: flat single-line pill ──
                return (
                  <div
                    className="hpl-tag-pill"
                    style={{
                      borderColor: badge.borderColor,
                      backgroundColor: badge.bgColor,
                      borderRadius: badge.borderRadius > 100 ? 9999 : `${badge.borderRadius}px`,
                      borderWidth: `${badge.borderWidth}px`,
                      borderStyle: badge.borderWidth > 0 ? 'solid' : 'none',
                      boxShadow: badge.boxShadow,
                      padding: '2px 8px',
                      marginBottom: 6,
                    }}
                  >
                    <HookIcon
                      name={iconName}
                      size={8}
                      color={badge.textColor}
                      glow={selectedBadgePreset === 'neon-outline' || selectedBadgePreset === 'highlight-chip'}
                      glowColor={`${badge.textColor}80`}
                      style={{ marginRight: 3 }}
                    />
                    <span
                      style={{
                        color: badge.textColor,
                        letterSpacing: badge.letterSpacing,
                        fontWeight: badge.fontWeight,
                        fontSize: 7.5,
                      }}
                    >
                      {cleanText}
                    </span>
                  </div>
                );
              })()}

              {/* Dynamic Animated Headline Text */}
              <div className={`hpl-headline-box anim-${activeAnimation}`}>
                {words.map((word, i) => {
                  const highlighted = isWordHighlighted(word, i);
                  return (
                    <span
                      key={`${word}-${i}`}
                      className={`hpl-word-token ${activeFont.fontClass} ${
                        highlighted ? `highlight-${preset.highlight.toLowerCase().replace(/\s+/g, '-')}` : ''
                      }`}
                      style={{
                        animationDelay:
                          activeAnimation === 'word-cascade' ? `${i * 0.12}s` : undefined,
                      }}
                    >
                      {/* Brush SVG underline */}
                      {highlighted && preset.highlight === 'Brush' && (
                        <svg
                          viewBox="0 0 100 32"
                          preserveAspectRatio="none"
                          className="hpl-brush-svg"
                        >
                          <path
                            d="M3 18C20 9 45 7 72 10C89 12 97 15 99 20C96 26 77 28 55 27C31 26 12 28 2 23Z"
                            fill="#06B6D4"
                          />
                        </svg>
                      )}
                      {word}
                    </span>
                  );
                })}
              </div>

              {/* Decoration Element */}
              {preset.decoration !== 'None' && preset.decoration !== 'Corner Frame' && (
                <div className="hpl-decoration-box">
                  {preset.decoration === 'Question Mark' && (
                    <span className="hpl-deco-qm">?</span>
                  )}
                  {preset.decoration === 'Number Badge' && (
                    <span className="hpl-deco-badge">#1</span>
                  )}
                  {preset.decoration === 'Arrow' && (
                    <svg width="34" height="20" viewBox="0 0 64 36" fill="none" className="hpl-deco-svg">
                      <path d="M6 18H56M56 18L40 6M56 18L40 30" stroke="#F59E0B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {preset.decoration === 'Scribble' && (
                    <svg width="80" height="18" viewBox="0 0 160 28" fill="none" className="hpl-deco-svg">
                      <path d="M4 14C35 8 70 24 105 12C122 6 142 16 156 18" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  )}
                  {preset.decoration === 'Spark' && (
                    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="hpl-deco-svg">
                      <path d="M24 2C24 14 34 24 46 24C34 24 24 34 24 46C24 34 14 24 2 24C14 24 24 14 24 2Z" fill="#FACC15" />
                    </svg>
                  )}
                  {preset.decoration === 'Burst' && (
                    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" className="hpl-deco-svg">
                      <path d="M32 4V16M32 48V60M4 32H16M48 32H60M12.2 12.2L20.7 20.7M43.3 43.3L51.8 51.8M12.2 51.8L20.7 43.3M43.3 20.7L51.8 12.2" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Safe Zone Indicator / Progress Bar Simulation */}
            <div className="hpl-progress-simulation">
              <div className="hpl-progress-fill" />
            </div>
          </div>
        </div>

        {/* Compact Preset Specs Strip */}
        <div className="hpl-compact-specs">
          <div className="hpl-spec-tag">
            <span className="spec-k">Preset:</span>
            <span className="spec-v">{preset.label}</span>
          </div>
          <div className="hpl-spec-tag">
            <span className="spec-k">Tipografi:</span>
            <span className="spec-v">{activeFont.fontName} ({activeTypography}) {overrideTypography && overrideTypography !== 'auto' ? '(Custom)' : ''}</span>
          </div>
          <div className="hpl-spec-tag">
            <span className="spec-k">Layout:</span>
            <span className="spec-v">{activeLayout} {overrideLayout && overrideLayout !== 'auto' ? '(Custom)' : ''}</span>
          </div>
          <div className="hpl-spec-tag">
            <span className="spec-k">Motion:</span>
            <span className="spec-v">{activeAnimation} {overrideAnimation && overrideAnimation !== 'auto' ? '(Custom)' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
