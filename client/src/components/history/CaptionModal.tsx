import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface CaptionModalProps {
  videoId: string | null;
  videoTitle: string;
  onClose: () => void;
}

export const CaptionModal: React.FC<CaptionModalProps> = ({
  videoId,
  videoTitle,
  onClose,
}) => {
  const [platform, setPlatform] = useState<'tiktok' | 'reels' | 'shorts'>('tiktok');
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .generateSocialCaptions({ videoId, title: videoTitle })
      .then((data) => {
        if (mounted) setCaptions(data);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Gagal menghasilkan caption');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [videoId, videoTitle]);

  if (!videoId) return null;

  const currentCaption = captions[platform] || captions.caption || '';

  const handleCopy = () => {
    if (currentCaption) {
      navigator.clipboard?.writeText(currentCaption);
      alert('Caption berhasil disalin ke clipboard ✓');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>
              📱 Generator Caption Media Sosial
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Caption cerdas dengan tagar relevan untuk: <strong style={{ color: '#ffffff' }}>{videoTitle}</strong>
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Tutup"
            style={{ fontSize: '20px' }}
          >
            ✕
          </button>
        </div>

        {/* Platform Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`btn small ${platform === 'tiktok' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('tiktok')}
          >
            TikTok
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'reels' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('reels')}
          >
            Instagram Reels
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'shorts' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('shorts')}
          >
            YouTube Shorts
          </button>
        </div>

        {loading ? (
          <div className="empty-recent-placeholder">Sedang membuat caption yang menarik...</div>
        ) : error ? (
          <div className="card" style={{ borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', color: '#FCA5A5' }}>
            <p>Terjadi kendala: {error}</p>
          </div>
        ) : (
          <div>
            <textarea
              readOnly
              value={currentCaption || 'Belum ada caption untuk platform ini.'}
              rows={8}
              style={{
                width: '100%',
                background: '#080C14',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                color: '#ffffff',
                fontSize: '13.5px',
                lineHeight: 1.6,
                resize: 'none',
              }}
            />
            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                Batal
              </button>
              <button type="button" className="btn primary" onClick={handleCopy}>
                📋 Salin Caption
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
