import React, { useState } from 'react';
import { HookTextStylePresets } from '../HookTextStylePresets';
import { resolvePresetLabelFromHook, resolvePresetIdFromHook } from '../../../lib/visual-presets';
import type {
  BrollPlacementItem,
  DownloadedVideo,
  ScriptSection,
  ViralClip,
  ViralHook,
  VisualPresetSelection,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
  OutroPresetId,
  SubtitleSize,
} from '../../../types';
import { ScriptEditorPanel } from './ScriptEditorPanel';
import { SubtitleTemplatePicker } from './SubtitleTemplatePicker';
import { BrollInspectorPanel } from './BrollInspectorPanel';
import { OutroCardStylingPanel } from './OutroCardStylingPanel';
import { resolveClientOutroPreset } from '../../../lib/outro-presets';

export type Step3SubTab = 'mode' | 'hook' | 'subtitles';

interface Step3StylingProps {
  step: number;
  setStep: (step: number) => void;
  outputMode: 'reel' | 'narration';
  setOutputMode: (mode: 'reel' | 'narration') => void;
  // Narration Script & TTS
  scriptDraft: { language?: string; sections: ScriptSection[] } | null;
  isScriptCached?: boolean;
  draftingScript: boolean;
  scriptError: string | null;
  outputLanguage: 'id' | 'en';
  setOutputLanguage: (lang: 'id' | 'en') => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  sourceVolume: number;
  setSourceVolume: (vol: number) => void;
  synthesizingTts: boolean;
  ttsAudioUrl: string | null;
  startDraftScript: (options?: { refresh?: boolean }) => void;
  startSynthesizeTts: () => void;
  updateScriptSection: (idx: number, updates: Partial<ScriptSection> | string) => void;
  addScriptSection: () => void;
  removeScriptSection: (idx: number) => void;
  saveScript?: () => void;
  savingScript?: boolean;
  hasUnsavedScript?: boolean;
  lastSavedScriptAt?: string | null;
  // Hook Visual Preset & Styling
  enableHookIntro: boolean;
  setEnableHookIntro: (val: boolean) => void;
  selectedVisualPreset: VisualPresetSelection;
  setSelectedVisualPreset: (preset: VisualPresetSelection) => void;
  selectedHookLayout: CompositionLayout | 'auto';
  setSelectedHookLayout: (layout: CompositionLayout | 'auto') => void;
  selectedHookAnimation: AnimationPreset | 'auto';
  setSelectedHookAnimation: (anim: AnimationPreset | 'auto') => void;
  selectedHookTypography: TypographyVariant | 'auto';
  setSelectedHookTypography: (typography: TypographyVariant | 'auto') => void;
  selectedHookBadgePreset: BadgePresetId;
  setSelectedHookBadgePreset: (preset: BadgePresetId) => void;
  selectedHookBadgeColor: BadgeColorVariant;
  setSelectedHookBadgeColor: (color: BadgeColorVariant) => void;
  runningTransform: boolean;
  selectedHookIndex: number | null;
  hooks: ViralHook[];
  selectedClipIndices: number[];
  clips: ViralClip[];
  downloadedVideo: DownloadedVideo | null;
  customHookText: string;
  setCustomHookText: (text: string) => void;
  customHookTag: string;
  setCustomHookTag: (tag: string) => void;
  // Subtitle template & Extras
  templateId: string;
  setTemplateId: (id: string) => void;
  subtitleSize?: SubtitleSize;
  setSubtitleSize?: (size: SubtitleSize) => void;
  enableBroll: boolean;
  setEnableBroll: (val: boolean) => void;
  autoReframe: boolean;
  setAutoReframe: (val: boolean) => void;
  brollPlacements: BrollPlacementItem[];
  loadingBroll: boolean;
  brollError: string | null;
  fetchBrollSuggestions: (options?: { force?: boolean }) => void;
  toggleBrollPlacement: (index: number) => void;
  updateBrollPlacement: (index: number, updates: Partial<BrollPlacementItem>) => void;
  removeBrollPlacement: (index: number) => void;
  addBrollPlacement: (placement: BrollPlacementItem) => void;
  enableIntroOutro: boolean;
  setEnableIntroOutro: (val: boolean) => void;
  outroPreset: OutroPresetId;
  setOutroPreset: (preset: OutroPresetId) => void;
  outroCtaText: string;
  setOutroCtaText: (text: string) => void;
  outroButtonText: string;
  setOutroButtonText: (text: string) => void;
  outroDuration: number;
  setOutroDuration: (duration: number) => void;
  outroChannelName: string;
  setOutroChannelName: (name: string) => void;
  outroLogoUrl: string | null;
  setOutroLogoUrl: (url: string | null) => void;
  channelName?: string;
  startTransform?: () => void;
}

