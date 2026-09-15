import React from 'react';
import type { ScriptSection } from '../../../types';

interface ScriptEditorPanelProps {
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
}

export const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({
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
}) => {
  return (
    <div className="script-editor-container" style={{ marginBottom: '26px' }}>
      <div className="script-editor-head">
        <div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
            📝 Draf Naskah &amp; Narator Suara AI
          </span>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            AI akan menyusun naskah pendek berstruktur kuat (Hook, Konteks, Komentar, Kesimpulan/CTA). Anda dapat mengedit teks naskah sebelum render.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn primary small"
            disabled={draftingScript}
            onClick={startDraftScript}
          >
            {draftingScript ? '⏳ Menulis Naskah...' : '✨ Buat Draf Naskah AI'}
          </button>

          <button
            type="button"
            className="btn ghost small"
            disabled={synthesizingTts || !scriptDraft}
            onClick={startSynthesizeTts}
          >
            {synthesizingTts ? '⏳ Memproses Suara...' : '🔊 Tes Suara TTS'}
          </button>
        </div>
      </div>

      {/* Pilihan Bahasa Narasi Output */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice)' }}>
          🌐 Bahasa Narasi Output:
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`chip-toggle ${outputLanguage === 'id' ? 'active' : ''}`}
            onClick={() => {
              setOutputLanguage('id');
              if (!ttsVoice.startsWith('id-')) setTtsVoice('id-ID-ArdiNeural');
            }}
          >
            🇮🇩 Bahasa Indonesia (ID)
          </button>
          <button
            type="button"
            className={`chip-toggle ${outputLanguage === 'en' ? 'active' : ''}`}
            onClick={() => {
              setOutputLanguage('en');
              if (!ttsVoice.startsWith('en-')) setTtsVoice('en-US-GuyNeural');
            }}
          >
            🇺🇸 English (EN)
          </button>
        </div>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Naskah AI &amp; suara narator baru akan dihasilkan dalam bahasa ini
        </span>
      </div>

      {scriptError && (
        <div className="card" style={{ borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5', padding: '10px 14px', marginBottom: '14px', fontSize: '13px' }}>
          {scriptError}
        </div>
      )}

      {/* Audio Preview Player if synthesized */}
      {ttsAudioUrl && (
        <div style={{ background: '#0E151E', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#A3E635' }}>
              ✓ Audio Narasi TTS Siap Di-render
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pratinjau Suara</span>
          </div>
          <audio controls src={ttsAudioUrl} autoPlay style={{ width: '100%', height: '36px' }} />
        </div>
      )}

      {/* Script Sections Editor */}
      {scriptDraft && scriptDraft.sections && scriptDraft.sections.length > 0 ? (
        <div>
          <div className="script-section-list">
            {scriptDraft.sections.map((sec, sIdx) => {
              const tagClass = sec.type === 'hook' ? 'hook' : sec.type === 'conclusion' ? 'conclusion' : '';
              const tagLabel =
                sec.type === 'hook'
                  ? '🔥 Hook 3 Detik'
                  : sec.type === 'conclusion'
                  ? '🎯 Kesimpulan & CTA'
                  : sec.type === 'commentary'
                  ? '🗣️ Komentar / Analisis'
                  : sec.type === 'context'
                  ? '📖 Cerita / Konteks'
                  : sec.type;

              return (
                <div key={sIdx} className="script-section-card">
                  <div className="script-section-header">
                    <span className={`script-section-tag ${tagClass}`}>{tagLabel}</span>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ padding: '2px 6px', fontSize: '11px', color: '#EF4444' }}
                      onClick={() => removeScriptSection(sIdx)}
                      title="Hapus Seksi"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    className="script-section-textarea"
                    value={sec.text}
                    onChange={(e) => updateScriptSection(sIdx, e.target.value)}
                    rows={2}
                    placeholder="Masukkan teks narasi di sini..."
                  />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="btn ghost small"
              onClick={addScriptSection}
            >
              ➕ Tambah Seksi Naskah
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
            Belum ada draf naskah AI. Klik tombol di bawah untuk membuat naskah narasi otomatis dari klip terpilih.
          </p>
          <button
            type="button"
            className="btn primary small"
            disabled={draftingScript}
            onClick={startDraftScript}
          >
            {draftingScript ? '⏳ Sedang Menulis Naskah...' : '✨ Buat Draf Naskah AI Sekarang'}
          </button>
        </div>
      )}

      {/* Voice & Audio Mixing Panel */}
      <div className="tts-controls-panel">
        <div className="form-row">
          <div className="input-group">
            <label className="label-main">Pilihan Suara Narator (TTS Voice)</label>
            <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}>
              {outputLanguage === 'en' ? (
                <>
                  <option value="en-US-GuyNeural">🇺🇸 en-US-GuyNeural (Pria Profesional)</option>
                  <option value="en-US-JennyNeural">🇺🇸 en-US-JennyNeural (Wanita Elegan)</option>
                  <option value="id-ID-ArdiNeural">🇮🇩 id-ID-ArdiNeural (Pria Enerjik)</option>
                  <option value="id-ID-GadisNeural">🇮🇩 id-ID-GadisNeural (Wanita Ramah)</option>
                </>
              ) : (
                <>
                  <option value="id-ID-ArdiNeural">🇮🇩 id-ID-ArdiNeural (Pria Enerjik)</option>
                  <option value="id-ID-GadisNeural">🇮🇩 id-ID-GadisNeural (Wanita Ramah)</option>
                  <option value="en-US-GuyNeural">🇺🇸 en-US-GuyNeural (Pria Profesional)</option>
                  <option value="en-US-JennyNeural">🇺🇸 en-US-JennyNeural (Wanita Elegan)</option>
                </>
              )}
            </select>
          </div>

          <div className="input-group">
            <label className="label-main">Volume Audio Asli di Latar (Ducking): {sourceVolume}%</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mute</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={sourceVolume}
                onChange={(e) => setSourceVolume(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--ice)', fontWeight: 600 }}>{sourceVolume}%</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Suara asli video dikecilkan agar narasi terdengar jelas dan dominan.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
