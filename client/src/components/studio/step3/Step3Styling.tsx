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
  enableBroll: boolean;
  setEnableBroll: (val: boolean) => void;
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
  startTransform: () => void;
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
  enableBroll,
  setEnableBroll,
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
  startTransform,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<Step3SubTab>('mode');

  return (
    <div className={`card ${step !== 3 ? 'hidden' : ''}`}>
      <div className="card-head">
        <div className="card-head-title">
          <h2>3. Desain Subtitle &amp; Mode Konten</h2>
          <span className="head-badge">Gaya &amp; Narasi</span>
        </div>
        <p className="muted">
          Konfigurasikan gaya video dalam 3 langkah terarah: pilih tipe narasi, desain hook pembuka 3 detik, dan tentukan gaya subtitle karaoke.
        </p>
      </div>

      {/* Focused Sub-Stepper Navigation for Step 3 */}
      <div className="step3-substepper" role="tablist" aria-label="Tahapan Desain Video">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'mode'}
          className={`step3-substep-btn ${activeSubTab === 'mode' ? 'active' : 'completed'}`}
          onClick={() => setActiveSubTab('mode')}
        >
          <div className="step3-substep-num">1</div>
          <div className="step3-substep-content">
            <span className="step3-substep-title">1. Tipe &amp; Narasi</span>
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
            <span className="step3-substep-title">2. Hook Intro (0–3s)</span>
            <span className="step3-substep-subtitle">
              {enableHookIntro ? `⚡ ${selectedVisualPreset.toUpperCase()}` : 'Nonaktif'}
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
            <span className="step3-substep-title">3. Subtitle &amp; Render</span>
            <span className="step3-substep-subtitle">
              {templateId === 'beast' || templateId === 'mrbeast' ? '🎨 MrBeast' : templateId === 'hormozi' ? '🎨 Hormozi' : '🎨 Clean'}
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
              Lanjut ke Desain Hook Intro (3.2) →
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
                ⚡ Hook Intro &amp; Judul Kinetik (0–3 Detik)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Teks animasi pembuka penentu retensi 3 detik pertama agar penonton tidak men-scroll lewat.
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
                  {enableHookIntro ? '✓ Intro Hook Aktif' : 'Intro Hook Nonaktif'}
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
              Lanjut ke Subtitle &amp; Render (3.3) →
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
                🎨 Gaya Subtitle Karaoke &amp; Pengaturan Akhir
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Tentukan gaya animasi takarir kata per kata dan opsi visual tambahan sebelum merender video master.
              </p>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Langkah 3 dari 3</span>
          </div>

          {/* Subtitle Template Picker */}
          <SubtitleTemplatePicker
            templateId={templateId}
            setTemplateId={setTemplateId}
          />

          {/* B-roll & Outro CTA toggles */}
          <div className="form-row" style={{ marginTop: '20px' }}>
            <div className="input-group">
              <label className="label-main">Sisipan Footage B-Roll Otomatis</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="check-broll"
                  checked={enableBroll}
                  onChange={(e) => setEnableBroll(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="check-broll" style={{ fontSize: '13px', color: '#ffffff', cursor: 'pointer' }}>
                  Aktifkan sisipan video B-roll otomatis sesuai konteks obrolan
                </label>
              </div>
            </div>

            <div className="input-group">
              <label className="label-main">Kartu Penutup (Outro Call to Action)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  id="check-outro"
                  checked={enableIntroOutro}
                  onChange={(e) => setEnableIntroOutro(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="check-outro" style={{ fontSize: '13px', color: '#ffffff', cursor: 'pointer' }}>
                  Pasang kartu promosi 3 detik di akhir video
                </label>
              </div>
            </div>
          </div>

          {/* B-Roll Visual Inspector Panel */}
          {enableBroll && (
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
          {enableIntroOutro && (
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
              <span style={{ fontSize: '11px', color: '#A3E635', fontWeight: 600 }}>
                ✓ Siap Diproses
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
                <span className="step3-summary-item-label">Hook Pembuka 0–3s</span>
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
                <span className="step3-summary-item-label">Klip Terpilih</span>
                <span className="step3-summary-item-value">
                  📦 {selectedClipIndices.length} Klip Siap Render
                </span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Footage B-Roll</span>
                <span className="step3-summary-item-value">
                  {enableBroll
                    ? `🎞️ ${brollPlacements.filter((p) => p.enabled !== false).length} Klip Aktif`
                    : '⚪ Nonaktif'}
                </span>
              </div>

              <div className="step3-summary-item">
                <span className="step3-summary-item-label">Kartu Outro CTA</span>
                <span className="step3-summary-item-value">
                  {enableIntroOutro
                    ? `🎯 ${resolveClientOutroPreset(outroPreset).name} (${outroDuration}s • @${(outroChannelName || channelName || 'kreator').replace(/^@/, '')}${outroLogoUrl ? ' • 🖼️ Logo' : ''})`
                    : '⚪ Nonaktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Final Render Action Button */}
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setActiveSubTab('hook')}>
              ← Kembali ke Desain Hook
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ padding: '12px 24px', fontSize: '14.5px', fontWeight: 700 }}
              disabled={runningTransform || selectedClipIndices.length === 0}
              onClick={startTransform}
            >
              {runningTransform
                ? '⏳ Sedang Merender Video...'
                : selectedClipIndices.length > 1
                ? `🚀 Render ${selectedClipIndices.length} Klip → ${outputMode === 'narration' ? 'Video Narasi AI' : 'Video Reel'}`
                : '🚀 Render Video Master'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

