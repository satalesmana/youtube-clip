import React from 'react';
import type { ViralClip } from '../../../types';
import { formatTimecode } from '../studioUtils';

interface ClipCardProps {
  clip: ViralClip;
  idx: number;
  isSelected: boolean;
  selectionOrder: number;
  isPlaying: boolean;
  progress: number;
  isMuted: boolean;
  downloadedVideoThumbnailUrl?: string;
  downloadedVideoId?: string;
  videoRef?: (el: HTMLVideoElement | null) => void;
  onSelect: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onProgressUpdate: (pct: number) => void;
  onPlayError: () => void;
  onOpenDetail: () => void;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  idx: _idx,
  isSelected,
  selectionOrder,
  isPlaying,
  progress,
  isMuted,
  downloadedVideoThumbnailUrl,
  downloadedVideoId,
  videoRef,
  onSelect,
  onTogglePlay,
  onToggleMute,
  onProgressUpdate,
  onPlayError,
  onOpenDetail,
}) => {
  const v = clip.virality;
  const score = Math.round(v?.overall ?? clip.score);
  const startFormatted = formatTimecode(clip.start);
  const durationFormatted = formatTimecode(clip.duration);
  const endFormatted = formatTimecode(clip.end || (clip.start + clip.duration));

  const fallbackThumbnail =
    downloadedVideoThumbnailUrl ||
    (downloadedVideoId ? `https://img.youtube.com/vi/${downloadedVideoId}/hqdefault.jpg` : '');

  const displayThumbnail =
    clip.thumbnailUrl ||
    (clip.previewUrl ? clip.previewUrl.replace(/\.mp4$/, '.jpg') : '') ||
    fallbackThumbnail;

  return (
    <div
      className={`opus-clip-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {/* 9:16 Video Preview Frame */}
      <div
        className={`opus-clip-preview ${isPlaying ? 'is-playing' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (clip.previewUrl) {
            onTogglePlay();
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
            ref={videoRef}
            src={clip.previewUrl}
            className="opus-clip-video-element"
            autoPlay
            playsInline
            loop
            muted={isMuted}
            onTimeUpdate={(e) => {
              const vEl = e.currentTarget;
              if (vEl.duration) {
                onProgressUpdate((vEl.currentTime / vEl.duration) * 100);
              }
            }}
            onError={onPlayError}
          />
        ) : (
          <img
            key={`img-${clip.id}-${displayThumbnail}`}
            src={displayThumbnail}
            alt={clip.title}
            className="opus-clip-thumbnail"
            loading="lazy"
            onError={(e) => {
              if (fallbackThumbnail && (e.target as HTMLImageElement).src !== fallbackThumbnail) {
                (e.target as HTMLImageElement).src = fallbackThumbnail;
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
              onToggleMute();
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

      {/* Score & AI Virality Metadata Row */}
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
            onSelect();
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
            onOpenDetail();
          }}
        >
          Detail
        </button>
      </div>
    </div>
  );
};
