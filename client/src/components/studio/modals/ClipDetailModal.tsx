import React from 'react';
import type { DownloadedVideo, ViralClip } from '../../../types';
import { formatTimecode } from '../studioUtils';

interface ClipDetailModalProps {
  modalData: { clip: ViralClip; idx: number } | null;
  onClose: () => void;
  downloadedVideo: DownloadedVideo | null;
  modalVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  rerenderingClipPreviews: boolean;
  onRerenderClipPreviews: () => void;
}

export const ClipDetailModal: React.FC<ClipDetailModalProps> = ({
  modalData,
  onClose,
  downloadedVideo,
  modalVideoRef,
  rerenderingClipPreviews,
  onRerenderClipPreviews,
}) => {
  if (!modalData) return null;

  const { clip, idx } = modalData;

  const posterUrl =
    clip.thumbnailUrl ||
    (clip.previewUrl ? clip.previewUrl.replace(/\.mp4$/, '.jpg') : undefined) ||
    downloadedVideo?.thumbnailUrl;

  const score = Math.round(clip.virality?.overall ?? clip.score);

  return (
    <div className="clip-modal-backdrop" onClick={onClose}>
      <div className="clip-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="clip-modal-header">
          <div className="clip-modal-title-wrap">
            <span className="clip-modal-rank">#{idx + 1}</span>
            <h3 className="clip-modal-title">{clip.title}</h3>
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
          {/* Left Column: 9:16 Portrait Video Player */}
          <div className="clip-modal-player-col">
            <div className="clip-modal-video-wrapper">
              {clip.previewUrl ? (
                <video
                  key={`modal-video-${clip.id}-${clip.previewUrl}`}
                  ref={(el) => {
                    modalVideoRef.current = el;
                  }}
                  src={clip.previewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="clip-modal-video"
                  poster={posterUrl}
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
                    onClick={onRerenderClipPreviews}
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
              <div className="modal-score-number">{score}</div>
              <div className="modal-score-desc">
                <span className="modal-score-badge">🔥 Skor Viralitas AI</span>
                <p>Potensi retensi penonton tinggi berdasarkan analisis hook awal dan alur cerita.</p>
              </div>
            </div>

            {/* Hook 3 Detik */}
            {clip.hook && (
              <div className="clip-modal-hook-box">
                <div className="modal-section-title">🎯 Hook Pembuka 3 Detik:</div>
                <div className="modal-hook-quote">"{clip.hook}"</div>
              </div>
            )}

            {/* Alasan Kurasi */}
            {clip.reason && (
              <div className="clip-modal-reason-box">
                <div className="modal-section-title">💡 Alasan Rekomendasi:</div>
                <p>{clip.reason}</p>
              </div>
            )}

            {/* Gauge Metrics */}
            {clip.virality && (
              <div className="clip-modal-gauges">
                <div className="modal-gauge-row">
                  <span>Hook 3 Detik</span>
                  <span className="val">{clip.virality.hookStrength}%</span>
                </div>
                <div className="virality-bar-bg">
                  <div className="virality-bar-fill" style={{ width: `${clip.virality.hookStrength}%`, background: '#A3E635' }}></div>
                </div>

                <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                  <span>Alur Cerita</span>
                  <span className="val">{clip.virality.engagementFlow}%</span>
                </div>
                <div className="virality-bar-bg">
                  <div className="virality-bar-fill" style={{ width: `${clip.virality.engagementFlow}%`, background: '#60A5FA' }}></div>
                </div>

                <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                  <span>Kesesuaian Tren</span>
                  <span className="val">{clip.virality.trendRelevance}%</span>
                </div>
                <div className="virality-bar-bg">
                  <div className="virality-bar-fill" style={{ width: `${clip.virality.trendRelevance}%`, background: '#F59E0B' }}></div>
                </div>

                <div className="modal-gauge-row" style={{ marginTop: '10px' }}>
                  <span>Nilai Mandiri</span>
                  <span className="val">{clip.virality.standaloneValue}%</span>
                </div>
                <div className="virality-bar-bg">
                  <div className="virality-bar-fill" style={{ width: `${clip.virality.standaloneValue}%`, background: '#A78BFA' }}></div>
                </div>
              </div>
            )}

            {/* Alasan / Virality Key Factors */}
            {clip.virality?.reasons && clip.virality.reasons.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {clip.virality.reasons.map((r, rIdx) => (
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
              <span>⏱️ Durasi: <strong>{formatTimecode(clip.duration)}</strong></span>
              <span>📍 Rentang: <strong>{formatTimecode(clip.start)} - {formatTimecode(clip.end || (clip.start + clip.duration))}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
