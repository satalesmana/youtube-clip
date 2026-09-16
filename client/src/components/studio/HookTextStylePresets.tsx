import React from 'react';
import type {
  VisualPresetSelection,
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  ViralHook,
} from '../../types';
import { CLIENT_VISUAL_PRESETS, CLIENT_PRESET_MAP } from '../../lib/visual-presets';
import { HOOK_TAG_CATEGORIES, RESEARCH_HOOK_TAGS, resolveTagVisual } from '../../lib/hook-tags';
import { HookPresetLivePreview } from './HookPresetLivePreview';

export interface HookTextStylePresetsProps {
  value: VisualPresetSelection;
  onChange: (v: VisualPresetSelection) => void;
  selectedLayout: CompositionLayout | 'auto';
  onLayoutChange: (l: CompositionLayout | 'auto') => void;
  selectedAnimation: AnimationPreset | 'auto';
  onAnimationChange: (a: AnimationPreset | 'auto') => void;
  selectedTypography: TypographyVariant | 'auto';
  onTypographyChange: (t: TypographyVariant | 'auto') => void;
  disabled?: boolean;
  aiRecommendationLabel?: string;
  aiRecommendationId?: VisualPresetId;
  customHookText?: string;
  setCustomHookText?: (t: string) => void;
  customHookTag?: string;
  setCustomHookTag?: (t: string) => void;
  highlightWords?: string[];
  thumbnailUrl?: string;
  selectedHookIndex?: number | null;
  hooks?: ViralHook[];
}

export function normalizeTypography(variant: TypographyVariant): TypographyVariant {
  switch (variant) {
    case 'kinetic':
      return 'bebas-neue';
    case 'stacked':
      return 'montserrat';
    case 'bold-caps':
      return 'anton';
    case 'minimal':
      return 'poppins';
    default:
      return variant;
  }
}

const TYPOGRAPHY_OPTIONS: Array<{
  id: TypographyVariant;
  label: string;
  font: string;
  cssClass: string;
  desc: string;
}> = [
  { id: 'montserrat', label: 'Montserrat', font: 'ExtraBold 800', cssClass: 'montserrat', desc: 'ExtraBold modern geometric sans' },
  { id: 'anton', label: 'Anton', font: 'Impact Caps', cssClass: 'anton', desc: 'Condensed heavy impact font' },
  { id: 'bebas-neue', label: 'Bebas Neue', font: 'Condensed Caps', cssClass: 'bebas-neue', desc: 'Bold condensed all-caps display' },
  { id: 'archivo-black', label: 'Archivo Black', font: 'Black 900', cssClass: 'archivo-black', desc: 'Ultra-heavy gothic sans' },
  { id: 'poppins', label: 'Poppins', font: 'Bold 700', cssClass: 'poppins', desc: 'Punchy geometric curves' },
  { id: 'oswald', label: 'Oswald', font: 'Bold 700', cssClass: 'oswald', desc: 'Alternate gothic condensed' },
  { id: 'barlow-condensed', label: 'Barlow Condensed', font: 'ExtraBold 800', cssClass: 'barlow-condensed', desc: 'High-energy condensed grotesque' },
];

const TYPOGRAPHY_MAP: Record<TypographyVariant, { label: string; font: string }> = {
  kinetic: { label: 'Bebas Neue', font: 'Bebas Neue' },
  stacked: { label: 'Montserrat ExtraBold', font: 'Montserrat ExtraBold' },
  minimal: { label: 'Poppins', font: 'Poppins' },
  'bold-caps': { label: 'Anton', font: 'Anton' },
  'bebas-neue': { label: 'Bebas Neue', font: 'Bebas Neue' },
  montserrat: { label: 'Montserrat ExtraBold', font: 'Montserrat ExtraBold' },
  anton: { label: 'Anton', font: 'Anton' },
  'archivo-black': { label: 'Archivo Black', font: 'Archivo Black' },
  poppins: { label: 'Poppins', font: 'Poppins' },
  oswald: { label: 'Oswald', font: 'Oswald' },
  'barlow-condensed': { label: 'Barlow Condensed', font: 'Barlow Condensed' },
};

