import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PlayerRef } from '@remotion/player';
import { formatTimecode } from '../studio/studioUtils';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface BrollBlock {
  id: string;
  startSec: number;
  durationSec: number;
  query: string;
  color?: string;
}

/** Represents one AI-producer dynamic overlay on the timeline */
export interface AiOverlayBlock {
  id: string;
  startSec: number;
  durationSec: number;
  /** human-readable label, e.g. overlay content or type */
  label: string;
  overlayType: 'sticker' | 'callout' | 'shape' | 'text' | 'badge' | 'html';
}

export interface InteractiveTimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationSec: number;
  fps: number;
  // Track states
  enableHookIntro: boolean;
  onEnableHookIntroChange?: (enabled: boolean) => void;
  hookDurationSec: number; // default 3.5
  onHookDurationChange?: (durationSec: number) => void;
  hookStartSec?: number;
  maxHookStartSec?: number;
  onHookMove?: (startSec: number) => void;
  enableBroll: boolean;
  onEnableBrollChange?: (enabled: boolean) => void;
  brollBlocks: BrollBlock[];
  enableMusic: boolean;
  onEnableMusicChange?: (enabled: boolean) => void;
  musicTrackLabel?: string; // e.g. "☕ Café Memories"
  musicVolume?: number; // 0–100
  enableOutro: boolean;
  outroDurationSec: number;
  onOutroDurationChange?: (durationSec: number) => void;
  outroStartSec?: number;
  onOutroMove?: (startSec: number) => void;
  // AI Overlay track
  aiOverlayBlocks?: AiOverlayBlock[];
  onAiOverlayMove?: (id: string, newStartSec: number) => void;
  onAiOverlayResize?: (id: string, newDurationSec: number) => void;
  onAiOverlayDelete?: (id: string) => void;
  // Narration Track
  outputMode?: 'reel' | 'narration';
  narrationAudioUrl?: string;
  synthesizingTts?: boolean;
  // Volume Controls
  sourceVolume?: number;
  onSourceVolumeChange?: (volume: number) => void;
  // Callbacks
  onSeek: (sec: number) => void;
  onBrollBlockMove: (id: string, newStartSec: number) => void;
  onBrollBlockResize: (id: string, newDurationSec: number) => void;
  onBrollBlockTrim?: (id: string, newStartSec: number, newDurationSec: number) => void;
  onAiOverlayTrim?: (id: string, newStartSec: number, newDurationSec: number) => void;
  zoomLevel?: number;
  onZoomLevelChange?: (zoom: number) => void;
  // New optional callbacks
  onMusicVolumeChange?: (volume: number) => void;
  onBrollBlockDelete?: (id: string) => void;
  // Video trimming & movement
  videoStartSec?: number;
  videoDurationSec?: number;
  videoTrimFrontSec?: number;
  onVideoTrim?: (newStartSec: number, newDurationSec: number, newTrimFrontSec?: number) => void;
  onVideoResize?: (newDurationSec: number, startSec?: number) => void;
  onVideoMove?: (newStartSec: number) => void;
  // Subtitle trimming & movement
  subtitleStartSec?: number;
  subtitleDurationSec?: number;
  onSubtitleTrim?: (newStartSec: number, newDurationSec: number, newTrimFrontSec?: number) => void;
  onSubtitleResize?: (newDurationSec: number, startSec?: number) => void;
  onSubtitleMove?: (newStartSec: number) => void;
  // Lock sync between Video and Subtitle
  lockSubtitleVideo?: boolean;
  onLockSubtitleVideoChange?: (locked: boolean) => void;
}

// ─── Tooltip State ───────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  duration: string;
}

// ─── Drag State (B-roll) ─────────────────────────────────────────────────────

interface BrollDragState {
  id: string;
  type: 'move' | 'resize' | 'resize-left' | 'resize-right';
  startMouseX: number;
  startSec: number;       // original startSec (for move / resize-left)
  startDuration: number;  // original durationSec (for resize / resize-left)
  startTrimFrontSec?: number; // original trimFrontSec (for resize-left)
  timelineDurationSec?: number;
}

// ─── Volume Drag State ───────────────────────────────────────────────────────

interface VolumeDragState {
  startMouseX: number;
  startVolume: number;
}

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuState {
  id: string;
  x: number;
  y: number;
}

// ─── Snap constants ──────────────────────────────────────────────────────────

const SNAP_PX_THRESHOLD = 12;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const MIN_CLIP_DURATION = 0.5;

// ─── Component ───────────────────────────────────────────────────────────────

