import React from 'react';
import type { DownloadedVideo, ViralClip, ViralHook } from '../../../types';
import { ClipCard } from './ClipCard';
import { HookCtaBanner } from './HookCtaBanner';
import { HookListSection } from './HookListSection';

interface Step2ClipsSelectionProps {
  step: number;
  setStep: (step: number) => void;
  clips: ViralClip[];
  selectedClipIndices: number[];
  selectedClipIndex: number | null;
  selectClip: (idx: number) => void;
  selectAllClips: () => void;
  clearSelectedClips: () => void;
  generatingClips: boolean;
  rerenderingClipPreviews: boolean;
  progressLabel: string;
  rerenderClipPreviews: () => void;
  refreshClips: () => void;
  downloadedVideo: DownloadedVideo | null;
  // Inline playback state
  playingClipIndex: number | null;
  inlineProgress: { [idx: number]: number };
  isMuted: boolean;
  activeVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onTogglePlayClip: (idx: number) => void;
  onToggleMute: () => void;
  onUpdateClipProgress: (idx: number, pct: number) => void;
  onClipPlayError: () => void;
  onOpenClipDetail: (clip: ViralClip, idx: number) => void;
  // Hooks
  hooks: ViralHook[];
  selectedHookIndex: number | null;
  playingHookIndex: number | null;
  inlineHookProgress: { [idx: number]: number };
  generatingHooks: boolean;
  activeHookVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  selectHook: (idx: number | null) => void;
  onTogglePlayHook: (idx: number) => void;
  onUpdateHookProgress: (idx: number, pct: number) => void;
  onHookPlayError: () => void;
  onOpenHookDetail: (hook: ViralHook, idx: number) => void;
  onTriggerHookCta: (refresh?: boolean) => void;
  onScrollToHookSection: () => void;
}

