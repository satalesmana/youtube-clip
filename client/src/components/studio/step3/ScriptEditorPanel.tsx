import React, { useState, useRef } from 'react';
import type { ScriptSection } from '../../../types';
import { api } from '../../../services/api';

interface ScriptEditorPanelProps {
  scriptDraft: { language?: string; sections: ScriptSection[] } | null;
  isScriptCached?: boolean;
  draftingScript: boolean;
  scriptError: string | null;
  outputLanguage: 'id' | 'en';
  setOutputLanguage: (lang: 'id' | 'en') => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  sourceVolume?: number;
  setSourceVolume?: (vol: number) => void;
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
}

export const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({
  scriptDraft,
  isScriptCached,
  draftingScript,
  scriptError,
  outputLanguage,
  setOutputLanguage,
  ttsVoice,
  setTtsVoice,
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
}) => {
  const [testingSectionIdx, setTestingSectionIdx] = useState<number | null>(null);
  const [playingSectionIdx, setPlayingSectionIdx] = useState<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleTestSectionAudio = async (idx: number, sec: ScriptSection) => {
    if (playingSectionIdx === idx) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingSectionIdx(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setTestingSectionIdx(idx);
    try {
      const res = await api.synthesizeSectionTts({
        text: sec.text,
        spokenText: sec.spokenText,
        type: sec.type,
        language: outputLanguage,
        ttsVoice,
      });

      if (res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        currentAudioRef.current = audio;
        setPlayingSectionIdx(idx);
        audio.onended = () => {
          setPlayingSectionIdx((curr) => (curr === idx ? null : curr));
        };
        audio.onerror = () => {
          setPlayingSectionIdx(null);
        };
        await audio.play();
      }
    } catch (err) {
      console.error('Gagal memutar audio seksi:', err);
    } finally {
      setTestingSectionIdx(null);
    }
  };
  return (
    <div className="script-editor-container" style={{ marginBottom: '26px' }}>
      <div className="script-editor-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              📝 Draf Naskah &amp; Narator Suara AI
            </span>
            {scriptDraft && isScriptCached && !hasUnsavedScript && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Draf naskah ini dimuat langsung dari cache disk lokal tanpa memanggil ulang LLM."
              >
                💾 Dimuat dari cache disk
              </span>
            )}
            {scriptDraft && !isScriptCached && !hasUnsavedScript && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#4ADE80',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Draf naskah baru yang baru saja di-generate oleh AI dan tersimpan ke disk."
              >
                ✨ Naskah AI Baru
              </span>
            )}
            {scriptDraft && hasUnsavedScript && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(234, 179, 8, 0.12)',
                  color: '#FACC15',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Ada perubahan pada naskah yang belum tersimpan ke disk"
              >
                ✏️ Ada editan belum disimpan
              </span>
            )}
            {scriptDraft && !hasUnsavedScript && lastSavedScriptAt && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.45)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                • Tersimpan {lastSavedScriptAt}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            AI akan menyusun naskah pendek berstruktur kuat (Hook, Konteks, Komentar, Kesimpulan/CTA). Anda dapat mengedit teks naskah sebelum render.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {scriptDraft && scriptDraft.sections?.length > 0 && saveScript && (
            <button
              type="button"
              className={`btn small ${hasUnsavedScript ? 'primary' : 'ghost'}`}
              disabled={savingScript}
              onClick={() => saveScript()}
              title="Simpan draf teks naskah dan pelafalan TTS ke disk cache lokal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: hasUnsavedScript ? 'var(--primary)' : 'rgba(255, 255, 255, 0.15)',
                background: hasUnsavedScript
                  ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                  : 'rgba(255, 255, 255, 0.04)',
                color: '#ffffff',
                fontWeight: hasUnsavedScript ? 600 : 500,
                boxShadow: hasUnsavedScript ? '0 0 12px rgba(14, 165, 233, 0.4)' : undefined,
                transition: 'all 0.2s ease',
              }}
            >
              {savingScript ? '⏳ Menyimpan...' : hasUnsavedScript ? '💾 Simpan Perubahan' : '✓ Draf Tersimpan'}
            </button>
          )}

          {scriptDraft && scriptDraft.sections?.length > 0 ? (
            <button
              type="button"
              className="btn ghost small"
              disabled={draftingScript}
              onClick={() => startDraftScript({ refresh: true })}
              title="Generate ulang naskah baru dari AI dan bypass disk cache"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              {draftingScript ? '⏳ Menulis Ulang...' : '🔄 Generate Ulang Naskah'}
            </button>
          ) : (
            <button
              type="button"
              className="btn primary small"
              disabled={draftingScript}
              onClick={() => startDraftScript()}
            >
              {draftingScript ? '⏳ Menulis Naskah...' : '✨ Buat Draf Naskah AI'}
            </button>
          )}

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
            onClick={() => setOutputLanguage('id')}
          >
            🇮🇩 Bahasa Indonesia (ID)
          </button>
          <button
            type="button"
            className={`chip-toggle ${outputLanguage === 'en' ? 'active' : ''}`}
            onClick={() => setOutputLanguage('en')}
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
          {/* Guide Banner */}
          <div className="script-guide-banner">
            <span className="script-guide-icon">💡</span>
            <div className="script-guide-text">
              <strong>Panduan Dual Editor:</strong> Kolom kiri (<strong>Teks Subtitle</strong>) adalah teks visual yang tampil di video. Kolom kanan (<strong>Pelafalan Suara TTS</strong>) adalah teks yang diucapkan narator AI — sesuaikan ejaan kata asing, singkatan (misal: "KTM" → "K T M"), atau angka agar pelafalan suara terdengar natural.
            </div>
          </div>

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

              const wordCount = (sec.text || '').trim().split(/\s+/).filter(Boolean).length;

              return (
                <div key={sIdx} className="script-section-card">
                  <div className="script-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`script-section-tag ${tagClass}`}>{tagLabel}</span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ice)' }}>Seksi #{sIdx + 1}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>•</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{wordCount} kata</span>

                      <button
                        type="button"
                        className="btn ghost small"
                        disabled={testingSectionIdx === sIdx || synthesizingTts}
                        onClick={() => handleTestSectionAudio(sIdx, sec)}
                        title="Tes suara TTS khusus untuk seksi ini (otomatis disimpan ke cache lokal)"
                        style={{
                          fontSize: '11px',
                          padding: '1px 8px',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderColor: playingSectionIdx === sIdx ? '#A3E635' : 'rgba(255, 255, 255, 0.15)',
                          color: playingSectionIdx === sIdx ? '#A3E635' : undefined,
                        }}
                      >
                        {testingSectionIdx === sIdx
                          ? '⏳ Memproses...'
                          : playingSectionIdx === sIdx
                            ? '⏸ Stop'
                            : '🔊 Tes Seksi'}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-delete-section"
                      onClick={() => removeScriptSection(sIdx)}
                      title="Hapus seksi ini"
                    >
                      ✕ Hapus
                    </button>
                  </div>

                  {/* Dual Grid: Subtitle on Left, TTS Pronunciation on Right */}
                  <div className="script-dual-grid">
                    {/* Kolom 1: Subtitle Visual */}
                    <div className="script-input-col">
                      <div className="script-col-header">
                        <label className="script-col-label subtitle">
                          <span>📝 Teks Subtitle</span>
                        </label>
                        <span className="script-col-badge">Visual Layar</span>
                      </div>
                      <textarea
                        className="script-textarea subtitle"
                        value={sec.text}
                        onChange={(e) => updateScriptSection(sIdx, { text: e.target.value })}
                        rows={2}
                        placeholder="Teks subtitle yang muncul di video..."
                      />
                      <div className="script-col-footer">
                        <span>{sec.text.length} karakter</span>
                      </div>
                    </div>

                    {/* Kolom 2: TTS Pronunciation */}
                    <div className="script-input-col">
                      <div className="script-col-header">
                        <label className="script-col-label tts">
                          <span>🔊 Pelafalan Suara (TTS)</span>
                        </label>
                        <span className="script-col-badge">Audio Narasi</span>
                      </div>
                      <textarea
                        className="script-textarea tts"
                        value={sec.spokenText ?? ''}
                        onChange={(e) => updateScriptSection(sIdx, { spokenText: e.target.value })}
                        rows={2}
                        placeholder="Ejaan khusus TTS (kosongkan bila sama)..."
                      />
                      <div className="script-col-footer">
                        <span style={{ color: '#94A3B8' }}>{sec.spokenText ? `${sec.spokenText.length} karakter` : 'Sama dengan subtitle'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-add-section-dash"
            onClick={addScriptSection}
          >
            <span>➕ Tambah Seksi Naskah Baru</span>
          </button>
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
            onClick={() => startDraftScript()}
          >
            {draftingScript ? '⏳ Sedang Menulis Naskah...' : '✨ Buat Draf Naskah AI Sekarang'}
          </button>
        </div>
      )}

      {/* Voice Configuration Panel */}
      <div className="tts-controls-panel">
        <div className="form-row">
          <div className="input-group">
            <label className="label-main">Pilihan Suara Narator (TTS Voice)</label>
            <input
              type="text"
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              placeholder="Kosongkan untuk default server (atau isi mis. id-ID-ArdiNeural, nova...)"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              💡 Pengaturan volume audio asli (ducking), narasi, dan musik diatur langsung di Step 4 (Live Preview Editor).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
