import React from 'react';
import type {
  VisualPresetSelection,
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
  ViralHook,
} from '../../types';
import { CLIENT_VISUAL_PRESETS, CLIENT_PRESET_MAP } from '../../lib/visual-presets';
import {
  HOOK_TAG_CATEGORIES,
  RESEARCH_HOOK_TAGS,
  BADGE_PRESETS,
  resolveTagVisual,
  resolveBadgeStyle,
  parseHookTag,
} from '../../lib/hook-tags';
import { HookIcon, type HookIconName } from './HookIcon';
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
  selectedBadgePreset?: BadgePresetId;
  onBadgePresetChange?: (p: BadgePresetId) => void;
  selectedBadgeColor?: BadgeColorVariant;
  onBadgeColorChange?: (c: BadgeColorVariant) => void;
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

const LAYOUT_OPTIONS: Array<{ id: CompositionLayout; label: string; iconName: HookIconName; desc: string }> = [
  { id: 'centered', label: 'Centered', iconName: 'target', desc: 'Tengah seimbang' },
  { id: 'top-heavy', label: 'Top-Heavy', iconName: 'rocket', desc: 'Atas (0–35%)' },
  { id: 'split-proof', label: 'Split-Proof', iconName: 'gem', desc: 'Bagi dua kolom' },
  { id: 'full-screen-text', label: 'Full-Screen', iconName: 'star', desc: 'Layar penuh' },
  { id: 'subject-first', label: 'Subject-First', iconName: 'eye', desc: 'Fokus orang' },
  { id: 'data-focus', label: 'Data-Focus', iconName: 'trending-up', desc: 'Fokus angka' },
  { id: 'question-focus', label: 'Question-Focus', iconName: 'help-circle', desc: 'Fokus tanya' },
];

const ANIMATION_OPTIONS: Array<{ id: AnimationPreset; label: string; iconName: HookIconName; desc: string }> = [
  { id: 'spring-punch', label: 'Spring Punch', iconName: 'zap', desc: 'Pantulan elastis' },
  { id: 'word-cascade', label: 'Word Cascade', iconName: 'sparkles', desc: 'Muncul bertahap' },
  { id: 'slide-up', label: 'Slide Up', iconName: 'rocket', desc: 'Meluncur ke atas' },
  { id: 'scale-burst', label: 'Scale Burst', iconName: 'flame', desc: 'Meledak lalu stabil' },
  { id: 'fade', label: 'Clean Fade', iconName: 'star', desc: 'Transisi halus' },
];

const PRESET_ICON_MAP: Record<string, HookIconName> = {
  'kinetic-punch': 'zap',
  'curiosity-stack': 'help-circle',
  'story-slide': 'compass',
  'minimal-question': 'help-circle',
  'bold-impact': 'flame',
  'data-punch': 'trending-up',
  'opportunity-glow': 'lightbulb',
  'focus-brush': 'sparkles',
  'clean-fade': 'star',
  'scribble-quote': 'message-circle',
  'action-pointer': 'target',
  'burst-stat': 'bomb',
};

/**
 * Parses preset label and maps it to a modern Lucide icon name and clean text title.
 */
