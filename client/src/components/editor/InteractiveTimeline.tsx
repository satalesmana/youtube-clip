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
  enableBroll: boolean;
  onEnableBrollChange?: (enabled: boolean) => void;
  brollBlocks: BrollBlock[];
  enableMusic: boolean;
  onEnableMusicChange?: (enabled: boolean) => void;
  musicTrackLabel?: string; // e.g. "☕ Café Memories"
  musicVolume?: number; // 0–100
  enableOutro: boolean;
  outroDurationSec: number;
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
  type: 'move' | 'resize' | 'resize-left';
  startMouseX: number;
  startSec: number;       // original startSec (for move / resize-left)
  startDuration: number;  // original durationSec (for resize / resize-left)
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
  enableBroll,
  brollBlocks,
  enableMusic,
  musicTrackLabel,
  musicVolume = 25,
  enableOutro,
  outroDurationSec,
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
  zoomLevel: propZoomLevel,
  onZoomLevelChange,
}) => {
  // ── Internal State ──────────────────────────────────────────────────────────
  const [currentSec, setCurrentSec] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [brollDrag, setBrollDrag] = useState<BrollDragState | null>(null);
  const [aiOverlayDrag, setAiOverlayDrag] = useState<BrollDragState | null>(null);
  const [volumeDrag, setVolumeDrag] = useState<VolumeDragState | null>(null);
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
  const currentSecRef = useRef(0);
  const zoomLevelRef = useRef(1);
  const zoomAnchorRef = useRef<{ zoom: number; sec: number; viewportX: number } | null>(null);
  // ── QW-2: Throttle seekTo — buffer pending seek, flush once per RAF frame ──
  const pendingSeekFrameRef = useRef<number | null>(null);

  isDraggingPlayheadRef.current = isDraggingPlayhead;
  brollDragRef.current = brollDrag;
  aiOverlayDragRef.current = aiOverlayDrag;
  volumeDragRef.current = volumeDrag;
  currentSecRef.current = currentSec;
  zoomLevelRef.current = zoomLevel;

  // Global drag cursor and selection guard
  useEffect(() => {
    if (brollDrag || aiOverlayDrag || isDraggingPlayhead || volumeDrag) {
      document.body.style.userSelect = 'none';
      if (isDraggingPlayhead) document.body.style.cursor = 'ew-resize';
      else if (brollDrag?.type === 'move' || aiOverlayDrag?.type === 'move') document.body.style.cursor = 'grabbing';
      else if (brollDrag?.type?.startsWith('resize') || aiOverlayDrag?.type?.startsWith('resize')) document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [brollDrag, aiOverlayDrag, isDraggingPlayhead, volumeDrag]);

  // ── Computed track metrics ───────────────────────────────────────────────────
  const hookEnd = enableHookIntro ? hookDurationSec : 0;
  const outroStart = durationSec - (enableOutro ? outroDurationSec : 0);

  // ── QW-3: Memoized snap points — only recompute when blocks actually change ──
  const snapPoints = useMemo(
    () => [0, hookEnd, outroStart, durationSec],
    [hookEnd, outroStart, durationSec],
  );

  const clipSnapPoints = useMemo(
    (): Array<{ sec: number; id?: string }> => [
      ...snapPoints.map((sec) => ({ sec })),
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
      const vDrag = volumeDragRef.current;
      if (vDrag && onMusicVolumeChange) {
        const rect = getContentRect();
        const totalWidth = rect?.width ?? 600;
        const deltaPct = ((e.clientX - vDrag.startMouseX) / totalWidth) * 100;
        const newVol = Math.max(0, Math.min(100, vDrag.startVolume + deltaPct));
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
      if (!drag) return;

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
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setBrollDrag(null);
      setAiOverlayDrag(null);
      setVolumeDrag(null);

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
  const subtitleStart = outputMode === 'reel' && enableHookIntro ? hookEnd : 0;
  const subtitleEnd = durationSec;
  const subtitleLeft = secToPercent(subtitleStart);
  const subtitleWidth = secToPercent(subtitleEnd - subtitleStart);
  const videoStart = outputMode === 'reel' && enableHookIntro ? hookEnd : 0;
  const videoLeft = secToPercent(videoStart);
  const videoWidth = secToPercent(Math.max(0, durationSec - videoStart));

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

          {/* ── TRACK 1: Hook ────────────────────────────────────────────── */}
          {renderTrackRow(
            <>⚡ Hook<br />Intro</>,
            <>
              {enableHookIntro && (
                <div
                  className={`timeline-block${selectedBlockId === '__hook__' ? ' selected' : ''}`}
                  style={{
                    ...blockStyle('0%', secToPercent(hookDurationSec), '#3282B8', { cursor: 'pointer' }),
                    ...selectedOutline('__hook__'),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToBlock('__hook__', 0);
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
                  ⚡ Hook
                </div>
              )}
              {enableOutro && outputMode === 'reel' && (
              <div
                  className={`timeline-block${selectedBlockId === '__outro__' ? ' selected' : ''}`}
                  style={{
                    ...blockStyle(secToPercent(outroStart), secToPercent(outroDurationSec), '#EC4899', { cursor: 'pointer' }),
                    ...selectedOutline('__outro__'),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToBlock('__outro__', outroStart);
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      label: '🏁 Outro CTA',
                      duration: formatTimecode(outroDurationSec),
                    })
                  }
                  onMouseMove={(e) =>
                    setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                  }
                  onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                >
                  🏁 Outro
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
              className={`timeline-block${selectedBlockId === '__subtitle__' ? ' selected' : ''}`}
              style={{
                ...blockStyle(subtitleLeft, subtitleWidth, 'rgba(50,130,184,0.55)', { cursor: 'pointer', justifyContent: 'flex-start' }),
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
              onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, label: '💬 Subtitle Karaoke', duration: formatTimecode(subtitleEnd - subtitleStart) })}
              onMouseMove={(e) => setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              💬 Subtitle Karaoke
            </div>,
            false,
            'subtitle',
          )}

          {/* ── TRACK: Outro ─────────────────────────────────────────────── */}
          {enableOutro && outputMode === 'narration' && renderTrackRow(
            <>🏁 Outro</>,
            <div
              className={`timeline-block${selectedBlockId === '__outro__' ? ' selected' : ''}`}
              style={{ ...blockStyle(secToPercent(outroStart), secToPercent(outroDurationSec), '#EC4899', { cursor: 'pointer' }), ...selectedOutline('__outro__') }}
              role="button"
              tabIndex={0}
              aria-label={`Outro CTA, durasi ${formatTimecode(outroDurationSec)}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekToBlock('__outro__', outroStart); } }}
              onClick={(e) => { e.stopPropagation(); seekToBlock('__outro__', outroStart); }}
            >
              🏁 Outro CTA
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
              className={`timeline-block${selectedBlockId === '__video__' ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Track video utama, mulai ${formatTimecode(videoStart)}, durasi ${formatTimecode(durationSec - videoStart)}, volume ${sourceVolume ?? 100} persen`}
              style={{
                ...blockStyle(videoLeft, videoWidth, '#10B981', { cursor: 'pointer', justifyContent: 'flex-start' }),
                ...selectedOutline('__video__'),
              }}
              onClick={(e) => {
                e.stopPropagation();
                seekToBlock('__video__', videoStart);
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  label: outputMode === 'narration' ? `🎥 Video Klip Utama (Ducking Vol: ${sourceVolume ?? 25}%)` : `🎥 Video Klip Utama (Vol: ${sourceVolume ?? 100}%)`,
                  duration: formatTimecode(durationSec),
                })
              }
              onMouseMove={(e) =>
                setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
              }
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              🎥 Video Klip Utama
              {sourceVolume !== undefined && (
                <span style={{ opacity: 0.85, fontSize: '9px', marginLeft: '6px' }}>
                  {outputMode === 'narration' ? `(Ducking: ${sourceVolume}%)` : `(Vol: ${sourceVolume}%)`}
                </span>
              )}

            </div>,
            false,
            'video',
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
