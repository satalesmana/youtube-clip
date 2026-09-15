import React from 'react';
import type { TransformResult } from '../../../types';

interface Step4OutputProps {
  step: number;
  setStep: (step: number) => void;
  transformResult: TransformResult | null;
  transformError: string | null;
  onOpenCaptionModal: (videoId: string, title: string) => void;
}

export const Step4Output: React.FC<Step4OutputProps> = ({
  step,
  setStep,
  transformResult,
  transformError,
  onOpenCaptionModal,
}) => {
  return (
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

      {transformResult ? (() => {
        const rawVideo = transformResult.videoUrl || transformResult.outputVideo;
        const videoSrc = typeof rawVideo === 'string'
          ? rawVideo
          : (rawVideo as { url?: string } | undefined)?.url || '';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div style={{ maxWidth: '340px', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', background: '#000', boxShadow: 'var(--shadow-lg)' }}>
              <video
                src={videoSrc}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <a
                href={videoSrc}
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
      ); })() : (
        <div className="empty-recent-placeholder">
          Belum ada hasil render. Selesaikan Langkah 3 dan klik tombol render untuk memulai pembuatan video.
        </div>
      )}
    </div>
  );
};
