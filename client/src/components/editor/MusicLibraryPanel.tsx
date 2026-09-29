import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  AUDIO_CATALOG,
  MUSIC_GENRES,
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

  // Live scraping states
  const [liveScrapedTracks, setLiveScrapedTracks] = useState<MusicTrack[]>([]);
  const [isScrapingLive, setIsScrapingLive] = useState(false);
  const [autoDirectScrape, setAutoDirectScrape] = useState(true);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [pixabayCookieInput, setPixabayCookieInput] = useState(() => {
    try {
      return localStorage.getItem('pixabay_cookie') || '';
    } catch {
      return '';
    }
  });
  const [scrapeNotification, setScrapeNotification] = useState<{
    type: 'success' | 'warn' | 'error';
    message: string;
  } | null>(null);

  // Track the last scraped query to avoid duplicate scraping
  const lastScrapedQueryRef = useRef<string>('');

  // -------------------------------------------------------------------------
  // Combined list: Live scraped tracks + Base Catalog
  // -------------------------------------------------------------------------
  const allTracksCombined = useMemo(() => {
    const map = new Map<string, MusicTrack>();
    for (const t of liveScrapedTracks) {
      map.set(t.id, t);
    }
    for (const t of AUDIO_CATALOG) {
      if (!map.has(t.id)) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [liveScrapedTracks]);

  const filteredTracks = useCallback((): MusicTrack[] => {
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      if (q === 'pixabay') {
        return allTracksCombined.filter(
          (t) =>
            t.id.startsWith('pixabay') ||
            t.artist.toLowerCase().includes('pixabay') ||
            t.tags?.some((tag) => tag.toLowerCase().includes('pixabay')),
        );
      }
      return allTracksCombined.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (activeGenre) {
      return allTracksCombined.filter((t) => t.genre === activeGenre);
    }
    return allTracksCombined;
  }, [searchQuery, activeGenre, allTracksCombined])();

  const selectedTrack = allTracksCombined.find((t) => t.id === selectedTrackId) ?? null;

  // -------------------------------------------------------------------------
  // Live Scraping Trigger
  // -------------------------------------------------------------------------
  const handlePixabayLiveSearch = async (overrideCookie?: string, customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : searchQuery).trim();
    if (!q) return;

    setIsScrapingLive(true);
    setScrapeNotification(null);

    try {
      const cookieToSend = overrideCookie !== undefined ? overrideCookie : (localStorage.getItem('pixabay_cookie') || '');
      const params = new URLSearchParams({ q });
      if (cookieToSend) params.set('cookie', cookieToSend);

      const res = await fetch(`/api/music/pixabay-search?${params.toString()}`);
      const data = await res.json();

      if (data.blockedByCloudflare) {
        setScrapeNotification({
          type: 'warn',
          message: 'Cloudflare WAF aktif di Pixabay. Menampilkan musik rekomendasi.',
        });
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          setLiveScrapedTracks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const fresh = data.tracks.filter((t: MusicTrack) => !existingIds.has(t.id));
            return [...fresh, ...prev];
          });
        }
      } else if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setLiveScrapedTracks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const fresh = data.tracks.filter((t: MusicTrack) => !existingIds.has(t.id));
          return [...fresh, ...prev];
        });
        setScrapeNotification({
          type: 'success',
          message: `✓ Berhasil direct scrape ${data.tracks.length} track dari Pixabay!`,
        });
        setCookieModalOpen(false);
      } else {
        setScrapeNotification({
          type: 'warn',
          message: `Tidak ditemukan lagu di Pixabay untuk kata kunci "${q}".`,
        });
      }
    } catch (err: any) {
      setScrapeNotification({
        type: 'error',
        message: `Gagal live scrape: ${err.message}`,
      });
    } finally {
      setIsScrapingLive(false);
    }
  };

  // -------------------------------------------------------------------------
  // Automatic Direct Scraping Debounce (750ms after typing)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!autoDirectScrape) return;
    const q = searchQuery.trim();
    if (q.length < 3 || q.toLowerCase() === 'pixabay') return;
    if (q === lastScrapedQueryRef.current) return;

    const timer = setTimeout(() => {
      lastScrapedQueryRef.current = q;
      handlePixabayLiveSearch(undefined, q);
    }, 750);

    return () => clearTimeout(timer);
  }, [searchQuery, autoDirectScrape]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={styles.headerTitle}>
            🎵 Background Music
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Streaming langsung via cloud CDN bebas royalti tanpa memakan memori/disk lokal"
          >
            ☁️ Online Stream
          </span>
        </div>
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
      {/* Search bar & Direct Live Scraping Trigger                           */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Cari atau ketik kata kunci Pixabay (otomatis scrape)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveGenre(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  lastScrapedQueryRef.current = searchQuery.trim();
                  handlePixabayLiveSearch();
                }
              }}
              style={styles.searchInput}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--border-focus)';
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
              }}
            />
            {isScrapingLive && (
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10.5px',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  pointerEvents: 'none',
                }}
              >
                ⚡ Scraping...
              </span>
            )}
          </div>

          <button
            onClick={() => {
              lastScrapedQueryRef.current = searchQuery.trim();
              handlePixabayLiveSearch();
            }}
            disabled={isScrapingLive || !searchQuery.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isScrapingLive
                ? 'var(--bg-input)'
                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isScrapingLive || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              opacity: isScrapingLive || !searchQuery.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              transition: 'all 0.15s ease',
            }}
            title="Tekan Enter atau klik untuk scrape langsung musik Pixabay sesuai kata kunci"
          >
            {isScrapingLive ? '⏳ Scraping...' : '⚡ Scrape Pixabay'}
          </button>
        </div>

        {/* Auto-scrape option & hotkey info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10.5px',
            color: 'var(--text-sub)',
            padding: '0 2px',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoDirectScrape}
              onChange={(e) => setAutoDirectScrape(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>Auto-scrape Pixabay saat mengetik</span>
          </label>
          <span style={{ opacity: 0.75 }}>
            Tekan <kbd style={{ padding: '1px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> untuk cari langsung
          </span>
        </div>
      </div>

      {/* Notification banner */}
      {scrapeNotification && (
        <div
          style={{
            fontSize: '11px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background:
              scrapeNotification.type === 'success'
                ? 'rgba(34, 197, 94, 0.15)'
                : scrapeNotification.type === 'warn'
                ? 'rgba(234, 179, 8, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
            color:
              scrapeNotification.type === 'success'
                ? '#4ade80'
                : scrapeNotification.type === 'warn'
                ? '#facc15'
                : '#f87171',
            border:
              scrapeNotification.type === 'success'
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : scrapeNotification.type === 'warn'
                ? '1px solid rgba(234, 179, 8, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
          }}
        >
          <span>{scrapeNotification.message}</span>
          {scrapeNotification.type === 'warn' && (
            <button
              onClick={() => setCookieModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '11px',
                padding: 0,
              }}
            >
              Set Cookie
            </button>
          )}
        </div>
      )}

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
          🌐 Semua
        </button>

        {/* "Pixabay" filter pill */}
        <button
          style={styles.pill(searchQuery.toLowerCase() === 'pixabay')}
          onClick={() => {
            setActiveGenre(null);
            setSearchQuery(searchQuery.toLowerCase() === 'pixabay' ? '' : 'pixabay');
          }}
          title="Tampilkan musik bebas royalti dari Pixabay"
        >
          ✨ Pixabay
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
            <div>Tidak ada musik di katalog lokal{searchQuery ? ` untuk "${searchQuery}"` : ''}.</div>
            {searchQuery.trim().length > 0 && (
              <button
                onClick={() => {
                  lastScrapedQueryRef.current = searchQuery.trim();
                  handlePixabayLiveSearch(undefined, searchQuery.trim());
                }}
                disabled={isScrapingLive}
                style={{
                  marginTop: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isScrapingLive ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                }}
              >
                {isScrapingLive ? '⏳ Sedang Scraping Pixabay...' : `⚡ Direct Scrape Pixabay: "${searchQuery}"`}
              </button>
            )}
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
                    {track.isLiveScraped && (
                      <span
                        style={{
                          fontSize: '9px',
                          background: 'rgba(234, 179, 8, 0.2)',
                          color: '#facc15',
                          border: '1px solid rgba(234, 179, 8, 0.4)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 700,
                        }}
                      >
                        ⚡ Live Pixabay
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '9px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 500,
                      }}
                    >
                      ☁️ Stream
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

      {/* ------------------------------------------------------------------ */}
      {/* Cloudflare Cookie Config Modal (Bypass Live Pixabay Scraping)      */}
      {/* ------------------------------------------------------------------ */}
      {cookieModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setCookieModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text, #f8fafc)' }}>
                🛡️ Cloudflare Bypass (Live Pixabay Scraping)
              </h3>
              <button
                onClick={() => setCookieModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sub, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub, #94a3b8)', lineHeight: 1.5 }}>
              Pixabay memproteksi pencarian langsung dengan Cloudflare Turnstile. Anda dapat menautkan cookie sesi dari browser Anda untuk live scraping on-the-fly:
            </p>

            <div style={{ fontSize: '11px', background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', color: '#cbd5e1', lineHeight: 1.6 }}>
              <strong>💡 Cara Cepat (Tanpa Perlu cf_clearance):</strong><br />
              1. Buka tab <a href="https://pixabay.com/music/" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>pixabay.com/music</a> di browser Anda.<br />
              2. Tekan <code>F12</code> (atau <code>Cmd + Option + I</code>) ➔ Tab <strong>Console</strong>.<br />
              3. Ketik perintah: <code style={{ color: '#38bdf8' }}>copy(document.cookie)</code> lalu tekan Enter.<br />
              4. Tempel (Paste) di kotak di bawah ini lalu klik Simpan.<br />
              <span style={{ opacity: 0.8, fontSize: '10.5px' }}>
                *(Catatan: Cookie <code>cf_clearance</code> memang tidak dibuat jika browser Anda tidak diminta menyelesaikan captcha)*
              </span>
            </div>

            <textarea
              rows={3}
              placeholder="Contoh: anonymous_user_id=...; __cf_bm=... (atau hasil paste dari copy(document.cookie))"
              value={pixabayCookieInput}
              onChange={(e) => setPixabayCookieInput(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border, #334155)',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '11px',
                color: 'var(--text, #f8fafc)',
                resize: 'none',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setCookieModalOpen(false)}
                style={{
                  background: 'var(--bg-input, #334155)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: 'var(--text-sub, #94a3b8)',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('pixabay_cookie', pixabayCookieInput.trim());
                  } catch {}
                  handlePixabayLiveSearch(pixabayCookieInput.trim());
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Simpan & Scrape Ulang ⚡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicLibraryPanel;