export const Step3Styling: React.FC<Step3StylingProps> = ({
  step,
  setStep,
  outputMode,
  setOutputMode,
  scriptDraft,
  isScriptCached,
  draftingScript,
  scriptError,
  outputLanguage,
  setOutputLanguage,
  ttsVoice,
  setTtsVoice,
  sourceVolume,
  setSourceVolume,
  synthesizingTts,
  ttsAudioUrl,
  startDraftScript,
  startSynthesizeTts,
  updateScriptSection,
  addScriptSection,
  removeScriptSection,
  saveScript,
  savingScript,
  hasUnsavedScript,
  lastSavedScriptAt,
  enableHookIntro,
  setEnableHookIntro,
  selectedVisualPreset,
  setSelectedVisualPreset,
  selectedHookLayout,
  setSelectedHookLayout,
  selectedHookAnimation,
  setSelectedHookAnimation,
  selectedHookTypography,
  setSelectedHookTypography,
  selectedHookBadgePreset,
  setSelectedHookBadgePreset,
  selectedHookBadgeColor,
  setSelectedHookBadgeColor,
  runningTransform,
  selectedHookIndex,
  hooks,
  selectedClipIndices,
  clips,
  downloadedVideo,
  customHookText,
  setCustomHookText,
  customHookTag,
  setCustomHookTag,
  templateId,
  setTemplateId,
  subtitleSize,
  setSubtitleSize,
  enableBroll,
  setEnableBroll,
  autoReframe,
  setAutoReframe,
  brollPlacements,
  loadingBroll,
  brollError,
  fetchBrollSuggestions,
  toggleBrollPlacement,
  updateBrollPlacement,
  removeBrollPlacement,
  addBrollPlacement,
  enableIntroOutro,
  setEnableIntroOutro,
  outroPreset,
  setOutroPreset,
  outroCtaText,
  setOutroCtaText,
  outroButtonText,
  setOutroButtonText,
  outroDuration,
  setOutroDuration,
  outroChannelName,
  setOutroChannelName,
  outroLogoUrl,
  setOutroLogoUrl,
  channelName,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<Step3SubTab>('mode');
  const [showBrollSettings, setShowBrollSettings] = useState(false);
  const [showOutroSettings, setShowOutroSettings] = useState(false);
  const canContinue = selectedClipIndices.length > 0 && (outputMode !== 'narration' || Boolean(ttsAudioUrl));

  return (
    <div className={`card ${step !== 3 ? 'hidden' : ''}`}>
      <div className="card-head">
        <div className="card-head-title">
          <h2>3. Produksi Video</h2>
          <span className="head-badge">Format, gaya &amp; visual</span>
        </div>
        <p className="muted">
          Atur format video, tampilan pembuka, subtitle, dan opsi visual sebelum masuk ke editor.
        </p>
      </div>

      {/* Focused Sub-Stepper Navigation for Step 3 */}
      <div className="step3-substepper" role="tablist" aria-label="Pengaturan produksi video">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'mode'}
          className={`step3-substep-btn ${activeSubTab === 'mode' ? 'active' : 'completed'}`}
          onClick={() => setActiveSubTab('mode')}
        >
          <div className="step3-substep-num">1</div>
          <div className="step3-substep-content">
            <span className="step3-substep-title">1. Format &amp; Narasi</span>
            <span className="step3-substep-subtitle">
              {outputMode === 'narration' ? '🎙️ Narasi AI' : '🎬 Klip Asli (Reel)'}
            </span>
          </div>
        </button>

        <div className="step3-substep-divider" />

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'hook'}
          className={`step3-substep-btn ${activeSubTab === 'hook' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('hook')}
        >
          <div className="step3-substep-num">2</div>
          <div className="step3-substep-content">
            <span className="step3-substep-title">2. Teks Pembuka</span>
            <span className="step3-substep-subtitle">
              {enableHookIntro ? `⚡ ${selectedVisualPreset.toUpperCase()}` : 'Pembuka nonaktif'}
            </span>
          </div>
        </button>

        <div className="step3-substep-divider" />

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'subtitles'}
          className={`step3-substep-btn ${activeSubTab === 'subtitles' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('subtitles')}
        >
          <div className="step3-substep-num">3</div>
          <div className="step3-substep-content">
            <span className="step3-substep-title">3. Subtitle &amp; Visual</span>
            <span className="step3-substep-subtitle">
              {templateId === 'beast' || templateId === 'mrbeast' ? 'Subtitle · MrBeast' : templateId === 'hormozi' ? 'Subtitle · Hormozi' : 'Subtitle · Clean'}
            </span>
          </div>
        </button>
      </div>

      {/* Sub-Tab 1: Mode Konten & Naskah Narasi */}
      {activeSubTab === 'mode' && (
        <div>
          <div className="input-group" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="label-main" style={{ margin: 0 }}>Pilih Tipe Konten Akhir</label>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Langkah 1 dari 3</span>
            </div>
            <div className="output-mode-grid">
              <div
                className={`output-mode-card ${outputMode === 'reel' ? 'active' : ''}`}
                onClick={() => setOutputMode('reel')}
              >
                <div className="output-mode-title">
                  <span>🎬 Mode Klip Asli (Reel)</span>
                </div>
                <p className="output-mode-desc">
                  Pertahankan audio asli pembicara dan tambahkan animasi subtitle karaoke dinamis (Gaya OpusClip).
                </p>
              </div>

              <div
                className={`output-mode-card ${outputMode === 'narration' ? 'active' : ''}`}
                onClick={() => setOutputMode('narration')}
              >
                <div className="output-mode-title">
                  <span>🎙️ Mode Narasi Baru AI (Storyteller)</span>
                </div>
                <p className="output-mode-desc">
                  AI menulis ulang naskah cerita dramatis, narator TTS membacakannya, dan video klip menjadi latar visual.
                </p>
              </div>
            </div>
          </div>

          {outputMode === 'reel' ? (
            <div
              style={{
                background: 'rgba(50, 130, 184, 0.08)',
                border: '1px solid rgba(50, 130, 184, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1 }}>🎬</span>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '13.5px', color: 'var(--ice)' }}>
                  Audio Asli Pembicara Dipertahankan
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Dalam mode ini, seluruh suara asli dan ekspresi pembicara akan digunakan tanpa dubbing suara buatan. Anda tidak perlu menyusun naskah suara baru. Klik tombol di bawah untuk melanjutkan ke pengaturan teks pembuka (Hook Intro).
                </p>
              </div>
            </div>
          ) : (
            <ScriptEditorPanel
              scriptDraft={scriptDraft}
              isScriptCached={isScriptCached}
              draftingScript={draftingScript}
              scriptError={scriptError}
              outputLanguage={outputLanguage}
              setOutputLanguage={setOutputLanguage}
              ttsVoice={ttsVoice}
              setTtsVoice={setTtsVoice}
              sourceVolume={sourceVolume}
              setSourceVolume={setSourceVolume}
              synthesizingTts={synthesizingTts}
              ttsAudioUrl={ttsAudioUrl}
              startDraftScript={startDraftScript}
              startSynthesizeTts={startSynthesizeTts}
              updateScriptSection={updateScriptSection}
              addScriptSection={addScriptSection}
              removeScriptSection={removeScriptSection}
              saveScript={saveScript}
              savingScript={savingScript}
              hasUnsavedScript={hasUnsavedScript}
              lastSavedScriptAt={lastSavedScriptAt}
            />
          )}

          {/* Navigation for Sub-Tab 1 */}
          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setStep(2)}>
              ← Kembali ke Pilihan Klip
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => setActiveSubTab('hook')}
            >
              Lanjut ke Teks Pembuka →
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Hook Intro Kinetik (0-3 Detik) */}
      {activeSubTab === 'hook' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#fff' }}>
                ⚡ Teks pembuka (0–3 detik)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Teks animasi yang tampil pada awal video.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={enableHookIntro}
                  onChange={(e) => setEnableHookIntro(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ color: enableHookIntro ? 'var(--ice)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {enableHookIntro ? '✓ Teks pembuka aktif' : 'Teks pembuka nonaktif'}
                </span>
              </label>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Langkah 2 dari 3</span>
            </div>
          </div>

          {/* Hook Visual Style Preset Picker & Studio Workspace */}
          {enableHookIntro ? (() => {
            const fallbackThumb =
              (selectedClipIndices.length > 0 && clips[selectedClipIndices[0]]?.thumbnailUrl) ||
              downloadedVideo?.thumbnailUrl ||
              (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');

            const hookThumb =
              (selectedHookIndex !== null && hooks[selectedHookIndex]?.thumbnailUrl) ||
              (selectedHookIndex !== null && hooks[selectedHookIndex]?.previewUrl ? hooks[selectedHookIndex].previewUrl!.replace(/\.mp4(\?.*)?$/, '.jpg$1') : '') ||
              fallbackThumb;

            const hookObj = selectedHookIndex !== null ? hooks[selectedHookIndex] : undefined;
            const aiLabel = hookObj ? resolvePresetLabelFromHook(hookObj.hookType, (hookObj as any)?.angle ?? (hookObj as any)?.hookAngle) : undefined;
            const aiRecId = hookObj ? resolvePresetIdFromHook(hookObj.hookType, (hookObj as any)?.angle ?? (hookObj as any)?.hookAngle) : 'kinetic-punch';

            return (
              <div style={{ marginBottom: '20px' }}>
                <HookTextStylePresets
                  value={selectedVisualPreset}
                  onChange={setSelectedVisualPreset}
                  selectedLayout={selectedHookLayout}
                  onLayoutChange={setSelectedHookLayout}
                  selectedAnimation={selectedHookAnimation}
                  onAnimationChange={setSelectedHookAnimation}
                  selectedTypography={selectedHookTypography}
                  onTypographyChange={setSelectedHookTypography}
                  selectedBadgePreset={selectedHookBadgePreset}
                  onBadgePresetChange={setSelectedHookBadgePreset}
                  selectedBadgeColor={selectedHookBadgeColor}
                  onBadgeColorChange={setSelectedHookBadgeColor}
                  disabled={runningTransform}
                  aiRecommendationLabel={aiLabel}
                  aiRecommendationId={aiRecId}
                  customHookText={customHookText}
                  setCustomHookText={setCustomHookText}
                  customHookTag={customHookTag}
                  setCustomHookTag={setCustomHookTag}
                  highlightWords={hookObj?.highlightWords}
                  thumbnailUrl={hookThumb}
                  selectedHookIndex={selectedHookIndex}
                  hooks={hooks}
                />
              </div>
            );
          })() : (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Intro hook kinetik dinonaktifkan. Video akan langsung dimulai dari dialog klip pertama tanpa judul pembuka.
            </div>
          )}

          {/* Navigation for Sub-Tab 2 */}
          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setActiveSubTab('mode')}>
              ← Kembali ke Tipe &amp; Narasi
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => setActiveSubTab('subtitles')}
            >
              Lanjut ke Subtitle &amp; Visual →
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Subtitle Karaoke & Render Video */}
      {activeSubTab === 'subtitles' && (
        <div>
          <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: '#fff' }}>
                🎨 Subtitle &amp; opsi visual
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Pilih tampilan subtitle. Opsi kamera, B-roll, dan kartu penutup bisa diatur jika diperlukan.
              </p>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Langkah 3 dari 3</span>
          </div>

          {/* Subtitle Template Picker */}
          <SubtitleTemplatePicker
            templateId={templateId}
            setTemplateId={setTemplateId}
            subtitleSize={subtitleSize}
            setSubtitleSize={setSubtitleSize}
          />

          {/* B-roll & Outro CTA toggles */}
          <section className="step3-visual-options" aria-labelledby="step3-visual-options-title">
            <div className="step3-visual-options-heading">
              <div>
                <h4 id="step3-visual-options-title">Opsi visual tambahan</h4>
                <p>Atur framing dan sisipan visual yang akan muncul pada hasil video.</p>
              </div>
              <span>OPSIONAL</span>
            </div>
            <div className="step3-visual-options-grid">
            <div className="input-group">
              <div className="step3-option-card">
                <label className="label-main" htmlFor="check-auto-reframe">Framing wajah otomatis</label>
                <p className="step3-option-description">Jaga pembicara tetap berada di area fokus.</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="check-auto-reframe"
                  checked={autoReframe}
                  onChange={(e) => setAutoReframe(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '1px' }}
                />
                <label htmlFor="check-auto-reframe" style={{ fontSize: '13px', color: '#ffffff', cursor: 'pointer' }}>
                  Ikuti wajah dengan pan dan zoom halus
                  <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Jika wajah tidak terdeteksi, video memakai framing tengah.
                  </span>
                </label>
                </div>
              </div>
            </div>
            <div className="input-group">
              <div className="step3-option-card">
                <label className="label-main" htmlFor="check-broll">B-roll otomatis</label>
                <p className="step3-option-description">Sisipkan footage pendukung sesuai konteks percakapan.</p>
                <label className="step3-option-toggle"><input type="checkbox" id="check-broll" checked={enableBroll} onChange={(e) => setEnableBroll(e.target.checked)} /> Aktifkan B-roll</label>
                {enableBroll && <button type="button" className="btn ghost step3-option-expand" aria-expanded={showBrollSettings} onClick={() => setShowBrollSettings((open) => !open)}>{showBrollSettings ? 'Tutup pengaturan' : `Atur footage (${brollPlacements.filter((p) => p.enabled !== false).length} aktif)`}</button>}
              </div>
            </div>

            <div className="input-group">
              <div className="step3-option-card">
                <label className="label-main" htmlFor="check-outro">Kartu penutup</label>
                <p className="step3-option-description">Tambahkan ajakan mengikuti channel di akhir video.</p>
                <label className="step3-option-toggle"><input type="checkbox" id="check-outro" checked={enableIntroOutro} onChange={(e) => setEnableIntroOutro(e.target.checked)} /> Tambahkan kartu penutup</label>
                {enableIntroOutro && <button type="button" className="btn ghost step3-option-expand" aria-expanded={showOutroSettings} onClick={() => setShowOutroSettings((open) => !open)}>{showOutroSettings ? 'Tutup pengaturan' : 'Atur tampilan kartu'}</button>}
              </div>
            </div>
            </div>
          </section>

          {/* B-Roll Visual Inspector Panel */}
          {enableBroll && showBrollSettings && (
            <BrollInspectorPanel
              brollPlacements={brollPlacements}
              loadingBroll={loadingBroll}
              brollError={brollError}
              onRefreshSuggestions={() => fetchBrollSuggestions({ force: true })}
              onTogglePlacement={toggleBrollPlacement}
              onUpdatePlacement={updateBrollPlacement}
              onRemovePlacement={removeBrollPlacement}
              onAddPlacement={addBrollPlacement}
            />
          )}

          {/* Outro CTA Preset & Styling Panel */}
          {enableIntroOutro && showOutroSettings && (
            <OutroCardStylingPanel
              selectedPreset={outroPreset}
              onPresetChange={setOutroPreset}
              ctaText={outroCtaText}
              onCtaTextChange={setOutroCtaText}
              buttonText={outroButtonText}
              onButtonTextChange={setOutroButtonText}
              duration={outroDuration}
              onDurationChange={setOutroDuration}
              channelName={outroChannelName || channelName}
              onChannelNameChange={setOutroChannelName}
              logoUrl={outroLogoUrl}
              onLogoUrlChange={setOutroLogoUrl}
            />
          )}

          {/* Ringkasan Konfigurasi Render */}
          <div className="step3-summary-card">
            <div className="step3-summary-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>📋</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice)' }}>
                  Ringkasan Konfigurasi Render Video
                </span>
              </div>
              <span className={`step3-readiness ${canContinue ? 'ready' : 'needs-attention'}`}>
                {canContinue ? '✓ Siap ke editor' : outputMode === 'narration' && selectedClipIndices.length > 0 ? 'Perlu audio narasi' : 'Pilih minimal 1 klip'}
              </span>
            </div>

            <div className="step3-summary-grid">
              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Tipe Konten</span>
                <span className="step3-summary-item-value">
                  {outputMode === 'narration' ? '🎙️ Narasi AI Storyteller' : '🎬 Klip Asli (Reel)'}
                </span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Teks pembuka 0–3s</span>
                <span className="step3-summary-item-value">
                  {enableHookIntro ? `⚡ ${selectedVisualPreset.toUpperCase()}` : '⚪ Nonaktif'}
                </span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Template Subtitle</span>
                <span className="step3-summary-item-value">
                  {templateId === 'beast' || templateId === 'mrbeast' ? '🎨 Gaya MrBeast' : templateId === 'hormozi' ? '🎨 Gaya Hormozi' : '🎨 Gaya Clean'}
                </span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Klip &amp; visual</span>
                <span className="step3-summary-item-value">📦 {selectedClipIndices.length} klip · {autoReframe ? 'Framing wajah' : 'Framing standar'} · {enableBroll ? `${brollPlacements.filter((p) => p.enabled !== false).length} B-roll` : 'Tanpa B-roll'}</span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Penutup</span>
                <span className="step3-summary-item-value">{enableIntroOutro ? `🎯 ${resolveClientOutroPreset(outroPreset).name} · ${outroDuration} dtk` : 'Tanpa kartu penutup'}</span>
              </div>
            </div>
          </div>

          {/* Final Navigation Action Button to Step 4 */}
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setActiveSubTab('hook')}>
              ← Kembali ke Teks Pembuka
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ padding: '12px 24px', fontSize: '14.5px', fontWeight: 700 }}
              disabled={!canContinue}
              onClick={() => setStep(4)}
            >
              {!canContinue && outputMode === 'narration' && selectedClipIndices.length > 0
                ? 'Buat audio narasi untuk melanjutkan'
                : selectedClipIndices.length === 0
                  ? 'Pilih klip untuk melanjutkan'
                  : selectedClipIndices.length > 1
                    ? `Lanjut ke Tahap 4 (${selectedClipIndices.length} Klip) →`
                    : 'Lanjut ke Tahap 4 (Editor Video) →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