const LAYOUT_OPTIONS: Array<{ id: CompositionLayout; label: string; icon: string; desc: string }> = [
  { id: 'centered', label: 'Centered', icon: '🎯', desc: 'Tengah seimbang' },
  { id: 'top-heavy', label: 'Top-Heavy', icon: '⬆️', desc: 'Atas (0–35%)' },
  { id: 'split-proof', label: 'Split-Proof', icon: '⚖️', desc: 'Bagi dua kolom' },
  { id: 'full-screen-text', label: 'Full-Screen', icon: '📺', desc: 'Layar penuh' },
  { id: 'subject-first', label: 'Subject-First', icon: '👤', desc: 'Fokus orang' },
  { id: 'data-focus', label: 'Data-Focus', icon: '📊', desc: 'Fokus angka' },
  { id: 'question-focus', label: 'Question-Focus', icon: '❓', desc: 'Fokus tanya' },
];

const ANIMATION_OPTIONS: Array<{ id: AnimationPreset; label: string; icon: string; desc: string }> = [
  { id: 'spring-punch', label: 'Spring Punch', icon: '⚡', desc: 'Pantulan elastis' },
  { id: 'word-cascade', label: 'Word Cascade', icon: '🌊', desc: 'Muncul bertahap' },
  { id: 'slide-up', label: 'Slide Up', icon: '⬆️', desc: 'Meluncur ke atas' },
  { id: 'scale-burst', label: 'Scale Burst', icon: '💥', desc: 'Meledak lalu stabil' },
  { id: 'fade', label: 'Clean Fade', icon: '✨', desc: 'Transisi halus' },
];

/**
 * Parses emoji prefix and text title cleanly from preset labels (e.g. "⚡ Kinetic Punch" -> icon: "⚡", title: "Kinetic Punch")
 * Prevents duplicate emoji rendering.
 */
function parsePresetLabel(fullLabel: string, fallbackIcon = '🎨'): { icon: string; title: string } {
  const match = fullLabel.match(/^(\S+)\s+(.+)$/);
  if (match) {
    return { icon: match[1], title: match[2] };
  }
  return { icon: fallbackIcon, title: fullLabel };
}

