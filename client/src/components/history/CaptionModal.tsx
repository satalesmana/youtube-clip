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
  const [platform, setPlatform] = useState<'tiktok' | 'reels' | 'shorts' | 'facebook' | 'x' | 'threads'>('tiktok');
  const [captions, setCaptions] = useState<Record<string, any>>({});
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

  const extractCaptionText = (cap: unknown): string => {
    if (!cap) return '';
    if (typeof cap === 'string') return cap;
    if (typeof cap === 'object') {
      const obj = cap as Record<string, any>;
      if (typeof obj.formattedCaption === 'string' && obj.formattedCaption.trim()) {
        return obj.formattedCaption.trim();
      }
      const parts: string[] = [];
      if (obj.title) parts.push(obj.title);
      if (obj.hook) parts.push(obj.hook);
      if (obj.body) parts.push(obj.body);
      if (obj.callToAction) parts.push(obj.callToAction);
      if (Array.isArray(obj.hashtags) && obj.hashtags.length > 0) {
        parts.push(obj.hashtags.join(' '));
      }
      if (parts.length > 0) return parts.join('\n\n');
    }
    return '';
  };

  const getActiveCaption = (): string => {
    if (!captions) return '';
    let raw: unknown = undefined;
    if (platform === 'tiktok') {
      raw = captions.tiktok;
    } else if (platform === 'reels') {
      raw = captions.instagram || captions.reels;
    } else if (platform === 'shorts') {
      raw = captions.youtube_shorts || captions.shorts;
    } else if (platform === 'facebook') {
      raw = captions.facebook || captions.facebook_reels;
    } else if (platform === 'x') {
      raw = captions.x || captions.twitter;
    } else if (platform === 'threads') {
      raw = captions.threads;
    }
    if (!raw && captions[platform]) {
      raw = captions[platform];
    }
    if (!raw && captions.caption) {
      raw = captions.caption;
    }
    return extractCaptionText(raw);
  };

  const currentCaption = getActiveCaption();

  const handleCopy = () => {
    if (currentCaption) {
      navigator.clipboard?.writeText(currentCaption);
      alert('Caption berhasil disalin ke clipboard ✓');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px', padding: '24px' }}>
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn small ${platform === 'tiktok' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('tiktok')}
          >
            🎵 TikTok
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'reels' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('reels')}
          >
            📸 Instagram Reels
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'shorts' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('shorts')}
          >
            🔴 YouTube Shorts
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'facebook' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('facebook')}
          >
            🔵 Facebook
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'x' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('x')}
          >
            𝕏 X / Twitter
          </button>
          <button
            type="button"
            className={`btn small ${platform === 'threads' ? 'primary' : 'ghost'}`}
            onClick={() => setPlatform('threads')}
          >
            🧵 Threads
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
