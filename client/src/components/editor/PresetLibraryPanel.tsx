import React, { useState, useRef, useCallback } from 'react';
import { MusicLibraryPanel } from './MusicLibraryPanel';
import type { MusicTrack } from '../../lib/audio-catalog';
import { CLIENT_VISUAL_PRESETS } from '../../lib/visual-presets';

// =============================================================================
// Static Subtitle Presets
// =============================================================================

const SUBTITLE_PRESETS = [
  { id: 'beast', label: 'MrBeast', emoji: '🟡', desc: 'Yellow pop, stroke hitam tebal', color: '#FFE600' },
  { id: 'hormozi', label: 'Hormozi', emoji: '🟢', desc: 'Kotak hijau & putih kontras tinggi', color: '#10B981' },
  { id: 'clean', label: 'Clean Modern', emoji: '⬜', desc: 'Frosted glass minimalis modern', color: '#64748B' },
];

// =============================================================================
// Props Interface
// =============================================================================

export interface PresetLibraryPanelProps {
  onDropSubtitlePreset: (templateId: string) => void;
  onDropHookPreset: (visualPreset: string) => void;
  onDropMusicTrack: (trackId: string, streamUrl: string, label: string) => void;
  activeSubtitleId: string;
  activeHookPresetId: string;
  activeMusicTrackId: string | null;
  onClose?: () => void;
}

// =============================================================================
// Draggable Card Component
// =============================================================================

interface DraggableCardProps {
  isActive: boolean;
  emoji: string;
  label: string;
  desc: string;
  accentColor?: string;
  tagline?: string;
  badges?: string[];
  onClick?: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  isActive,
  emoji,
  label,
  desc,
  accentColor = 'var(--accent)',
  tagline,
  badges,
  onClick,
  onDragStart,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
      cardRef.current.style.transform = 'translateY(-2px)';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow = 'none';
      cardRef.current.style.transform = 'translateY(0)';
    }
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (cardRef.current) cardRef.current.style.opacity = '0.7';
      onDragStart(e);
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(() => {
    if (cardRef.current) cardRef.current.style.opacity = '1';
  }, []);

  return (
    <div
      ref={cardRef}
      draggable
      onClick={onClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: isActive ? 'rgba(50, 130, 184, 0.22)' : 'var(--bg-card)',
        border: `1.5px solid ${isActive ? 'var(--border-focus)' : `${accentColor}44`}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        cursor: 'grab',
        transition: 'all 0.15s ease',
        position: 'relative',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {/* Active badge */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'var(--accent)',
            color: '#FFFFFF',
            fontSize: '9px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 'var(--radius-full)',
            letterSpacing: '0.04em',
          }}
        >
          ✓ Aktif
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{emoji}</span>
        <div style={{ fontSize: '12px', fontWeight: 800, color: isActive ? '#FFFFFF' : 'var(--text-muted)' }}>
          {label}
        </div>
      </div>

      {tagline && (
        <div style={{ fontSize: '10px', fontWeight: 700, color: accentColor }}>
          {tagline}
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.35 }}>
        {desc}
      </div>

      {badges && badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {badges.map((b, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 5px',
                borderRadius: '4px',
              }}
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const PresetLibraryPanel: React.FC<PresetLibraryPanelProps> = ({
  onDropSubtitlePreset,
  onDropHookPreset,
  onDropMusicTrack,
  activeSubtitleId,
  activeHookPresetId,
  activeMusicTrackId,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'hook' | 'subtitle' | 'music'>('hook');

  // Music state
  const [internalMusicVolume, setInternalMusicVolume] = useState(25);
  const [internalAutoDucking, setInternalAutoDucking] = useState(true);

  const handleSelectTrack = useCallback(
    (track: MusicTrack | null) => {
      if (track) {
        onDropMusicTrack(track.id, track.streamUrl, track.title);
      }
    },
    [onDropMusicTrack],
  );

  const TAB_DEFS: Array<{ id: 'hook' | 'subtitle' | 'music'; label: string }> = [
    { id: 'hook', label: '⚡ Hook (12)' },
    { id: 'subtitle', label: '🎨 Subtitle' },
    { id: 'music', label: '🎵 Musik' },
  ];

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0F4C75, #3282B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0,
            }}
          >
            📦
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Katalog Preset Video</div>
            <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>Klik langsung atau seret ke player canvas</div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup katalog preset"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}
      >
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-sub)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 2: HOOK PRESETS (All 12 Visual Presets from Registry) */}
      {activeTab === 'hook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
            12 Pilihan Animasi Visual Hook (Spring, Cascade, Slide, Burst):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {CLIENT_VISUAL_PRESETS.map((preset) => (
              <DraggableCard
                key={preset.id}
                isActive={activeHookPresetId === preset.id}
                emoji={preset.label.split(' ')[0] || '⚡'}
                label={preset.label}
                tagline={preset.familyLabel}
                desc={preset.description}
                badges={preset.metaBadges}
                onClick={() => onDropHookPreset(preset.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({ type: 'hook-preset', id: preset.id }),
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUBTITLE PRESETS */}
      {activeTab === 'subtitle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
            Gaya Karaoke Pop Subtitle:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SUBTITLE_PRESETS.map((preset) => (
              <DraggableCard
                key={preset.id}
                isActive={activeSubtitleId === preset.id}
                emoji={preset.emoji}
                label={preset.label}
                desc={preset.desc}
                accentColor={preset.color}
                onClick={() => onDropSubtitlePreset(preset.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({ type: 'subtitle-preset', id: preset.id }),
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MUSIC */}
      {activeTab === 'music' && (
        <MusicLibraryPanel
          selectedTrackId={activeMusicTrackId}
          musicVolume={internalMusicVolume}
          autoDucking={internalAutoDucking}
          onSelectTrack={handleSelectTrack}
          onVolumeChange={setInternalMusicVolume}
          onAutoDuckingChange={setInternalAutoDucking}
        />
      )}

      {/* Drag instruction footer */}
      {activeTab !== 'music' && (
        <div
          style={{
            marginTop: 'auto',
            padding: '8px 10px',
            background: 'rgba(50, 130, 184, 0.08)',
            border: '1px dashed var(--border-dim)',
            borderRadius: 'var(--radius-md)',
            fontSize: '9.5px',
            color: 'var(--text-sub)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          ✋ Klik kartu untuk menerapkan instan, atau seret ke area preview canvas
        </div>
      )}
    </div>
  );
};