function parsePresetLabel(fullLabel: string, presetId?: string): { iconName: HookIconName; title: string } {
  const match = fullLabel.match(/^(\S+)\s+(.+)$/);
  const title = match ? match[2] : fullLabel;
  if (presetId && PRESET_ICON_MAP[presetId]) {
    return { iconName: PRESET_ICON_MAP[presetId], title };
  }
  const parsed = parseHookTag(fullLabel);
  return { iconName: parsed.iconName, title };
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
  selectedBadgePreset = 'neon-outline',
  onBadgePresetChange,
  selectedBadgeColor = 'auto',
  onBadgeColorChange,
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

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: RESEARCH_HOOK_TAGS.length };
    for (const item of RESEARCH_HOOK_TAGS) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const displayedTags = tagCategoryFilter === 'all'
    ? RESEARCH_HOOK_TAGS
    : RESEARCH_HOOK_TAGS.filter((t) => t.category === tagCategoryFilter);

  const activeTagVisual = resolveTagVisual(customHookTag);

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
                <span className="hts-group-title">1. Gaya Visual Hook (Preset Rekomendasi)</span>
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
                const { iconName, title } = parsePresetLabel(preset.label, preset.id);
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
                      <HookIcon
                        name={iconName}
                        size={15}
                        color={isSelected ? '#00F0FF' : '#94A3B8'}
                        glow={isSelected}
                        style={{ marginRight: 6 }}
                      />
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
                    <span className="hts-btn-icon">
                      <HookIcon name={opt.iconName} size={15} color={isSelected ? '#00F0FF' : '#94A3B8'} />
                    </span>
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
                    <span className="hts-btn-icon">
                      <HookIcon name={opt.iconName} size={15} color={isSelected ? '#00F0FF' : '#94A3B8'} />
                    </span>
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
                  {/* Header Row with retention badge and status */}
                  <div className="hts-tag-header">
                    <div className="hts-tag-title-wrap">
                      <span className="hts-tag-sublabel">Pill Tag Badge (0–3 Detik):</span>
                      <span className="hts-tag-badge-pill">Hook Retensi</span>
                    </div>
                    {customHookTag ? (
                      <button
                        type="button"
                        className="hts-tag-quick-clear"
                        onClick={() => setCustomHookTag('')}
                        title="Hapus badge (jadikan video tanpa tag)"
                      >
                        ✕ Hapus Tag
                      </button>
                    ) : (
                      <span className="hts-tag-no-badge-badge">Tanpa Tag</span>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="hts-tag-cat-tabs" role="tablist" aria-label="Kategori Tag Hook">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tagCategoryFilter === 'all'}
                      className={`hts-tag-cat-btn ${tagCategoryFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setTagCategoryFilter('all')}
                    >
                      <HookIcon name="sparkles" size={13} style={{ marginRight: 5 }} />
                      <span className="hts-cat-label">Semua</span>
                      <span className="hts-cat-count">{categoryCounts.all}</span>
                    </button>
                    {HOOK_TAG_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={tagCategoryFilter === cat.id}
                        className={`hts-tag-cat-btn ${tagCategoryFilter === cat.id ? 'active' : ''}`}
                        onClick={() => setTagCategoryFilter(cat.id)}
                      >
                        <HookIcon name={cat.iconName} size={13} style={{ marginRight: 5 }} />
                        <span className="hts-cat-label">{cat.label}</span>
                        <span className="hts-cat-count">{categoryCounts[cat.id] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {/* Research Tag Cards Grid */}
                  <div className="hts-tag-grid-container">
                    <div className="hts-tag-grid" role="radiogroup" aria-label="Pilihan Tag Retensi">
                      {/* Option: Tanpa Tag */}
                      <button
                        type="button"
                        className={`hts-tag-card hts-tag-card-none ${!customHookTag ? 'active' : ''}`}
                        onClick={() => setCustomHookTag('')}
                        title="Tanpa badge: hook langsung mulai dari kalimat pembuka"
                      >
                        <div className="hts-tag-icon-box">
                          <HookIcon name="sparkles" size={14} color="#64748B" />
                        </div>
                        <div className="hts-tag-text-wrap">
                          <span className="hts-tag-name">TANPA BADGE</span>
                          <span className="hts-tag-sub">Mulai langsung kalimat hook</span>
                        </div>
                        {!customHookTag && <span className="hts-tag-check">✓</span>}
                      </button>

                      {displayedTags.map((item) => {
                        const visual = resolveTagVisual(item.tag);
                        const isActive = customHookTag === item.tag;
                        const { iconName, cleanText } = parseHookTag(item.tag);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`hts-tag-card ${isActive ? 'active' : ''}`}
                            style={
                              isActive
                                ? {
                                    borderColor: visual.borderColor,
                                    boxShadow: `0 4px 16px ${visual.glowColor}, inset 0 0 0 1px ${visual.borderColor}`,
                                    background: `linear-gradient(135deg, ${visual.glowColor}, rgba(15, 23, 42, 0.88))`,
                                  }
                                : undefined
                            }
                            onClick={() => setCustomHookTag(item.tag)}
                            title={item.description}
                          >
                            <div
                              className="hts-tag-icon-box"
                              style={
                                isActive
                                  ? {
                                      background: 'rgba(255, 255, 255, 0.15)',
                                      borderColor: visual.borderColor,
                                    }
                                  : undefined
                              }
                            >
                              <HookIcon
                                name={iconName}
                                size={15}
                                color={isActive ? visual.textColor : '#94A3B8'}
                                glow={isActive}
                                glowColor={visual.glowColor}
                              />
                            </div>
                            <div className="hts-tag-text-wrap">
                              <span
                                className="hts-tag-name"
                                style={isActive ? { color: '#FFFFFF' } : undefined}
                              >
                                {cleanText}
                              </span>
                              <span className="hts-tag-sub">{item.description}</span>
                            </div>
                            {isActive && (
                              <span
                                className="hts-tag-check"
                                style={{ color: visual.textColor, borderColor: visual.borderColor }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Tag Input & Live Status Bar */}
                  <div className="hts-tag-input-section">
                    <div className="hts-tag-input-bar">
                      <span className="hts-tag-input-icon">
                        <HookIcon name="key" size={13} color="#94A3B8" />
                      </span>
                      <input
                        type="text"
                        value={customHookTag ?? ''}
                        onChange={(e) => setCustomHookTag(e.target.value)}
                        placeholder="Ketik teks tag kustom (contoh: 🔥 TIPS HARI INI)..."
                        className="hts-tag-input-field"
                      />
                      {customHookTag && (
                        <button
                          type="button"
                          className="hts-tag-input-clear-btn"
                          onClick={() => setCustomHookTag('')}
                          title="Hapus / Kosongkan Tag"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {customHookTag ? (
                      <div className="hts-tag-status-bar">
                        <span className="hts-tag-status-label">Badge Aktif:</span>
                        <div
                          className="hts-tag-status-pill"
                          style={{
                            borderColor: activeTagVisual.borderColor,
                            color: activeTagVisual.textColor,
                            boxShadow: `0 0 10px ${activeTagVisual.glowColor}`,
                          }}
                        >
                          <span
                            className="hts-tag-status-dot"
                            style={{ background: activeTagVisual.borderColor }}
                          />
                          {customHookTag}
                        </div>
                        <span className="hts-tag-status-hint">Muncul detik 0–3 di hook pembuka</span>
                      </div>
                    ) : (
                      <div className="hts-tag-status-bar muted">
                        <span className="hts-tag-status-dot-off" />
                        <span className="hts-tag-status-hint">
                          Mode Tanpa Badge aktif: hook langsung dimulai dengan kalimat utama
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group 6: Desain Badge Pill (Badge Design System — 4 Presets) */}
          <div className="hts-control-group">
            <div className="hts-group-header">
              <div className="hts-group-title-row">
                <span className="hts-group-title">6. Desain Badge Pill (Badge Design System)</span>
                <span className="hts-group-badge">4 Preset Visual</span>
              </div>
              <span className="hts-group-hint">
                Pilih gaya visual badge &amp; variasi warna aksen (ukuran proporsional lebih kecil dari teks hook)
              </span>
            </div>

            <div className="hts-badge-grid" role="radiogroup" aria-label="Badge Pill Presets">
              {BADGE_PRESETS.map((bp) => {
                const isSelected = selectedBadgePreset === bp.id;
                const sampleTag = customHookTag && customHookTag.trim() ? customHookTag : bp.defaultTag;
                const sampleStyle = resolveBadgeStyle(bp.id, isSelected ? selectedBadgeColor : bp.defaultColor, sampleTag);
                const { iconName, cleanText } = parseHookTag(sampleTag);

                return (
                  <div
                    key={bp.id}
                    className={`hts-badge-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (!disabled && onBadgePresetChange) {
                        onBadgePresetChange(bp.id);
                      }
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !disabled && onBadgePresetChange) {
                        e.preventDefault();
                        onBadgePresetChange(bp.id);
                      }
                    }}
                  >
                    <div className="hts-badge-card-header">
                      <div className="hts-badge-title-wrap">
                        <span className="hts-badge-title">{bp.label}</span>
                        <span className="hts-badge-cat-tag">{bp.category}</span>
                      </div>
                      {isSelected && <span className="hts-badge-check">✓ Aktif</span>}
                    </div>

                    {/* Miniature Live Badge Pill Preview */}
                    <div className="hts-badge-preview-box">
                      {bp.id === 'solid-impact' ? (() => {
                        const activeColor = isSelected ? selectedBadgeColor : bp.defaultColor;
                        let bgHex = '#E11D48';
                        if (activeColor === 'yellow') bgHex = '#D97706';
                        else if (activeColor === 'green') bgHex = '#16A34A';
                        else if (activeColor === 'auto') bgHex = sampleStyle.bgColor;

                        const StrokeSide = ({ side }: { side: 'left' | 'right' }) => (
                          <svg
                            width="10"
                            height="12"
                            viewBox="0 0 10 12"
                            style={{
                              flexShrink: 0,
                              transform: side === 'left' ? 'none' : 'scaleX(-1)',
                              marginRight: side === 'left' ? 3 : 0,
                              marginLeft: side === 'right' ? 3 : 0,
                            }}
                          >
                            <path d="M1 2 L8 2" stroke={bgHex} strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M3 6 L9 6" stroke={bgHex} strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M1 10 L7 10" stroke={bgHex} strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        );

                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <StrokeSide side="left" />
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: bgHex,
                              borderRadius: 4,
                              padding: '2.5px 8px',
                              boxShadow: `0 0 0 1px rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.4), 0 0 8px ${bgHex}88`,
                              position: 'relative',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '45%',
                                background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)',
                                pointerEvents: 'none',
                              }} />
                              <HookIcon
                                name={iconName}
                                size={10}
                                color="#FFFFFF"
                                glow
                                glowColor="rgba(255,255,255,0.7)"
                                style={{ position: 'relative', zIndex: 1 }}
                              />
                              <span style={{
                                position: 'relative',
                                zIndex: 1,
                                fontSize: 9.5,
                                fontWeight: 900,
                                letterSpacing: '0.6px',
                                color: '#FFFFFF',
                                textTransform: 'uppercase',
                                lineHeight: 1.1,
                                whiteSpace: 'nowrap',
                              }}>
                                {cleanText}
                              </span>
                            </div>
                            <StrokeSide side="right" />
                          </div>
                        );
                      })() : bp.id === 'price-tag' ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.65)) drop-shadow(0 0 6px ${sampleStyle.bgColor}80)`,
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              backgroundColor: sampleStyle.bgColor,
                              clipPath: 'polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%, 0% 0%)',
                              borderRadius: '3px 0 0 3px',
                              padding: '2.5px 11px 2.5px 14px',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                left: 4,
                                width: 4,
                                height: 4,
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
                              size={9}
                              color={sampleStyle.textColor}
                              style={{ marginRight: 3.5, position: 'relative', zIndex: 1 }}
                            />
                            <span
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                fontSize: 9.5,
                                fontWeight: 900,
                                letterSpacing: sampleStyle.letterSpacing,
                                color: sampleStyle.textColor,
                                textTransform: 'uppercase',
                              }}
                            >
                              {cleanText}
                            </span>
                          </div>
                        </div>
                      ) : bp.id === 'speech-bubble' ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.65)) drop-shadow(0 0 6px ${sampleStyle.bgColor}80)`,
                            marginBottom: 3,
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              backgroundColor: sampleStyle.bgColor,
                              borderRadius: 6,
                              border: '1px solid rgba(255,255,255,0.35)',
                              padding: '2.5px 9px',
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
                                borderTop: `5px solid ${sampleStyle.bgColor}`,
                              }}
                            />
                            <HookIcon
                              name={iconName}
                              size={9}
                              color={sampleStyle.textColor}
                              style={{ marginRight: 3.5, position: 'relative', zIndex: 1 }}
                            />
                            <span
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                fontSize: 9.5,
                                fontWeight: 800,
                                letterSpacing: sampleStyle.letterSpacing,
                                color: sampleStyle.textColor,
                                textTransform: 'uppercase',
                              }}
                            >
                              {cleanText}
                            </span>
                          </div>
                        </div>
                      ) : bp.id === 'burst-stamp' ? (() => {
                        const burstPolygon =
                          'polygon(50% 0%, 56% 12%, 63% 2%, 69% 14%, 77% 4%, 82% 16%, 92% 10%, 90% 24%, 100% 25%, 93% 40%, 100% 50%, 93% 60%, 100% 75%, 90% 76%, 92% 90%, 82% 84%, 77% 96%, 69% 86%, 63% 98%, 56% 88%, 50% 100%, 44% 88%, 37% 98%, 31% 86%, 23% 96%, 18% 84%, 8% 90%, 10% 76%, 0% 75%, 7% 60%, 0% 50%, 7% 40%, 0% 25%, 10% 24%, 8% 10%, 18% 16%, 23% 4%, 31% 14%, 37% 2%, 44% 12%)';
                        return (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              transform: 'rotate(-1.5deg)',
                              filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.75)) drop-shadow(0 0 8px ${sampleStyle.bgColor}80)`,
                            }}
                          >
                            <div
                              style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                backgroundColor: sampleStyle.bgColor,
                                clipPath: burstPolygon,
                                padding: '3.5px 12px',
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
                                size={9}
                                color={sampleStyle.textColor}
                                style={{ marginRight: 3.5, position: 'relative', zIndex: 1 }}
                              />
                              <span
                                style={{
                                  position: 'relative',
                                  zIndex: 1,
                                  fontSize: 9.5,
                                  fontWeight: 900,
                                  letterSpacing: sampleStyle.letterSpacing,
                                  color: sampleStyle.textColor,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {cleanText}
                              </span>
                            </div>
                          </div>
                        );
                      })() : bp.id === 'diagonal-slash' ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${sampleStyle.bgColor}70)`,
                          }}
                        >
                          <div style={{ display: 'inline-flex', gap: 2.5, marginRight: 4, transform: 'skewX(-16deg)' }}>
                            <div style={{ width: 2.5, height: 13, backgroundColor: sampleStyle.bgColor, borderRadius: 1, boxShadow: `0 0 4px ${sampleStyle.bgColor}` }} />
                            <div style={{ width: 1.8, height: 13, backgroundColor: sampleStyle.bgColor, opacity: 0.65, borderRadius: 1, boxShadow: `0 0 2px ${sampleStyle.bgColor}` }} />
                          </div>
                          <div
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              backgroundColor: sampleStyle.bgColor,
                              clipPath: 'polygon(7px 0%, 100% 0%, calc(100% - 7px) 100%, 0% 100%)',
                              padding: '2.5px 10px',
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
                              size={9}
                              color={sampleStyle.textColor}
                              style={{ marginRight: 3.5, position: 'relative', zIndex: 1 }}
                            />
                            <span
                              style={{
                                position: 'relative',
                                zIndex: 1,
                                fontSize: 9.5,
                                fontWeight: 900,
                                fontStyle: 'italic',
                                letterSpacing: sampleStyle.letterSpacing,
                                color: sampleStyle.textColor,
                                textTransform: 'uppercase',
                              }}
                            >
                              {cleanText}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="hts-badge-mini-pill"
                          style={{
                            backgroundColor: sampleStyle.bgColor,
                            borderColor: sampleStyle.borderColor,
                            borderWidth: `${sampleStyle.borderWidth}px`,
                            borderStyle: sampleStyle.borderWidth > 0 ? 'solid' : 'none',
                            borderRadius: sampleStyle.borderRadius > 100 ? 9999 : `${sampleStyle.borderRadius}px`,
                            boxShadow: sampleStyle.boxShadow,
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <HookIcon
                            name={iconName}
                            size={9}
                            color={sampleStyle.textColor}
                            glow={bp.id === 'neon-outline' || bp.id === 'highlight-chip'}
                            glowColor={`${sampleStyle.textColor}80`}
                            style={{ marginRight: 3.5 }}
                          />
                          <span
                            style={{
                              color: sampleStyle.textColor,
                              letterSpacing: sampleStyle.letterSpacing,
                              fontWeight: sampleStyle.fontWeight,
                            }}
                          >
                            {cleanText}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="hts-badge-desc">{bp.description}</p>

                    <div className="hts-badge-bestfor">
                      <span className="hts-badge-bestfor-label">Best for:</span>
                      {bp.bestFor.map((item, idx) => (
                        <span key={idx} className="hts-badge-tag">{item}</span>
                      ))}
                    </div>

                    {/* Color Swatches for this preset */}
                    <div className="hts-badge-colors" onClick={(e) => e.stopPropagation()}>
                      <span className="hts-colors-label">Warna:</span>
                      <button
                        type="button"
                        className={`hts-color-swatch-btn ${isSelected && selectedBadgeColor === 'auto' ? 'active' : ''}`}
                        onClick={() => {
                          if (!disabled) {
                            if (onBadgePresetChange && !isSelected) onBadgePresetChange(bp.id);
                            if (onBadgeColorChange) onBadgeColorChange('auto');
                          }
                        }}
                        title="Auto (Warna semantik sesuai kategori hook)"
                      >
                        <span className="hts-swatch-auto">Auto</span>
                      </button>

                      {bp.colorOptions.map((c) => {
                        const isColorActive = isSelected && selectedBadgeColor === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={`hts-color-swatch-circle ${isColorActive ? 'active' : ''}`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                              if (!disabled) {
                                if (onBadgePresetChange && !isSelected) onBadgePresetChange(bp.id);
                                if (onBadgeColorChange) onBadgeColorChange(c.id as any);
                              }
                            }}
                            title={`${c.label} (${c.hex})`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Live Phone Preview */}
        <div className="hts-preview-col">
          <HookPresetLivePreview
            selectedPreset={value}
            overrideLayout={selectedLayout}
            overrideAnimation={selectedAnimation}
            overrideTypography={selectedTypography}
            selectedBadgePreset={selectedBadgePreset}
            selectedBadgeColor={selectedBadgeColor}
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
