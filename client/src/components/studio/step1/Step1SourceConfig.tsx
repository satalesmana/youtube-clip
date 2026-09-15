import React from 'react';
import type { DownloadedVideo } from '../../../types';

interface Step1SourceConfigProps {
  step: number;
  url: string;
  setUrl: (url: string) => void;
  downloadedVideo: DownloadedVideo | null;
  downloadingVideo: boolean;
  downloadError: string | null;
  startDownloadVideo: () => void;
  resetDownload: () => void;
  detectedLanguage: string | null;
  detectingLanguage: boolean;
  genre: string;
  setGenre: (genre: string) => void;
  aspectRatio: '9:16' | '16:9' | '1:1';
  setAspectRatio: (ar: '9:16' | '16:9' | '1:1') => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  clipsCount: number;
  clipsError: string | null;
  generatingClips: boolean;
  onAnalyzeClips: () => void;
  onReanalyzeClips: () => void;
}

export const Step1SourceConfig: React.FC<Step1SourceConfigProps> = ({
  step,
  url,
  setUrl,
  downloadedVideo,
  downloadingVideo,
  downloadError,
  startDownloadVideo,
  resetDownload,
  detectedLanguage,
  detectingLanguage,
  genre,
  setGenre,
  aspectRatio,
  setAspectRatio,
  customPrompt,
  setCustomPrompt,
  clipsCount,
  clipsError,
  generatingClips,
  onAnalyzeClips,
  onReanalyzeClips,
}) => {
  return (
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
              onClick={startDownloadVideo}
              style={{ whiteSpace: 'nowrap', padding: '12px 20px' }}
            >
              {downloadingVideo ? '⏳ Mengunduh Video...' : '⚡ Unduh & Siapkan Video'}
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost"
              onClick={resetDownload}
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
              className={`btn primary ${clipsCount > 0 ? '' : 'full'}`}
              style={{ flex: clipsCount > 0 ? 1 : undefined }}
              disabled={generatingClips || detectingLanguage}
              onClick={onAnalyzeClips}
            >
              {generatingClips
                ? '⏳ Sedang Menganalisis Potensi Viral...'
                : detectingLanguage
                ? '⏳ Menunggu Deteksi Bahasa & Transkrip Selesai...'
                : '✨ Analisis Video & Temukan Klip Viral'}
            </button>
            {clipsCount > 0 && (
              <button
                type="button"
                className="btn ghost"
                disabled={generatingClips || detectingLanguage}
                title="Analisis ulang dan render preview baru dari awal (bypass cache)"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={onReanalyzeClips}
              >
                🔄 Analisis Ulang (Bypass Cache)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
