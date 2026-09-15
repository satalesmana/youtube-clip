import React from 'react';
import type { DownloadedVideo, ViralHook } from '../../../types';

interface HookDetailModalProps {
  modalData: { hook: ViralHook; idx: number } | null;
  onClose: () => void;
  downloadedVideo: DownloadedVideo | null;
}

export const HookDetailModal: React.FC<HookDetailModalProps> = ({
  modalData,
  onClose,
  downloadedVideo,
}) => {
  if (!modalData) return null;

  const { hook, idx } = modalData;

  const posterUrl =
    (hook.previewUrl ? hook.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1') : undefined) ||
    downloadedVideo?.thumbnailUrl;

  const score = Math.round(hook.score);

  return (
    <div className="clip-modal-backdrop" onClick={onClose}>
      <div
        className="clip-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px' }}
      >
        <div className="clip-modal-header">
          <div className="clip-modal-title-wrap">
            <span className="clip-modal-rank">Hook #{idx + 1}</span>
            <h3 className="clip-modal-title">Styled Hook Intro Preview</h3>
          </div>
          <button
            type="button"
            className="clip-modal-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="clip-modal-body">
          <div className="clip-modal-player-col">
            <div className="clip-modal-video-wrapper">
              <video
                key={`modal-hook-video-${hook.id || idx}-${hook.previewUrl}`}
                src={hook.previewUrl}
                controls
                autoPlay
                playsInline
                className="clip-modal-video"
                poster={posterUrl}
              />
            </div>
          </div>

          <div className="clip-modal-info-col">
            <div className="clip-modal-score-box">
              <div className="modal-score-number">{score}</div>
              <div className="modal-score-desc">
                <span className="modal-score-badge">🔥 [{hook.hookType}]</span>
                <p>Styled hook intro dirender otomatis menggunakan Remotion untuk menarik perhatian penonton dalam detik-detik awal.</p>
              </div>
            </div>

            <div className="clip-modal-hook-box">
              <div className="modal-section-title">🎯 Teks Hook Pembuka:</div>
              <div className="modal-hook-quote">"{hook.hookText}"</div>
            </div>

            {hook.explanation && (
              <div className="clip-modal-reason-box">
                <div className="modal-section-title">💡 Alasan Analisis:</div>
                <p>{hook.explanation}</p>
              </div>
            )}

            {hook.finalDurationSeconds && (
              <div className="clip-modal-time-info">
                <span>⏱️ Durasi Intro: <strong>{hook.finalDurationSeconds.toFixed(1)} detik</strong></span>
                {hook.tag && (
                  <span>🏷️ Tag: <strong>{hook.tag}</strong></span>
                )}
              </div>
            )}

            <div className="clip-modal-actions">
              <button
                type="button"
                className="btn ghost full"
                onClick={() => {
                  navigator.clipboard.writeText(hook.hookText);
                }}
              >
                📋 Salin Teks Hook
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
