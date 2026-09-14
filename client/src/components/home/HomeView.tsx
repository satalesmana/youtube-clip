import React, { useState } from 'react';
import type { HistoryItem } from '../../types';

interface HomeViewProps {
  onStartClips: (url: string) => void;
  onNavigateTab: (tab: string) => void;
  recentProjects: HistoryItem[];
  onPlayVideo?: (url: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onStartClips,
  onNavigateTab,
  recentProjects,
  onPlayVideo,
}) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      alert('Masukkan URL video YouTube terlebih dahulu.');
      return;
    }
    onStartClips(url.trim());
  };

  return (
    <div className="opus-home-container">
      {/* Hero Video Ingest Card */}
      <section className="opus-hero-section">
        <div className="hero-drop-card">
          <div className="hero-header-label">
            <span className="head-badge">✨ AI Video Clipper & Highlight Generator</span>
          </div>

          <h1 className="hero-title">
            Ubah Video Panjang Jadi Shorts Viral dalam 60 Detik
          </h1>
          <p className="hero-subtitle">
            AI kami otomatis menemukan momen terbaik, memotong rasio 9:16 untuk ponsel, dan menambahkan subtitle karaoke beranimasi siap tayang.
          </p>

          <form onSubmit={handleSubmit} style={{ margin: 0 }}>
            <div className="hero-input-wrap">
              <span className="link-icon">🔗</span>
              <input
                type="url"
                id="hero-url-input"
                placeholder="Tempel tautan video YouTube (misal: https://youtube.com/watch?v=...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
              />
              {url && (
                <button
                  type="button"
                  className="btn-clear-hero"
                  onClick={() => setUrl('')}
                  title="Hapus input"
                >
                  ✕ Hapus
                </button>
              )}
            </div>

            <div className="hero-options-row">
              <div className="hero-supported-tag">
                <span>⚡ Mendukung Video YouTube, Shorts, &amp; Podcast</span>
              </div>
              <button
                type="button"
                className="btn-quick-settings"
                onClick={() => onNavigateTab('transform')}
              >
                ⚙️ Buka Studio Klip →
              </button>
            </div>

            <button
              type="submit"
              className="btn-hero-cta"
              style={{ marginTop: '20px' }}
            >
              ⚡ Potong Jadi Shorts (60 Detik)
            </button>
          </form>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="industrial-features-section">
        <div className="section-technical-header">
          <h3>Fitur Unggulan Studio</h3>
          <span className="tech-spec-label">Engine Remotion 1080x1920 60FPS</span>
        </div>

        <div className="asymmetric-grid">
          {/* Module 01: 9:16 Reframe */}
          <div className="grid-cell col-8" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">🎯 Pelacakan Wajah Dinamis</span>
            <h4 className="cell-title">Smart Reframe 9:16 Otomatis</h4>
            <p className="cell-desc">
              Ubah video lanskap 16:9 menjadi format vertikal 9:16 yang pas untuk layar ponsel. Kamera AI cerdas otomatis mendeteksi dan memusatkan subjek pembicara dengan transisi halus tanpa goncangan.
            </p>

            <div className="mockup-viewfinder">
              <div className="viewfinder-frame-916">
                <div className="viewfinder-crosshair">+</div>
              </div>
              <div className="viewfinder-tag">
                Fokus Subjek: Otomatis Terkunci di Tengah • Format Siap Shorts/Reels/TikTok
              </div>
            </div>
          </div>

          {/* Module 02: Audio Ducking */}
          <div className="grid-cell col-4" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">🎙️ Kualitas Audio Jernih</span>
            <h4 className="cell-title">Isolasi Suara &amp; Smart Ducking</h4>
            <p className="cell-desc">
              AI memisahkan vokal narasumber dan menurunkan musik latar hingga -18dB secara otomatis saat obrolan berlangsung, sehingga pesan terdengar jelas.
            </p>

            <div className="mockup-waveform">
              {[20, 45, 80, 65, 95, 30, 85, 100, 70, 40, 90, 60, 35, 75, 50, 90, 85, 40, 65, 30].map((h, i) => (
                <div
                  key={i}
                  className={`wave-bar ${h > 60 ? 'active' : ''}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Module 03: Subtitle Engine */}
          <div className="grid-cell col-4" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">✨ Animasi Subtitle</span>
            <h4 className="cell-title">Subtitle Karaoke Akurat</h4>
            <p className="cell-desc">
              Transkripsi cepat dan presisi kata demi kata. Highlight warna dinamis membantu penonton tetap fokus dan meningkatkan retensi video Anda.
            </p>

            <div style={{ background: '#080C14', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: 'auto' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Waktu: 00:14.28</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                KATA KUNCI: <span style={{ color: '#BBE1FA', background: 'rgba(50, 130, 184, 0.25)', padding: '2px 6px', borderRadius: '4px' }}>VIRAL</span> DALAM 60 DETIK
              </div>
            </div>
          </div>

          {/* Module 04: Multi-Track Timeline */}
          <div className="grid-cell col-8" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">🎬 Footage Tambahan</span>
            <h4 className="cell-title">Sisipan B-Roll Otomatis Berdasarkan Konteks</h4>
            <p className="cell-desc">
              AI mengenali topik yang sedang dibicarakan, mencari footage pendukung yang relevan, dan menaruhnya pada timeline video secara cerdas tanpa memotong rekaman suara asli.
            </p>

            <div className="mockup-timeline">
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px' }}>
                <span>00:00</span>
                <span>00:15</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>▼ 00:28 (Momen Kunci)</span>
                <span>00:45</span>
              </div>
              <div className="timeline-track">
                <span className="track-label">B-Roll</span>
                <div className="track-strip">
                  <div className="track-block" style={{ left: '25%', width: '35%', background: '#3282B8' }}></div>
                </div>
              </div>
              <div className="timeline-track">
                <span className="track-label">Video</span>
                <div className="track-strip">
                  <div className="track-block" style={{ left: '0%', width: '100%', background: '#3B82F6' }}></div>
                </div>
              </div>
              <div className="timeline-track">
                <span className="track-label">Audio</span>
                <div className="track-strip">
                  <div className="track-block" style={{ left: '0%', width: '100%', background: '#10B981' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Module 05: Virality Matrix */}
          <div className="grid-cell col-6" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">📊 Penilaian Algoritma</span>
            <h4 className="cell-title">Skor Retensi &amp; Hook 3 Detik</h4>
            <p className="cell-desc">
              Ketahui klip mana yang memiliki peluang viral tertinggi. Dinilai dari kekuatan pembuka 3 detik pertama, tempo dialog, dan relevansi topik.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#080C14', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: 'auto' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hook 3 Detik</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#34D399' }}>94%</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tempo Dialog</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#60A5FA' }}>88%</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nilai Mandiri</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#A78BFA' }}>91%</div>
              </div>
            </div>
          </div>

          {/* Module 06: Master Export */}
          <div className="grid-cell col-6" onClick={() => onNavigateTab('transform')} style={{ cursor: 'pointer' }}>
            <span className="cell-index">⚡ Ekspor Cepat</span>
            <h4 className="cell-title">Render Remotion 1080x1920 Full HD</h4>
            <p className="cell-desc">
              Hasil video vertikal jernih 60fps dengan standar format H.264/AAC dan kartu penutup promosi (Call to Action) yang rapi.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
              <span className="reason-pill">✓ Resolusi 1080x1920 60FPS</span>
              <span className="reason-pill">✓ Format MP4 (H.264)</span>
              <span className="reason-pill">✓ Kartu Outro Promosi</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="recent-projects-container">
        <div className="recent-projects-head">
          <h3>Proyek Video Terakhir</h3>
          <button
            type="button"
            className="btn-view-all-projects"
            onClick={() => onNavigateTab('history')}
          >
            Lihat Semua Proyek →
          </button>
        </div>

        <div className="recent-projects-grid">
          {recentProjects.length === 0 ? (
            <div className="empty-recent-placeholder">
              Belum ada proyek. Tempelkan tautan video YouTube di atas untuk mulai membuat klip pertama Anda!
            </div>
          ) : (
            recentProjects.slice(0, 4).map((item, idx) => {
              const clipUrl = item.videoUrl || item.outputVideo;
              const title = item.title || item.video || 'Klip Video';
              const duration = item.duration ? `00:${String(Math.floor(item.duration)).padStart(2, '0')}` : '00:45';

              return (
                <div
                  key={item.id || idx}
                  className="recent-project-card"
                  onClick={() => {
                    if (clipUrl && onPlayVideo) {
                      onPlayVideo(clipUrl);
                    } else if (item.sourceUrl) {
                      onStartClips(item.sourceUrl);
                    }
                  }}
                  title={title}
                >
                  <div className="recent-card-thumb">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" loading="lazy" />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#080C14',
                          color: 'var(--text-muted)',
                          fontSize: '12px',
                        }}
                      >
                        🎬 Pratinjau Video
                      </div>
                    )}
                    <span className="recent-card-duration">{duration}</span>
                  </div>
                  <div className="recent-card-body">
                    <div className="recent-card-title">{title}</div>
                    <div className="recent-card-meta">
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : 'Baru'}</span>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>Selesai</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
