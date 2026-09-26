import React, { useState, useRef, useCallback } from 'react';
import { MusicLibraryPanel } from './MusicLibraryPanel';
import type { MusicTrack } from '../../lib/audio-catalog';

// =============================================================================
// Static Preset Data
// =============================================================================

const SUBTITLE_PRESETS = [
  { id: 'beast', label: 'MrBeast', emoji: '🟡', desc: 'Yellow pop, stroke hitam', color: '#FFE600' },
  { id: 'hormozi', label: 'Hormozi', emoji: '🟢', desc: 'High contrast box', color: '#10B981' },
  { id: 'clean', label: 'Clean Modern', emoji: '⬜', desc: 'Frosted glass minimal', color: '#64748B' },
];

const HOOK_PRESETS = [
  { id: 'kinetic-punch', label: 'Kinetic Punch', emoji: '⚡', desc: 'Impact zoom masuk' },
  { id: 'curiosity-stack', label: 'Curiosity Stack', emoji: '🤔', desc: 'Suspensi empat baris' },
  { id: 'bold-impact', label: 'Bold Impact', emoji: '🔥', desc: 'Frame kuning tebal' },
  { id: 'story-slide', label: 'Story Slide', emoji: '📖', desc: 'Narasi masuk pelan' },
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
}

// =============================================================================
// Draggable Card
// =============================================================================

interface DraggableCardProps {
  isActive: boolean;
  emoji: string;
  label: string;
  desc: string;
  accentColor?: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  isActive,
  emoji,
  label,
  desc,
  accentColor,
  onDragStart,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.boxShadow = 'var(--shadow-glow)';
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: isActive ? 'rgba(50, 130, 184, 0.2)' : 'var(--bg-card)',
        border: `2px solid ${isActive ? 'var(--border-focus)' : accentColor ? `${accentColor}55` : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px',
        cursor: 'grab',
        transition: 'all 0.15s ease',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Active badge */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'var(--accent)',
            color: '#FFFFFF',
            fontSize: '9px',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: 'var(--radius-full)',
            letterSpacing: '0.04em',
          }}
        >
          ✓ Aktif
        </div>
      )}

      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{emoji}</div>
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 800,
          color: isActive ? '#FFFFFF' : 'var(--text-muted)',
          marginBottom: '2px',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-sub)', lineHeight: 1.3 }}>{desc}</div>
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
}) => {
  const [activeTab, setActiveTab] = useState<'subtitle' | 'hook' | 'music'>('subtitle');

  // Proxy handlers for MusicLibraryPanel — music selection from within the panel
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

  const TAB_DEFS: Array<{ id: 'subtitle' | 'hook' | 'music'; label: string }> = [
    { id: 'subtitle', label: '🎨 Subtitle' },
    { id: 'hook', label: '⚡ Hook' },
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
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Panel Preset &amp; Aset</div>
          <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>Seret ke video atau timeline</div>
        </div>
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
              padding: '5px 4px',
              borderRadius: '6px',
              fontSize: '10.5px',
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

      {/* TAB: Subtitle Presets */}
      {activeTab === 'subtitle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
            Seret kartu ke area video untuk menerapkan gaya subtitle:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {SUBTITLE_PRESETS.map((preset) => (
              <DraggableCard
                key={preset.id}
                isActive={activeSubtitleId === preset.id}
                emoji={preset.emoji}
                label={preset.label}
                desc={preset.desc}
                accentColor={preset.color}
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
          {/* One-click apply */}
          <div style={{ fontSize: '10px', color: 'var(--text-sub)', marginTop: '4px' }}>
            Atau klik langsung untuk menerapkan:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUBTITLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onDropSubtitlePreset(preset.id)}
                style={{
                  background: activeSubtitleId === preset.id ? 'var(--accent)' : 'var(--bg-card)',
                  color: activeSubtitleId === preset.id ? '#FFFFFF' : 'var(--text-muted)',
                  border: `1px solid ${activeSubtitleId === preset.id ? 'var(--border-focus)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {preset.emoji} {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Hook Presets */}
      {activeTab === 'hook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
            Seret kartu ke area video untuk mengubah visual hook intro:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {HOOK_PRESETS.map((preset) => (
              <DraggableCard
                key={preset.id}
                isActive={activeHookPresetId === preset.id}
                emoji={preset.emoji}
                label={preset.label}
                desc={preset.desc}
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
          {/* One-click apply */}
          <div style={{ fontSize: '10px', color: 'var(--text-sub)', marginTop: '4px' }}>
            Atau klik langsung untuk menerapkan:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {HOOK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onDropHookPreset(preset.id)}
                style={{
                  background: activeHookPresetId === preset.id ? 'var(--accent)' : 'var(--bg-card)',
                  color: activeHookPresetId === preset.id ? '#FFFFFF' : 'var(--text-muted)',
                  border: `1px solid ${activeHookPresetId === preset.id ? 'var(--border-focus)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {preset.emoji} {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Music — embed MusicLibraryPanel directly */}
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
            fontSize: '10px',
            color: 'var(--text-sub)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          ✋ Seret kartu ke area preview video <br />
          atau ke timeline di bawah player
        </div>
      )}
    </div>
  );
};
