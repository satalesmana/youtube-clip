import React, { useRef, useState, useCallback } from 'react';
import {
  AUDIO_CATALOG,
  MUSIC_GENRES,
  filterByGenre,
  searchTracks,
} from '../../lib/audio-catalog';
import type { MusicGenre, MusicTrack } from '../../lib/audio-catalog';

// =============================================================================
// Types
// =============================================================================

export interface MusicLibraryPanelProps {
  selectedTrackId: string | null;
  musicVolume: number;         // 0–100
  autoDucking: boolean;
  onSelectTrack: (track: MusicTrack | null) => void;
  onVolumeChange: (vol: number) => void;
  onAutoDuckingChange: (enabled: boolean) => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Format seconds to M:SS */
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// =============================================================================
// Component
// =============================================================================

export const MusicLibraryPanel: React.FC<MusicLibraryPanelProps> = ({
  selectedTrackId,
  musicVolume,
  autoDucking,
  onSelectTrack,
  onVolumeChange,
  onAutoDuckingChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<MusicGenre | null>(null);

  // -------------------------------------------------------------------------
  // Derived list
  // -------------------------------------------------------------------------
  const filteredTracks = useCallback((): MusicTrack[] => {
    if (searchQuery.trim().length > 0) return searchTracks(searchQuery);
    if (activeGenre) return filterByGenre(activeGenre);
    return AUDIO_CATALOG;
  }, [searchQuery, activeGenre])();

  const selectedTrack = AUDIO_CATALOG.find((t) => t.id === selectedTrackId) ?? null;

  // -------------------------------------------------------------------------
  // Preview playback
  // -------------------------------------------------------------------------
  const togglePreview = (track: MusicTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (previewingId === track.id) {
      // Pause current preview
      audio.pause();
      setPreviewingId(null);
    } else {
      // Load & play new preview
      audio.pause();
      audio.currentTime = 0;
      audio.src = track.streamUrl;
      audio.volume = 0.5;
      audio.play().catch((err) => {
        console.warn('[MusicLibraryPanel] Audio preview play warning:', err);
        setPreviewingId(null);
      });
      setPreviewingId(track.id);
    }
  };

  const handleAudioEnded = () => setPreviewingId(null);

  // -------------------------------------------------------------------------
  // Styles (CSS variable-based, no external libs)
  // -------------------------------------------------------------------------
  const styles = {
    panel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      padding: '16px',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      fontFamily: 'var(--font-body)',
      color: 'var(--text)',
      minWidth: 0,
    },

    // Header
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
    },
    headerTitle: {
      fontSize: '13px',
      fontWeight: 700,
      color: 'var(--text)',
      letterSpacing: '-0.01em',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    clearBtn: {
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-sub)',
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 10px',
      cursor: 'pointer',
      transition: 'color 0.15s, border-color 0.15s',
      whiteSpace: 'nowrap' as const,
    },

    // Search
    searchInput: {
      width: '100%',
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: '12px',
      color: 'var(--text)',
      outline: 'none',
      transition: 'border-color 0.15s',
    },

    // Genre Pills
    genrePills: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '6px',
    },
    pill: (active: boolean): React.CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: active ? 'var(--accent-dim)' : 'var(--bg-input)',
      color: active ? 'var(--ice)' : 'var(--text-sub)',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }),

    // Track List
    trackList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
      maxHeight: '280px',
      overflowY: 'auto' as const,
      paddingRight: '2px',
    },
    trackRow: (selected: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 10px',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      border: selected
        ? '1px solid var(--accent)'
        : '1px solid transparent',
      background: selected
        ? 'var(--bg-card-selected)'
        : 'var(--bg-panel)',
      transition: 'all 0.15s',
      minWidth: 0,
    }),
    cover: {
      width: '40px',
      height: '40px',
      borderRadius: '6px',
      objectFit: 'cover' as const,
      flexShrink: 0,
      background: 'var(--bg-input)',
    },
    trackInfo: {
      flex: 1,
      minWidth: 0,
    },
    trackTitle: {
      fontSize: '12px',
      fontWeight: 700,
      color: 'var(--text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    trackArtist: {
      fontSize: '10px',
      color: 'var(--text-sub)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    trackMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '3px',
      flexWrap: 'wrap' as const,
    },
    genreTag: {
      fontSize: '9px',
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--accent-dim)',
      color: 'var(--ice)',
      border: '1px solid var(--border-dim)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
    },
    duration: {
      fontSize: '10px',
      color: 'var(--text-sub)',
      fontVariantNumeric: 'tabular-nums',
    },
    previewBtn: (playing: boolean): React.CSSProperties => ({
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: playing ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: playing ? 'var(--accent-dim)' : 'var(--bg-input)',
      color: playing ? 'var(--ice)' : 'var(--text-sub)',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'all 0.15s',
    }),

    // Controls
    controls: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '10px',
      paddingTop: '12px',
      borderTop: '1px solid var(--border-subtle)',
    },
    controlLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-sub)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    controlValue: {
      color: 'var(--accent)',
      fontVariantNumeric: 'tabular-nums',
    },
    slider: {
      width: '100%',
      accentColor: 'var(--accent)',
      cursor: 'pointer',
    },
    duckingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    checkbox: {
      width: '16px',
      height: '16px',
      accentColor: 'var(--accent)',
      cursor: 'pointer',
      flexShrink: 0,
    },
    duckingLabel: {
      fontSize: '11px',
      color: 'var(--text-sub)',
      lineHeight: 1.4,
    },
    duckingHint: {
      fontSize: '10px',
      color: 'var(--text-sub)',
      opacity: 0.7,
      marginTop: '2px',
    },

    // Empty state
    emptyState: {
      textAlign: 'center' as const,
      padding: '24px 0',
      color: 'var(--text-sub)',
      fontSize: '12px',
    },

    // Selected track info badge
    selectedBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 10px',
      background: 'var(--bg-card-selected)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius-md)',
      fontSize: '11px',
      color: 'var(--ice)',
    },
    selectedBadgeDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'var(--accent)',
      flexShrink: 0,
      boxShadow: '0 0 6px var(--accent-glow)',
    },
  };

  return (
    <div style={styles.panel}>
      {/* Hidden native audio element for preview — not part of Remotion render */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={() => setPreviewingId(null)}
        style={{ display: 'none' }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          🎵 Background Music
        </span>
        {selectedTrack && (
          <button
            style={styles.clearBtn}
            onClick={() => {
              audioRef.current?.pause();
              setPreviewingId(null);
              onSelectTrack(null);
            }}
            title="Hapus musik latar"
          >
            ✕ Hapus
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Selected track badge (visible when music is on)                     */}
      {/* ------------------------------------------------------------------ */}
      {selectedTrack && (
        <div style={styles.selectedBadge}>
          <div style={styles.selectedBadgeDot} />
          <span>
            {selectedTrack.genreEmoji} {selectedTrack.title}
            <span style={{ opacity: 0.7 }}> — {selectedTrack.artist}</span>
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Search bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      <input
        type="text"
        placeholder="🔍 Cari judul, artis, atau tag..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setActiveGenre(null);
        }}
        style={styles.searchInput}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--border-focus)';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Genre filter pills                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div style={styles.genrePills}>
        {/* "Semua" pill */}
        <button
          style={styles.pill(activeGenre === null && searchQuery.trim() === '')}
          onClick={() => {
            setActiveGenre(null);
            setSearchQuery('');
          }}
        >
          🎵 Semua
        </button>

        {MUSIC_GENRES.map((g) => (
          <button
            key={g.id}
            style={styles.pill(activeGenre === g.id && searchQuery.trim() === '')}
            onClick={() => {
              setActiveGenre(g.id);
              setSearchQuery('');
            }}
            title={g.description}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Track list                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div style={styles.trackList}>
        {filteredTracks.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🎶</div>
            Tidak ada track yang sesuai.
          </div>
        ) : (
          filteredTracks.map((track) => {
            const isSelected = track.id === selectedTrackId;
            const isPreviewing = track.id === previewingId;

            return (
              <div
                key={track.id}
                style={styles.trackRow(isSelected)}
                onClick={() => onSelectTrack(isSelected ? null : track)}
                title={`Pilih: ${track.title}`}
              >
                {/* Cover thumbnail */}
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  style={styles.cover}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="%231E3444"%3E%3Crect width="40" height="40"/%3E%3Ctext x="50%25" y="55%25" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="%23BBE1FA"%3E🎵%3C/text%3E%3C/svg%3E';
                  }}
                />

                {/* Track info */}
                <div style={styles.trackInfo}>
                  <div style={styles.trackTitle}>{track.title}</div>
                  <div style={styles.trackArtist}>{track.artist}</div>
                  <div style={styles.trackMeta}>
                    <span style={styles.genreTag}>
                      {track.genreEmoji} {track.genre}
                    </span>
                    <span style={styles.duration}>
                      {formatDuration(track.durationSec)}
                      {track.bpm ? ` · ${track.bpm} BPM` : ''}
                    </span>
                  </div>
                </div>

                {/* Preview button — stops propagation so it doesn't select */}
                <button
                  style={styles.previewBtn(isPreviewing)}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreview(track);
                  }}
                  title={isPreviewing ? 'Stop preview' : 'Preview track'}
                >
                  {isPreviewing ? '⏹' : '▶'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Volume & Ducking Controls — only visible when a track is selected   */}
      {/* ------------------------------------------------------------------ */}
      {selectedTrack && (
        <div style={styles.controls}>
          {/* Volume slider */}
          <div>
            <div style={styles.controlLabel}>
              <span>Volume Musik</span>
              <span style={styles.controlValue}>{musicVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={musicVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              style={styles.slider}
              title="Atur volume musik latar"
            />
          </div>

          {/* Auto-Ducking toggle */}
          <div>
            <div style={styles.duckingRow}>
              <input
                id="auto-ducking-toggle"
                type="checkbox"
                checked={autoDucking}
                onChange={(e) => onAutoDuckingChange(e.target.checked)}
                style={styles.checkbox}
              />
              <label
                htmlFor="auto-ducking-toggle"
                style={{ ...styles.duckingLabel, cursor: 'pointer' }}
              >
                <strong>Auto-Ducking</strong>
              </label>
            </div>
            <p style={styles.duckingHint}>
              Musik otomatis mengecil saat dialog/narasi aktif
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicLibraryPanel;