export const HookTextStylePresets: React.FC<HookTextStylePresetsProps> = ({
  value,
  onChange,
  selectedLayout,
  onLayoutChange,
  selectedAnimation,
  onAnimationChange,
  selectedTypography,
  onTypographyChange,
  disabled = false,
  aiRecommendationId = 'kinetic-punch',
  customHookText,
  setCustomHookText,
  customHookTag,
  setCustomHookTag,
  highlightWords,
  thumbnailUrl,
  selectedHookIndex,
  hooks = [],
}) => {
  const [tagCategoryFilter, setTagCategoryFilter] = React.useState<string>('all');
  const aiPreset = CLIENT_PRESET_MAP[aiRecommendationId] || CLIENT_PRESET_MAP['kinetic-punch'];

  const displayedTags = tagCategoryFilter === 'all'
    ? RESEARCH_HOOK_TAGS
    : RESEARCH_HOOK_TAGS.filter((t) => t.category === tagCategoryFilter);

  // 1. Active visual preset (either user override or AI default)
  const isPresetCustom = value !== 'auto';
  const effectivePresetId: VisualPresetId = isPresetCustom ? value : aiRecommendationId;
  const effectivePreset = CLIENT_PRESET_MAP[effectivePresetId] || aiPreset;
  const effectivePresetParsed = parsePresetLabel(effectivePreset.label);

  // 2. Active typography (either user override or preset native)
  const isTypographyCustom = selectedTypography !== 'auto';
  const effectiveTypography: TypographyVariant = isTypographyCustom
    ? selectedTypography
    : (effectivePreset.typography.toLowerCase().replace(/\s+/g, '-') as TypographyVariant);

  const effectiveFontInfo = TYPOGRAPHY_MAP[effectiveTypography] || {
    label: effectivePreset.typography,
    font: effectivePreset.fontName,
  };
  const effectiveFontName = effectiveFontInfo.font;
  const effectiveTypoLabel = effectiveFontInfo.label;

  // 3. Active layout (either user override or preset native)
  const isLayoutCustom = selectedLayout !== 'auto';
  const effectiveLayout: CompositionLayout = isLayoutCustom
    ? selectedLayout
    : (effectivePreset.layout.toLowerCase().replace(/\s+/g, '-') as CompositionLayout);

  // 4. Active animation (either user override or preset native)
  const isAnimationCustom = selectedAnimation !== 'auto';
  const effectiveAnimation: AnimationPreset = isAnimationCustom
    ? selectedAnimation
    : (effectivePreset.animation.toLowerCase().replace(/\s+/g, '-') as AnimationPreset);

  const isFullAuto = !isPresetCustom && !isTypographyCustom && !isLayoutCustom && !isAnimationCustom;

  const handleApplyAllAi = () => {
    if (!disabled) {
      onChange('auto');
      onTypographyChange('auto');
      onLayoutChange('auto');
      onAnimationChange('auto');
    }
  };

  return (
    <div className="hts-workspace">
      {/* 2-Column Responsive Studio Workspace */}
      <div className="hts-studio-layout">
        {/* Left Column: All Controls (Presets, Typography, Layout, Animation, Text) */}
        <div className="hts-controls-col">
          {/* Master Auto AI Recommendation Card: Controls All 4 Options (Preset + Typography + Layout + Animation) */}
          <div className={`hts-master-auto-card ${isFullAuto ? 'active' : ''}`}>
            <div className="hts-master-auto-top">
              <div className="hts-master-auto-left">
                <span className="hts-master-auto-icon">✨</span>
                <div>
                  <div className="hts-master-auto-title">
                    Auto AI Recommendation <span className="hts-rec-badge">{isFullAuto ? '4 Opsi AI Aktif' : 'Kustom Aktif'}</span>
                  </div>
                  <div className="hts-master-auto-desc">
                    {isFullAuto
                      ? 'AI memilih kombinasi 4 opsi optimal berdasarkan hook yang terdeteksi:'
                      : 'Kombinasi kustom aktif. Klik chip di bawah untuk mereset opsi ke AI:'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`hts-master-apply-btn ${isFullAuto ? 'active' : ''}`}
                onClick={handleApplyAllAi}
                disabled={disabled || isFullAuto}
                title="Terapkan semua 4 rekomendasi AI sekaligus"
              >
                {isFullAuto ? '✓ 4 Opsi AI Aktif' : '↺ Terapkan Semua AI'}
              </button>
            </div>

            {/* Quad of 4 Interactive Option Chips */}
            <div className="hts-triad-row" role="group" aria-label="Rekomendasi AI untuk 4 opsi">
              {/* Option 1: Gaya Preset */}
              <button
                type="button"
                className={`hts-triad-chip ${isPresetCustom ? 'custom' : 'active'}`}
                onClick={() => !disabled && isPresetCustom && onChange('auto')}
                title={isPresetCustom ? 'Klik untuk deselect kustom & kembali ke AI: ' + aiPreset.label : 'Gaya Preset mengikuti AI: ' + aiPreset.label}
              >
                <div className="triad-chip-top">
                  <span className="triad-chip-name">1. Preset</span>
                  <span className={`triad-chip-badge ${isPresetCustom ? 'badge-manual' : 'badge-auto'}`}>
                    {isPresetCustom ? 'Kustom' : '✓ AI'}
                  </span>
                </div>
                <div className="triad-chip-val">{effectivePresetParsed.title}</div>
              </button>

              {/* Option 2: Gaya Tipografi (Typography) */}
              <button
                type="button"
                className={`hts-triad-chip ${isTypographyCustom ? 'custom' : 'active'}`}
                onClick={() => !disabled && isTypographyCustom && onTypographyChange('auto')}
                title={isTypographyCustom ? `Klik untuk deselect kustom & kembali ke AI: ${aiPreset.fontName} (${aiPreset.typography})` : 'Tipografi mengikuti AI'}
              >
                <div className="triad-chip-top">
                  <span className="triad-chip-name">2. Tipografi</span>
                  <span className={`triad-chip-badge ${isTypographyCustom ? 'badge-manual' : 'badge-auto'}`}>
                    {isTypographyCustom ? 'Kustom' : '✓ AI'}
                  </span>
                </div>
                <div className="triad-chip-val">{effectiveFontName}</div>
              </button>

              {/* Option 3: Tata Letak (Layout) */}
              <button
                type="button"
                className={`hts-triad-chip ${isLayoutCustom ? 'custom' : 'active'}`}
                onClick={() => !disabled && isLayoutCustom && onLayoutChange('auto')}
                title={isLayoutCustom ? 'Klik untuk deselect kustom & kembali ke AI: ' + aiPreset.layout : 'Layout mengikuti AI'}
              >
                <div className="triad-chip-top">
                  <span className="triad-chip-name">3. Layout</span>
                  <span className={`triad-chip-badge ${isLayoutCustom ? 'badge-manual' : 'badge-auto'}`}>
                    {isLayoutCustom ? 'Kustom' : '✓ AI'}
                  </span>
                </div>
                <div className="triad-chip-val">{effectiveLayout}</div>
              </button>

              {/* Option 4: Gerakan Animasi (Motion) */}
              <button
                type="button"
                className={`hts-triad-chip ${isAnimationCustom ? 'custom' : 'active'}`}
                onClick={() => !disabled && isAnimationCustom && onAnimationChange('auto')}
                title={isAnimationCustom ? 'Klik untuk deselect kustom & kembali ke AI: ' + aiPreset.animation : 'Animasi mengikuti AI'}
              >
                <div className="triad-chip-top">
                  <span className="triad-chip-name">4. Animasi</span>
                  <span className={`triad-chip-badge ${isAnimationCustom ? 'badge-manual' : 'badge-auto'}`}>
                    {isAnimationCustom ? 'Kustom' : '✓ AI'}
                  </span>
                </div>
                <div className="triad-chip-val">{effectiveAnimation}</div>
              </button>
            </div>
          </div>

          {/* Group 1: Visual Style Presets (12 Presets directly, no individual auto bar) */}
          <div className="hts-control-group">
            <div className="hts-group-header">
              <div className="hts-group-title-row">
                <span className="hts-group-title">1. Gaya Visual Preset</span>
                <span className="hts-group-badge">12 Presets</span>
              </div>
              <span className="hts-group-hint">
                {isPresetCustom ? `Kustom: ${effectivePresetParsed.title}` : `Pilihan AI: ${effectivePresetParsed.title}`}
              </span>
            </div>

            {/* Compact 12 Preset Cards Grid (Strict 3 Columns) */}
            <div className="hts-compact-grid" role="group" aria-label="Visual style presets">
              {CLIENT_VISUAL_PRESETS.map((preset) => {
                const isSelected = effectivePresetId === preset.id;
                const { icon, title } = parsePresetLabel(preset.label);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    id={`hts-preset-${preset.id}`}
                    className={`hts-compact-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!disabled) {
                        // If this preset was explicitly custom selected, clicking it again deselects it back to auto AI
                        if (value === preset.id) {
                          onChange('auto');
                        } else {
                          onChange(preset.id);
                        }
                      }
                    }}
                    disabled={disabled}
                    aria-pressed={isSelected}
                    title={preset.description}
                  >
                    <div className="hts-compact-top">
                      <span className="hts-compact-icon">{icon}</span>
                      <span className="hts-compact-label">{title}</span>
                      {isSelected && <span className="hts-compact-check">✓</span>}
                    </div>
                    <div className="hts-compact-meta">
                      <span>{preset.metaBadges.slice(0, 2).join(' • ')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Typography Variant Selector (No icons, direct font style preview cards) */}
          <div className="hts-control-group">
            <div className="hts-group-header">
              <div className="hts-group-title-row">
                <span className="hts-group-title">2. Gaya Tipografi &amp; Font</span>
                <span className="hts-group-badge">7 Font</span>
              </div>
              <span className="hts-group-hint">
                {isTypographyCustom ? `Kustom: ${effectiveTypoLabel}` : `Pilihan AI: ${effectiveFontName}`}
              </span>
            </div>
            <div className="hts-typo-grid" role="radiogroup" aria-label="Pilihan gaya tipografi font">
              {TYPOGRAPHY_OPTIONS.map((opt) => {
                const isSelected = normalizeTypography(effectiveTypography) === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`hts-typo-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!disabled) {
                        // If this typography was explicitly custom selected, clicking it again deselects it back to auto AI
                        if (selectedTypography === opt.id) {
                          onTypographyChange('auto');
                        } else {
                          onTypographyChange(opt.id);
                        }
                      }
                    }}
                    title={`${opt.label} (${opt.font}): ${opt.desc}`}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    <div className="hts-typo-card-body">
                      <div className={`hts-typo-preview-sample font-${opt.cssClass}`}>
                        {opt.label}
                      </div>
                      <div className={`hts-typo-preview-family font-${opt.cssClass}`}>
                        {opt.font}
                      </div>
                    </div>
                    {isSelected && <span className="hts-typo-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 3: Composition Layout Selector (7 Layouts directly, no auto button) */}
          <div className="hts-control-group">
            <div className="hts-group-header">
              <div className="hts-group-title-row">
                <span className="hts-group-title">3. Tata Letak Video (Layout)</span>
                <span className="hts-group-badge">7 Layouts</span>
              </div>
              <span className="hts-group-hint">
                {isLayoutCustom ? `Kustom: ${effectiveLayout}` : `Pilihan AI: ${effectiveLayout}`}
              </span>
            </div>
            <div className="hts-layout-grid" role="radiogroup" aria-label="Composition layout selection">
              {LAYOUT_OPTIONS.map((opt) => {
                const isSelected = effectiveLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`hts-grid-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!disabled) {
                        // If this layout was explicitly custom selected, clicking it again deselects it back to auto AI
                        if (selectedLayout === opt.id) {
                          onLayoutChange('auto');
                        } else {
                          onLayoutChange(opt.id);
                        }
                      }
                    }}
                    title={opt.desc}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    <span className="hts-btn-icon">{opt.icon}</span>
                    <span className="hts-btn-text">{opt.label}</span>
                    {isSelected && <span className="hts-btn-check-inline">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 4: Text Animation Motion Selector (5 Motion options directly, no auto button) */}
          <div className="hts-control-group">
            <div className="hts-group-header">
              <div className="hts-group-title-row">
                <span className="hts-group-title">4. Gerakan Animasi Teks (Motion)</span>
                <span className="hts-group-badge">5 Gerakan</span>
              </div>
              <span className="hts-group-hint">
                {isAnimationCustom ? `Kustom: ${effectiveAnimation}` : `Pilihan AI: ${effectiveAnimation}`}
              </span>
            </div>
            <div className="hts-anim-grid" role="radiogroup" aria-label="Text animation motion selection">
              {ANIMATION_OPTIONS.map((opt) => {
                const isSelected = effectiveAnimation === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`hts-grid-btn anim-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!disabled) {
                        // If this animation was explicitly custom selected, clicking it again deselects it back to auto AI
                        if (selectedAnimation === opt.id) {
                          onAnimationChange('auto');
                        } else {
                          onAnimationChange(opt.id);
                        }
                      }
                    }}
                    title={opt.desc}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    <span className="hts-btn-icon">{opt.icon}</span>
                    <span className="hts-btn-text">{opt.label}</span>
                    {isSelected && <span className="hts-btn-check-inline">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 5: Headline Text & Tag Customization */}
          {(setCustomHookText || setCustomHookTag) && (
            <div className="hts-control-group">
              <div className="hts-group-header">
                <div className="hts-group-title-row">
                  <span className="hts-group-title">5. Kalimat &amp; Kategori Hook</span>
                </div>
                {selectedHookIndex !== null && selectedHookIndex !== undefined && hooks[selectedHookIndex] && (
                  <span className="hts-group-hint">
                    Hook #{selectedHookIndex + 1} ({hooks[selectedHookIndex]?.hookType})
                  </span>
                )}
              </div>

              {setCustomHookText && (
                <div style={{ marginBottom: '8px' }}>
                  <textarea
                    rows={2}
                    value={customHookText ?? ''}
                    onChange={(e) => setCustomHookText(e.target.value)}
                    placeholder="Tulis kalimat hook pembuka di sini (contoh: JANGAN SAMPAI SALAH PILIH!)..."
                    className="hts-hook-textarea"
                  />
                </div>
              )}

              {setCustomHookTag && (
                <div className="hts-tag-section">
                  <div className="hts-tag-label-row">
                    <span className="hts-tag-sublabel">Pill Tag Badge (0–3 Detik):</span>
                    <span className="hts-tag-hint">Pilih tag retensi viral atau ketik kustom</span>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="hts-tag-cat-tabs">
                    <button
                      type="button"
                      className={`hts-tag-cat-btn ${tagCategoryFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setTagCategoryFilter('all')}
                    >
                      ✨ Semua
                    </button>
                    {HOOK_TAG_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`hts-tag-cat-btn ${tagCategoryFilter === cat.id ? 'active' : ''}`}
                        onClick={() => setTagCategoryFilter(cat.id)}
                      >
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Research Tag Chips */}
                  <div className="hts-tag-bar">
                    <div className="hts-tag-pills">
                      {displayedTags.map((item) => {
                        const visual = resolveTagVisual(item.tag);
                        const isActive = customHookTag === item.tag;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`hts-tag-chip ${isActive ? 'active' : ''}`}
                            style={
                              isActive
                                ? {
                                    borderColor: visual.borderColor,
                                    color: visual.textColor,
                                    backgroundColor: visual.bgColor,
                                    boxShadow: `0 0 12px ${visual.glowColor}`,
                                  }
                                : undefined
                            }
                            onClick={() => setCustomHookTag(item.tag)}
                            title={item.description}
                          >
                            {item.tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Tag Input with active pill preview */}
                  <div className="hts-tag-custom-row">
                    <input
                      type="text"
                      value={customHookTag ?? ''}
                      onChange={(e) => setCustomHookTag(e.target.value)}
                      placeholder="Ketik teks tag kustom (contoh: 👀 JANGAN DI-SKIP)..."
                      className="hts-tag-input"
                    />
                    {customHookTag && (
                      <button
                        type="button"
                        className="hts-tag-clear-btn"
                        onClick={() => setCustomHookTag('')}
                        title="Hapus tag (tanpa badge)"
                      >
                        ✕ Hapus Tag
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Live Phone Preview */}
        <div className="hts-preview-col">
          <HookPresetLivePreview
            selectedPreset={value}
            overrideLayout={selectedLayout}
            overrideAnimation={selectedAnimation}
            overrideTypography={selectedTypography}
            customText={customHookText}
            customTag={customHookTag}
            highlightWords={highlightWords}
            thumbnailUrl={thumbnailUrl}
            aiRecommendationId={aiRecommendationId}
          />
        </div>
      </div>
    </div>
  );
};
