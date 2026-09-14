import React, { useState, useRef } from 'react';
import type { useClipTransform } from '../../hooks/useClipTransform';
import type { ViralClip, ViralHook } from '../../types';

type ClipTransformHook = ReturnType<typeof useClipTransform>;

interface StudioViewProps {
  transform: ClipTransformHook;
  onOpenCaptionModal: (videoId: string, title: string) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  transform,
  onOpenCaptionModal,
}) => {
  const {
    step,
    setStep,
    url,
    setUrl,
    downloadedVideo,
    downloadingVideo,
    downloadError,
    startDownloadVideo,
    resetDownload,
    detectedLanguage,
    detectingLanguage,
    outputLanguage,
    setOutputLanguage,
    genre,
    setGenre,
    outputMode,
    setOutputMode,
    aspectRatio,
    setAspectRatio,
    enableBroll,
    setEnableBroll,
    enableIntroOutro,
    setEnableIntroOutro,
    templateId,
    setTemplateId,
    customPrompt,
    setCustomPrompt,
    // Script & TTS
    scriptDraft,
    draftingScript,
    scriptError,
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
    // Clips & Hooks
    clips,
    selectedClipIndex,
    selectClip,
    generatingClips,
    rerenderingClipPreviews,
    clipsError,
    hooks,
    selectedHookIndex,
    selectHook,
    customHookText,
    setCustomHookText,
    customHookTag,
    setCustomHookTag,
    enableHookIntro,
    setEnableHookIntro,
    generatingHooks,
    startGenerateClips,
    refreshClips,
    rerenderClipPreviews,
    startGenerateHooks,
    runningTransform,
    progressPct,
    progressLabel,
    transformResult,
    transformError,
    startTransform,
    // multi-select
    selectedClipIndices,
    selectAllClips,
    clearSelectedClips,
  } = transform;


  const [playingClipIndex, setPlayingClipIndex] = useState<number | null>(null);
  const [playingHookIndex, setPlayingHookIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewModalClip, setPreviewModalClip] = useState<{ clip: ViralClip; idx: number } | null>(null);
  const [previewModalHook, setPreviewModalHook] = useState<{ hook: ViralHook; idx: number } | null>(null);
  const [inlineProgress, setInlineProgress] = useState<{ [idx: number]: number }>({});
  const [inlineHookProgress, setInlineHookProgress] = useState<{ [idx: number]: number }>({});
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeHookVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleTogglePlay = (idx: number) => {
    if (playingClipIndex === idx) {
      if (activeVideoRef.current) {
        activeVideoRef.current.pause();
      }
      setPlayingClipIndex(null);
    } else {
      if (activeHookVideoRef.current) {
        activeHookVideoRef.current.pause();
      }
      setPlayingHookIndex(null);
      setPlayingClipIndex(idx);
    }
  };

  const handleTogglePlayHook = (idx: number) => {
    if (playingHookIndex === idx) {
      if (activeHookVideoRef.current) {
        activeHookVideoRef.current.pause();
      }
      setPlayingHookIndex(null);
    } else {
      if (activeVideoRef.current) {
        activeVideoRef.current.pause();
      }
      setPlayingClipIndex(null);
      setPlayingHookIndex(idx);
    }
  };

  const formatTimecode = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const scrollToHookSection = () => {
    document.getElementById('hook-generator-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTriggerHookCta = (refresh = false) => {
    if (selectedClipIndex === null) return;
    if (hooks.length > 0 && !refresh) {
      scrollToHookSection();
      return;
    }
    startGenerateHooks({ refresh });
    setTimeout(() => {
      scrollToHookSection();
    }, 120);
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 24px 60px' }}>
      {/* 4-Step Sequencer Stepper */}
      <div className="wizard-stepper">
        <div
          className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
          onClick={() => setStep(1)}
        >
          <span className="wizard-step-num">1</span>
          <div className="wizard-step-info">
            <span className="wizard-step-title">Pilih Video</span>
            <span className="wizard-step-desc">URL &amp; Parameter</span>
          </div>
        </div>

        <div
          className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
          onClick={() => setStep(2)}
        >
          <span className="wizard-step-num">2</span>
          <div className="wizard-step-info">
            <span className="wizard-step-title">Klip Rekomendasi AI</span>
            <span className="wizard-step-desc">
              {clips.length > 0
                ? selectedClipIndices.length > 0
                  ? `${selectedClipIndices.length}/${clips.length} Dipilih`
                  : `${clips.length} Klip Siap`
                : 'Analisis Skor'}
            </span>
          </div>
        </div>

        <div
          className={`wizard-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}
          onClick={() => setStep(3)}
        >
          <span className="wizard-step-num">3</span>
          <div className="wizard-step-info">
            <span className="wizard-step-title">Gaya &amp; Subtitle</span>
            <span className="wizard-step-desc">Template &amp; B-Roll</span>
          </div>
        </div>

        <div
          className={`wizard-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}
          onClick={() => setStep(4)}
        >
          <span className="wizard-step-num">4</span>
          <div className="wizard-step-info">
            <span className="wizard-step-title">Hasil &amp; Unduh</span>
            <span className="wizard-step-desc">Video 1080x1920</span>
          </div>
        </div>
      </div>

      {/* Progress Telemetry */}
      {(generatingClips || runningTransform) && (
        <div className="progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPct || 45}%`, transition: 'width 0.3s ease' }}
            ></div>
          </div>
          <div className="progress-status-row">
            <span>Sedang Memproses: {progressLabel || 'Menganalisis audio dan framing video...'}</span>
            <span>{Math.round(progressPct || 45)}%</span>
          </div>
        </div>
      )}

      {/* STEP 1: Ingest & Konfigurasi */}
      <div className={`card ${step !== 1 ? 'hidden' : ''}`}>
        <div className="card-head">
          <div className="card-head-title">
            <h2>1. Masukkan Video &amp; Parameter Pengaturan</h2>
            <span className="head-badge">
              {downloadedVideo ? '✓ Video Terunduh' : 'Tahap 1: Unduh Video'}
            </span>
          </div>
          <p className="muted">
            Unduh video sumber terlebih dahulu ke workspace lokal, kemudian tentukan parameter pemotongan klip di bawahnya.
          </p>
        </div>

        {/* Tahap 1A: Input URL & Unduh Video */}
        <div style={{ marginBottom: '24px' }}>
          <label className="label-main">Tautan Video Sumber (YouTube atau URL Publik)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (downloadedVideo) resetDownload();
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={downloadingVideo || !!downloadedVideo}
              style={{ flex: 1 }}
            />
            {!downloadedVideo ? (
              <button
                type="button"
                className="btn primary"
                disabled={downloadingVideo || !url.trim()}
                onClick={() => startDownloadVideo()}
                style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}
              >
                {downloadingVideo ? '⏳ Mengunduh Video...' : '⚡ Unduh & Siapkan Video'}
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost"
                onClick={() => resetDownload()}
                style={{ whiteSpace: 'nowrap', padding: '12px 18px' }}
              >
                🔄 Ganti Video
              </button>
            )}
          </div>

          {downloadError && (
            <div className="card" style={{ marginTop: '14px', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5', padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>⚠️ {downloadError}</p>
            </div>
          )}

          {downloadingVideo && (
            <div style={{ marginTop: '14px', background: '#080C14', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="spinner" style={{ width: '22px', height: '22px' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>Sedang Mengunduh Video Sumber…</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proses yt-dlp sedang mengambil video dan audio resolusi terbaik. Mohon tunggu sejenak.</div>
              </div>
            </div>
          )}

          {downloadedVideo && (
            <div className="downloaded-video-card">
              {downloadedVideo.thumbnailUrl && (
                <img
                  src={downloadedVideo.thumbnailUrl}
                  alt=""
                  style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                  loading="lazy"
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#10B981', color: '#ffffff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    ✓ Video Siap di Workspace
                  </span>
                  {downloadedVideo.durationSeconds > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Durasi: {Math.floor(downloadedVideo.durationSeconds / 60)}:{String(Math.floor(downloadedVideo.durationSeconds % 60)).padStart(2, '0')}
                    </span>
                  )}
                  {detectingLanguage ? (
                    <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} /> Deteksi Bahasa...
                    </span>
                  ) : detectedLanguage ? (
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6EE7B7', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      🌐 Bahasa Sumber: {detectedLanguage === 'id' ? '🇮🇩 Indonesia' : detectedLanguage === 'en' ? '🇺🇸 English' : detectedLanguage.toUpperCase()}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {downloadedVideo.title}
                </div>
              </div>
            </div>
          )}

          {detectingLanguage && (
            <div style={{ marginTop: '14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" style={{ width: '18px', height: '18px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#93C5FD' }}>Mendeteksi Bahasa Transkrip Sumber…</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Menganalisis audio video dan menyiapkan transkrip. Mohon tunggu proses ini selesai sebelum menganalisis video.</div>
              </div>
            </div>
          )}
        </div>

        {/* Tahap 1B: Parameter Pengaturan Studio (Hanya aktif jika video terunduh) */}
        {!downloadedVideo ? (
          <div className="config-locked-container">
            <span style={{ fontSize: '24px' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px', marginBottom: '2px' }}>
                Konfigurasi Studio Terkunci
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Video harus terunduh terlebih dahulu sebelum parameter rasio, durasi, audio, dan analisis dapat diatur. Masukkan URL YouTube di atas lalu klik <strong>"⚡ Unduh &amp; Siapkan Video"</strong>.
              </div>
            </div>
          </div>
        ) : (
          <div className="config-unlocked-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px' }}>⚙️</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ice)' }}>
                Konfigurasi Studio &amp; Pemotongan Klip
              </span>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label className="label-main">Genre Konten (Panduan AI)</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="auto">🌐 Auto / General (Semua Genre)</option>
                  <option value="podcast">🎙️ Podcast / Interview</option>
                  <option value="sports">⚽ Olahraga / Sports</option>
                  <option value="match-highlight">🏆 Match Highlight (Pertandingan)</option>
                  <option value="gaming">🎮 Gaming / Esports</option>
                  <option value="tutorial">💡 Tutorial / Edukasi</option>
                  <option value="commentary">🗣️ Komentari / Opini</option>
                  <option value="entertainment">🎭 Entertainment / Hiburan</option>
                </select>
              </div>

              <div className="input-group">
                <label className="label-main">Rasio Frame Target</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')}
                >
                  <option value="9:16">9:16 Vertikal (Shorts, Reels, TikTok)</option>
                  <option value="16:9">16:9 Lanskap (Standar YouTube)</option>
                  <option value="1:1">1:1 Persegi (Instagram Feed)</option>
                </select>
              </div>
            </div>


            {/* Pengaturan Lanjutan */}
            <div style={{ marginTop: '22px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice)', marginBottom: '14px' }}>
                ⚙️ Pengaturan Lanjutan (Fokus Prompt Khusus)
              </div>
              <div className="input-group">
                <label className="label-main">Fokus Momen Tertentu (Opsional)</label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Contoh: Fokus pada punchline humor, argumen utama, tips praktis..."
                />
              </div>
            </div>

            {clipsError && (
              <div className="card" style={{ marginTop: '16px', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5' }}>
                <p>Terjadi kendala saat menganalisis: {clipsError}</p>
              </div>
            )}

            <div style={{ marginTop: '28px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn primary ${clips.length > 0 ? '' : 'full'}`}
                style={{ flex: clips.length > 0 ? 1 : undefined }}
                disabled={generatingClips || detectingLanguage}
                onClick={() => startGenerateClips()}
              >
                {generatingClips
                  ? '⏳ Sedang Menganalisis Potensi Viral...'
                  : detectingLanguage
                  ? '⏳ Menunggu Deteksi Bahasa & Transkrip Selesai...'
                  : '✨ Analisis Video & Temukan Klip Viral'}
              </button>
              {clips.length > 0 && (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={generatingClips || detectingLanguage}
                  title="Analisis ulang dan render preview baru dari awal (bypass cache)"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setPlayingClipIndex(null);
                    setInlineProgress({});
                    startGenerateClips(undefined, { refresh: true });
                  }}
                >
                  🔄 Analisis Ulang (Bypass Cache)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: Retention Matrix & Scoring */}
      <div className={`card ${step !== 2 ? 'hidden' : ''}`}>
      <div className="card-head">
          <div className="card-head-title">
            <h2>2. Rekomendasi Klip Viral &amp; Analisis Skor</h2>
            <span className="head-badge">
              {selectedClipIndices.length > 0
                ? `${selectedClipIndices.length}/${clips.length} Dipilih`
                : `${clips.length} Klip Tersedia`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            <p className="muted" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
              Pilih satu atau beberapa klip terbaik (bisa multi-select). Urutan klik menentukan urutan klip di video akhir.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                id="btn-rerender-previews"
                className="btn ghost"
                disabled={generatingClips || rerenderingClipPreviews}
                title="Render ulang file preview video 9:16 dari awal tanpa memanggil ulang LLM"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  padding: '7px 14px',
                }}
                onClick={() => {
                  setPlayingClipIndex(null);
                  setInlineProgress({});
                  rerenderClipPreviews();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: rerenderingClipPreviews ? 'spin 1s linear infinite' : 'none',
                  }}
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {rerenderingClipPreviews ? 'Merender Preview…' : 'Render Ulang Preview'}
              </button>

              <button
                type="button"
                id="btn-refresh-clips"
                className="btn ghost"
                disabled={generatingClips || rerenderingClipPreviews}
                title="Generate ulang rekomendasi klip dan render preview dari awal (bypass cache)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  padding: '7px 14px',
                }}
                onClick={() => {
                  setPlayingClipIndex(null);
                  setInlineProgress({});
                  refreshClips();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: generatingClips ? 'spin 1s linear infinite' : 'none',
                  }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                {generatingClips ? 'Menganalisis Ulang…' : 'Generate Ulang'}
              </button>
            </div>
          </div>
        </div>

        {(generatingClips || rerenderingClipPreviews) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(50, 130, 184, 0.12)',
            border: '1px solid rgba(50, 130, 184, 0.3)',
            color: '#BBE1FA',
            fontSize: '13px',
          }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#F1F5F9' }}>
                {generatingClips ? 'Sedang Menganalisis Ulang & Merender Preview Klip…' : 'Sedang Merender Ulang Preview Video 9:16…'}
              </strong>
              <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>
                {progressLabel || 'Proses pemotongan video FFmpeg sedang berjalan, preview baru akan segera diperbarui.'}
              </div>
            </div>
          </div>
        )}

        {clips.length === 0 ? (
          <div className="empty-recent-placeholder">
            Belum ada klip yang dianalisis. Kembali ke Langkah 1 dan masukkan URL video Anda.
          </div>
        ) : (
          <>
            {/* Multi-select info bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              marginBottom: '16px',
              background: 'rgba(50, 130, 184, 0.08)',
              border: '1px solid rgba(50, 130, 184, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: '#94A3B8',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                💡 <strong style={{ color: '#BBE1FA' }}>Klik klip untuk memilih</strong>
                <span>(urutan klik = urutan video)</span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {selectedClipIndices.length > 0 && (
                  <span style={{ color: '#3282B8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {selectedClipIndices.length} klip dipilih
                    {' · '}
                    {Math.round(
                      selectedClipIndices
                        .map((i) => clips[i])
                        .filter(Boolean)
                        .reduce((sum, c) => sum + (c!.duration || (c!.end - c!.start)), 0)
                    )}s total
                  </span>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    style={{ fontSize: '11px', padding: '3px 8px', height: 'auto' }}
                    onClick={() => selectAllClips()}
                    title="Pilih semua klip rekomendasi"
                  >
                    Pilih Semua
                  </button>
                  {selectedClipIndices.length > 0 && (
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#EF4444' }}
                      onClick={() => clearSelectedClips()}
                      title="Hapus semua pilihan klip"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="opus-clips-grid">
            {clips.map((clip, idx) => {
              const isSelected = selectedClipIndices.includes(idx);
              const selectionOrder = selectedClipIndices.indexOf(idx); // -1 if not selected
              const isPlaying = playingClipIndex === idx;
              const progress = inlineProgress[idx] ?? 0;
              const v = clip.virality;
              const score = Math.round(v?.overall ?? clip.score);
              const startFormatted = formatTimecode(clip.start);
              const durationFormatted = formatTimecode(clip.duration);
              const endFormatted = formatTimecode(clip.end || (clip.start + clip.duration));
              const displayThumbnail =
                clip.thumbnailUrl ||
                (clip.previewUrl ? clip.previewUrl.replace(/\.mp4$/, '.jpg') : '') ||
                downloadedVideo?.thumbnailUrl ||
                (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');

              return (
                <div
                  key={clip.id || idx}
                  className={`opus-clip-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectClip(idx)}
                >
                  {/* 9:16 Video Preview Frame */}
                  <div
                    className={`opus-clip-preview ${isPlaying ? 'is-playing' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (clip.previewUrl) {
                        handleTogglePlay(idx);
                      }
                    }}
                  >
                    {/* Blurred background for landscape video in 9:16 portrait frame */}
                    <div
                      key={`bg-${clip.id}-${displayThumbnail}`}
                      className="opus-clip-bg-blur"
                      style={{
                        backgroundImage: `url(${displayThumbnail})`,
                      }}
                    />

                    {/* Active Video Player or Thumbnail Image */}
                    {isPlaying && clip.previewUrl ? (
                      <video
                        key={`video-${clip.id}-${clip.previewUrl}`}
                        ref={(el) => {
                          if (el) activeVideoRef.current = el;
                        }}
                        src={clip.previewUrl}
                        className="opus-clip-video-element"
                        autoPlay
                        playsInline
                        loop
                        muted={isMuted}
                        onTimeUpdate={(e) => {
                          const vEl = e.currentTarget;
                          if (vEl.duration) {
                            setInlineProgress((prev) => ({
                              ...prev,
                              [idx]: (vEl.currentTime / vEl.duration) * 100,
                            }));
                          }
                        }}
                        onError={() => {
                          setPlayingClipIndex(null);
                        }}
                      />
                    ) : (
                      <img
                        key={`img-${clip.id}-${displayThumbnail}`}
                        src={displayThumbnail}
                        alt={clip.title}
                        className="opus-clip-thumbnail"
                        loading="lazy"
                        onError={(e) => {
                          const fallback =
                            downloadedVideo?.thumbnailUrl ||
                            (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');
                          if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                            (e.target as HTMLImageElement).src = fallback;
                          }
                        }}
                      />
                    )}

                    {/* Top Badges (Selected Pill & Live Playing Status) */}
                    <div className="opus-clip-top-badges">
                      {isSelected && (
                        <div className="opus-clip-selected-badge">
                          <span style={{ fontWeight: 700, fontSize: '11px' }}>▶{selectionOrder + 1}</span>
                          <span>Terpilih</span>
                        </div>
                      )}
                      {isPlaying && (
                        <div className="opus-clip-live-badge">
                          <span className="live-dot" />
                          <span>Memutar</span>
                        </div>
                      )}
                    </div>

                    {/* Sound Mute/Unmute Audio Toggle (Only shown when playing) */}
                    {isPlaying && clip.previewUrl && (
                      <button
                        type="button"
                        className="opus-clip-mute-btn"
                        title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMuted(!isMuted);
                        }}
                      >
                        {isMuted ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Bottom-Right Time Range Badge */}
                    <div className="opus-clip-time-badge">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>{durationFormatted}</span>
                      <span className="badge-divider">•</span>
                      <span className="badge-range">{startFormatted} - {endFormatted}</span>
                    </div>

                    {/* Interactive Play/Pause Button Overlay */}
                    <div className={`opus-clip-play-overlay ${isPlaying ? 'is-playing' : ''}`}>
                      <div className="opus-clip-play-circle" title={isPlaying ? 'Jeda' : 'Putar Preview'}>
                        {isPlaying ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
                            <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Visible during playback) */}
                    {isPlaying && (
                      <div className="opus-clip-progress-track">
                        <div
                          className="opus-clip-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Modern Hook 3 Detik Quote Box */}
                  {clip.hook && (
                    <div className="opus-clip-hook-card opus-clip-sticker opus-clip-caption-glass">
                      <div className="caption-hook-tag">
                        <span className="hook-icon">🎯</span>
                        <span className="hook-label">HOOK 3 DETIK</span>
                      </div>
                      <div className="caption-text">
                        "{clip.hook}"
                      </div>
                    </div>
                  )}

                  {/* Score & AI Virality Metadata Row (3 non-functional icons removed) */}
                  <div className="opus-clip-meta-row">
                    <div className="opus-clip-score-wrap">
                      <div className="opus-clip-score-number">{score}</div>
                      <div className="opus-clip-score-meta">
                        <span className="score-grade-badge">
                          {score >= 85 ? '🔥 Sangat Viral' : score >= 75 ? '⚡ Viral Tinggi' : '📈 Potensi Baik'}
                        </span>
                        <span className="score-sublabel">Skor Viralitas AI</span>
                      </div>
                    </div>
                  </div>

                  {/* Clip Title */}
                  <h3 className="opus-clip-title" title={clip.title}>
                    {clip.title}
                  </h3>

                  {/* Action Buttons: Pilih Klip & Buka Detail */}
                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn ${isSelected ? 'primary' : 'ghost'} small`}
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(idx);
                      }}
                    >
                      {isSelected ? `✓ Klip #${selectionOrder + 1} Terpilih` : 'Pilih Klip Ini'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      title="Buka Detail Rekomendasi & Analisis Skor"
                      style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewModalClip({ clip, idx });
                      }}
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

        {/* Animated Attention-Grabbing Hook CTA Banner */}
        {selectedClipIndex !== null && clips[selectedClipIndex] && (
          <div className="hook-cta-banner">
            <div className="hook-cta-content">
              <div className="hook-cta-pill">
                <span className="hook-cta-pill-icon">🔥</span>
                <span>Optimasi Viralitas • Klip #{selectedClipIndex + 1}</span>
              </div>
              <h3 className="hook-cta-title">
                {hooks.length > 0
                  ? '5 Hook Alternatif Siap Dipilih!'
                  : 'Ingin Detik 0–3 Klip Ini Lebih Menghentak?'}
              </h3>
              <p className="hook-cta-desc">
                {hooks.length > 0
                  ? `5 Variasi hook pembuka AI untuk "${clips[selectedClipIndex].title}" sudah siap. Pilih salah satu di bawah.`
                  : `Hasilkan 5 variasi kalimat pembuka alternatif AI (gaya kontroversial, rasa penasaran, atau fakta mengejutkan) dengan thumbnail footage.`}
              </p>
            </div>
            <div className="hook-cta-action" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-hook-pulse"
                disabled={generatingHooks}
                onClick={() => {
                  if (hooks.length > 0) {
                    scrollToHookSection();
                  } else {
                    handleTriggerHookCta(false);
                  }
                }}
              >
                {generatingHooks ? (
                  <>⏳ Meracik 5 Hook Alternatif AI...</>
                ) : hooks.length > 0 ? (
                  <>🎯 Lihat 5 Hook Alternatif ↓</>
                ) : (
                  <>⚡ Buat 5 Hook Alternatif AI</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* AI Hooks Generator - Loading State */}
        {generatingHooks && (
          <div id="hook-generator-section" className="hook-loading-panel">
            <div className="hook-loading-spinner" />
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>
              Sedang Meracik 5 Hook Alternatif AI...
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '480px' }}>
              AI sedang menganalisis transkrip dan menyiapkan variasi hook pembuka beserta thumbnail untuk klip #{selectedClipIndex !== null ? selectedClipIndex + 1 : 1}. Mohon tunggu sejenak.
            </div>
          </div>
        )}

        {/* AI Hooks Generator - Results */}
        {hooks.length > 0 && (
          <div
            id="hook-generator-section"
            style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border)',
              scrollMarginTop: '80px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ice)' }}>
                  💡 5 Inspirasi Hook Pembuka Alternatif {selectedClipIndex !== null ? `(Klip #${selectedClipIndex + 1})` : ''}
                </span>
                {selectedClipIndex !== null && clips[selectedClipIndex] && (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    🎯 Momen sumber: "{clips[selectedClipIndex].title}" ({formatTimecode(clips[selectedClipIndex].start)} - {formatTimecode(clips[selectedClipIndex].end)})
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn ghost small"
                disabled={generatingHooks}
                onClick={() => startGenerateHooks({ refresh: true })}
                title="Buat ulang 5 hook alternatif baru untuk klip ini"
              >
                🔄 Regenerasi Hook Baru
              </button>
            </div>

            <div className="opus-clips-grid" style={{ marginTop: '16px' }}>
              {hooks.map((h, hIdx) => {
                const isSelected = selectedHookIndex === hIdx;
                const isPlaying = playingHookIndex === hIdx;
                const progress = inlineHookProgress[hIdx] ?? 0;
                const durationFormatted = `${(h.finalDurationSeconds ?? 4.5).toFixed(1)}s`;
                const displayThumbnail =
                  h.thumbnailUrl ||
                  (h.previewUrl ? h.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1') : '') ||
                  (selectedClipIndex !== null && clips[selectedClipIndex]?.thumbnailUrl) ||
                  downloadedVideo?.thumbnailUrl ||
                  (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');

                return (
                  <div
                    key={h.id || hIdx}
                    className={`opus-clip-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectHook(isSelected ? null : hIdx)}
                  >
                    {/* 9:16 Video Preview Frame */}
                    <div
                      className={`opus-clip-preview ${isPlaying ? 'is-playing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (h.previewUrl) {
                          handleTogglePlayHook(hIdx);
                        }
                      }}
                    >
                      {/* Blurred ambient background fill */}
                      <div
                        key={`hook-bg-${h.id || hIdx}-${displayThumbnail}`}
                        className="opus-clip-bg-blur"
                        style={{
                          backgroundImage: `url(${displayThumbnail})`,
                        }}
                      />

                      {/* Active Video Player or Thumbnail */}
                      {isPlaying && h.previewUrl ? (
                        <video
                          key={`hook-video-${h.id || hIdx}-${h.previewUrl}`}
                          ref={(el) => {
                            if (el) activeHookVideoRef.current = el;
                          }}
                          src={h.previewUrl}
                          className="opus-clip-video-element"
                          autoPlay
                          playsInline
                          loop
                          muted={isMuted}
                          onTimeUpdate={(e) => {
                            const vEl = e.currentTarget;
                            if (vEl.duration) {
                              setInlineHookProgress((prev) => ({
                                ...prev,
                                [hIdx]: (vEl.currentTime / vEl.duration) * 100,
                              }));
                            }
                          }}
                          onError={() => {
                            setPlayingHookIndex(null);
                          }}
                        />
                      ) : (
                        <img
                          key={`hook-img-${h.id || hIdx}-${displayThumbnail}`}
                          src={displayThumbnail}
                          alt={h.hookText}
                          className="opus-clip-thumbnail"
                          loading="lazy"
                          onError={(e) => {
                            const fallback =
                              (selectedClipIndex !== null && clips[selectedClipIndex]?.thumbnailUrl) ||
                              downloadedVideo?.thumbnailUrl ||
                              (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');
                            if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                              (e.target as HTMLImageElement).src = fallback;
                            }
                          }}
                        />
                      )}

                      {/* Top Badges (Selected Pill & Live Playing Status) */}
                      <div className="opus-clip-top-badges">
                        {isSelected && (
                          <div className="opus-clip-selected-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Hook Terpilih</span>
                          </div>
                        )}
                        {isPlaying && (
                          <div className="opus-clip-live-badge">
                            <span className="live-dot" />
                            <span>Memutar Intro</span>
                          </div>
                        )}
                      </div>

                      {/* Sound Mute/Unmute Audio Toggle */}
                      {isPlaying && h.previewUrl && (
                        <button
                          type="button"
                          className="opus-clip-mute-btn"
                          title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMuted(!isMuted);
                          }}
                        >
                          {isMuted ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                              <line x1="12" y1="19" x2="12" y2="23"></line>
                              <path d="M8 23h8"></path>
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Time Range Badge */}
                      <div className="opus-clip-time-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>{durationFormatted}</span>
                        <span className="badge-divider">•</span>
                        <span className="badge-range">{h.hookType?.toUpperCase() || 'HOOK'}</span>
                      </div>

                      {/* Interactive Play/Pause Button Overlay */}
                      <div className={`opus-clip-play-overlay ${isPlaying ? 'is-playing' : ''}`}>
                        <div className="opus-clip-play-circle" title={isPlaying ? 'Jeda' : 'Putar Preview'}>
                          {isPlaying ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
                              <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {isPlaying && (
                        <div className="opus-clip-progress-track">
                          <div className="opus-clip-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Hook 3 Detik Sticker Quote Card */}
                    <div className="opus-clip-hook-card opus-clip-sticker opus-clip-caption-glass">
                      <div className="caption-hook-tag" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="hook-icon">🎯</span>
                          <span className="hook-label">HOOK #{h.rank ?? hIdx + 1} • {h.hookType.toUpperCase()}</span>
                        </div>
                        {h.tag && (
                          <span className="hook-badge-tag">{h.tag}</span>
                        )}
                      </div>
                      <div className="caption-text">
                        "{h.hookText}"
                      </div>
                    </div>

                    {/* Score & AI Virality Metadata Row */}
                    <div className="opus-clip-meta-row">
                      <div className="opus-clip-score-wrap">
                        <div className="opus-clip-score-number">{Math.round(h.score)}</div>
                        <div className="opus-clip-score-meta">
                          <span className="score-grade-badge">
                            {h.score >= 85 ? '🔥 Sangat Kuat' : h.score >= 75 ? '⚡ Retensi Tinggi' : '📈 Potensi Baik'}
                          </span>
                          <span className="score-sublabel">Skor Retensi AI</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Gunakan Hook & Buka Detail */}
                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn ${isSelected ? 'primary' : 'ghost'} small`}
                        style={{ flex: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectHook(isSelected ? null : hIdx);
                        }}
                      >
                        {isSelected ? '✓ Hook Terpilih' : 'Gunakan Hook Ini'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost small"
                        title="Buka Detail Hook & Analisis"
                        style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalHook({ hook: h, idx: hIdx });
                        }}
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" onClick={() => setStep(1)}>
            ← Kembali ke Langkah 1
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={selectedClipIndices.length === 0}
            onClick={() => setStep(3)}
          >
            {selectedClipIndices.length > 0
              ? `Lanjut ke Pengaturan Video (${selectedClipIndices.length} Klip Dipilih) →`
              : 'Pilih Minimal 1 Klip untuk Lanjut'}
          </button>
        </div>
      </div>

      {/* STEP 3: Composer Studio (Subtitles & B-Roll) */}
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
                  className="btn secondary small"
                  disabled={draftingScript}
                  onClick={() => startDraftScript()}
                >
                  {draftingScript ? '⏳ Menulis Naskah...' : '✨ Buat Draf Naskah AI'}
                </button>

                <button
                  type="button"
                  className="btn ghost small"
                  disabled={synthesizingTts || !scriptDraft}
                  onClick={() => startSynthesizeTts()}
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
                    onClick={() => addScriptSection()}
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
                  className="btn secondary small"
                  disabled={draftingScript}
                  onClick={() => startDraftScript()}
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
        )}

        {/* Hook Intro & Headline Styling Panel (Step 3) */}
        <div className="input-group" style={{ marginBottom: '26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="label-main" style={{ margin: 0 }}>🎨 Desain &amp; Edit Teks Hook Pembuka (0–3 Detik)</label>
              <span className="output-mode-badge" style={{ fontSize: '10.5px' }}>Tahap 3: Styling Video</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={enableHookIntro}
                onChange={(e) => setEnableHookIntro(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: enableHookIntro ? 'var(--ice)' : 'var(--text-muted)' }}>
                {enableHookIntro ? '✓ Intro Hook Aktif' : 'Intro Hook Nonaktif'}
              </span>
            </label>
          </div>

          {enableHookIntro ? (
            <div
              className="card"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {/* Thumbnail Preview Column */}
                <div style={{ width: '90px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ position: 'relative', width: '90px', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                    <img
                      src={
                        (selectedHookIndex !== null && hooks[selectedHookIndex]?.thumbnailUrl) ||
                        (selectedHookIndex !== null && hooks[selectedHookIndex]?.previewUrl ? hooks[selectedHookIndex].previewUrl!.replace(/\.mp4(\?.*)?$/, '.jpg$1') : '') ||
                        (selectedClipIndices.length > 0 && clips[selectedClipIndices[0]]?.thumbnailUrl) ||
                        downloadedVideo?.thumbnailUrl ||
                        (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '')
                      }
                      alt="Hook Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const fallback =
                          (selectedClipIndices.length > 0 && clips[selectedClipIndices[0]]?.thumbnailUrl) ||
                          downloadedVideo?.thumbnailUrl ||
                          (downloadedVideo?.videoId ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg` : '');
                        if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                          (e.target as HTMLImageElement).src = fallback;
                        }
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 4px', fontSize: '9.5px', textAlign: 'center', color: '#fff', fontWeight: 600 }}>
                      Detik 0–3
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Footage Pembuka
                  </span>
                </div>

                {/* Edit Controls Column */}
                <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ice)' }}>
                        Kalimat Hook Kinetik di Layar:
                      </span>
                      {selectedHookIndex !== null && (
                        <span style={{ fontSize: '11.5px', color: 'var(--accent)' }}>
                          Terpilih dari Hook #{selectedHookIndex + 1} ({hooks[selectedHookIndex]?.hookType})
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={customHookText}
                      onChange={(e) => setCustomHookText(e.target.value)}
                      placeholder="Masukkan kalimat pembuka yang mengejutkan atau memicu rasa penasaran..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--bg-input, #0c1017)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: '6px' }}>
                      Pilih / Ubah Tag Kategori:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {['🔥 MOMEN VIRAL', '⚡ FAKTA MENGEJUTKAN', '🎯 DETIK KRUSIAL', '❓ TAHUKAH KAMU?'].map((tagOption) => (
                        <button
                          key={tagOption}
                          type="button"
                          className={`chip-toggle ${customHookTag === tagOption ? 'active' : ''}`}
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => setCustomHookTag(tagOption)}
                        >
                          {tagOption}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={customHookTag}
                        onChange={(e) => setCustomHookTag(e.target.value)}
                        placeholder="Tag kustom..."
                        style={{
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          color: '#fff',
                          width: '140px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '11.5px', color: '#93C5FD' }}>
                    💡 <strong>Proses Styling Remotion:</strong> Gaya tipografi kinetik untuk hook ini akan dirender secara terpadu oleh Remotion Engine bersamaan dengan template subtitle saat tombol Render ditekan.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Intro hook kinetik dinonaktifkan. Video akan langsung dimulai dari dialog klip pertama tanpa judul pembuka.
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="label-main">Pilih Template Subtitle Karaoke</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div
              className="card"
              style={{
                border: templateId === 'beast' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: templateId === 'beast' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
                cursor: 'pointer',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
              }}
              onClick={() => setTemplateId('beast')}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ice)', marginBottom: '6px' }}>
                🌟 Pop Dinamis (Gaya MrBeast)
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Teks tebal dengan sorotan kata per kata berwarna kuning &amp; cyan yang bergerak lincah menarik perhatian penonton.
              </p>
            </div>

            <div
              className="card"
              style={{
                border: templateId === 'hormozi' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: templateId === 'hormozi' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
                cursor: 'pointer',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
              }}
              onClick={() => setTemplateId('hormozi')}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                ⬛ Kotak Kontras Tegas (Gaya Hormozi)
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Huruf impact tebal dengan latar belakang kotak hitam pekat yang kontras tinggi dan sangat nyaman dibaca.
              </p>
            </div>

            <div
              className="card"
              style={{
                border: templateId === 'clean' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: templateId === 'clean' ? 'var(--bg-card-selected)' : 'var(--bg-card)',
                cursor: 'pointer',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
              }}
              onClick={() => setTemplateId('clean')}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                ✨ Modern Elegan Minimalis
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Tipografi bersih dan elegan dengan bayangan lembut, cocok untuk konten podcast, edukasi, dan wawasan bisnis.
              </p>
            </div>
          </div>
        </div>

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
            onClick={() => startTransform()}
          >
            {runningTransform
              ? '⏳ Sedang Merender Video...'
              : selectedClipIndices.length > 1
              ? `🚀 Render ${selectedClipIndices.length} Klip → ${outputMode === 'narration' ? 'Video Narasi AI' : 'Video Reel'}`
              : '🚀 Render Video Master'}
          </button>
        </div>
      </div>

      {/* STEP 4: Master Output */}
      <div className={`card ${step !== 4 ? 'hidden' : ''}`}>
        <div className="card-head">
          <div className="card-head-title">
            <h2>4. Video Berhasil Dirender &amp; Siap Pakai</h2>
            <span className="head-badge" style={{ background: '#10B981', color: '#ffffff' }}>✓ Selesai Dirender</span>
          </div>
          <p className="muted">
            Video format 1080x1920 60fps telah siap dipublikasikan ke YouTube Shorts, Instagram Reels, dan TikTok.
          </p>
        </div>

        {transformError && (
          <div className="card" style={{ borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5', marginBottom: '18px' }}>
            <p>Terjadi kendala saat rendering: {transformError}</p>
          </div>
        )}

        {transformResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div style={{ maxWidth: '340px', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: '#000', boxShadow: 'var(--shadow-lg)' }}>
              <video
                src={transformResult.videoUrl || transformResult.outputVideo}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <a
                href={transformResult.videoUrl || transformResult.outputVideo}
                download
                className="btn primary"
                style={{ textDecoration: 'none' }}
              >
                ⬇ Unduh Master Video (MP4)
              </a>

              {transformResult.videoId && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => onOpenCaptionModal(transformResult.videoId!, transformResult.title)}
                >
                  📱 Buat Caption Media Sosial
                </button>
              )}

              <button
                type="button"
                className="btn ghost"
                onClick={() => setStep(1)}
              >
                + Proses Video Baru
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-recent-placeholder">
            Belum ada hasil render. Selesaikan Langkah 3 dan klik tombol render untuk memulai pembuatan video.
          </div>
        )}
      </div>

      {/* Expanded Video Preview Modal */}
      {previewModalClip && (
        <div
          className="clip-modal-backdrop"
          onClick={() => setPreviewModalClip(null)}
        >
          <div
            className="clip-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clip-modal-header">
              <div className="clip-modal-title-wrap">
                <span className="clip-modal-rank">#{previewModalClip.idx + 1}</span>
                <h3 className="clip-modal-title">{previewModalClip.clip.title}</h3>
              </div>
              <button
                type="button"
                className="clip-modal-close-btn"
                onClick={() => setPreviewModalClip(null)}
              >
                ✕
              </button>
            </div>

            <div className="clip-modal-body">
              {/* Left Column: 9:16 Portrait Video Player */}
              <div className="clip-modal-player-col">
                <div className="clip-modal-video-wrapper">
                  {previewModalClip.clip.previewUrl ? (
                    <video
                      key={`modal-video-${previewModalClip.clip.id}-${previewModalClip.clip.previewUrl}`}
                      ref={modalVideoRef}
                      src={previewModalClip.clip.previewUrl}
                      controls
                      autoPlay
                      playsInline
                      className="clip-modal-video"
                      poster={
                        previewModalClip.clip.thumbnailUrl ||
                        (previewModalClip.clip.previewUrl ? previewModalClip.clip.previewUrl.replace(/\.mp4$/, '.jpg') : undefined) ||
                        downloadedVideo?.thumbnailUrl
                      }
                    />
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: '20px',
                      textAlign: 'center',
                      color: '#94A3B8',
                      gap: '12px',
                    }}>
                      <p style={{ margin: 0, fontSize: '13px' }}>Preview video belum siap untuk klip ini.</p>
                      <button
                        type="button"
                        className="btn ghost small"
                        disabled={rerenderingClipPreviews}
                        onClick={() => rerenderClipPreviews()}
                      >
                        {rerenderingClipPreviews ? 'Merender Preview…' : 'Render Preview'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Virality Breakdown & Actions */}
              <div className="clip-modal-info-col">
                {/* Score Banner */}
                <div className="clip-modal-score-box">
                  <div className="modal-score-number">
                    {Math.round(previewModalClip.clip.virality?.overall ?? previewModalClip.clip.score)}
                  </div>
                  <div className="modal-score-desc">
                    <span className="modal-score-badge">🔥 Skor Viralitas AI</span>
                    <p>Potensi retensi penonton tinggi berdasarkan analisis hook awal dan alur cerita.</p>
                  </div>
                </div>

                {/* Hook 3 Detik */}
                {previewModalClip.clip.hook && (
                  <div className="clip-modal-hook-box">
                    <div className="modal-section-title">🎯 Hook Pembuka 3 Detik:</div>
                    <div className="modal-hook-quote">"{previewModalClip.clip.hook}"</div>
                  </div>
                )}

                {/* Alasan Kurasi */}
                {previewModalClip.clip.reason && (
                  <div className="clip-modal-reason-box">
                    <div className="modal-section-title">💡 Alasan Rekomendasi:</div>
                    <p>{previewModalClip.clip.reason}</p>
                  </div>
                )}

                {/* Gauge Metrics */}
                {previewModalClip.clip.virality && (
                  <div className="clip-modal-gauges">
                    <div className="modal-gauge-row">
                      <span>Hook 3 Detik</span>
                      <span className="val">{previewModalClip.clip.virality.hookStrength}%</span>
                    </div>
                    <div className="virality-bar-bg">
                      <div className="virality-bar-fill" style={{ width: `${previewModalClip.clip.virality.hookStrength}%`, background: '#A3E635' }}></div>
                    </div>

                    <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                      <span>Alur Cerita</span>
                      <span className="val">{previewModalClip.clip.virality.engagementFlow}%</span>
                    </div>
                    <div className="virality-bar-bg">
                      <div className="virality-bar-fill" style={{ width: `${previewModalClip.clip.virality.engagementFlow}%`, background: '#60A5FA' }}></div>
                    </div>

                    <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                      <span>Kesesuaian Tren</span>
                      <span className="val">{previewModalClip.clip.virality.trendRelevance}%</span>
                    </div>
                    <div className="virality-bar-bg">
                      <div className="virality-bar-fill" style={{ width: `${previewModalClip.clip.virality.trendRelevance}%`, background: '#F59E0B' }}></div>
                    </div>

                    <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                      <span>Nilai Mandiri</span>
                      <span className="val">{previewModalClip.clip.virality.standaloneValue}%</span>
                    </div>
                    <div className="virality-bar-bg">
                      <div className="virality-bar-fill" style={{ width: `${previewModalClip.clip.virality.standaloneValue}%`, background: '#A78BFA' }}></div>
                    </div>
                  </div>
                )}

                {/* Alasan / Virality Key Factors */}
                {previewModalClip.clip.virality?.reasons && previewModalClip.clip.virality.reasons.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {previewModalClip.clip.virality.reasons.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="reason-pill"
                        style={{ fontSize: '11px', padding: '3px 10px' }}
                      >
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timestamp & Duration info */}
                <div className="clip-modal-time-info">
                  <span>⏱️ Durasi: <strong>{formatTimecode(previewModalClip.clip.duration)}</strong></span>
                  <span>📍 Rentang: <strong>{formatTimecode(previewModalClip.clip.start)} - {formatTimecode(previewModalClip.clip.end || (previewModalClip.clip.start + previewModalClip.clip.duration))}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Hook Preview Modal */}
      {previewModalHook && (
        <div
          className="clip-modal-backdrop"
          onClick={() => setPreviewModalHook(null)}
        >
          <div
            className="clip-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '780px' }}
          >
            <div className="clip-modal-header">
              <div className="clip-modal-title-wrap">
                <span className="clip-modal-rank">Hook #{previewModalHook.idx + 1}</span>
                <h3 className="clip-modal-title">Styled Hook Intro Preview</h3>
              </div>
              <button
                type="button"
                className="clip-modal-close-btn"
                onClick={() => setPreviewModalHook(null)}
              >
                ✕
              </button>
            </div>

            <div className="clip-modal-body">
              <div className="clip-modal-player-col">
                <div className="clip-modal-video-wrapper">
                  <video
                    key={`modal-hook-video-${previewModalHook.hook.id || previewModalHook.idx}-${previewModalHook.hook.previewUrl}`}
                    src={previewModalHook.hook.previewUrl}
                    controls
                    autoPlay
                    playsInline
                    className="clip-modal-video"
                    poster={
                      (previewModalHook.hook.previewUrl ? previewModalHook.hook.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1') : undefined) ||
                      downloadedVideo?.thumbnailUrl
                    }
                  />
                </div>
              </div>

              <div className="clip-modal-info-col">
                <div className="clip-modal-score-box">
                  <div className="modal-score-number">
                    {Math.round(previewModalHook.hook.score)}
                  </div>
                  <div className="modal-score-desc">
                    <span className="modal-score-badge">🔥 [{previewModalHook.hook.hookType}]</span>
                    <p>Styled hook intro dirender otomatis menggunakan Remotion untuk menarik perhatian penonton dalam detik-detik awal.</p>
                  </div>
                </div>

                <div className="clip-modal-hook-box">
                  <div className="modal-section-title">🎯 Teks Hook Pembuka:</div>
                  <div className="modal-hook-quote">"{previewModalHook.hook.hookText}"</div>
                </div>

                {previewModalHook.hook.explanation && (
                  <div className="clip-modal-reason-box">
                    <div className="modal-section-title">💡 Alasan Analisis:</div>
                    <p>{previewModalHook.hook.explanation}</p>
                  </div>
                )}

                {previewModalHook.hook.finalDurationSeconds && (
                  <div className="clip-modal-time-info">
                    <span>⏱️ Durasi Intro: <strong>{previewModalHook.hook.finalDurationSeconds.toFixed(1)} detik</strong></span>
                    {previewModalHook.hook.tag && (
                      <span>🏷️ Tag: <strong>{previewModalHook.hook.tag}</strong></span>
                    )}
                  </div>
                )}

                <div className="clip-modal-actions">
                  <button
                    type="button"
                    className="btn ghost full"
                    onClick={() => {
                      navigator.clipboard.writeText(previewModalHook.hook.hookText);
                    }}
                  >
                    📋 Salin Teks Hook
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
