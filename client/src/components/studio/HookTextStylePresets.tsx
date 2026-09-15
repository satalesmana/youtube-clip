import React from 'react';
import type { VisualPresetSelection } from '../../types';
import { CLIENT_VISUAL_PRESETS } from '../../lib/visual-presets';

interface HookTextStylePresetsProps {
  value: VisualPresetSelection;
  onChange: (v: VisualPresetSelection) => void;
  disabled?: boolean;
  /** AI-recommended preset label shown as a hint inside the Auto card. */
  aiRecommendationLabel?: string;
}

export const HookTextStylePresets: React.FC<HookTextStylePresetsProps> = ({
  value,
  onChange,
  disabled = false,
  aiRecommendationLabel,
}) => {
  return (
    <div className="hts-section">
      {/* Section header */}
      <div className="hts-header">
        <div className="hts-header-text">
          <span className="hts-title">🎨 Gaya Visual Hook</span>
          <span className="hts-subtitle">
            Pilih bagaimana judul hook ditampilkan di video
          </span>
        </div>
      </div>

      {/* Auto card — full width, always at top */}
      <button
        type="button"
        className={`hts-auto-card ${value === 'auto' ? 'active' : ''}`}
        onClick={() => !disabled && onChange('auto')}
        disabled={disabled}
        id="hts-preset-auto"
        aria-pressed={value === 'auto'}
      >
        <div className="hts-auto-left">
          <span className="hts-auto-icon">✨</span>
          <div>
            <div className="hts-auto-name">Auto <span className="hts-recommended-badge">Recommended</span></div>
            <div className="hts-auto-desc">
              AI pilih otomatis berdasarkan jenis hook yang terdeteksi
              {aiRecommendationLabel && (
                <span className="hts-auto-hint"> → Biasanya: <strong>{aiRecommendationLabel}</strong></span>
              )}
            </div>
          </div>
        </div>
        {value === 'auto' && (
          <div className="hts-check-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </button>

      {/* Preset grid */}
      <div className="hts-grid" role="group" aria-label="Visual style presets">
        {CLIENT_VISUAL_PRESETS.map((preset) => {
          const isActive = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              id={`hts-preset-${preset.id}`}
              className={`hts-preset-card ${isActive ? 'active' : ''}`}
              onClick={() => !disabled && onChange(isActive ? 'auto' : preset.id)}
              disabled={disabled}
              aria-pressed={isActive}
              title={preset.description}
            >
              {/* Selected check */}
              {isActive && (
                <div className="hts-preset-check" aria-hidden="true">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}

              {/* Static visual preview */}
              <div className={`hts-preview ${preset.previewClass}`} aria-hidden="true">
                <PresetPreview presetId={preset.id} />
              </div>

              {/* Label + description */}
              <div className="hts-preset-label">{preset.label}</div>

              {/* Meta badges: animation + highlight type */}
              <div className="hts-meta-badges">
                {preset.metaBadges.map((badge) => (
                  <span key={badge} className="hts-meta-badge">{badge}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Static CSS preview that simulates the visual style — no video needed. */
const PresetPreview: React.FC<{ presetId: string }> = ({ presetId }) => {
  switch (presetId) {
    case 'kinetic-punch':
      return (
        <div className="hts-prev-kinetic">
          <span className="hts-prev-word hts-prev-plain">YOU'RE</span>
          <span className="hts-prev-word hts-prev-glow">DOING</span>
          <span className="hts-prev-word hts-prev-plain">THIS</span>
          <span className="hts-prev-word hts-prev-glow">WRONG</span>
        </div>
      );
    case 'curiosity-stack':
      return (
        <div className="hts-prev-cascade">
          <span className="hts-prev-cascade-word" style={{ opacity: 1 }}>DID</span>
          <span className="hts-prev-cascade-word" style={{ opacity: 0.85 }}>YOU</span>
          <span className="hts-prev-cascade-word hts-prev-glow" style={{ opacity: 0.7 }}>KNOW</span>
          <span className="hts-prev-cascade-word" style={{ opacity: 0.5 }}>THAT</span>
        </div>
      );
    case 'story-slide':
      return (
        <div className="hts-prev-story">
          <span className="hts-prev-story-word">This happened</span>
          <span className="hts-prev-story-word hts-prev-underline">to me</span>
        </div>
      );
    case 'minimal-question':
      return (
        <div className="hts-prev-story">
          <span className="hts-prev-story-word hts-prev-underline">Have you</span>
          <span className="hts-prev-story-word">ever wondered</span>
          <span className="hts-prev-question-mark">?</span>
        </div>
      );
    case 'bold-impact':
      return (
        <div className="hts-prev-bold">
          <span className="hts-prev-bold-word">YOU'RE</span>
          <span className="hts-prev-bold-word hts-prev-chip">WRONG</span>
          <span className="hts-prev-bold-word">ABOUT</span>
        </div>
      );
    case 'data-punch':
      return (
        <div className="hts-prev-bold">
          <span className="hts-prev-bold-word hts-prev-chip">97%</span>
          <span className="hts-prev-bold-word">OF PEOPLE</span>
          <span className="hts-prev-bold-word">FAIL</span>
        </div>
      );
    case 'opportunity-glow':
      return (
        <div className="hts-prev-cascade">
          <span className="hts-prev-cascade-word" style={{ opacity: 1 }}>This</span>
          <span className="hts-prev-cascade-word hts-prev-glow" style={{ opacity: 0.9 }}>changed</span>
          <span className="hts-prev-cascade-word" style={{ opacity: 0.75 }}>everything</span>
        </div>
      );
    default:
      return null;
  }
};
