import React, { useState, useEffect } from 'react';
import type { ClientVisualPreset } from '../../lib/visual-presets';
import { CLIENT_PRESET_MAP } from '../../lib/visual-presets';
import { resolveTagVisual } from '../../lib/hook-tags';
import type {
  VisualPresetSelection,
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
} from '../../types';

interface HookPresetLivePreviewProps {
  selectedPreset: VisualPresetSelection;
  overrideLayout?: CompositionLayout | 'auto';
  overrideAnimation?: AnimationPreset | 'auto';
  overrideTypography?: TypographyVariant | 'auto';
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

  // Trigger animation replay when preset, layout, animation, or typography changes
  useEffect(() => {
    setReplayKey((k) => k + 1);
  }, [activePresetId, overrideLayout, overrideAnimation, overrideTypography]);

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

              {/* Tag Pill */}
              {tagText && (() => {
                const visual = resolveTagVisual(tagText);
                return (
                  <div
                    className="hpl-tag-pill"
                    style={{
                      borderColor: visual.borderColor,
                      backgroundColor: visual.bgColor,
                      boxShadow: `0 4px 14px rgba(0, 0, 0, 0.7), 0 0 12px ${visual.glowColor}`,
                    }}
                  >
                    <span style={{ color: visual.textColor }}>{tagText}</span>
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
