import React from 'react';
import { HookTextStylePresets } from '../HookTextStylePresets';
import { resolvePresetLabelFromHook } from '../../../lib/visual-presets';
import type { DownloadedVideo, ScriptSection, ViralClip, ViralHook, VisualPresetSelection } from '../../../types';
import { ScriptEditorPanel } from './ScriptEditorPanel';
import { HookIntroStylingPanel } from './HookIntroStylingPanel';
import { SubtitleTemplatePicker } from './SubtitleTemplatePicker';

interface Step3StylingProps {
  step: number;
  setStep: (step: number) => void;
  outputMode: 'reel' | 'narration';
  setOutputMode: (mode: 'reel' | 'narration') => void;
  // Narration Script & TTS
  scriptDraft: { language?: string; sections: ScriptSection[] } | null;
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
  startDraftScript: () => void;
  startSynthesizeTts: () => void;
  updateScriptSection: (idx: number, text: string) => void;
  addScriptSection: () => void;
  removeScriptSection: (idx: number) => void;
  // Hook Visual Preset & Styling
  enableHookIntro: boolean;
  setEnableHookIntro: (val: boolean) => void;
  selectedVisualPreset: VisualPresetSelection;
  setSelectedVisualPreset: (preset: VisualPresetSelection) => void;
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
  enableIntroOutro: boolean;
  setEnableIntroOutro: (val: boolean) => void;
  startTransform: () => void;
}

export const Step3Styling: React.FC<Step3StylingProps> = ({
  step,
  setStep,
  outputMode,
  setOutputMode,
  scriptDraft,
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
  enableIntroOutro,
  setEnableIntroOutro,
  startTransform,
}) => {
  return (
    <div className={`card ${step !== 3 ? 'hidden' : ''}`}>
      <div className="card-head">
        <div className="card-head-title">
          <h2>3. Desain Subtitle &amp; Mode Konten</h2>
          <span className="head-badge">Gaya &amp; Narasi</span>
        </div>
        <p className="muted">
          Pilih apakah ingin menggunakan klip asli pembicara atau narasi baru bercerita oleh AI, serta pilih animasi subtitle karaoke.
        </p>
      </div>

      {/* Output Mode Selection: Reel vs Narration */}
      <div className="input-group" style={{ marginBottom: '24px' }}>
        <label className="label-main">Pilih Tipe Konten Akhir</label>
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
            <span className="output-mode-badge">✨ Nilai Pembeda</span>
            <div className="output-mode-title">
              <span>🎙️ Mode Narasi Baru AI (Storyteller)</span>
            </div>
            <p className="output-mode-desc">
              AI menulis ulang naskah cerita dramatis, narator TTS membacakannya, dan video klip menjadi latar visual.
            </p>
          </div>
        </div>
      </div>

      {/* When Narration Mode is active: AI Script Draft & TTS Studio */}
      {outputMode === 'narration' && (
        <ScriptEditorPanel
          scriptDraft={scriptDraft}
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

      {/* Hook Visual Style Preset Picker */}
      {enableHookIntro && (
        <HookTextStylePresets
          value={selectedVisualPreset}
          onChange={setSelectedVisualPreset}
          disabled={runningTransform}
          aiRecommendationLabel={
            selectedHookIndex !== null && hooks[selectedHookIndex]
              ? resolvePresetLabelFromHook(
                  hooks[selectedHookIndex]?.hookType,
                  (hooks[selectedHookIndex] as any)?.angle ?? (hooks[selectedHookIndex] as any)?.hookAngle
                )
              : undefined
          }
        />
      )}

      {/* Hook Intro & Headline Styling Panel */}
      <HookIntroStylingPanel
        enableHookIntro={enableHookIntro}
        setEnableHookIntro={setEnableHookIntro}
        selectedHookIndex={selectedHookIndex}
        hooks={hooks}
        selectedClipIndices={selectedClipIndices}
        clips={clips}
        downloadedVideo={downloadedVideo}
        customHookText={customHookText}
        setCustomHookText={setCustomHookText}
        customHookTag={customHookTag}
        setCustomHookTag={setCustomHookTag}
      />

      {/* Subtitle Template Picker */}
      <SubtitleTemplatePicker
        templateId={templateId}
        setTemplateId={setTemplateId}
      />

      {/* B-roll & Outro CTA toggles */}
      <div className="form-row" style={{ marginTop: '22px' }}>
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
              Aktifkan sisipan video B-roll otomatis sesuai topik obrolan
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

      <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn ghost" onClick={() => setStep(2)}>
          ← Kembali ke Pilihan Klip
        </button>
        <button
          type="button"
          className="btn primary"
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
  );
};
