import React, { lazy, Suspense, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { PlayerRef } from '@remotion/player';
import type { RemotionStudioCompositionProps } from './RemotionStudioComposition';
import { InteractiveTimeline, type BrollBlock } from './InteractiveTimeline';
import { MusicLibraryPanel } from './MusicLibraryPanel';
import { CanvasOverlayEditor } from './CanvasOverlayEditor';
import { resolveAudioStreamUrl } from '../../lib/audio-catalog';
import type { useClipTransform } from '../../hooks/useClipTransform';
import type { useAiProducer } from '../../hooks/useAiProducer';
import { resolveBrollMediaAsset, resolveStockBrollUrl } from '../../lib/stock-broll';
import { resolveClientOutroPreset } from '../../lib/outro-presets';
import { resolvePresetIdFromHook } from '../../lib/visual-presets';
import { api } from '../../services/api';

const RemotionPlayer = lazy(() => import('@remotion/player').then((module) => ({ default: module.Player })));
const RemotionStudioComposition = lazy(() => import('./RemotionStudioComposition').then((module) => ({ default: module.RemotionStudioComposition })));


// =============================================================================
// Static Presets Data & Preset Card Component
// =============================================================================

const HOOK_PRESETS = [
  { id: 'kinetic-punch', label: 'Kinetic Punch', emoji: '⚡', desc: 'Impact zoom masuk dinamis' },
  { id: 'curiosity-stack', label: 'Curiosity Stack', emoji: '🤔', desc: 'Suspensi 4 baris bikin penasaran' },
  { id: 'bold-impact', label: 'Bold Impact', emoji: '🔥', desc: 'Frame kuning tebal kontras tinggi' },
  { id: 'story-slide', label: 'Story Slide', emoji: '📖', desc: 'Narasi masuk halus & bercerita' },
];

const SUBTITLE_PRESETS = [
  { id: 'beast', label: 'MrBeast', emoji: '🟡', desc: 'Yellow pop, stroke hitam tebal', color: '#FFE600' },
  { id: 'hormozi', label: 'Hormozi', emoji: '🟢', desc: 'Kotak hijau & putih kontras tinggi', color: '#10B981' },
  { id: 'clean', label: 'Clean Modern', emoji: '⬜', desc: 'Frosted glass minimalis modern', color: '#94A3B8' },
];

interface PresetCardProps {
  isActive: boolean;
  emoji: string;
  label: string;
  desc: string;
  accentColor?: string;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const PresetCard: React.FC<PresetCardProps> = ({
  isActive,
  emoji,
  label,
  desc,
  accentColor,
  onClick,
  onDragStart,
}) => {
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: isActive ? 'rgba(50, 130, 184, 0.16)' : 'var(--bg-input)',
        border: `1.5px solid ${isActive ? 'var(--accent)' : accentColor ? `${accentColor}44` : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        position: 'relative',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: isActive ? '0 0 12px rgba(50, 130, 184, 0.25)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'var(--border-focus)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = accentColor ? `${accentColor}44` : 'var(--border)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '20px' }}>{emoji}</span>
        {isActive && (
          <span
            style={{
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '999px',
              letterSpacing: '0.04em',
            }}
          >
            ✓ Aktif
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 800,
          color: isActive ? '#FFFFFF' : 'var(--text-main)',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '10.5px', color: 'var(--text-sub)', lineHeight: 1.3 }}>
        {desc}
      </div>
    </div>
  );
};

interface RemotionVideoEditorProps {
  transform: ReturnType<typeof useClipTransform>;
  producer: ReturnType<typeof useAiProducer>;
  onOpenFullProducerDrawer: () => void;
}

export const RemotionVideoEditor: React.FC<RemotionVideoEditorProps> = ({
  transform,
  producer,
  onOpenFullProducerDrawer,
}) => {
  const {
    aspectRatio,
    setAspectRatio,
    templateId,
    setTemplateId,
    subtitleSize,
    setSubtitleSize,
    selectedVisualPreset,
    setSelectedVisualPreset,
    customHookText,
    setCustomHookText,
    customHookTag,
    setCustomHookTag,
    enableHookIntro,
    setEnableHookIntro,
    selectedHookLayout,
    selectedHookAnimation,
    selectedHookTypography,
    selectedHookBadgePreset,
    selectedHookBadgeColor,
    selectedHookIndex,
    hooks,
    enableBroll,
    setEnableBroll,
    brollPlacements,
    updateBrollPlacement,
    enableIntroOutro,
    setEnableIntroOutro,
    outroPreset,
    outroCtaText,
    outroButtonText,
    outroDuration,
    outroChannelName,
    outroLogoUrl,
    clips,
    selectedClipIndex,
    downloadedVideo,
    transcript,
    dynamicStyles,
    dynamicOverlays,
    setDynamicOverlays,
    addDynamicOverlay,
    removeDynamicOverlay,
    startTransform,
    runningTransform,
    selectedMusicTrack,
    setSelectedMusicTrack,
    musicVolume,
    setMusicVolume,
    autoDucking,
    setAutoDucking,
  } = transform;

  const [promptInput, setPromptInput] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'hook' | 'subtitle' | 'music'>('editor');
  const [timelineZoom, setTimelineZoom] = useState(1);

  // playerRef for timeline sync
  const playerRef = useRef<PlayerRef | null>(null);

  // Drop zone state
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false);

  // Canvas Overlay Editor
  const [canvasEditorOpen, setCanvasEditorOpen] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [faceFocusPoints, setFaceFocusPoints] = useState<Array<{ time: number; x: number; y: number }>>([]);
  const [faceSourceAspectRatio, setFaceSourceAspectRatio] = useState(16 / 9);
  const [faceFocusStatus, setFaceFocusStatus] = useState<'idle' | 'analyzing' | 'ready' | 'no-face' | 'error'>('idle');
  const selectedOutroPreset = resolveClientOutroPreset(outroPreset);

  const fps = 30;

  // Sync currentTimeSec from player frame
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentTimeSec(e.detail.frame / fps);
    };
    player.addEventListener('frameupdate', onFrameUpdate as any);
    return () => player.removeEventListener('frameupdate', onFrameUpdate as any);
  }, [fps]);

  // Selected clip resolution
  const activeClip =
    selectedClipIndex !== null && clips[selectedClipIndex]
      ? clips[selectedClipIndex]
      : clips[0] || undefined;

  const clipBaseDuration = activeClip?.duration || 30;
  const selectedHook = selectedHookIndex !== null ? hooks[selectedHookIndex] : undefined;
  const hookSourceStart = selectedHook?.source?.start;
  const hookSourceEnd = hookSourceStart !== undefined && selectedHook?.source?.end !== undefined
    ? Math.min(selectedHook.source.end, hookSourceStart + 3.5)
    : undefined;
  const hookDurationSec = hookSourceStart !== undefined && hookSourceEnd !== undefined && hookSourceEnd > hookSourceStart
    ? hookSourceEnd - hookSourceStart
    : Math.min(3.5, Math.max(0.5, selectedHook?.finalDurationSeconds ?? 3.5));
  const clipStart = activeClip?.start ?? 0;
  const clipEnd = activeClip?.end ?? (clipStart + clipBaseDuration);
  const isRenderedOutput = Boolean(transform.transformResult?.videoUrl);
  const sequenceHookIntro = enableHookIntro && transform.outputMode === 'reel' && !isRenderedOutput;
  // Hook and selected clip are independent timeline segments. The clip always
  // begins at its selected source range, even when it overlaps the hook range.
  const sourceContentStartSec = clipStart;
  const sourceRelativeContentStartSec = 0;
  const baseVideoDurationSec =
    transform.transformResult?.duration ||
    (typeof transform.transformResult?.outputVideo === 'object'
      ? (transform.transformResult.outputVideo as any)?.durationSeconds
      : undefined) ||
    (transform.outputMode === 'narration' && transform.ttsDurationSeconds
      ? Math.max(clipBaseDuration, transform.ttsDurationSeconds)
      : clipBaseDuration);
  const contentDurationSec = sequenceHookIntro && activeClip
    ? Math.max(0.5, clipEnd - sourceContentStartSec)
    : baseVideoDurationSec;
  const videoDurationSec = contentDurationSec;
  const durationInFrames = Math.max(90, Math.round((contentDurationSec + (sequenceHookIntro ? hookDurationSec : 0)) * fps));
  const effectiveDurationSec = durationInFrames / fps;
  const timelineContentOffsetSec = sequenceHookIntro ? hookDurationSec : 0;
  const effectiveOutroDurationSec = Math.min(
    Math.max(0, outroDuration || 3),
    effectiveDurationSec,
  );

  // Derive real voice-synced transcript captions for the active clip
  const clipCaptions = useMemo(() => {
    if (!transcript?.segments?.length || !activeClip) return [];

    // Filter segments overlapping this clip range
    const segmentsInRange = transcript.segments.filter(
      (s) => s.end > sourceContentStartSec && s.start < clipEnd,
    );

    // Flatten words in range with timestamps rebased to the first visible clip frame.
    const flatWords: Array<{ word: string; start: number; end: number }> = [];
    for (const seg of segmentsInRange) {
      if (seg.words && seg.words.length > 0) {
        for (const w of seg.words) {
          if (w.end > sourceContentStartSec && w.start < clipEnd) {
            flatWords.push({
              word: w.word,
              start: Math.max(0, Number((w.start - sourceContentStartSec).toFixed(2))),
              end: Math.max(0.05, Number((w.end - sourceContentStartSec).toFixed(2))),
            });
          }
        }
      } else {
        const words = (seg.text || '').trim().split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.1, seg.end - seg.start);
        const wDur = segDur / Math.max(1, words.length);
        words.forEach((w, i) => {
          const wStart = seg.start + i * wDur;
          const wEnd = seg.start + (i + 1) * wDur;
          if (wEnd > sourceContentStartSec && wStart < clipEnd) {
            flatWords.push({
              word: w,
              start: Math.max(0, Number((wStart - sourceContentStartSec).toFixed(2))),
              end: Math.max(0.05, Number((wEnd - sourceContentStartSec).toFixed(2))),
            });
          }
        });
      }
    }

    if (flatWords.length === 0) return [];

    // Group into natural caption phrases of 3–5 words per event (matches Remotion Caption component)
    const captions: Array<{
      start: number;
      end: number;
      text: string;
      highlightWords?: string[];
      wordTimings: Array<{ word: string; start: number; end: number }>;
    }> = [];

    const CHUNK_SIZE = 4;
    for (let i = 0; i < flatWords.length; i += CHUNK_SIZE) {
      const chunk = flatWords.slice(i, i + CHUNK_SIZE);
      const start = chunk[0]!.start;
      const end = chunk[chunk.length - 1]!.end;
      const text = chunk.map((w) => w.word).join(' ');
      const highlightWords = chunk
        .filter((w) => /\d/.test(w.word) || w.word.length >= 7)
        .map((w) => w.word);

      captions.push({
        start,
        end,
        text,
        highlightWords,
        wordTimings: chunk,
      });
    }

    return captions;
  }, [transcript, activeClip, sourceContentStartSec, clipEnd]);

  // Derive real voice-synced captions for narration mode (AI script sections)
  const narrationCaptions = useMemo(() => {
    if (transform.outputMode !== 'narration' || !transform.scriptDraft?.sections?.length) {
      return [];
    }

    const sections = transform.scriptDraft.sections;
    const ttsSections = transform.ttsSections;

    const captions: Array<{
      start: number;
      end: number;
      text: string;
      highlightWords?: string[];
      wordTimings: Array<{ word: string; start: number; end: number }>;
    }> = [];

    // If we have precise TTS section timings:
    if (ttsSections && ttsSections.length === sections.length) {
      let offset = 0;
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx]!;
        const timing = ttsSections[sIdx]!;
        const secDur = timing.durationSeconds || Math.max(2, sec.text.split(/\s+/).length / 2.5);
        const secStart = offset;
        const secEnd = offset + secDur;
        offset = secEnd;

        // Skip hook in captions if hook intro card is enabled, to avoid duplicate text
        if (enableHookIntro && (sec.type === 'hook' || sIdx === 0)) {
          continue;
        }

        const words = (sec.text || '').trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        const rawTimings = timing.wordTimings ?? [];
        if (rawTimings.length > 0) {
          const CHUNK_SIZE = 4;
          for (let i = 0; i < words.length; i += CHUNK_SIZE) {
            const chunk = words.slice(i, i + CHUNK_SIZE);
            const startIdx = Math.min(rawTimings.length - 1, Math.floor((i / words.length) * rawTimings.length));
            const endIdx = Math.min(rawTimings.length - 1, Math.floor(((i + chunk.length) / words.length) * rawTimings.length) - 1);
            const first = rawTimings[startIdx]!;
            const last = rawTimings[Math.max(startIdx, endIdx)]!;
            const chunkTimings = rawTimings.slice(startIdx, Math.max(startIdx + 1, endIdx + 1));

            const alignedTimings = chunk.map((word, k) => {
              const tStartIdx = Math.min(chunkTimings.length - 1, Math.floor((k / chunk.length) * chunkTimings.length));
              const tEndIdx = Math.min(chunkTimings.length - 1, Math.floor(((k + 1) / chunk.length) * chunkTimings.length) - 1);
              const wFirst = chunkTimings[tStartIdx]!;
              const wLast = chunkTimings[Math.max(tStartIdx, tEndIdx)]!;
              return {
                word,
                start: Number(wFirst.start.toFixed(3)),
                end: Number(Math.max(wLast.end, wFirst.start + 0.05).toFixed(3)),
              };
            });

            captions.push({
              start: Number(first.start.toFixed(2)),
              end: Number(Math.max(last.end, first.start + 0.1).toFixed(2)),
              text: chunk.join(' '),
              highlightWords: chunk.filter((w) => /\d/.test(w) || w.length >= 7),
              wordTimings: alignedTimings,
            });
          }
        } else {
          // Fallback: distribute evenly across secDur
          const CHUNK_SIZE = 4;
          for (let i = 0; i < words.length; i += CHUNK_SIZE) {
            const chunk = words.slice(i, i + CHUNK_SIZE);
            const cStart = secStart + (i / words.length) * secDur;
            const cEnd = secStart + (Math.min(i + CHUNK_SIZE, words.length) / words.length) * secDur;
            const wDur = (cEnd - cStart) / Math.max(1, chunk.length);
            const alignedTimings = chunk.map((word, k) => ({
              word,
              start: Number((cStart + k * wDur).toFixed(2)),
              end: Number((cStart + (k + 1) * wDur).toFixed(2)),
            }));
            captions.push({
              start: Number(cStart.toFixed(2)),
              end: Number(cEnd.toFixed(2)),
              text: chunk.join(' '),
              highlightWords: chunk.filter((w) => /\d/.test(w) || w.length >= 7),
              wordTimings: alignedTimings,
            });
          }
        }
      }
    } else {
      // Estimated distribution across estimated duration
      let curSecTime = 0;
      const totalWords = sections.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
      const estTotalDur = transform.ttsDurationSeconds || Math.max(15, totalWords / 2.5);

      sections.forEach((sec, sIdx) => {
        const words = (sec.text || '').trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return;
        const secRatio = words.length / Math.max(1, totalWords);
        const secDur = secRatio * estTotalDur;
        const secStart = curSecTime;
        const secEnd = curSecTime + secDur;
        curSecTime = secEnd;

        if (enableHookIntro && (sec.type === 'hook' || sIdx === 0)) {
          return;
        }

        const CHUNK_SIZE = 4;
        for (let i = 0; i < words.length; i += CHUNK_SIZE) {
          const chunk = words.slice(i, i + CHUNK_SIZE);
          const cStart = secStart + (i / words.length) * secDur;
          const cEnd = secStart + (Math.min(i + CHUNK_SIZE, words.length) / words.length) * secDur;
          const wDur = (cEnd - cStart) / Math.max(1, chunk.length);
          const alignedTimings = chunk.map((word, k) => ({
            word,
            start: Number((cStart + k * wDur).toFixed(2)),
            end: Number((cStart + (k + 1) * wDur).toFixed(2)),
          }));
          captions.push({
            start: Number(cStart.toFixed(2)),
            end: Number(cEnd.toFixed(2)),
            text: chunk.join(' '),
            highlightWords: chunk.filter((w) => /\d/.test(w) || w.length >= 7),
            wordTimings: alignedTimings,
          });
        }
      });
    }

    return captions;
  }, [
    transform.outputMode,
    transform.scriptDraft,
    transform.ttsSections,
    transform.ttsDurationSeconds,
    enableHookIntro,
  ]);

  // Auto-synthesize TTS narration if user in narration mode and audio not yet available
  useEffect(() => {
    if (
      transform.outputMode === 'narration' &&
      !transform.ttsAudioUrl &&
      !transform.synthesizingTts &&
      transform.scriptDraft?.sections?.length &&
      !transform.scriptError
    ) {
      transform.startSynthesizeTts().catch((err) => {
        console.warn('[RemotionVideoEditor] Auto TTS synthesis error:', err);
      });
    }
  }, [
    transform.outputMode,
    transform.ttsAudioUrl,
    transform.synthesizingTts,
    transform.scriptDraft,
    transform.scriptError,
    transform.startSynthesizeTts,
  ]);

  // Dimensions based on aspect ratio
  const { compWidth, compHeight, playerAspectRatio } = useMemo(() => {
    switch (aspectRatio) {
      case '16:9':
        return { compWidth: 1920, compHeight: 1080, playerAspectRatio: '16/9' };
      case '1:1':
        return { compWidth: 1080, compHeight: 1080, playerAspectRatio: '1/1' };
      default: // 9:16
        return { compWidth: 1080, compHeight: 1920, playerAspectRatio: '9/16' };
    }
  }, [aspectRatio]);

  // Video source — urutan prioritas:
  // 1. Video sudah dirender (hasil transform)
  // 2. previewUrl klip dari server (ada jika clip sudah di-preview)
  // 3. Source video yang didownload via /api/media/{videoId}/downloads/{videoId}.mp4
  const rawPreviewUrl = activeClip?.previewUrl || '';
  const videoSrc =
    transform.transformResult?.videoUrl ||
    (rawPreviewUrl || undefined) ||
    (downloadedVideo?.videoId
      ? `/api/media/${downloadedVideo.videoId}/downloads/${downloadedVideo.videoId}.mp4`
      : undefined);

  useEffect(() => {
    const videoId = downloadedVideo?.videoId;
    const downloadUrl = `/api/media/${videoId}/downloads/${videoId}.mp4`;
    const isOriginalSource = Boolean(videoSrc && (videoSrc === rawPreviewUrl || videoSrc.includes(downloadUrl)));
    if (!transform.autoReframe || !videoId || !isOriginalSource || aspectRatio !== '9:16') {
      setFaceFocusPoints([]);
      setFaceFocusStatus('idle');
      return;
    }

    let active = true;
    const controller = new AbortController();
    setFaceFocusPoints([]);
    setFaceFocusStatus('analyzing');
    api.analyzeFaceFocus({ videoId, start: clipStart, end: clipEnd }, controller.signal)
      .then((analysis) => {
        if (!active) return;
        setFaceFocusPoints(analysis.points);
        if (analysis.sourceAspectRatio) setFaceSourceAspectRatio(analysis.sourceAspectRatio);
        setFaceFocusStatus(analysis.points.length > 0 ? 'ready' : 'no-face');
      })
      .catch(() => {
        if (active) setFaceFocusStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [transform.autoReframe, downloadedVideo?.videoId, videoSrc, aspectRatio, clipStart, clipEnd]);

  const thumbnailUrl =
    activeClip?.thumbnailUrl ||
    downloadedVideo?.thumbnailUrl ||
    (downloadedVideo?.videoId
      ? `https://img.youtube.com/vi/${downloadedVideo.videoId}/hqdefault.jpg`
      : undefined);

  // Debug log di development
  if (import.meta.env.DEV) {
    console.debug('[RemotionEditor] videoSrc:', videoSrc, '| thumbnailUrl:', thumbnailUrl, '| rawPreviewUrl:', rawPreviewUrl);
  }

  // Normalized B-Roll Placements: rebased to 0 relative to activeClip.start for live player sync
  const normalizedBrollList = useMemo(() => {
    return brollPlacements
      .filter((b) => b.enabled !== false)
      .map((b, i) => {
        const rawStart = Number((b as any).start ?? (b as any).startSec ?? (b as any).cue?.start ?? 0);
        const rawEnd = Number((b as any).end ?? (b as any).endSec ?? (b as any).cue?.end ?? (rawStart + 3));
        const query = (b as any).query ?? (b as any).cue?.query ?? 'B-Roll';
        const { videoUrl, posterUrl } = resolveBrollMediaAsset(b);
        const assetUrl = videoUrl || resolveStockBrollUrl(query);

        // Rebase logic:
        // Case 1: rawStart is absolute in the source video (>= clipStart - 0.5)
        // Case 2: rawStart is already relative / 0-based within clip duration (< videoDurationSec)
        let relStart = rawStart;
        let relEnd = rawEnd;

        if (clipStart > 0 && rawStart >= clipStart - 0.5) {
          relStart = Math.max(0, Number((rawStart - clipStart).toFixed(2)));
          relEnd = Math.min(videoDurationSec, Number((rawEnd - clipStart).toFixed(2)));
        } else if (rawStart >= videoDurationSec && clipStart > 0) {
          relStart = Math.max(0, Number((rawStart - clipStart).toFixed(2)));
          relEnd = Math.min(videoDurationSec, Number((rawEnd - clipStart).toFixed(2)));
        } else {
          relStart = Math.max(0, Number(rawStart.toFixed(2)));
          relEnd = Math.min(videoDurationSec, Number(rawEnd.toFixed(2)));
        }

        const durationSec = relEnd > relStart
          ? Math.max(1, Number((relEnd - relStart).toFixed(2)))
          : 0;

        return {
          id: (b as any).id || `broll-${i}`,
          start: relStart,
          end: relEnd > relStart ? relEnd : relStart,
          durationSec,
          query,
          assetUrl,
          posterUrl,
          rawStart,
          rawEnd,
        };
      })
      .filter((b) => b.end > b.start && b.start < videoDurationSec);
  }, [brollPlacements, clipStart, videoDurationSec, sequenceHookIntro, sourceRelativeContentStartSec]);

  // BrollBlocks derived for InteractiveTimeline
  const brollBlocks: BrollBlock[] = useMemo(
    () =>
      normalizedBrollList.map((b) => ({
        id: b.id,
        startSec: b.start + timelineContentOffsetSec,
        durationSec: b.durationSec,
        query: b.query,
      })),
    [normalizedBrollList, timelineContentOffsetSec],
  );

  // AI Overlay blocks derived from dynamicOverlays for InteractiveTimeline
  const aiOverlayBlocks = useMemo(
    () =>
      dynamicOverlays.map((o) => ({
        id: o.id,
        startSec: o.start + timelineContentOffsetSec,
        durationSec: Math.max(0.5, o.end - o.start),
        label: o.content ? (o.content.length > 24 ? o.content.slice(0, 24) + '…' : o.content) : o.type,
        overlayType: o.type,
      })),
    [dynamicOverlays, timelineContentOffsetSec],
  );

  // Broll Placements memoized prop
  const brollPlacementsProp = useMemo(
    () =>
      normalizedBrollList.map((b) => ({
        start: b.start,
        end: b.end,
        query: b.query,
        assetUrl: b.assetUrl,
        posterUrl: b.posterUrl,
      })),
    [normalizedBrollList],
  );

  // Hook Intro sub-props
  const hookIntroProps = useMemo(
    () => {
      const visualPreset = selectedVisualPreset === 'auto'
        ? resolvePresetIdFromHook(selectedHook?.hookType, selectedHook?.angle)
        : selectedVisualPreset;
      return ({
      enableHookIntro,
      hookText: customHookText || selectedHook?.hookText || activeClip?.title || 'Trik Rahasia Meningkatkan View!',
      hookTag: customHookTag || selectedHook?.tag || '🔥 JANGAN DI-SKIP',
      hookThumbnailUrl: selectedHook?.thumbnailUrl || selectedHook?.previewUrl?.replace(/\.mp4(\?.*)?$/, '.jpg$1') || thumbnailUrl,
      // previewUrl is a standalone extracted segment and starts at t=0;
      // only use it as the intro source, never apply sourceRange to it again.
      hookPreviewVideoSrc: selectedHook?.previewUrl?.match(/\.mp4(?:\?.*)?$/i) ? selectedHook.previewUrl : undefined,
      visualPreset,
      hookLayout: selectedHookLayout,
      hookAnimation: selectedHookAnimation,
      hookTypography: selectedHookTypography,
      hookHighlightWords: selectedHook?.highlightWords,
      hookDurationSec,
      sequenceHookIntro,
      badgePreset: selectedHookBadgePreset || 'neon-outline',
      badgeColor: selectedHookBadgeColor || 'cyan',
      });
    },
    [
      enableHookIntro,
      customHookText,
      customHookTag,
      activeClip?.title,
      thumbnailUrl,
      selectedHook?.previewUrl,
      selectedVisualPreset,
      selectedHookLayout,
      selectedHookAnimation,
      selectedHookTypography,
      selectedHookBadgePreset,
      selectedHookBadgeColor,
      selectedHookIndex,
      hooks,
      selectedHook,
      hookDurationSec,
      sequenceHookIntro,
    ],
  );

  // Outro sub-props
  const outroProps = useMemo(
    () => ({
      enableIntroOutro,
      outroPreset,
      outroCtaText: outroCtaText.trim() || selectedOutroPreset.defaultCtaText,
      outroButtonText: outroButtonText.trim() || selectedOutroPreset.defaultButtonText,
      outroDuration: effectiveOutroDurationSec,
      channelName: outroChannelName || downloadedVideo?.channelTitle || '@kreator',
      outroLogoUrl: outroLogoUrl || undefined,
    }),
    [
      enableIntroOutro,
      outroPreset,
      outroCtaText,
      outroButtonText,
      outroDuration,
      effectiveOutroDurationSec,
      selectedOutroPreset,
      outroChannelName,
      downloadedVideo?.channelTitle,
      outroLogoUrl,
    ],
  );

  // Audio sub-props
  const audioProps = useMemo(
    () => ({
      musicSrc: resolveAudioStreamUrl(selectedMusicTrack?.streamUrl),
      musicVolume: musicVolume / 100,
      autoDucking,
      sourceVolume: (transform.sourceVolume ?? 25) / 100,
      narrationAudioUrl: transform.outputMode === 'narration' ? (transform.ttsAudioUrl || undefined) : undefined,
      narrationVolume: 1,
      outputMode: transform.outputMode,
    }),
    [
      selectedMusicTrack?.streamUrl,
      musicVolume,
      autoDucking,
      transform.sourceVolume,
      transform.outputMode,
      transform.ttsAudioUrl,
    ],
  );

  // Composition props (reactive, merged from decoupled memo blocks)
  const compositionProps: RemotionStudioCompositionProps = useMemo(
    () => ({
      videoSrc,
      thumbnailUrl,
      durationInSeconds: effectiveDurationSec,
      aspectRatio,
      ...hookIntroProps,
      templateId,
      subtitleSize,
      subtitleText: activeClip?.title,
      captions: transform.outputMode === 'narration' && narrationCaptions.length > 0 ? narrationCaptions : clipCaptions,
      isRenderedVideo: isRenderedOutput,
      enableBroll,
      brollPlacements: brollPlacementsProp,
      ...outroProps,
      ...audioProps,
      videoStartFromSec: videoSrc?.includes('/downloads/') ? clipStart : sourceRelativeContentStartSec,
      faceFocusPoints,
      faceSourceAspectRatio,
      dynamicStyles,
      dynamicOverlays,
    }),
    [
      videoSrc,
      isRenderedOutput,
      thumbnailUrl,
      effectiveDurationSec,
      aspectRatio,
      hookIntroProps,
      templateId,
      subtitleSize,
      activeClip?.title,
      transform.outputMode,
      narrationCaptions,
      clipCaptions,
      transform.transformResult?.videoUrl,
      enableBroll,
      brollPlacementsProp,
      outroProps,
      audioProps,
      clipStart,
      faceFocusPoints,
      faceSourceAspectRatio,
      dynamicStyles,
      dynamicOverlays,
    ],
  );

  // Canvas drop handler
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOverCanvas(false);
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'subtitle-preset') {
          setTemplateId(data.id);
        } else if (data.type === 'hook-preset') {
          setSelectedVisualPreset(data.id as any);
        } else if (data.type === 'music-track') {
          setSelectedMusicTrack({ id: data.id, streamUrl: data.streamUrl, title: data.label } as any);
        }
      } catch (_) {
        // ignore malformed drag data
      }
    },
    [setTemplateId, setSelectedVisualPreset],
  );

  const handleSendPrompt = (textToSend?: string) => {
    const text = (textToSend || promptInput).trim();
    if (!text || producer.isLoading) return;
    producer.sendMessage(text);
    if (!textToSend) setPromptInput('');
  };

  return (
    <div
      className="remotion-editor-shell"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-focus)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      {/* -------------------------------------------------------------------- */}
      {/* HEADER                                                                */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0F4C75, #3282B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 4px 12px rgba(50, 130, 184, 0.4)',
              flexShrink: 0,
            }}
          >
            🎬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#FFFFFF', fontWeight: 800 }}>
                Editor Video
              </h3>
              <span
                style={{
                  background: 'rgba(50, 130, 184, 0.2)',
                  border: '1px solid #3282B8',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  color: '#BBE1FA',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Live Preview
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub)' }}>
              Perubahan hook, subtitle, dan B-roll langsung terlihat di pratinjau.
            </p>
          </div>
        </div>

        {/* Aspect Ratio Switcher */}
        <div className="remotion-editor-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginRight: '4px' }}>Format:</span>
          {(['9:16', '1:1', '16:9'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspectRatio(ratio)}
              style={{
                background: aspectRatio === ratio ? 'var(--accent)' : 'var(--bg-panel)',
                color: aspectRatio === ratio ? '#FFFFFF' : 'var(--text-muted)',
                border: `1px solid ${aspectRatio === ratio ? 'var(--border-focus)' : 'var(--border)'}`,
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {ratio === '9:16' ? '📱 9:16' : ratio === '1:1' ? '⏹️ 1:1' : '🖥️ 16:9'}
            </button>
          ))}
          <button
            type="button"
            className="remotion-editor-render-button"
            disabled={runningTransform}
            onClick={() => startTransform()}
          >
            {runningTransform ? 'Merender…' : 'Render video'}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MODE & AUDIO STATUS BAR                                              */}
      {/* -------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              background: transform.outputMode === 'narration' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${transform.outputMode === 'narration' ? '#06B6D4' : '#10B981'}`,
              color: transform.outputMode === 'narration' ? '#67E8F9' : '#6EE7B7',
            }}
          >
            {transform.outputMode === 'narration' ? '🎙️ Narasi AI' : '🎞️ Klip Sorotan'}
          </span>

          {transform.outputMode === 'narration' && (
            <>
              {transform.synthesizingTts ? (
                <span style={{ color: '#67E8F9', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className="spinner" style={{ width: '12px', height: '12px' }} />
                  Sedang mensintesis narasi suara AI...
                </span>
              ) : transform.ttsAudioUrl ? (
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  ✓ Narasi AI aktif & tersinkron
                </span>
              ) : (
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                  ⚠️ Narasi belum dibuat
                </span>
              )}
            </>
          )}
        </div>

        {transform.outputMode === 'narration' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {transform.hasUnsavedScript && (
              <span style={{ fontSize: '11px', color: '#F59E0B', fontStyle: 'italic' }}>
                Naskah diedit — perbarui suara
              </span>
            )}
            <button
              type="button"
              disabled={transform.synthesizingTts || !transform.scriptDraft?.sections?.length}
              onClick={() => {
                transform.startSynthesizeTts().catch((err) => {
                  alert('Gagal mensintesis audio TTS: ' + (err instanceof Error ? err.message : String(err)));
                });
              }}
              style={{
                background: transform.ttsAudioUrl ? 'rgba(6, 182, 212, 0.15)' : 'var(--accent)',
                border: '1px solid #06B6D4',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {transform.synthesizingTts ? '⏳ Mensintesis...' : transform.ttsAudioUrl ? '🔄 Sinkronkan Ulang Suara' : '🎙️ Buat Suara Narasi AI'}
            </button>
          </div>
        )}
      </div>


      {/* -------------------------------------------------------------------- */}
      {/* ERROR BANNER — tampil langsung jika render gagal                     */}
      {/* -------------------------------------------------------------------- */}
      {transform.transformError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1.5px solid rgba(239, 68, 68, 0.55)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: '8px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#EF4444', marginBottom: '4px' }}>
              ⚠️ Render Gagal
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#FCA5A5', lineHeight: 1.55, wordBreak: 'break-word' }}>
              {transform.transformError}
            </p>
          </div>
          <button
            type="button"
            disabled={transform.runningTransform}
            onClick={() => transform.startTransform()}
            style={{
              flexShrink: 0,
              background: 'rgba(239, 68, 68, 0.20)',
              border: '1px solid rgba(239, 68, 68, 0.55)',
              color: '#FCA5A5',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🔄 Coba Ulang
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* UNIFIED 2-COLUMN LAYOUT: Left: Canvas & Timeline | Right: Inspector   */}
      {/* -------------------------------------------------------------------- */}
      <div
        className="remotion-editor-workspace"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* ================================================================== */}
        {/* LEFT / CENTER COLUMN: Player Canvas + Interactive Timeline         */}
        {/* ================================================================== */}
        <div className="remotion-editor-stage-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: 0, width: '100%' }}>
          {/* Player wrapper — position:relative so canvas overlay is absolute inside */}
          {/* Extra right padding reserved for library panel when canvas editor open */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              paddingRight: canvasEditorOpen ? '80px' : '0',
              transition: 'padding-right 0.2s ease',
            }}
          >
            <div
              className="remotion-editor-canvas-stage"
              onDragOver={(e) => {
                e.preventDefault();
                if (!canvasEditorOpen) setIsDragOverCanvas(true);
              }}
              onDragLeave={() => setIsDragOverCanvas(false)}
              onDrop={handleCanvasDrop}
              style={{
                width: '100%',
                maxWidth: aspectRatio === '9:16' ? '340px' : aspectRatio === '1:1' ? '420px' : '100%',
                aspectRatio: playerAspectRatio,
                borderRadius: 'var(--radius-lg)',
                overflow: 'visible', // allow library panel to extend outside
                border: isDragOverCanvas
                  ? '2px dashed var(--accent)'
                  : canvasEditorOpen
                    ? '2px solid rgba(50,130,184,0.7)'
                    : '2px solid var(--border)',
                boxShadow: isDragOverCanvas
                  ? 'var(--shadow-glow)'
                  : canvasEditorOpen
                    ? '0 0 0 4px rgba(50,130,184,0.18), 0 16px 40px rgba(0, 0, 0, 0.65)'
                    : '0 16px 40px rgba(0, 0, 0, 0.65)',
                background: '#0A0E14',
                position: 'relative',
                transition: 'border-color 0.15s ease, box-shadow 0.2s ease',
              }}
            >
              {/* Inner clip for the player itself */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#94A3B8' }}>Memuat pratinjau…</div>}>
                <RemotionPlayer
                  ref={playerRef}
                  component={RemotionStudioComposition}
                  inputProps={compositionProps}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  compositionWidth={compWidth}
                  compositionHeight={compHeight}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  loop
                  autoPlay={false}
                />
                </Suspense>
              </div>

              {/* Preset drag-over overlay (only when canvas editor is closed) */}
              {isDragOverCanvas && !canvasEditorOpen && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(50, 130, 184, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 10,
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(10, 14, 20, 0.85)',
                      border: '2px dashed var(--accent)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 24px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#BBE1FA',
                      textAlign: 'center',
                    }}
                  >
                    🎯 Lepaskan untuk Mengubah Preset
                  </div>
                </div>
              )}

              {/* CanvasOverlayEditor — renders toggle button + overlay canvas + inspector + library */}
              <CanvasOverlayEditor
                open={canvasEditorOpen}
                onToggle={() => setCanvasEditorOpen((v) => !v)}
                overlays={dynamicOverlays}
                overlayCount={dynamicOverlays.length}
                videoDurationSec={videoDurationSec}
                currentTimeSec={currentTimeSec}
                onUpdateOverlay={(id, patch) =>
                  setDynamicOverlays((prev) =>
                    prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
                  )
                }
                onAddOverlay={(ov) =>
                  addDynamicOverlay({
                    ...ov,
                    id: `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  })
                }
                onRemoveOverlay={removeDynamicOverlay}
              />
            </div>
          </div>

          {transform.autoReframe && aspectRatio === '9:16' && (
            <div
              role="status"
              style={{
                width: '100%',
                maxWidth: '340px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.035)',
                color: faceFocusStatus === 'error' ? '#FCA5A5' : 'var(--text-sub)',
                fontSize: '11px',
              }}
            >
              {faceFocusStatus === 'analyzing' && '⏳ Menganalisis wajah untuk live preview…'}
              {faceFocusStatus === 'ready' && '✓ Tracking wajah aktif di live preview'}
              {faceFocusStatus === 'no-face' && 'Tidak ada wajah terdeteksi; memakai framing tengah'}
              {faceFocusStatus === 'error' && 'Analisis preview gagal; framing tengah digunakan'}
              {faceFocusStatus === 'idle' && 'Tracking preview tersedia untuk video sumber vertikal'}
            </div>
          )}

          {/* Interactive Timeline */}
          <div style={{ width: '100%' }}>
            <InteractiveTimeline
              playerRef={playerRef}
              durationSec={effectiveDurationSec}
              fps={fps}
              zoomLevel={timelineZoom}
              onZoomLevelChange={setTimelineZoom}
              enableHookIntro={enableHookIntro}
              onEnableHookIntroChange={setEnableHookIntro}
              hookDurationSec={hookDurationSec}
              enableBroll={enableBroll}
              onEnableBrollChange={setEnableBroll}
              brollBlocks={brollBlocks}
              aiOverlayBlocks={aiOverlayBlocks}
              enableMusic={selectedMusicTrack !== null}
              onEnableMusicChange={(enabled) => {
                if (!enabled) setSelectedMusicTrack(null);
                else if (!selectedMusicTrack) setActiveTab('music');
              }}
              musicTrackLabel={selectedMusicTrack ? selectedMusicTrack.title : undefined}
              musicVolume={musicVolume}
              enableOutro={enableIntroOutro}
              outroDurationSec={effectiveOutroDurationSec}
              outputMode={transform.outputMode}
              narrationAudioUrl={transform.outputMode === 'narration' ? (transform.ttsAudioUrl || undefined) : undefined}
              synthesizingTts={transform.synthesizingTts}
              sourceVolume={transform.sourceVolume}
              onSourceVolumeChange={(vol) => transform.setSourceVolume(vol)}
              onSeek={(sec) => playerRef.current?.seekTo(Math.round(sec * fps))}
              onMusicVolumeChange={(vol) => setMusicVolume(vol)}
              onBrollBlockDelete={(id) => {
                const idx = brollPlacements.findIndex(
                  (b, i) => (b as any).id === id || `broll-${i}` === id,
                );
                if (idx !== -1) {
                  transform.removeBrollPlacement(idx);
                }
              }}
              onAiOverlayDelete={(id) => removeDynamicOverlay(id)}
              onAiOverlayMove={(id, newStart) => {
                setDynamicOverlays((prev) =>
                  prev.map((o) => {
                    if (o.id !== id) return o;
                    const dur = Math.max(0.5, o.end - o.start);
                    const contentStart = Math.max(0, newStart - timelineContentOffsetSec);
                    return { ...o, start: contentStart, end: contentStart + dur };
                  }),
                );
              }}
              onAiOverlayResize={(id, newDur) => {
                setDynamicOverlays((prev) =>
                  prev.map((o) => {
                    if (o.id !== id) return o;
                    return { ...o, end: o.start + Math.max(0.5, newDur) };
                  }),
                );
              }}
              onAiOverlayTrim={(id, newStart, newDur) => {
                setDynamicOverlays((prev) =>
                  prev.map((o) => {
                    if (o.id !== id) return o;
                    const contentStart = Math.max(0, newStart - timelineContentOffsetSec);
                    return { ...o, start: contentStart, end: contentStart + newDur };
                  }),
                );
              }}
              onBrollBlockMove={(id, newStart) => {

                const idx = brollPlacements.findIndex(
                  (b, i) => (b as any).id === id || `broll-${i}` === id,
                );
                if (idx !== -1) {
                  const b = brollPlacements[idx];
                  const currentStart =
                    (b as any).start ?? (b as any).startSec ?? (b as any).cue?.start ?? 0;
                  const currentEnd =
                    (b as any).end ?? (b as any).endSec ?? (b as any).cue?.end ?? (currentStart + 3);
                  const dur = Math.max(1, currentEnd - currentStart);
                  const contentStart = Math.max(0, newStart - timelineContentOffsetSec);
                  const newEnd = contentStart + dur;
                  updateBrollPlacement(idx, {
                    ...b,
                    start: contentStart,
                    end: newEnd,
                    startSec: contentStart,
                    endSec: newEnd,
                    cue: b.cue
                      ? { ...b.cue, start: contentStart, end: newEnd }
                      : { start: contentStart, end: newEnd, query: (b as any).query || 'B-Roll' },
                  } as any);
                }
              }}
              onBrollBlockResize={(id, newDur) => {
                const idx = brollPlacements.findIndex(
                  (b, i) => (b as any).id === id || `broll-${i}` === id,
                );
                if (idx !== -1) {
                  const b = brollPlacements[idx];
                  const currentStart = normalizedBrollList.find((item) => item.id === id)?.start ?? 0;
                  const newEnd = currentStart + Math.max(1, newDur);
                  updateBrollPlacement(idx, {
                    ...b,
                    start: currentStart,
                    end: newEnd,
                    startSec: currentStart,
                    endSec: newEnd,
                    cue: b.cue
                      ? { ...b.cue, start: currentStart, end: newEnd }
                      : { start: currentStart, end: newEnd, query: (b as any).query || 'B-Roll' },
                  } as any);
                }
              }}
              onBrollBlockTrim={(id, newStart, newDur) => {
                const idx = brollPlacements.findIndex(
                  (b, i) => (b as any).id === id || `broll-${i}` === id,
                );
                if (idx !== -1) {
                  const b = brollPlacements[idx];
                  const contentStart = Math.max(0, newStart - timelineContentOffsetSec);
                  const newEnd = contentStart + newDur;
                  updateBrollPlacement(idx, {
                    ...b,
                    start: contentStart,
                    end: newEnd,
                    startSec: contentStart,
                    endSec: newEnd,
                    cue: b.cue
                      ? { ...b.cue, start: contentStart, end: newEnd }
                      : { start: contentStart, end: newEnd, query: (b as any).query || 'B-Roll' },
                  } as any);
                }
              }}
            />
          </div>
        </div>

        {/* ================================================================== */}
        {/* RIGHT COLUMN: Unified Studio Inspector Panel                       */}
        {/* ================================================================== */}
        <div
          className="remotion-editor-inspector"
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Panel Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>🎛️</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                Pengaturan
              </span>
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div
            className="remotion-editor-inspector-tabs"
            style={{
              display: 'flex',
              gap: '4px',
              background: 'var(--bg-card)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            {[
              { id: 'editor' as const, label: '🤖 AI Co-Pilot' },
              { id: 'hook' as const, label: '⚡ Hook' },
              { id: 'subtitle' as const, label: '🎨 Subtitle' },
              { id: 'music' as const, label: selectedMusicTrack ? '🔊 Audio & Musik (Aktif)' : '🔊 Audio & Musik' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab.id ? (tab.id === 'music' ? '#A855F7' : 'var(--accent)') : 'transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: AI Co-Pilot */}
          {activeTab === 'editor' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#FFFFFF' }}>
                  💬 Perintahkan AI Producer di Sini
                </span>
                <button
                  type="button"
                  onClick={onOpenFullProducerDrawer}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-focus)',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Buka Chat Penuh ↗
                </button>
              </div>

              {/* Quick Input Bar */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                  placeholder="Ketik: 'Ganti subtitle ke Hormozi' atau 'Bikin hook lebih viral'..."
                  disabled={producer.isLoading}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSendPrompt()}
                  disabled={producer.isLoading || !promptInput.trim()}
                  style={{
                    background: 'var(--accent)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '0 16px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: producer.isLoading || !promptInput.trim() ? 0.5 : 1,
                  }}
                >
                  {producer.isLoading ? '⏳...' : 'Kirim'}
                </button>
              </div>

              {/* Applied Badges feedback */}
              {producer.appliedBadges && producer.appliedBadges.length > 0 && (
                <div
                  style={{
                    background: 'rgba(50, 130, 184, 0.15)',
                    border: '1px solid #3282B8',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {producer.appliedBadges.map((badge, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#3282B8',
                          color: '#FFFFFF',
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontWeight: 600,
                        }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={producer.undo}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-focus)',
                      color: 'var(--text-muted)',
                      fontSize: '10.5px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      cursor: 'pointer',
                    }}
                  >
                    ↩ Undo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Hook Controls */}
          {activeTab === 'hook' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Toggle Hook Intro Banner */}
              <div
                onClick={() => setEnableHookIntro(!enableHookIntro)}
                style={{
                  background: enableHookIntro ? 'rgba(50, 130, 184, 0.14)' : 'var(--bg-input)',
                  border: `1.5px solid ${enableHookIntro ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={enableHookIntro}
                  onChange={(e) => setEnableHookIntro(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: enableHookIntro ? '#FFFFFF' : 'var(--text-muted)' }}>
                    Tampilkan Hook Intro (0-3.5s)
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-sub)' }}>
                    Animasi pembuka dinamis untuk menarik atensi penonton
                  </div>
                </div>
              </div>

              {/* Visual Preset Cards Grid */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '8px' }}>
                  Pilihan Animasi Visual Hook:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {HOOK_PRESETS.map((p) => (
                    <PresetCard
                      key={p.id}
                      isActive={selectedVisualPreset === p.id}
                      emoji={p.emoji}
                      label={p.label}
                      desc={p.desc}
                      onClick={() => setSelectedVisualPreset(p.id as any)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'hook-preset', id: p.id }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Headline Text Input */}
              <div>
                <label
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', display: 'block', marginBottom: '5px' }}
                >
                  Teks Headline Hook:
                </label>
                <input
                  type="text"
                  value={customHookText}
                  onChange={(e) => setCustomHookText(e.target.value)}
                  placeholder="Ketik judul hook pembuka..."
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Badge Tag Input */}
              <div>
                <label
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', display: 'block', marginBottom: '5px' }}
                >
                  Badge Tag Kategori:
                </label>
                <input
                  type="text"
                  value={customHookTag}
                  onChange={(e) => setCustomHookTag(e.target.value)}
                  placeholder="Misal: 🔥 JANGAN DI-SKIP"
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: Subtitle & B-Roll Controls */}
          {activeTab === 'subtitle' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Subtitle Presets Grid */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '8px' }}>
                  Gaya Animasi Subtitle (Karaoke Pop):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {SUBTITLE_PRESETS.map((tpl) => (
                    <PresetCard
                      key={tpl.id}
                      isActive={templateId === tpl.id}
                      emoji={tpl.emoji}
                      label={tpl.label}
                      desc={tpl.desc}
                      accentColor={tpl.color}
                      onClick={() => setTemplateId(tpl.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'subtitle-preset', id: tpl.id }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Subtitle Font Size Controls */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '8px' }}>
                  Ukuran Font Subtitle:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'sm', label: 'Kecil', px: '38px', desc: 'Subtil' },
                    { id: 'md', label: 'Sedang', px: '48px', desc: 'Default' },
                    { id: 'lg', label: 'Besar', px: '58px', desc: 'Tebal' },
                    { id: 'xl', label: 'Ekstra', px: '68px', desc: 'Maksimal' },
                  ].map((s) => {
                    const isSelected = (subtitleSize || 'md') === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSubtitleSize(s.id as 'sm' | 'md' | 'lg' | 'xl')}
                        style={{
                          background: isSelected ? 'rgba(56, 189, 248, 0.16)' : 'var(--bg-input)',
                          border: isSelected ? '2px solid #38BDF8' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '8px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          color: '#FFFFFF',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#38BDF8' : '#FFFFFF' }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: isSelected ? '#BAE6FD' : 'var(--text-sub)' }}>
                          {s.px}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {s.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Enhancers */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-sub)' }}>
                  🎬 Pengaya Visual Klip:
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#FFFFFF',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableBroll}
                    onChange={(e) => setEnableBroll(e.target.checked)}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>Aktifkan B-Roll Pendukung</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginLeft: '6px' }}>
                      ({brollPlacements.length} scene terdeteksi)
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#FFFFFF',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enableIntroOutro}
                    onChange={(e) => setEnableIntroOutro(e.target.checked)}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600 }}>Kartu Outro CTA</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginLeft: '6px' }}>
                      ({outroDuration || 3}s penutup & follow)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: Audio & Musik */}
          {activeTab === 'music' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Audio Mixer Card */}
              <div
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '18px' }}>🎚️</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF' }}>
                      Audio Mixer & Ducking
                    </h4>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-sub)' }}>
                      Atur keseimbangan volume suara asli video, narasi AI, dan musik latar secara live.
                    </p>
                  </div>
                </div>

                {/* Track 1: Suara Video Asli */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                      🎥 Volume Suara Asli Video {transform.outputMode === 'narration' ? '(Ducking Latar)' : ''}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: (transform.sourceVolume ?? 25) === 0 ? '#EF4444' : 'var(--accent)',
                      }}
                    >
                      {(transform.sourceVolume ?? 25) === 0 ? 'Mute (0%)' : `${transform.sourceVolume ?? 25}%`}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={transform.sourceVolume ?? 25}
                    onChange={(e) => transform.setSourceVolume(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)', marginBottom: '8px' }}
                  />

                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { label: '🔇 Mute (0%)', val: 0 },
                      { label: '🔉 15% Subtil', val: 15 },
                      { label: '✨ 25% Seimbang', val: 25 },
                      { label: '🔊 50% Jelas', val: 50 },
                      { label: '📢 100% Penuh', val: 100 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => transform.setSourceVolume(p.val)}
                        style={{
                          background: (transform.sourceVolume ?? 25) === p.val ? 'var(--accent)' : 'var(--bg-input)',
                          color: (transform.sourceVolume ?? 25) === p.val ? '#FFFFFF' : 'var(--text-sub)',
                          border: `1px solid ${(transform.sourceVolume ?? 25) === p.val ? 'var(--border-focus)' : 'var(--border)'}`,
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {transform.outputMode === 'narration' && (
                    <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-sub)', marginTop: '6px', lineHeight: 1.35 }}>
                      Suara video asli dikecilkan (ducking) agar suara narasi AI baru terdengar jelas dan dominan.
                    </span>
                  )}
                </div>

              </div>

              {/* Music Library Panel */}
              <MusicLibraryPanel
                selectedTrackId={selectedMusicTrack?.id ?? null}
                musicVolume={musicVolume}
                autoDucking={autoDucking}
                onSelectTrack={(track) => setSelectedMusicTrack(track)}
                onVolumeChange={setMusicVolume}
                onAutoDuckingChange={setAutoDucking}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