export const InteractiveTimeline: React.FC<InteractiveTimelineProps> = ({
  playerRef,
  durationSec,
  fps,
  enableHookIntro,
  hookDurationSec,
  onHookDurationChange,
  hookStartSec = 0,
  maxHookStartSec,
  onHookMove,
  enableBroll,
  brollBlocks,
  enableMusic,
  musicTrackLabel,
  musicVolume = 25,
  enableOutro,
  outroDurationSec,
  onOutroDurationChange,
  outroStartSec: propOutroStartSec,
  onOutroMove,
  aiOverlayBlocks = [],
  onAiOverlayMove,
  onAiOverlayResize,
  onAiOverlayDelete,
  outputMode = 'reel',
  narrationAudioUrl,
  synthesizingTts = false,
  sourceVolume,
  onSourceVolumeChange,
  onEnableHookIntroChange,
  onEnableBrollChange,
  onEnableMusicChange,
  onSeek,
  onBrollBlockMove,
  onBrollBlockResize,
  onMusicVolumeChange,
  onBrollBlockDelete,
  onBrollBlockTrim,
  onAiOverlayTrim,
  videoStartSec,
  videoDurationSec,
  videoTrimFrontSec,
  onVideoTrim,
  onVideoResize,
  onVideoMove,
  subtitleStartSec,
  subtitleDurationSec,
  onSubtitleTrim,
  onSubtitleResize,
  onSubtitleMove,
  lockSubtitleVideo: propLockSubtitleVideo,
  onLockSubtitleVideoChange,
  zoomLevel: propZoomLevel,
  onZoomLevelChange,
}) => {
  // ── Internal State ──────────────────────────────────────────────────────────
  const [currentSec, setCurrentSec] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [brollDrag, setBrollDrag] = useState<BrollDragState | null>(null);
  const [aiOverlayDrag, setAiOverlayDrag] = useState<BrollDragState | null>(null);
  const [volumeDrag, setVolumeDrag] = useState<VolumeDragState | null>(null);
  const [videoDrag, setVideoDrag] = useState<BrollDragState | null>(null);
  const [subtitleDrag, setSubtitleDrag] = useState<BrollDragState | null>(null);
  const [hookDrag, setHookDrag] = useState<BrollDragState | null>(null);
  const [outroDrag, setOutroDrag] = useState<BrollDragState | null>(null);
  const [internalLockSubtitleVideo, setInternalLockSubtitleVideo] = useState(true);
  const lockSubtitleVideo = propLockSubtitleVideo !== undefined ? propLockSubtitleVideo : internalLockSubtitleVideo;
  const setLockSubtitleVideo = useCallback(
    (action: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof action === 'function' ? action(lockSubtitleVideo) : action;
      setInternalLockSubtitleVideo(nextVal);
      onLockSubtitleVideoChange?.(nextVal);
    },
    [lockSubtitleVideo, onLockSubtitleVideoChange],
  );
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    duration: '',
  });
  const [internalZoomLevel, setInternalZoomLevel] = useState(1);
  const zoomLevel = propZoomLevel !== undefined ? propZoomLevel : internalZoomLevel;
  const setZoomLevel = useCallback(
    (action: number | ((prev: number) => number)) => {
      const nextZoom = typeof action === 'function' ? action(zoomLevel) : action;
      const clamped = Math.max(1, Math.min(8, nextZoom));
      setInternalZoomLevel(clamped);
      onZoomLevelChange?.(clamped);
    },
    [zoomLevel, onZoomLevelChange],
  );
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeSnapSec, setActiveSnapSec] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<(ContextMenuState & { track: 'broll' | 'ai' }) | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures
  const isDraggingPlayheadRef = useRef(false);
  const brollDragRef = useRef<BrollDragState | null>(null);
  const aiOverlayDragRef = useRef<BrollDragState | null>(null);
  const volumeDragRef = useRef<VolumeDragState | null>(null);
  const videoDragRef = useRef<BrollDragState | null>(null);
  const subtitleDragRef = useRef<BrollDragState | null>(null);
  const hookDragRef = useRef<BrollDragState | null>(null);
  const outroDragRef = useRef<BrollDragState | null>(null);
  const lockSubtitleVideoRef = useRef(true);
  const currentSecRef = useRef(0);
  const zoomLevelRef = useRef(1);
  const zoomAnchorRef = useRef<{ zoom: number; sec: number; viewportX: number } | null>(null);
  // ── QW-2: Throttle seekTo — buffer pending seek, flush once per RAF frame ──
  const pendingSeekFrameRef = useRef<number | null>(null);

  isDraggingPlayheadRef.current = isDraggingPlayhead;
  brollDragRef.current = brollDrag;
  aiOverlayDragRef.current = aiOverlayDrag;
  volumeDragRef.current = volumeDrag;
  videoDragRef.current = videoDrag;
  subtitleDragRef.current = subtitleDrag;
  hookDragRef.current = hookDrag;
  outroDragRef.current = outroDrag;
  lockSubtitleVideoRef.current = lockSubtitleVideo;
  currentSecRef.current = currentSec;
  zoomLevelRef.current = zoomLevel;

  // Global drag cursor and selection guard
  useEffect(() => {
    if (brollDrag || aiOverlayDrag || isDraggingPlayhead || volumeDrag || videoDrag || subtitleDrag || hookDrag || outroDrag) {
      document.body.style.userSelect = 'none';
      if (isDraggingPlayhead) document.body.style.cursor = 'ew-resize';
      else if (hookDrag?.type === 'move' || outroDrag?.type === 'move' || brollDrag?.type === 'move' || aiOverlayDrag?.type === 'move' || videoDrag?.type === 'move' || subtitleDrag?.type === 'move') document.body.style.cursor = 'grabbing';
      else if (brollDrag?.type?.startsWith('resize') || aiOverlayDrag?.type?.startsWith('resize') || videoDrag?.type?.startsWith('resize') || subtitleDrag?.type?.startsWith('resize') || hookDrag || outroDrag) document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [brollDrag, aiOverlayDrag, isDraggingPlayhead, volumeDrag, videoDrag, subtitleDrag, hookDrag, outroDrag]);

  // ── Computed track metrics ───────────────────────────────────────────────────
  const hookEnd = enableHookIntro ? hookStartSec + hookDurationSec : 0;
  const outroStart = propOutroStartSec ?? durationSec - (enableOutro ? outroDurationSec : 0);

  // ── QW-3: Memoized snap points — only recompute when blocks actually change ──
  const snapPoints = useMemo(
    () => [
      { sec: 0 },
      { sec: hookStartSec, id: '__hook__' },
      { sec: hookEnd, id: '__hook__' },
      { sec: outroStart, id: '__outro__' },
      { sec: durationSec },
    ],
    [hookStartSec, hookEnd, outroStart, durationSec],
  );

  const clipSnapPoints = useMemo(
    (): Array<{ sec: number; id?: string }> => [
      ...snapPoints,
      // Playhead position included via currentSecRef at snap-time (not here)
      ...brollBlocks.flatMap((block) => [
        { sec: block.startSec, id: block.id },
        { sec: block.startSec + block.durationSec, id: block.id },
      ]),
      ...aiOverlayBlocks.flatMap((block) => [
        { sec: block.startSec, id: `ai:${block.id}` },
        { sec: block.startSec + block.durationSec, id: `ai:${block.id}` },
      ]),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      snapPoints,
      // Serialize only the identity-relevant fields, not the full object reference
      brollBlocks.map((b) => `${b.id}:${b.startSec}:${b.durationSec}`).join(','),
      aiOverlayBlocks.map((b) => `${b.id}:${b.startSec}:${b.durationSec}`).join(','),
    ],
  );

  // ── QW-1: RAF Sync with Player — skip setState when frame hasn't changed ────
  useEffect(() => {
    let rafId: number;
    let prevFrame = -1;
    const poll = () => {
      if (playerRef.current && !isDraggingPlayheadRef.current) {
        const frame = playerRef.current.getCurrentFrame();
        if (frame !== prevFrame) {
          prevFrame = frame;
          setCurrentSec(frame / fps);
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [playerRef, fps]);

  // ── Zoom Wheel Handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const rect = contentAreaRef.current?.getBoundingClientRect();
      if (rect) {
        const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0;
        const viewportX = e.clientX - rect.left;
        const contentX = viewportX + scrollLeft;
        const width = rect.width;
        zoomAnchorRef.current = { zoom: zoomLevelRef.current, sec: (contentX / width) * durationSec, viewportX };
      }
      setZoomLevel((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor)));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [durationSec]);

  // ── Close context menu on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ': {
          e.preventDefault();
          // Toggle play/pause via the player
          try {
            const p = playerRef.current as any;
            if (p?.isPlaying?.()) p.pause?.();
            else p?.play?.();
          } catch (_) {/* ignore */}
          break;
        }
        case 'n':
        case 'N': {
          setSnappingEnabled((enabled) => !enabled);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const delta = e.shiftKey ? 5 : 1;
          const newSec = Math.max(0, currentSecRef.current - delta);
          setCurrentSec(newSec);
          onSeek(newSec);
          playerRef.current?.seekTo(Math.round(newSec * fps));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const delta = e.shiftKey ? 5 : 1;
          const newSec = Math.min(durationSec, currentSecRef.current + delta);
          setCurrentSec(newSec);
          onSeek(newSec);
          playerRef.current?.seekTo(Math.round(newSec * fps));
          break;
        }
        case 'Home': {
          e.preventDefault();
          setCurrentSec(0);
          onSeek(0);
          playerRef.current?.seekTo(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          const last = Math.max(0, durationSec - 1 / fps);
          setCurrentSec(last);
          onSeek(last);
          playerRef.current?.seekTo(Math.round(last * fps));
          break;
        }
        case 'Escape': {
          setSelectedBlockId(null);
          setContextMenu(null);
          break;
        }
        // QW-6: Volume keyboard shortcuts
        case 'm':
        case 'M': {
          // Mute/unmute source volume
          if (onSourceVolumeChange) {
            const current = sourceVolume ?? 25;
            onSourceVolumeChange(current > 0 ? 0 : 25);
          }
          break;
        }
        case '[': {
          // Volume down ±5
          if (onMusicVolumeChange) {
            onMusicVolumeChange(Math.max(0, (musicVolume ?? 25) - 5));
          }
          break;
        }
        case ']': {
          // Volume up ±5
          if (onMusicVolumeChange) {
            onMusicVolumeChange(Math.min(100, (musicVolume ?? 25) + 5));
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [durationSec, fps, onSeek, playerRef, sourceVolume, onSourceVolumeChange, musicVolume, onMusicVolumeChange]);

  // ── Helper: get content area rect ────────────────────────────────────────────
  const getContentRect = useCallback(() => {
    return contentAreaRef.current?.getBoundingClientRect() ?? null;
  }, []);

  // ── Helper: sec → percentage (for zoomed track inner positioning) ────────────
  const secToPercent = useCallback(
    (sec: number): string =>
      `${Math.min(100, (sec / durationSec) * 100)}%`,
    [durationSec],
  );

  // ── Helper: mouse X → seconds (relative to track content area + scroll) ──────
  const mouseXToSec = useCallback(
    (clientX: number): number => {
      const rect = getContentRect();
      if (!rect) return 0;
      const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0;
      const totalWidth = rect.width;
      // The content element begins after the fixed track-label gutter.
      const posX = clientX - rect.left + scrollLeft;
      const ratio = Math.max(0, Math.min(1, posX / totalWidth));
      return ratio * durationSec;
    },
    [durationSec, getContentRect],
  );

  // ── Snap helper ──────────────────────────────────────────────────────────────
  const snapSec = useCallback(
    (sec: number, pxPerSec: number, bypassSnap?: boolean, excludedId?: string): number => {
      if (!snappingEnabled || bypassSnap) {
        setActiveSnapSec(null);
        return sec;
      }
      // Also include current playhead position as a live snap point
      const livePoints = [...clipSnapPoints, { sec: currentSecRef.current }];
      let closest: number | null = null;
      let closestDistance = SNAP_PX_THRESHOLD;
      for (const point of livePoints) {
        if (!Number.isFinite(point.sec) || point.id === excludedId) continue;
        const distPx = Math.abs(sec - point.sec) * pxPerSec;
        if (distPx < closestDistance) {
          closest = point.sec;
          closestDistance = distPx;
        }
      }
      if (closest !== null) {
        setActiveSnapSec(closest);
        return closest;
      }
      setActiveSnapSec(null);
      return sec;
    },
    // QW-3: clipSnapPoints is now a stable memoized array, no JSON.stringify needed
    [snappingEnabled, clipSnapPoints],
  );

  // Keep the time under the playhead/cursor in the same viewport position when zooming.
  useEffect(() => {
    const anchor = zoomAnchorRef.current;
    const scrollEl = scrollContainerRef.current;
    const contentEl = contentAreaRef.current;
    if (anchor && scrollEl && contentEl) {
      const width = contentEl.getBoundingClientRect().width;
      const targetScroll = (anchor.sec / durationSec) * width - anchor.viewportX;
      scrollEl.scrollLeft = Math.max(0, targetScroll);
      zoomAnchorRef.current = null;
      return;
    }
    if (!scrollEl || !contentEl || zoomLevel <= 1) return;
    const width = contentEl.getBoundingClientRect().width;
    scrollEl.scrollLeft = Math.max(0, (currentSec / durationSec) * width - scrollEl.clientWidth / 2);
  }, [zoomLevel, durationSec]);

  // ── Playhead Mouse Down (on any track-content area) ──────────────────────────
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
      // Ignore if clicking on a b-roll block or volume handle (they call e.stopPropagation)
      setIsDraggingPlayhead(true);
      setSelectedBlockId(null);
      const sec = mouseXToSec(e.clientX);
      setCurrentSec(sec);
      onSeek(sec);
      playerRef.current?.seekTo(Math.round(sec * fps));
    },
    [mouseXToSec, onSeek, playerRef, fps],
  );

  // ── Scroll sync: keep playhead in view while playing ─────────────────────────
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const contentEl = contentAreaRef.current;
    if (!scrollEl || !contentEl || isDraggingPlayhead || zoomLevel <= 1) return;

    const rect = contentEl.getBoundingClientRect();
    const totalWidth = rect.width;
    const playheadPx = (currentSec / durationSec) * totalWidth;
    const viewLeft = scrollEl.scrollLeft;
    const viewRight = viewLeft + scrollEl.clientWidth;
    const margin = scrollEl.clientWidth * 0.15;

    if (playheadPx > viewRight - margin) {
      scrollEl.scrollLeft = playheadPx - scrollEl.clientWidth + margin;
    } else if (playheadPx < viewLeft + margin) {
      scrollEl.scrollLeft = Math.max(0, playheadPx - margin);
    }
  }, [currentSec, durationSec, zoomLevel, isDraggingPlayhead]);

  // ── Global Mouse Move & Up (playhead + b-roll + ai-overlay + volume drag) ──
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Volume drag
      const volDrag = volumeDragRef.current;
      if (volDrag && onMusicVolumeChange) {
        const rect = getContentRect();
        const totalWidth = rect?.width ?? 600;
        const deltaPct = ((e.clientX - volDrag.startMouseX) / totalWidth) * 100;
        const newVol = Math.max(0, Math.min(100, volDrag.startVolume + deltaPct));
        onMusicVolumeChange(Math.round(newVol));
        return;
      }

      // Playhead drag — QW-2: throttle seekTo via RAF buffer
      if (isDraggingPlayheadRef.current) {
        const sec = mouseXToSec(e.clientX);
        setCurrentSec(sec);
        onSeek(sec);
        // Cancel any previously queued seek and queue a new one for this frame
        if (pendingSeekFrameRef.current !== null) {
          cancelAnimationFrame(pendingSeekFrameRef.current);
        }
        const targetFrame = Math.round(sec * fps);
        pendingSeekFrameRef.current = requestAnimationFrame(() => {
          playerRef.current?.seekTo(targetFrame);
          pendingSeekFrameRef.current = null;
        });
        return;
      }

      // AI overlay drag
      const aiDrag = aiOverlayDragRef.current;
      if (aiDrag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / durationSec;
        const deltaSec = (e.clientX - aiDrag.startMouseX) / pxPerSec;
        const bypass = e.altKey;

        if (aiDrag.type === 'move') {
          const maxStart = Math.max(0, durationSec - aiDrag.startDuration);
          const rawStart = Math.max(0, Math.min(maxStart, aiDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, `ai:${aiDrag.id}`);
          const snappedEnd = snapSec(rawStart + aiDrag.startDuration, pxPerSec, bypass, `ai:${aiDrag.id}`) - aiDrag.startDuration;
          const candidate = Math.abs(snappedStart - rawStart) <= Math.abs(snappedEnd - rawStart) ? snappedStart : snappedEnd;
          onAiOverlayMove?.(aiDrag.id, Math.max(0, Math.min(maxStart, candidate)));
        } else if (aiDrag.type === 'resize-left') {
          const originalEnd = aiDrag.startSec + aiDrag.startDuration;
          const maxStart = originalEnd - 0.5;
          const rawStart = Math.max(0, Math.min(maxStart, aiDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, `ai:${aiDrag.id}`);
          const newStart = Math.max(0, Math.min(maxStart, snappedStart));
          const newDuration = Math.max(0.5, originalEnd - newStart);
          if (onAiOverlayTrim) {
            onAiOverlayTrim(aiDrag.id, newStart, newDuration);
          } else {
            onAiOverlayMove?.(aiDrag.id, newStart);
            onAiOverlayResize?.(aiDrag.id, newDuration);
          }
        } else {
          const maxDuration = Math.max(MIN_CLIP_DURATION, durationSec - aiDrag.startSec);
          const rawDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, aiDrag.startDuration + deltaSec));
          const snappedEnd = snapSec(aiDrag.startSec + rawDuration, pxPerSec, bypass, `ai:${aiDrag.id}`);
          const newDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, snappedEnd - aiDrag.startSec));
          onAiOverlayResize?.(aiDrag.id, newDuration);
        }
        return;
      }

      // B-roll drag
      const drag = brollDragRef.current;
      if (drag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / durationSec;
        const deltaSec = (e.clientX - drag.startMouseX) / pxPerSec;
        const bypass = e.altKey;

        if (drag.type === 'move') {
          const maxStart = Math.max(0, durationSec - drag.startDuration);
          const rawStart = Math.max(0, Math.min(maxStart, drag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, drag.id);
          const snappedEnd = snapSec(rawStart + drag.startDuration, pxPerSec, bypass, drag.id) - drag.startDuration;
          const candidate = Math.abs(snappedStart - rawStart) <= Math.abs(snappedEnd - rawStart) ? snappedStart : snappedEnd;
          onBrollBlockMove(drag.id, Math.max(0, Math.min(maxStart, candidate)));
        } else if (drag.type === 'resize-left') {
          const originalEnd = drag.startSec + drag.startDuration;
          const maxStart = originalEnd - MIN_CLIP_DURATION;
          const rawStart = Math.max(0, Math.min(maxStart, drag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, drag.id);
          const newStart = Math.max(0, Math.min(maxStart, snappedStart));
          const newDuration = Math.max(MIN_CLIP_DURATION, originalEnd - newStart);
          if (onBrollBlockTrim) {
            onBrollBlockTrim(drag.id, newStart, newDuration);
          } else {
            onBrollBlockMove(drag.id, newStart);
            onBrollBlockResize(drag.id, newDuration);
          }
        } else {
          const maxDuration = Math.max(MIN_CLIP_DURATION, durationSec - drag.startSec);
          const rawDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, drag.startDuration + deltaSec));
          const snappedEnd = snapSec(drag.startSec + rawDuration, pxPerSec, bypass, drag.id);
          const newDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, snappedEnd - drag.startSec));
          onBrollBlockResize(drag.id, newDuration);
        }
        return;
      }
      // Subtitle drag
      const sDrag = subtitleDragRef.current;
      if (sDrag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / durationSec;
        const deltaSec = (e.clientX - sDrag.startMouseX) / pxPerSec;
        const bypass = e.altKey;
        const isLocked = lockSubtitleVideoRef.current;
        if (sDrag.type === 'move') {
          const maxStart = Math.max(0, durationSec - sDrag.startDuration);
          const rawStart = Math.max(0, Math.min(maxStart, sDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, '__subtitle__');
          const snappedEnd = snapSec(rawStart + sDrag.startDuration, pxPerSec, bypass, '__subtitle__') - sDrag.startDuration;
          const candidate = Math.abs(snappedStart - rawStart) <= Math.abs(snappedEnd - rawStart) ? snappedStart : snappedEnd;
          const finalStart = Math.max(0, Math.min(maxStart, candidate));
          if (onSubtitleMove) {
            onSubtitleMove(finalStart);
          } else if (onSubtitleTrim) {
            onSubtitleTrim(finalStart, sDrag.startDuration);
          }
          if (isLocked) {
            if (onVideoMove) {
              onVideoMove(finalStart);
            } else if (onVideoTrim) {
              onVideoTrim(finalStart, sDrag.startDuration);
            }
          }
        } else if (sDrag.type === 'resize-left') {
          const originalEnd = sDrag.startSec + sDrag.startDuration;
          const maxStart = originalEnd - MIN_CLIP_DURATION;
          const rawStart = Math.max(0, Math.min(maxStart, sDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, '__subtitle__');
          const newStart = Math.max(0, Math.min(maxStart, snappedStart));
          const newDuration = Math.max(MIN_CLIP_DURATION, originalEnd - newStart);
          const trimFrontDelta = newStart - sDrag.startSec;
          const newTrimFront = Math.max(0, (sDrag.startTrimFrontSec ?? 0) + trimFrontDelta);
          if (onSubtitleTrim) {
            onSubtitleTrim(newStart, newDuration, newTrimFront);
          } else {
            onSubtitleMove?.(newStart);
            onSubtitleResize?.(newDuration, newStart);
          }
          if (isLocked) {
            if (onVideoTrim) {
              onVideoTrim(newStart, newDuration, newTrimFront);
            } else {
              onVideoMove?.(newStart);
              onVideoResize?.(newDuration, newStart);
            }
          }
        } else {
          const maxDuration = Math.max(MIN_CLIP_DURATION, durationSec - sDrag.startSec);
          const rawDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, sDrag.startDuration + deltaSec));
          const snappedEnd = snapSec(sDrag.startSec + rawDuration, pxPerSec, bypass, '__subtitle__');
          const newDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, snappedEnd - sDrag.startSec));
          if (onSubtitleResize) {
            onSubtitleResize(newDuration, sDrag.startSec);
          } else if (onSubtitleTrim) {
            onSubtitleTrim(sDrag.startSec, newDuration);
          }
          if (isLocked) {
            if (onVideoResize) {
              onVideoResize(newDuration, sDrag.startSec);
            } else if (onVideoTrim) {
              onVideoTrim(sDrag.startSec, newDuration);
            }
          }
        }
        return;
      }

      // Video drag
      const vidDrag = videoDragRef.current;
      if (vidDrag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / durationSec;
        const deltaSec = (e.clientX - vidDrag.startMouseX) / pxPerSec;
        const bypass = e.altKey;
        const isLocked = lockSubtitleVideoRef.current;

        if (vidDrag.type === 'move') {
          const maxStart = Math.max(0, durationSec - vidDrag.startDuration);
          const rawStart = Math.max(0, Math.min(maxStart, vidDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, '__video__');
          const snappedEnd = snapSec(rawStart + vidDrag.startDuration, pxPerSec, bypass, '__video__') - vidDrag.startDuration;
          const candidate = Math.abs(snappedStart - rawStart) <= Math.abs(snappedEnd - rawStart) ? snappedStart : snappedEnd;
          const finalStart = Math.max(0, Math.min(maxStart, candidate));
          if (onVideoMove) {
            onVideoMove(finalStart);
          } else if (onVideoTrim) {
            onVideoTrim(finalStart, vidDrag.startDuration);
          }
          if (isLocked) {
            if (onSubtitleMove) {
              onSubtitleMove(finalStart);
            } else if (onSubtitleTrim) {
              onSubtitleTrim(finalStart, vidDrag.startDuration);
            }
          }
        } else if (vidDrag.type === 'resize-left') {
          const originalEnd = vidDrag.startSec + vidDrag.startDuration;
          const maxStart = originalEnd - MIN_CLIP_DURATION;
          const rawStart = Math.max(0, Math.min(maxStart, vidDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, '__video__');
          const newStart = Math.max(0, Math.min(maxStart, snappedStart));
          const newDuration = Math.max(MIN_CLIP_DURATION, originalEnd - newStart);
          const trimFrontDelta = newStart - vidDrag.startSec;
          const newTrimFront = Math.max(0, (vidDrag.startTrimFrontSec ?? 0) + trimFrontDelta);
          if (onVideoTrim) {
            onVideoTrim(newStart, newDuration, newTrimFront);
          } else {
            onVideoMove?.(newStart);
            onVideoResize?.(newDuration, newStart);
          }
          if (isLocked) {
            if (onSubtitleTrim) {
              onSubtitleTrim(newStart, newDuration, newTrimFront);
            } else {
              onSubtitleMove?.(newStart);
              onSubtitleResize?.(newDuration, newStart);
            }
          }
        } else {
          const maxDuration = Math.max(MIN_CLIP_DURATION, durationSec - vidDrag.startSec);
          const rawDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, vidDrag.startDuration + deltaSec));
          const snappedEnd = snapSec(vidDrag.startSec + rawDuration, pxPerSec, bypass, '__video__');
          const newDuration = Math.max(MIN_CLIP_DURATION, Math.min(maxDuration, snappedEnd - vidDrag.startSec));
          if (onVideoResize) {
            onVideoResize(newDuration, vidDrag.startSec);
          } else if (onVideoTrim) {
            onVideoTrim(vidDrag.startSec, newDuration);
          }
          if (isLocked) {
            if (onSubtitleResize) {
              onSubtitleResize(newDuration, vidDrag.startSec);
            } else if (onSubtitleTrim) {
              onSubtitleTrim(vidDrag.startSec, newDuration);
            }
          }
        }
        return;
      }

      // Hook drag (resize)
      const hDrag = hookDragRef.current;
      if (hDrag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / (hDrag.timelineDurationSec ?? durationSec);
        const deltaSec = (e.clientX - hDrag.startMouseX) / pxPerSec;
        const bypass = e.altKey;

        if (hDrag.type === 'move') {
          const trackDuration = hDrag.timelineDurationSec ?? durationSec;
          const maxStart = Math.min(trackDuration - hDrag.startDuration, maxHookStartSec ?? trackDuration - hDrag.startDuration);
          const newStart = snapSec(Math.max(0, Math.min(maxStart, hDrag.startSec + deltaSec)), pxPerSec, bypass, '__hook__');
          onHookMove?.(Math.max(0, Math.min(maxStart, Number(newStart.toFixed(2)))));
          setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: '⚡ Hook Intro', duration: `${formatTimecode(newStart)} → ${formatTimecode(newStart + hDrag.startDuration)}` });
        } else if (hDrag.type === 'resize-left') {
          const originalEnd = hDrag.startSec + hDrag.startDuration;
          const newStart = Math.max(0, Math.min(originalEnd - 0.5, maxHookStartSec ?? durationSec, hDrag.startSec + deltaSec));
          const newDur = Math.max(0.5, Math.min(15, originalEnd - newStart));
          onHookMove?.(Number(newStart.toFixed(2)));
          onHookDurationChange?.(Number(newDur.toFixed(2)));
          setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: '⚡ Hook Intro', duration: `${newDur.toFixed(1)}s` });
        } else {
          // resize-right
          const rawEnd = hDrag.startSec + hDrag.startDuration + deltaSec;
          const snappedEnd = snapSec(rawEnd, pxPerSec, bypass, '__hook__');
          const newDur = Math.max(0.5, Math.min(15, snappedEnd - hDrag.startSec));
          onHookDurationChange?.(Number(newDur.toFixed(2)));
          setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: '⚡ Hook Intro', duration: `${newDur.toFixed(1)}s` });
        }
        return;
      }

      // Outro drag (resize)
      const oDrag = outroDragRef.current;
      if (oDrag) {
        const rect = getContentRect();
        if (!rect) return;
        const totalWidth = rect.width;
        const pxPerSec = totalWidth / (oDrag.timelineDurationSec ?? durationSec);
        const deltaSec = (e.clientX - oDrag.startMouseX) / pxPerSec;
        const bypass = e.altKey;

        if (oDrag.type === 'move') {
          const trackDuration = oDrag.timelineDurationSec ?? durationSec;
          const newStart = snapSec(Math.max(0, Math.min(trackDuration - oDrag.startDuration, oDrag.startSec + deltaSec)), pxPerSec, bypass, '__outro__');
          onOutroMove?.(Math.max(0, Math.min(trackDuration - oDrag.startDuration, Number(newStart.toFixed(2)))));
          setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: '🏁 Outro CTA', duration: `${formatTimecode(newStart)} → ${formatTimecode(newStart + oDrag.startDuration)}` });
        } else if (oDrag.type === 'resize-left') {
          const originalEnd = oDrag.startSec + oDrag.startDuration;
          const rawStart = Math.max(0, Math.min(originalEnd - 1, oDrag.startSec + deltaSec));
          const snappedStart = snapSec(rawStart, pxPerSec, bypass, '__outro__');
          const finalDur = Math.max(1, Math.min(10, originalEnd - snappedStart));
          onOutroMove?.(Number(snappedStart.toFixed(2)));
          onOutroDurationChange?.(Number(finalDur.toFixed(2)));
          setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            label: '🏁 Outro CTA',
            duration: `${formatTimecode(snappedStart)} → ${formatTimecode(snappedStart + finalDur)} (${finalDur.toFixed(1)}s)`,
          });
        } else {
          // resize-right
          const rawEnd = oDrag.startSec + oDrag.startDuration + deltaSec;
          const snappedEnd = snapSec(rawEnd, pxPerSec, bypass, '__outro__');
          const finalDur = Math.max(1, Math.min(10, snappedEnd - oDrag.startSec));
          onOutroDurationChange?.(Number(finalDur.toFixed(2)));
          setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            label: '🏁 Outro CTA',
            duration: `${formatTimecode(outroStart)} → ${formatTimecode(outroStart + finalDur)} (${finalDur.toFixed(1)}s)`,
          });
        }
        return;
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setBrollDrag(null);
      setAiOverlayDrag(null);
      setVolumeDrag(null);
      setVideoDrag(null);
      setSubtitleDrag(null);
      setHookDrag(null);
      setOutroDrag(null);

      setActiveSnapSec(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    mouseXToSec,
    onSeek,
    playerRef,
    fps,
    durationSec,
    onBrollBlockMove,
    onBrollBlockResize,
    onBrollBlockTrim,
    onMusicVolumeChange,
    onAiOverlayMove,
    onAiOverlayResize,
    onAiOverlayTrim,
    onVideoTrim,
    onVideoResize,
    onVideoMove,
    onSubtitleTrim,
    onSubtitleResize,
    onSubtitleMove,
    onHookDurationChange,
    hookStartSec,
    maxHookStartSec,
    onHookMove,
    onOutroDurationChange,
    propOutroStartSec,
    onOutroMove,
    snapSec,
    getContentRect,
    aiOverlayBlocks,
    brollBlocks,
  ]);

  // ── Ruler Markers ────────────────────────────────────────────────────────────
  // Adapt marker interval based on zoom so we don't have too many / too few
  const rawInterval = 5 / zoomLevel;
  const markerInterval = rawInterval < 1 ? 1 : rawInterval < 2 ? 2 : 5;
  const rulerMarkers: number[] = [];
  for (let s = 0; s <= durationSec; s = Math.round((s + markerInterval) * 10) / 10) {
    rulerMarkers.push(s);
  }
  if (rulerMarkers[rulerMarkers.length - 1] !== durationSec) {
    rulerMarkers.push(durationSec);
  }

  // ── Playhead position (% within zoomed track) ────────────────────────────────
  const playheadLeft = secToPercent(currentSec);

  // ── Block style factory ──────────────────────────────────────────────────────
  const blockStyle = (
    leftPct: string,
    widthPct: string,
    bg: string,
    extra?: React.CSSProperties,
  ): React.CSSProperties => ({
    position: 'absolute',
    left: leftPct,
    width: widthPct,
    height: '28px',
    top: '8px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 8px',
    background: bg,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    userSelect: 'none',
    ...extra,
  });

  // ── Block selection highlight ────────────────────────────────────────────────
  const selectedOutline = (id: string): React.CSSProperties =>
    selectedBlockId === id
      ? { outline: '2px solid #FFFFFF', outlineOffset: '1px', zIndex: 5 }
      : {};

  // ── Seek to block ────────────────────────────────────────────────────────────
  const seekToBlock = useCallback(
    (blockId: string, sec: number) => {
      setSelectedBlockId(blockId);
      setCurrentSec(sec);
      onSeek(sec);
      playerRef.current?.seekTo(Math.round(sec * fps));

      // Smoothly scroll target block into view if zoomed in
      const scrollEl = scrollContainerRef.current;
      const contentEl = contentAreaRef.current;
      if (scrollEl && contentEl && zoomLevel > 1) {
        const totalWidth = contentEl.getBoundingClientRect().width;
        const targetPx = (sec / durationSec) * totalWidth;
        const targetScroll = Math.max(0, targetPx - scrollEl.clientWidth / 2);
        scrollEl.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
    },
    [onSeek, playerRef, fps, zoomLevel, durationSec],
  );

  // ─── Track Row wrapper ───────────────────────────────────────────────────────
  const renderTrackRow = (
    label: React.ReactNode,
    content: React.ReactNode,
    isFirst = false,
    trackKey?: string,
    trackControls?: React.ReactNode,
  ) => (
    <div className={`timeline-track-row${trackKey ? ` timeline-track-${trackKey}` : ''}`}>
      <div className="timeline-track-label" aria-label={`${trackKey ?? 'timeline'} track`}>
        <span className="timeline-track-name">{label}</span>
        {trackControls && <span className="timeline-track-controls">{trackControls}</span>}
      </div>
      <div
        ref={isFirst ? contentAreaRef : undefined}
        className="timeline-track-content"
        onMouseDown={handleTimelineMouseDown}
      >
        {/* Playhead line inside each track */}
        <div
          className="timeline-playhead"
          style={{ left: playheadLeft, height: '100%', pointerEvents: 'none' }}
        />
        {/* Snap guide line */}
        {activeSnapSec !== null && (
          <div
            className="timeline-snap-guide"
            style={{ left: secToPercent(activeSnapSec) }}
          />
        )}
        {content}
      </div>
    </div>
  );

  // Subtitle track covers the content section in both reel and narration modes.
  const defaultSubtitleStart = outputMode === 'reel' && enableHookIntro ? hookEnd : 0;
  const subtitleStart = subtitleStartSec !== undefined ? subtitleStartSec : defaultSubtitleStart;
  const subtitleDur = subtitleDurationSec !== undefined ? subtitleDurationSec : Math.max(0.5, durationSec - subtitleStart);
  const subtitleEnd = subtitleStart + subtitleDur;
  const subtitleLeft = secToPercent(subtitleStart);
  const subtitleWidth = secToPercent(subtitleDur);

  const defaultVideoStart = outputMode === 'reel' && enableHookIntro ? hookEnd : 0;
  const videoStart = videoStartSec !== undefined ? videoStartSec : defaultVideoStart;
  const videoDur = videoDurationSec !== undefined ? videoDurationSec : Math.max(0.5, durationSec - videoStart);
  const videoLeft = secToPercent(videoStart);
  const videoWidth = secToPercent(videoDur);

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="timeline-container" ref={containerRef}>
      {/* ── Context Menu ──────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="timeline-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.track === 'ai' ? (
            <>
              <button
                onClick={() => {
                  onAiOverlayDelete?.(contextMenu.id);
                  setContextMenu(null);
                  if (selectedBlockId === `ai:${contextMenu.id}`) setSelectedBlockId(null);
                }}
              >
                🗑️ Hapus AI UI ini
              </button>
              <button
                onClick={() => {
                  const block = aiOverlayBlocks.find((b) => b.id === contextMenu.id);
                  if (block) seekToBlock(`ai:${block.id}`, block.startSec);
                  setContextMenu(null);
                }}
              >
                ▶ Tuju ke blok ini
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onBrollBlockDelete?.(contextMenu.id);
                  setContextMenu(null);
                  if (selectedBlockId === contextMenu.id) setSelectedBlockId(null);
                }}
              >
                🗑️ Hapus B-roll ini
              </button>
              <button
                onClick={() => {
                  seekToBlock(contextMenu.id, brollBlocks.find((b) => b.id === contextMenu.id)?.startSec ?? 0);
                  setContextMenu(null);
                }}
              >
                ▶ Tuju ke blok ini
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tooltip ──────────────────────────────────────────────────────── */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 36,
            background: '#0A0E14',
            border: '1px solid var(--border-focus)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            color: '#FFFFFF',
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {tooltip.label}
          <span style={{ color: 'var(--text-sub)', marginLeft: '6px', fontWeight: 400 }}>
            {tooltip.duration}
          </span>
        </div>
      )}

      {/* ── Zoom Controls Bar ────────────────────────────────────────────── */}
      <div className="timeline-zoom-controls">
        <span style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 600 }}>
          🔍 Zoom:
        </span>
        <button
          className="timeline-zoom-btn"
          onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z / 1.5))}
          title="Zoom out (atau Ctrl+Scroll)"
          disabled={zoomLevel <= MIN_ZOOM}
        >
          −
        </button>
        <span className="timeline-zoom-label">{zoomLevel.toFixed(1)}×</span>
        <button
          className="timeline-zoom-btn"
          onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z * 1.5))}
          title="Zoom in (atau Ctrl+Scroll)"
          disabled={zoomLevel >= MAX_ZOOM}
        >
          +
        </button>
        <button
          className="timeline-zoom-btn"
          style={{ marginLeft: '4px', fontSize: '9px' }}
          onClick={() => setZoomLevel(1)}
          title="Reset zoom"
          disabled={zoomLevel === 1}
        >
          1×
        </button>
        <button
          className="timeline-zoom-btn timeline-tool-btn"
          onClick={() => setZoomLevel(1)}
          title="Fit seluruh durasi timeline"
          aria-label="Fit seluruh durasi timeline"
        >
          Fit
        </button>
        <button
          className={`timeline-zoom-btn timeline-tool-btn${snappingEnabled ? ' active' : ''}`}
          onClick={() => setSnappingEnabled((enabled) => !enabled)}
          title={`Snapping ${snappingEnabled ? 'aktif' : 'nonaktif'} (N)`}
          aria-pressed={snappingEnabled}
        >
          ⧲ Snap
        </button>
        <span className="timeline-a11y-hint" aria-live="polite">{snappingEnabled ? 'Snapping aktif' : 'Snapping nonaktif'}</span>
        <button
          className={`timeline-zoom-btn timeline-tool-btn${lockSubtitleVideo ? ' active' : ''}`}
          onClick={() => setLockSubtitleVideo((l) => !l)}
          title={`Kunci Sinkronisasi Subtitle & Video Utama: ${lockSubtitleVideo ? 'Aktif (🔗 Terkunci)' : 'Nonaktif (🔓 Terpisah)'}`}
          aria-pressed={lockSubtitleVideo}
          style={lockSubtitleVideo ? { borderColor: '#10B981', color: '#10B981', background: 'rgba(16, 185, 129, 0.15)' } : {}}
        >
          {lockSubtitleVideo ? '🔗 Kunci Video+Sub' : '🔓 Kunci Lepas'}
        </button>
        <span className="timeline-a11y-hint" aria-live="polite">
          {lockSubtitleVideo ? 'Kunci Subtitle dan Video aktif' : 'Kunci Subtitle dan Video nonaktif'}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '9.5px',
            color: 'var(--text-sub)',
            fontStyle: 'italic',
          }}
        >
          ⌨ Space · ←→ · N=snap · ⌥drag=no-snap · klik blok=seek
        </span>
      </div>

      {/* ── Scroll Wrapper ───────────────────────────────────────────────── */}
      <div ref={scrollContainerRef} className="timeline-scroll-container">
        {/* ── Ruler Header ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            width: `${zoomLevel * 100}%`,
            minWidth: '100%',
          }}
        >
          {/* Empty label gutter */}
          <div
            style={{
              width: '110px',
              minWidth: '110px',
              background: 'var(--bg-card)',
              borderRight: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
          {/* Ruler body */}
          <div className="timeline-ruler" style={{ flex: 1, position: 'relative' }}>
            {rulerMarkers.map((sec) => (
              <div
                key={sec}
                className={`timeline-ruler-marker${sec === durationSec ? ' timeline-ruler-marker-end' : ''}`}
                style={{ left: secToPercent(sec) }}
              >
                <span className="timeline-ruler-marker-label">{formatTimecode(sec)}</span>
                <div className="timeline-ruler-marker-line" />
              </div>
            ))}

            {/* Playhead needle in ruler (triangle handle) */}
            <div
              className="timeline-ruler-playhead-head"
              style={{ left: playheadLeft }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsDraggingPlayhead(true);
              }}
              title="Drag untuk seek"
            />

            {/* Playhead line in ruler */}
            <div
              style={{
                position: 'absolute',
                left: playheadLeft,
                top: 0,
                height: '100%',
                width: '2px',
                background: 'var(--accent)',
                opacity: 0.8,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Inner tracks container (scrolls with ruler) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            width: `${zoomLevel * 100}%`,
            minWidth: '100%',
          }}
        >

          {/* ── TRACK 1: Hook & Outro ────────────────────────────────────── */}
          {renderTrackRow(
            <>⚡ Hook<br />& Outro</>,
            <>
              {enableHookIntro && (
                <div
                  className={`timeline-block${hookDrag ? ' dragging' : ''}${selectedBlockId === '__hook__' ? ' selected' : ''}`}
                  style={{
                    ...blockStyle(secToPercent(hookStartSec), secToPercent(hookDurationSec), '#3282B8', {
                      cursor: hookDrag ? 'grabbing' : 'grab',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                    }),
                    ...selectedOutline('__hook__'),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToBlock('__hook__', hookStartSec);
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedBlockId('__hook__');
                    setHookDrag({ id: '__hook__', type: 'move', startMouseX: e.clientX, startSec: hookStartSec, startDuration: hookDurationSec, timelineDurationSec: durationSec });
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      label: '⚡ Hook Intro',
                      duration: formatTimecode(hookDurationSec),
                    })
                  }
                  onMouseMove={(e) =>
                    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                  }
                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                >
                  {/* Left resize handle */}
                  <div
                    title="Drag untuk sesuaikan durasi hook"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '8px',
                      height: '100%',
                      cursor: 'col-resize',
                      background: 'rgba(255,255,255,0.25)',
                      borderRight: '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '4px 0 0 4px',
                      zIndex: 3,
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setSelectedBlockId('__hook__');
                      setHookDrag({
                        id: '__hook__',
                        type: 'resize-left',
                        startMouseX: e.clientX,
                        startSec: hookStartSec,
                        startDuration: hookDurationSec,
                        timelineDurationSec: durationSec,
                      });
                    }}
                  />
                  ⚡ Hook ({hookDurationSec.toFixed(1)}s)
                  {/* Right resize handle */}
                  <div
                    title="Drag untuk potong / sesuaikan durasi hook"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '8px',
                      height: '100%',
                      cursor: 'col-resize',
                      background: 'rgba(255,255,255,0.25)',
                      borderLeft: '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '0 4px 4px 0',
                      zIndex: 3,
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setSelectedBlockId('__hook__');
                      setHookDrag({
                        id: '__hook__',
                        type: 'resize-right',
                        startMouseX: e.clientX,
                        startSec: hookStartSec,
                        startDuration: hookDurationSec,
                        timelineDurationSec: durationSec,
                      });
                    }}
                  />
                </div>
              )}
              {enableOutro && outputMode === 'reel' && (
                <div
                  className={`timeline-block${outroDrag ? ' dragging' : ''}${selectedBlockId === '__outro__' ? ' selected' : ''}`}
                  style={{
                    ...blockStyle(secToPercent(outroStart), secToPercent(outroDurationSec), '#EC4899', {
                      cursor: outroDrag ? 'grabbing' : 'grab',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                    }),
                    ...selectedOutline('__outro__'),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToBlock('__outro__', outroStart);
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedBlockId('__outro__');
                    setOutroDrag({ id: '__outro__', type: 'move', startMouseX: e.clientX, startSec: outroStart, startDuration: outroDurationSec, timelineDurationSec: durationSec });
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      label: '🏁 Outro CTA',
                      duration: `${formatTimecode(outroStart)} → ${formatTimecode(outroStart + outroDurationSec)} (${formatTimecode(outroDurationSec)})`,
                    })
                  }
                  onMouseMove={(e) =>
                    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                  }
                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                >
                  {/* Left resize handle */}
                  <div
                    title="Drag untuk potong / sesuaikan titik mulai outro"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '8px',
                      height: '100%',
                      cursor: 'col-resize',
                      background: 'rgba(255,255,255,0.25)',
                      borderRight: '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '4px 0 0 4px',
                      zIndex: 3,
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setSelectedBlockId('__outro__');
                      setOutroDrag({
                        id: '__outro__',
                        type: 'resize-left',
                        startMouseX: e.clientX,
                        startSec: outroStart,
                        startDuration: outroDurationSec,
                        timelineDurationSec: durationSec,
                      });
                    }}
                  />
                  🏁 Outro ({outroDurationSec.toFixed(1)}s)
                  {/* Right resize handle */}
                  <div
                    title="Drag untuk sesuaikan durasi akhir outro"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '8px',
                      height: '100%',
                      cursor: 'col-resize',
                      background: 'rgba(255,255,255,0.25)',
                      borderLeft: '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '0 4px 4px 0',
                      zIndex: 3,
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setSelectedBlockId('__outro__');
                      setOutroDrag({
                        id: '__outro__',
                        type: 'resize-right',
                        startMouseX: e.clientX,
                        startSec: outroStart,
                        startDuration: outroDurationSec,
                        timelineDurationSec: durationSec,
                      });
                    }}
                  />
                </div>
              )}
            </>,
            true, // isFirst → sets contentAreaRef
            'visual',
            <button type="button" className="timeline-track-toggle" aria-label={`${enableHookIntro ? 'Sembunyikan' : 'Tampilkan'} hook intro`} aria-pressed={enableHookIntro} title="Aktif/nonaktif hook intro" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEnableHookIntroChange?.(!enableHookIntro)}>{enableHookIntro ? '●' : '○'}</button>,
          )}

          {/* ── TRACK 2: Subtitle (shared by reel and narration) ──────────── */}
          {renderTrackRow(
            <>💬 Subtitle</>,
            <div
              className={`timeline-block${(subtitleDrag || (lockSubtitleVideo && videoDrag)) ? ' dragging' : ''}${selectedBlockId === '__subtitle__' ? ' selected' : ''}`}
              style={{
                ...blockStyle(subtitleLeft, subtitleWidth, 'rgba(50,130,184,0.55)', {
                  cursor: subtitleDrag ? 'grabbing' : 'grab',
                  justifyContent: 'flex-start',
                  paddingLeft: '14px',
                  paddingRight: '14px',
                }),
                ...selectedOutline('__subtitle__'),
              }}
              role="button"
              tabIndex={0}
              aria-label={`Subtitle, ${formatTimecode(subtitleStart)} sampai ${formatTimecode(subtitleEnd)}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekToBlock('__subtitle__', subtitleStart); } }}
              onClick={(e) => {
                e.stopPropagation();
                seekToBlock('__subtitle__', subtitleStart);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSubtitleDrag({
                  id: '__subtitle__',
                  type: 'move',
                  startMouseX: e.clientX,
                  startSec: subtitleStart,
                  startDuration: subtitleDur,
                });
              }}
              onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: lockSubtitleVideo ? '💬 Subtitle Karaoke 🔗 (Terkunci dengan Video Utama)' : '💬 Subtitle Karaoke', duration: `${formatTimecode(subtitleStart)} → ${formatTimecode(subtitleEnd)} (${formatTimecode(subtitleDur)})` })}
              onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              {/* Left resize handle (shrink/expand from start) */}
              <div
                title="Drag untuk potong / ubah titik awal subtitle"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.2)',
                  borderRight: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '4px 0 0 4px',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSubtitleDrag({
                    id: '__subtitle__',
                    type: 'resize-left',
                    startMouseX: e.clientX,
                    startSec: subtitleStart,
                    startDuration: subtitleDur,
                    startTrimFrontSec: videoTrimFrontSec ?? 0,
                  });
                }}
              />
              💬 Subtitle Karaoke
              {lockSubtitleVideo && (
                <span style={{ opacity: 0.8, fontSize: '9.5px', marginLeft: '4px' }} title="Terkunci dengan Video Utama">
                  🔗
                </span>
              )}
              {/* Right resize handle (extend/shrink from end) */}
              <div
                title="Drag untuk potong / ubah titik akhir subtitle"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.2)',
                  borderLeft: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '0 4px 4px 0',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSubtitleDrag({
                    id: '__subtitle__',
                    type: 'resize',
                    startMouseX: e.clientX,
                    startSec: subtitleStart,
                    startDuration: subtitleDur,
                  });
                }}
              />
            </div>,
            false,
            'subtitle',
            <button
              type="button"
              className={`timeline-track-toggle${lockSubtitleVideo ? ' active' : ''}`}
              aria-label={lockSubtitleVideo ? 'Buka kunci dengan video utama' : 'Kunci bersama video utama'}
              aria-pressed={lockSubtitleVideo}
              title={lockSubtitleVideo ? '🔗 Terkunci dengan Video Utama (Klik untuk melepas)' : '🔓 Terpisah dari Video Utama (Klik untuk mengunci)'}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setLockSubtitleVideo((l) => !l)}
              style={{
                fontSize: '10px',
                color: lockSubtitleVideo ? '#10B981' : 'var(--text-sub)',
                background: lockSubtitleVideo ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: `1px solid ${lockSubtitleVideo ? 'rgba(16, 185, 129, 0.5)' : 'var(--border)'}`,
                borderRadius: '4px',
                padding: '0 4px',
                cursor: 'pointer',
                lineHeight: '16px',
                height: '18px',
              }}
            >
              {lockSubtitleVideo ? '🔗' : '🔓'}
            </button>,
          )}

          {/* ── TRACK: Outro ─────────────────────────────────────────────── */}
          {enableOutro && outputMode === 'narration' && renderTrackRow(
            <>🏁 Outro</>,
            <div
              className={`timeline-block${outroDrag ? ' dragging' : ''}${selectedBlockId === '__outro__' ? ' selected' : ''}`}
              style={{
                ...blockStyle(secToPercent(outroStart), secToPercent(outroDurationSec), '#EC4899', {
                  cursor: outroDrag ? 'grabbing' : 'grab',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                }),
                ...selectedOutline('__outro__'),
              }}
              role="button"
              tabIndex={0}
              aria-label={`Outro CTA, durasi ${formatTimecode(outroDurationSec)}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekToBlock('__outro__', outroStart); } }}
              onClick={(e) => { e.stopPropagation(); seekToBlock('__outro__', outroStart); }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                setSelectedBlockId('__outro__');
                setOutroDrag({ id: '__outro__', type: 'move', startMouseX: e.clientX, startSec: outroStart, startDuration: outroDurationSec, timelineDurationSec: durationSec });
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  label: '🏁 Outro CTA',
                  duration: `${formatTimecode(outroStart)} → ${formatTimecode(outroStart + outroDurationSec)} (${formatTimecode(outroDurationSec)})`,
                })
              }
              onMouseMove={(e) =>
                setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
              }
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              {/* Left resize handle */}
              <div
                title="Drag untuk potong / sesuaikan titik mulai outro"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.25)',
                  borderRight: '1px solid rgba(255,255,255,0.45)',
                  borderRadius: '4px 0 0 4px',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSelectedBlockId('__outro__');
                  setOutroDrag({
                    id: '__outro__',
                    type: 'resize-left',
                    startMouseX: e.clientX,
                    startSec: outroStart,
                    startDuration: outroDurationSec,
                    timelineDurationSec: durationSec,
                  });
                }}
              />
              🏁 Outro CTA ({outroDurationSec.toFixed(1)}s)
              {/* Right resize handle */}
              <div
                title="Drag untuk sesuaikan durasi akhir outro"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.25)',
                  borderLeft: '1px solid rgba(255,255,255,0.45)',
                  borderRadius: '0 4px 4px 0',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSelectedBlockId('__outro__');
                  setOutroDrag({
                    id: '__outro__',
                    type: 'resize-right',
                    startMouseX: e.clientX,
                    startSec: outroStart,
                    startDuration: outroDurationSec,
                    timelineDurationSec: durationSec,
                  });
                }}
              />
            </div>,
            false,
            'outro',
          )}

          {/* ── TRACK 3: B-Roll (Draggable) ──────────────────────────────── */}
          {renderTrackRow(
            <>🎬 B-Roll<br />Overlays</>,
            <>
              {enableBroll && brollBlocks.length > 0 ? (
                brollBlocks.map((block) => {
                  const isDragging = brollDrag?.id === block.id;
                  const isSelected = selectedBlockId === block.id;
                  return (
                    <div
                      key={block.id}
                      className={`timeline-block${isDragging ? ' dragging' : ''}${isSelected ? ' selected' : ''}`}
                      style={{
                        ...blockStyle(
                          secToPercent(block.startSec),
                          secToPercent(block.durationSec),
                          block.color ?? '#F59E0B',
                          { cursor: isDragging ? 'grabbing' : 'grab', paddingRight: '14px' },
                        ),
                        ...selectedOutline(block.id),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekToBlock(block.id, block.startSec);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ id: block.id, x: e.clientX, y: e.clientY, track: 'broll' });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setBrollDrag({
                          id: block.id,
                          type: 'move',
                          startMouseX: e.clientX,
                          startSec: block.startSec,
                          startDuration: block.durationSec,
                        });
                      }}
                      onMouseEnter={(e) =>
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          label: `🎬 ${block.query}`,
                          duration: formatTimecode(block.durationSec),
                        })
                      }
                      onMouseMove={(e) =>
                        setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                      }
                      onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                    >
                      {/* QW-4: Left resize handle (shrink/expand from start) */}
                      <div
                        title="Drag untuk ubah titik awal"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '6px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '4px 0 0 4px',
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Left handle: resize from start — store negative convention:
                          // we flip the deltaSec sign in handleMouseMove using a custom type
                          setBrollDrag({
                            id: block.id,
                            type: 'resize-left',
                            startMouseX: e.clientX,
                            startSec: block.startSec,
                            startDuration: block.durationSec,
                          });
                        }}
                      />
                      🎬{' '}
                      {block.query.length > 12 ? block.query.slice(0, 12) + '…' : block.query}
                      {/* Right resize handle (extend/shrink from end) */}
                      <div
                        title="Drag untuk ubah titik akhir"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          width: '6px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '0 4px 4px 0',
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setBrollDrag({
                            id: block.id,
                            type: 'resize',
                            startMouseX: e.clientX,
                            startSec: block.startSec,
                            startDuration: block.durationSec,
                          });
                        }}
                      />
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: 'var(--text-sub)',
                    fontStyle: 'italic',
                    pointerEvents: 'none',
                  }}
                >
                  {!enableBroll
                    ? 'B-Roll dinonaktifkan'
                    : 'Drag B-roll dari panel aset ke sini'}
                </div>
              )}
            </>,
            false,
            'broll',
            <button type="button" className="timeline-track-toggle" aria-label={`${enableBroll ? 'Nonaktifkan' : 'Aktifkan'} B-roll`} aria-pressed={enableBroll} title="Aktif/nonaktif B-roll" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEnableBrollChange?.(!enableBroll)}>{enableBroll ? '●' : '○'}</button>,
          )}

          {/* ── TRACK 3: AI Producer UI Overlays ─────────────────────────── */}
          {renderTrackRow(
            <>🤖 AI<br />UI</>,
            <>
              {aiOverlayBlocks.length > 0 ? (
                aiOverlayBlocks.map((block) => {
                  const isDragging = aiOverlayDrag?.id === block.id;
                  const isSelected = selectedBlockId === `ai:${block.id}`;

                  // Color by overlay type
                  const typeColors: Record<string, string> = {
                    sticker: '#F97316',
                    callout: '#06B6D4',
                    shape: '#8B5CF6',
                    text: '#EC4899',
                    badge: '#EAB308',
                    html: '#10B981',
                  };
                  const bg = typeColors[block.overlayType] ?? '#64748B';

                  // Type emoji
                  const typeEmoji: Record<string, string> = {
                    sticker: '😀',
                    callout: '💬',
                    shape: '🔷',
                    text: '📝',
                    badge: '🏷️',
                    html: '🌐',
                  };
                  const emoji = typeEmoji[block.overlayType] ?? '🤖';

                  return (
                    <div
                      key={block.id}
                      className={`timeline-block${isDragging ? ' dragging' : ''}${isSelected ? ' selected' : ''}`}
                      style={{
                        ...blockStyle(
                          secToPercent(block.startSec),
                          secToPercent(block.durationSec),
                          bg,
                          {
                            cursor: isDragging ? 'grabbing' : 'grab',
                            paddingRight: '14px',
                            backgroundImage: `repeating-linear-gradient(
                              45deg,
                              transparent,
                              transparent 4px,
                              rgba(255,255,255,0.08) 4px,
                              rgba(255,255,255,0.08) 8px
                            )`,
                          },
                        ),
                        ...(isSelected ? { outline: '2px solid rgba(255,255,255,0.9)', outlineOffset: '1px', zIndex: 5 } : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekToBlock(`ai:${block.id}`, block.startSec);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ id: block.id, x: e.clientX, y: e.clientY, track: 'ai' });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setAiOverlayDrag({
                          id: block.id,
                          type: 'move',
                          startMouseX: e.clientX,
                          startSec: block.startSec,
                          startDuration: block.durationSec,
                        });
                      }}
                      onMouseEnter={(e) =>
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          label: `${emoji} ${block.label || block.overlayType}`,
                          duration: `${formatTimecode(block.startSec)} → ${formatTimecode(block.startSec + block.durationSec)}`,
                        })
                      }
                      onMouseMove={(e) =>
                        setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                      }
                      onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                    >
                      {/* QW-4: Left resize handle for AI overlay */}
                      <div
                        title="Drag untuk ubah titik awal"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '6px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '4px 0 0 4px',
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setAiOverlayDrag({
                            id: block.id,
                            type: 'resize-left',
                            startMouseX: e.clientX,
                            startSec: block.startSec,
                            startDuration: block.durationSec,
                          });
                        }}
                      />
                      {emoji}{' '}
                      {block.label.length > 10 ? block.label.slice(0, 10) + '…' : block.label}
                      {/* Right resize handle */}
                      <div
                        title="Drag untuk ubah titik akhir"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          width: '6px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '0 4px 4px 0',
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setAiOverlayDrag({
                            id: block.id,
                            type: 'resize',
                            startMouseX: e.clientX,
                            startSec: block.startSec,
                            startDuration: block.durationSec,
                          });
                        }}
                      />
                    </div>
                  );
                })
              ) : null}
            </>,
            false,
            'ai-overlay',
          )}

          {/* ── TRACK 4: Video Utama ──────────────────────────────────────── */}

          {renderTrackRow(
            <>🎥 Video<br />Utama</>,
            <div
              className={`timeline-block${(videoDrag || (lockSubtitleVideo && subtitleDrag)) ? ' dragging' : ''}${selectedBlockId === '__video__' ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Track video utama, mulai ${formatTimecode(videoStart)}, durasi ${formatTimecode(videoDur)}, volume ${sourceVolume ?? 100} persen`}
              style={{
                ...blockStyle(videoLeft, videoWidth, '#10B981', {
                  cursor: videoDrag ? 'grabbing' : 'grab',
                  justifyContent: 'flex-start',
                  paddingLeft: '14px',
                  paddingRight: '14px',
                }),
                ...selectedOutline('__video__'),
              }}
              onClick={(e) => {
                e.stopPropagation();
                seekToBlock('__video__', videoStart);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setVideoDrag({
                  id: '__video__',
                  type: 'move',
                  startMouseX: e.clientX,
                  startSec: videoStart,
                  startDuration: videoDur,
                });
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  label: lockSubtitleVideo
                    ? (outputMode === 'narration' ? `🎥 Video Klip Utama 🔗 (Terkunci dengan Subtitle, Ducking: ${sourceVolume ?? 25}%)` : `🎥 Video Klip Utama 🔗 (Terkunci dengan Subtitle, Vol: ${sourceVolume ?? 100}%)`)
                    : (outputMode === 'narration' ? `🎥 Video Klip Utama (Ducking Vol: ${sourceVolume ?? 25}%)` : `🎥 Video Klip Utama (Vol: ${sourceVolume ?? 100}%)`),
                  duration: `${formatTimecode(videoStart)} → ${formatTimecode(videoStart + videoDur)} (${formatTimecode(videoDur)})`,
                })
              }
              onMouseMove={(e) =>
                setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
              }
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              {/* Left resize handle (shrink/expand from start) */}
              <div
                title="Drag untuk potong / ubah titik awal video"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.2)',
                  borderRight: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '4px 0 0 4px',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setVideoDrag({
                    id: '__video__',
                    type: 'resize-left',
                    startMouseX: e.clientX,
                    startSec: videoStart,
                    startDuration: videoDur,
                    startTrimFrontSec: videoTrimFrontSec ?? 0,
                  });
                }}
              />
              🎥 Video Klip Utama
              {lockSubtitleVideo && (
                <span style={{ opacity: 0.85, fontSize: '9.5px', marginLeft: '4px' }} title="Terkunci dengan Subtitle">
                  🔗
                </span>
              )}
              {sourceVolume !== undefined && (
                <span style={{ opacity: 0.85, fontSize: '9px', marginLeft: '6px' }}>
                  {outputMode === 'narration' ? `(Ducking: ${sourceVolume}%)` : `(Vol: ${sourceVolume}%)`}
                </span>
              )}
              {/* Right resize handle (extend/shrink from end) */}
              <div
                title="Drag untuk potong / ubah titik akhir video"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'col-resize',
                  background: 'rgba(255,255,255,0.2)',
                  borderLeft: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '0 4px 4px 0',
                  zIndex: 3,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setVideoDrag({
                    id: '__video__',
                    type: 'resize',
                    startMouseX: e.clientX,
                    startSec: videoStart,
                    startDuration: videoDur,
                  });
                }}
              />
            </div>,
            false,
            'video',
            <button
              type="button"
              className={`timeline-track-toggle${lockSubtitleVideo ? ' active' : ''}`}
              aria-label={lockSubtitleVideo ? 'Buka kunci dengan subtitle' : 'Kunci bersama subtitle'}
              aria-pressed={lockSubtitleVideo}
              title={lockSubtitleVideo ? '🔗 Terkunci dengan Subtitle (Klik untuk melepas)' : '🔓 Terpisah dari Subtitle (Klik untuk mengunci)'}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setLockSubtitleVideo((l) => !l)}
              style={{
                fontSize: '10px',
                color: lockSubtitleVideo ? '#10B981' : 'var(--text-sub)',
                background: lockSubtitleVideo ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: `1px solid ${lockSubtitleVideo ? 'rgba(16, 185, 129, 0.5)' : 'var(--border)'}`,
                borderRadius: '4px',
                padding: '0 4px',
                cursor: 'pointer',
                lineHeight: '16px',
                height: '18px',
              }}
            >
              {lockSubtitleVideo ? '🔗' : '🔓'}
            </button>,
          )}

          {/* ── TRACK: AI Narration Voice (when in narration mode) ─────────── */}
          {outputMode === 'narration' &&
            renderTrackRow(
              <>🎙️ Narasi<br />Suara AI</>,
              synthesizingTts ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#67E8F9',
                    background: 'rgba(6, 182, 212, 0.12)',
                    border: '1px dashed #06B6D4',
                    borderRadius: '6px',
                  }}
                >
                  ⏳ Mensintesis Audio Narasi AI...
                </div>
              ) : narrationAudioUrl ? (
                <div
                  className={`timeline-block timeline-audio-clip${selectedBlockId === '__narration__' ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Track narasi AI, durasi ${formatTimecode(durationSec)}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekToBlock('__narration__', 0); } }}
                  style={{
                    ...blockStyle('0%', '100%', 'linear-gradient(90deg, #0284C7 0%, #06B6D4 100%)', {
                      cursor: 'pointer',
                      justifyContent: 'flex-start',
                      gap: '6px',
                      paddingLeft: '10px',
                    }),
                    ...selectedOutline('__narration__'),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToBlock('__narration__', 0);
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      label: '🎙️ Audio Narasi AI (TTS)',
                      duration: formatTimecode(durationSec),
                    })
                  }
                  onMouseMove={(e) =>
                    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                  }
                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                >
                  🎙️ Audio Narasi AI (TTS Suara Baru)
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10.5px',
                    color: '#FDE68A',
                    background: 'rgba(245, 158, 11, 0.10)',
                    border: '1px dashed rgba(245, 158, 11, 0.4)',
                    borderRadius: '6px',
                  }}
                >
                  ⚠️ Audio narasi belum disintesis
                </div>
              ),
              false,
              'narration',
            )}

          {/* ── TRACK 5: Background Music ─────────────────────────────────── */}
          {renderTrackRow(
            <>🎵 Musik<br />BG</>,
            enableMusic ? (
              <div
                className={`timeline-block timeline-audio-clip${selectedBlockId === '__music__' ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Track musik ${musicTrackLabel ?? 'Background Music'}, volume ${musicVolume} persen`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekToBlock('__music__', 0); } }}
                style={{
                  ...blockStyle('0%', '100%', 'linear-gradient(90deg, #A855F7 0%, #7C3AED 100%)', {
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    gap: '6px',
                    paddingLeft: '10px',
                    paddingRight: '32px',
                  }),
                  ...selectedOutline('__music__'),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekToBlock('__music__', 0);
                }}
                onMouseEnter={(e) =>
                  setTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    label: `🎵 ${musicTrackLabel ?? 'Background Music'}`,
                    duration: `Vol: ${musicVolume}% — drag handle untuk ubah`,
                  })
                }
                onMouseMove={(e) =>
                  setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                }
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              >
                {/* Mini audio waveform decoration */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: '60px',
                    height: '100%',
                    pointerEvents: 'none',
                    opacity: 0.28,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '0 8px',
                    overflow: 'hidden',
                  }}
                  aria-hidden="true"
                >
                  {Array.from({ length: 54 }).map((_, i) => {
                    const h = 20 + Math.sin(i * 0.45) * 35 + Math.cos(i * 0.9) * 25 + ((i % 3) * 10);
                    const clampedH = Math.max(16, Math.min(88, Math.round(h)));
                    return (
                      <div
                        key={i}
                        style={{
                          width: '2px',
                          height: `${clampedH}%`,
                          background: '#FFFFFF',
                          borderRadius: '1px',
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
                🎵 {musicTrackLabel ?? 'Background Music'}
                <span style={{ opacity: 0.75, fontSize: '9px', marginLeft: '4px' }}>
                  Vol: {musicVolume}%
                </span>

                {/* Volume track bar */}
                {onMusicVolumeChange && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '48px',
                      height: '6px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${musicVolume}%`,
                        background: 'rgba(255,255,255,0.8)',
                        borderRadius: '3px',
                        transition: 'width 0.05s',
                      }}
                    />
                  </div>
                )}

                {/* Volume drag handle */}
                {onMusicVolumeChange && (
                  <div
                    className="timeline-music-volume-handle"
                    style={{ right: `calc(${100 - musicVolume}% * 0.048 + 4px)` }}
                    title={`Volume: ${musicVolume}% — drag kiri/kanan`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setVolumeDrag({ startMouseX: e.clientX, startVolume: musicVolume });
                    }}
                  />
                )}
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'var(--text-sub)',
                  fontStyle: 'italic',
                  pointerEvents: 'none',
                }}
              >
                Tidak ada musik — tambahkan dari panel 🎵
              </div>
            ),
            false,
            'music',
            <button type="button" className="timeline-track-toggle" aria-label={`${enableMusic ? 'Nonaktifkan' : 'Aktifkan'} musik`} aria-pressed={enableMusic} title="Aktif/nonaktif musik latar" onMouseDown={(e) => e.stopPropagation()} onClick={() => onEnableMusicChange?.(!enableMusic)}>{enableMusic ? '●' : '○'}</button>,
          )}
        </div>
      </div>

      {/* ── Footer: Timecode + Keyboard Hint + Legend ─────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px 6px 102px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-sub)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Current timecode */}
        <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          ▶ {formatTimecode(currentSec)} / {formatTimecode(durationSec)}
        </span>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { color: '#3282B8', label: 'Hook' },
            { color: 'rgba(50,130,184,0.5)', label: 'Subtitle' },
            { color: '#F59E0B', label: 'B-Roll' },
            { color: 'linear-gradient(90deg,#F97316,#06B6D4,#EC4899)', label: 'AI UI' },
            { color: '#10B981', label: 'Video' },
            { color: '#A855F7', label: 'Musik' },
            { color: '#EC4899', label: 'Outro' },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  background: color,
                  borderRadius: '2px',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