export const Step2ClipsSelection: React.FC<Step2ClipsSelectionProps> = ({
  step,
  setStep,
  clips,
  selectedClipIndices,
  selectedClipIndex,
  selectClip,
  selectAllClips,
  clearSelectedClips,
  generatingClips,
  rerenderingClipPreviews,
  progressLabel,
  rerenderClipPreviews,
  refreshClips,
  downloadedVideo,
  playingClipIndex,
  inlineProgress,
  isMuted,
  activeVideoRef,
  onTogglePlayClip,
  onToggleMute,
  onUpdateClipProgress,
  onClipPlayError,
  onOpenClipDetail,
  hooks,
  selectedHookIndex,
  playingHookIndex,
  inlineHookProgress,
  generatingHooks,
  activeHookVideoRef,
  selectHook,
  onTogglePlayHook,
  onUpdateHookProgress,
  onHookPlayError,
  onOpenHookDetail,
  onTriggerHookCta,
  onScrollToHookSection,
}) => {
  const selectedClip = selectedClipIndex !== null ? clips[selectedClipIndex] : undefined;

  return (
    <div className={`card ${step !== 2 ? 'hidden' : ''}`}>
      <div className="card-head">
        <div className="card-head-title">
          <h2>2. Rekomendasi Klip Viral &amp; Analisis Skor</h2>
          <span className="head-badge">
            {selectedClipIndices.length > 0
              ? `${selectedClipIndices.length}/${clips.length} Dipilih`
              : `${clips.length} Klip Tersedia`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <p className="muted" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
            Pilih satu atau beberapa klip terbaik (bisa multi-select). Urutan klik menentukan urutan klip di video akhir.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              id="btn-rerender-previews"
              className="btn ghost"
              disabled={generatingClips || rerenderingClipPreviews}
              title="Render ulang file preview video 9:16 dari awal tanpa memanggil ulang LLM"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={rerenderClipPreviews}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: rerenderingClipPreviews ? 'spin 1s linear infinite' : 'none',
                }}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {rerenderingClipPreviews ? 'Merender Preview…' : 'Render Ulang Preview'}
            </button>

            <button
              type="button"
              id="btn-refresh-clips"
              className="btn ghost"
              disabled={generatingClips || rerenderingClipPreviews}
              title="Generate ulang rekomendasi klip dan render preview dari awal (bypass cache)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                fontSize: '13px',
                padding: '7px 14px',
              }}
              onClick={refreshClips}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: generatingClips ? 'spin 1s linear infinite' : 'none',
                }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {generatingClips ? 'Menganalisis Ulang…' : 'Generate Ulang'}
            </button>
          </div>
        </div>
      </div>

      {(generatingClips || rerenderingClipPreviews) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(50, 130, 184, 0.12)',
          border: '1px solid rgba(50, 130, 184, 0.3)',
          color: '#BBE1FA',
          fontSize: '13px',
        }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#F1F5F9' }}>
              {generatingClips ? 'Sedang Menganalisis Ulang & Merender Preview Klip…' : 'Sedang Merender Ulang Preview Video 9:16…'}
            </strong>
            <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>
              {progressLabel || 'Proses pemotongan video FFmpeg sedang berjalan, preview baru akan segera diperbarui.'}
            </div>
          </div>
        </div>
      )}

      {clips.length === 0 ? (
        <div className="empty-recent-placeholder">
          Belum ada klip yang dianalisis. Kembali ke Langkah 1 dan masukkan URL video Anda.
        </div>
      ) : (
        <>
          {/* Multi-select info bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginBottom: '16px',
            background: 'rgba(50, 130, 184, 0.08)',
            border: '1px solid rgba(50, 130, 184, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: '#94A3B8',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              💡 <strong style={{ color: '#BBE1FA' }}>Klik klip untuk memilih</strong>
              <span>(urutan klik = urutan video)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {selectedClipIndices.length > 0 && (
                <span style={{ color: '#3282B8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {selectedClipIndices.length} klip dipilih
                  {' · '}
                  {Math.round(
                    selectedClipIndices
                      .map((i) => clips[i])
                      .filter(Boolean)
                      .reduce((sum, c) => sum + (c!.duration || (c!.end - c!.start)), 0)
                  )}s total
                </span>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ fontSize: '11px', padding: '3px 8px', height: 'auto' }}
                  onClick={selectAllClips}
                  title="Pilih semua klip rekomendasi"
                >
                  Pilih Semua
                </button>
                {selectedClipIndices.length > 0 && (
                  <button
                    type="button"
                    className="btn ghost small"
                    style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#EF4444' }}
                    onClick={clearSelectedClips}
                    title="Hapus semua pilihan klip"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="opus-clips-grid">
            {clips.map((clip, idx) => {
              const isSelected = selectedClipIndices.includes(idx);
              const selectionOrder = selectedClipIndices.indexOf(idx);
              const isPlaying = playingClipIndex === idx;
              const progress = inlineProgress[idx] ?? 0;

              return (
                <ClipCard
                  key={clip.id || idx}
                  clip={clip}
                  idx={idx}
                  isSelected={isSelected}
                  selectionOrder={selectionOrder}
                  isPlaying={isPlaying}
                  progress={progress}
                  isMuted={isMuted}
                  downloadedVideoThumbnailUrl={downloadedVideo?.thumbnailUrl}
                  downloadedVideoId={downloadedVideo?.videoId}
                  videoRef={(el) => {
                    if (el) activeVideoRef.current = el;
                  }}
                  onSelect={() => selectClip(idx)}
                  onTogglePlay={() => onTogglePlayClip(idx)}
                  onToggleMute={onToggleMute}
                  onProgressUpdate={(pct) => onUpdateClipProgress(idx, pct)}
                  onPlayError={onClipPlayError}
                  onOpenDetail={() => onOpenClipDetail(clip, idx)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Animated Attention-Grabbing Hook CTA Banner */}
      <HookCtaBanner
        selectedClip={selectedClip}
        selectedClipIndex={selectedClipIndex}
        hooksCount={hooks.length}
        generatingHooks={generatingHooks}
        onTriggerHookCta={() => onTriggerHookCta(false)}
        onScrollToHookSection={onScrollToHookSection}
      />

      {/* AI Hooks Generator - Results & Loading */}
      <HookListSection
        hooks={hooks}
        generatingHooks={generatingHooks}
        selectedClipIndex={selectedClipIndex}
        selectedClip={selectedClip}
        downloadedVideo={downloadedVideo}
        selectedHookIndex={selectedHookIndex}
        playingHookIndex={playingHookIndex}
        inlineHookProgress={inlineHookProgress}
        isMuted={isMuted}
        activeHookVideoRef={activeHookVideoRef}
        onSelectHook={selectHook}
        onTogglePlayHook={onTogglePlayHook}
        onToggleMute={onToggleMute}
        onProgressUpdate={onUpdateHookProgress}
        onPlayError={onHookPlayError}
        onOpenDetailHook={onOpenHookDetail}
        onRegenerateHooks={() => onTriggerHookCta(true)}
      />

      {/* Navigation Footer */}
      <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn ghost" onClick={() => setStep(1)}>
          ← Kembali ke Langkah 1
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={selectedClipIndices.length === 0}
          onClick={() => setStep(3)}
        >
          {selectedClipIndices.length > 0
            ? `Lanjut ke Pengaturan Video (${selectedClipIndices.length} Klip Dipilih) →`
            : 'Pilih Minimal 1 Klip untuk Lanjut'}
        </button>
      </div>
    </div>
  );
};
