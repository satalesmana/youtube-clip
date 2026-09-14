import React from 'react';
import type { HistoryItem } from '../../types';

interface HistoryViewProps {
  history: HistoryItem[];
  loading: boolean;
  onOpenCaptionModal: (videoId: string, title: string) => void;
  onPlayVideo: (url: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  loading,
  onOpenCaptionModal,
  onPlayVideo,
  onNavigateTab,
}) => {
  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 24px 60px' }}>
      <div className="card">
        <div className="card-head">
          <div className="card-head-title">
            <h2>Daftar Proyek &amp; Arsip Video</h2>
            <span className="head-badge">{history.length} Video Tersimpan</span>
          </div>
          <p className="muted">
            Daftar seluruh rekaman video yang telah diproses, siap diunduh, diputar, atau dibuatkan caption media sosial.
          </p>
        </div>

        {loading ? (
          <div className="empty-recent-placeholder">
            <div className="spinner" style={{ width: '28px', height: '28px' }} />
            <p style={{ marginTop: '8px', color: '#ffffff' }}>Memuat data proyek video...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-recent-placeholder">
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(50, 130, 184, 0.14)',
                border: '1px solid rgba(50, 130, 184, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                marginBottom: '4px',
              }}
            >
              🎬
            </div>
            <h4 style={{ margin: 0, color: '#FFFFFF', fontSize: '17px', fontWeight: 700 }}>
              Belum Ada Klip Tersimpan
            </h4>
            <p style={{ margin: 0, maxWidth: '460px', color: 'var(--text-sub)', fontSize: '13px', lineHeight: 1.6 }}>
              Mulai buat klip viral pertama Anda dari video panjang YouTube dengan AI subtitle otomatis, framing 9:16, dan hook viral.
            </p>
            {onNavigateTab && (
              <button
                type="button"
                className="btn primary"
                onClick={() => onNavigateTab('home')}
                style={{ marginTop: '8px' }}
              >
                ⚡ Buat Klip Baru
              </button>
            )}
          </div>
        ) : (
          <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.slice().reverse().map((item, idx) => {
              const clipUrl = item.videoUrl || item.outputVideo || '';
              const vId = item.videoId || '';
              const title = item.title || item.video || 'Klip Video';

              return (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px 18px',
                    background: '#080C14',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      style={{ width: '84px', height: '52px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: '84px',
                        height: '52px',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                      }}
                    >
                      🎬 Video
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                      {title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Format: 1080x1920 (9:16) • Resolusi Penuh 60FPS
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {vId && (
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => onOpenCaptionModal(vId, title)}
                        title="Buat Caption Media Sosial"
                      >
                        📱 Buat Caption
                      </button>
                    )}
                    {clipUrl && (
                      <a
                        href={clipUrl}
                        download
                        className="btn ghost small"
                        title="Unduh File MP4"
                        style={{ textDecoration: 'none' }}
                      >
                        ⬇ Unduh
                      </a>
                    )}
                    {clipUrl && (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => onPlayVideo(clipUrl)}
                        title="Putar Video Sekarang"
                      >
                        ▶ Putar Video
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
