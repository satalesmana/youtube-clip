import React from 'react';
import type { ViralHook } from '../../../types';

interface HookCardProps {
  hook: ViralHook;
  hIdx: number;
  isSelected: boolean;
  isPlaying: boolean;
  progress: number;
  isMuted: boolean;
  selectedClipThumbnailUrl?: string;
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

export const HookCard: React.FC<HookCardProps> = ({
  hook: h,
  hIdx,
  isSelected,
  isPlaying,
  progress,
  isMuted,
  selectedClipThumbnailUrl,
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
  const durationFormatted = `${(h.finalDurationSeconds ?? 4.5).toFixed(1)}s`;

  const fallbackThumbnail =
    selectedClipThumbnailUrl ||
    downloadedVideoThumbnailUrl ||
    (downloadedVideoId ? `https://img.youtube.com/vi/${downloadedVideoId}/hqdefault.jpg` : '');

  const displayThumbnail =
    h.thumbnailUrl ||
    (h.previewUrl ? h.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1') : '') ||
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
          if (h.previewUrl) {
            onTogglePlay();
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
            ref={videoRef}
            src={h.previewUrl}
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
            key={`hook-img-${h.id || hIdx}-${displayThumbnail}`}
            src={displayThumbnail}
            alt={h.hookText}
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
              onToggleMute();
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
            onSelect();
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
            onOpenDetail();
          }}
        >
          Detail
        </button>
      </div>
    </div>
  );
};
