import React from 'react';
import type { DownloadedVideo, ViralClip, ViralHook } from '../../../types';
import { formatTimecode } from '../studioUtils';
import { HookCard } from './HookCard';

interface HookListSectionProps {
  hooks: ViralHook[];
  generatingHooks: boolean;
  selectedClipIndex: number | null;
  selectedClip: ViralClip | undefined;
  downloadedVideo: DownloadedVideo | null;
  selectedHookIndex: number | null;
  playingHookIndex: number | null;
  inlineHookProgress: { [idx: number]: number };
  isMuted: boolean;
  activeHookVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onSelectHook: (idx: number | null) => void;
  onTogglePlayHook: (idx: number) => void;
  onToggleMute: () => void;
  onProgressUpdate: (idx: number, pct: number) => void;
  onPlayError: () => void;
  onOpenDetailHook: (hook: ViralHook, idx: number) => void;
  onRegenerateHooks: () => void;
}

export const HookListSection: React.FC<HookListSectionProps> = ({
  hooks,
  generatingHooks,
  selectedClipIndex,
  selectedClip,
  downloadedVideo,
  selectedHookIndex,
  playingHookIndex,
  inlineHookProgress,
  isMuted,
  activeHookVideoRef,
  onSelectHook,
  onTogglePlayHook,
  onToggleMute,
  onProgressUpdate,
  onPlayError,
  onOpenDetailHook,
  onRegenerateHooks,
}) => {
  return (
    <>
      {/* AI Hooks Generator - Loading State */}
      {generatingHooks && (
        <div id="hook-generator-section" className="hook-loading-panel">
          <div className="hook-loading-spinner" />
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>
            Sedang Meracik 5 Hook Alternatif AI...
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '480px' }}>
            AI sedang menganalisis transkrip dan menyiapkan variasi hook pembuka beserta thumbnail untuk klip #{selectedClipIndex !== null ? selectedClipIndex + 1 : 1}. Mohon tunggu sejenak.
          </div>
        </div>
      )}

      {/* AI Hooks Generator - Results */}
      {hooks.length > 0 && (
        <div
          id="hook-generator-section"
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border)',
            scrollMarginTop: '80px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ice)' }}>
                💡 5 Inspirasi Hook Pembuka Alternatif {selectedClipIndex !== null ? `(Klip #${selectedClipIndex + 1})` : ''}
              </span>
              {selectedClip && (
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  🎯 Momen sumber: "{selectedClip.title}" ({formatTimecode(selectedClip.start)} - {formatTimecode(selectedClip.end)})
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn ghost small"
              disabled={generatingHooks}
              onClick={onRegenerateHooks}
              title="Buat ulang 5 hook alternatif baru untuk klip ini"
            >
              🔄 Regenerasi Hook Baru
            </button>
          </div>

          <div className="opus-clips-grid" style={{ marginTop: '16px' }}>
            {hooks.map((h, hIdx) => (
              <HookCard
                key={h.id || hIdx}
                hook={h}
                hIdx={hIdx}
                isSelected={selectedHookIndex === hIdx}
                isPlaying={playingHookIndex === hIdx}
                progress={inlineHookProgress[hIdx] ?? 0}
                isMuted={isMuted}
                selectedClipThumbnailUrl={selectedClip?.thumbnailUrl}
                downloadedVideoThumbnailUrl={downloadedVideo?.thumbnailUrl}
                downloadedVideoId={downloadedVideo?.videoId}
                videoRef={(el) => {
                  if (el) activeHookVideoRef.current = el;
                }}
                onSelect={() => onSelectHook(selectedHookIndex === hIdx ? null : hIdx)}
                onTogglePlay={() => onTogglePlayHook(hIdx)}
                onToggleMute={onToggleMute}
                onProgressUpdate={(pct) => onProgressUpdate(hIdx, pct)}
                onPlayError={onPlayError}
                onOpenDetail={() => onOpenDetailHook(h, hIdx)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
