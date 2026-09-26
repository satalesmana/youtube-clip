import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export interface InteractiveTimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationSec: number;
  fps: number;
  // Track states
  enableHookIntro: boolean;
  hookDurationSec: number; // default 3.5
  enableBroll: boolean;
  brollBlocks: BrollBlock[];
  enableMusic: boolean;
  musicTrackLabel?: string; // e.g. "☕ Café Memories"
  musicVolume?: number; // 0–100
  enableOutro: boolean;
  outroDurationSec: number;
  // Callbacks
  onSeek: (sec: number) => void;
  onBrollBlockMove: (id: string, newStartSec: number) => void;
  onBrollBlockResize: (id: string, newDurationSec: number) => void;
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
  type: 'move' | 'resize';
  startMouseX: number;
  startSec: number;       // original startSec (for move)
  startDuration: number;  // original durationSec (for resize)
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
  onSeek,
  onBrollBlockMove,
  onBrollBlockResize,
  onMusicVolumeChange,
  onBrollBlockDelete,
}) => {
  // ── Internal State ──────────────────────────────────────────────────────────
  const [currentSec, setCurrentSec] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [brollDrag, setBrollDrag] = useState<BrollDragState | null>(null);
  const [volumeDrag, setVolumeDrag] = useState<VolumeDragState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    duration: '',
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeSnapSec, setActiveSnapSec] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures
  const isDraggingPlayheadRef = useRef(false);
  const brollDragRef = useRef<BrollDragState | null>(null);
  const volumeDragRef = useRef<VolumeDragState | null>(null);
  const currentSecRef = useRef(0);
  const zoomLevelRef = useRef(1);

  isDraggingPlayheadRef.current = isDraggingPlayhead;
  brollDragRef.current = brollDrag;
  volumeDragRef.current = volumeDrag;
  currentSecRef.current = currentSec;
  zoomLevelRef.current = zoomLevel;

  // ── Computed track metrics ───────────────────────────────────────────────────
  const hookEnd = enableHookIntro ? hookDurationSec : 0;
  const outroStart = durationSec - (enableOutro ? outroDurationSec : 0);

  // Snap points (in seconds)
  const snapPoints = [0, hookEnd, outroStart, durationSec];

  // ── RAF Sync with Player ────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;
    const poll = () => {
      if (playerRef.current && !isDraggingPlayheadRef.current) {
        const frame = playerRef.current.getCurrentFrame();
        setCurrentSec(frame / fps);
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
      setZoomLevel((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor)));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [durationSec, fps, onSeek, playerRef]);

  // ── Helper: get content area rect ────────────────────────────────────────────
  const getContentRect = useCallback(() => {
    return contentAreaRef.current?.getBoundingClientRect() ?? null;
  }, []);

  // ── Helper: sec → left px within zoomed content ──────────────────────────────
  const secToLeftPx = useCallback(
    (sec: number): number => {
      const rect = getContentRect();
      const baseWidth = rect?.width ?? 600;
      const totalWidth = baseWidth * zoomLevel;
      return Math.min(totalWidth, (sec / durationSec) * totalWidth);
    },
    [durationSec, zoomLevel, getContentRect],
  );

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
      const totalWidth = rect.width * zoomLevelRef.current;
      const posX = clientX - rect.left + scrollLeft;
      const ratio = Math.max(0, Math.min(1, posX / totalWidth));
      return ratio * durationSec;
    },
    [durationSec, getContentRect],
  );

  // ── Snap helper ──────────────────────────────────────────────────────────────
  const snapSec = useCallback(
    (sec: number, pxPerSec: number, bypassSnap?: boolean): number => {
      if (bypassSnap) {
        setActiveSnapSec(null);
        return sec;
      }
      for (const point of snapPoints) {
        const distPx = Math.abs(sec - point) * pxPerSec;
        if (distPx < SNAP_PX_THRESHOLD) {
          setActiveSnapSec(point);
          return point;
        }
      }
      setActiveSnapSec(null);
      return sec;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapPoints.join(',')],
  );

  // ── Playhead Mouse Down (on any track-content area) ──────────────────────────
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
    const totalWidth = rect.width * zoomLevel;
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

  // ── Global Mouse Move & Up (playhead + b-roll + volume drag) ─────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Volume drag
      const vDrag = volumeDragRef.current;
      if (vDrag && onMusicVolumeChange) {
        const rect = getContentRect();
        const totalWidth = (rect?.width ?? 600) * zoomLevelRef.current;
        const deltaPct = ((e.clientX - vDrag.startMouseX) / totalWidth) * 100;
        const newVol = Math.max(0, Math.min(100, vDrag.startVolume + deltaPct));
        onMusicVolumeChange(Math.round(newVol));
        return;
      }

      // Playhead drag
      if (isDraggingPlayheadRef.current) {
        const sec = mouseXToSec(e.clientX);
        setCurrentSec(sec);
        onSeek(sec);
        playerRef.current?.seekTo(Math.round(sec * fps));
        return;
      }

      // B-roll drag
      const drag = brollDragRef.current;
      if (!drag) return;

      const rect = getContentRect();
      if (!rect) return;
      const totalWidth = rect.width * zoomLevelRef.current;
      const pxPerSec = totalWidth / durationSec;
      const deltaSec = (e.clientX - drag.startMouseX) / pxPerSec;
      const bypass = e.altKey;

      if (drag.type === 'move') {
        const rawStart = Math.max(0, Math.min(durationSec, drag.startSec + deltaSec));
        const snapped = snapSec(rawStart, pxPerSec, bypass);
        onBrollBlockMove(drag.id, snapped);
      } else {
        const newDuration = Math.max(0.5, drag.startDuration + deltaSec);
        onBrollBlockResize(drag.id, newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setBrollDrag(null);
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
    onMusicVolumeChange,
    snapSec,
    getContentRect,
  ]);

  // ── Ruler Markers ────────────────────────────────────────────────────────────
  // Adapt marker interval based on zoom so we don't have too many / too few
  const rawInterval = 5 / zoomLevel;
  const markerInterval = rawInterval < 1 ? 1 : rawInterval < 2 ? 2 : 5;
  const rulerMarkers: number[] = [];
  for (let s = 0; s <= durationSec; s = Math.round((s + markerInterval) * 10) / 10) {
    rulerMarkers.push(s);
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
    },
    [onSeek, playerRef, fps],
  );

  // ─── Track Row wrapper ───────────────────────────────────────────────────────
  const renderTrackRow = (
    label: React.ReactNode,
    content: React.ReactNode,
    isFirst = false,
  ) => (
    <div className="timeline-track-row">
      <div className="timeline-track-label">{label}</div>
      <div
        ref={isFirst ? contentAreaRef : undefined}
        className="timeline-track-content"
        style={{ width: `${zoomLevel * 100}%` }}
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

  // Subtitle positioning
  const subtitleLeft = secToPercent(hookEnd);
  const subtitleWidth = secToPercent(outroStart - hookEnd);

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
              seekToBlock(contextMenu.id, brollBlocks.find(b => b.id === contextMenu.id)?.startSec ?? 0);
              setContextMenu(null);
            }}
          >
            ▶ Tuju ke blok ini
          </button>
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
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '9.5px',
            color: 'var(--text-sub)',
            fontStyle: 'italic',
          }}
        >
          ⌨ Space · ←→ ·  ⌥drag=no-snap · klik blok=seek
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
              width: '90px',
              minWidth: '90px',
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
                className="timeline-ruler-marker"
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
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>

          {/* ── TRACK 1: Hook + Subtitle + Outro ─────────────────────────── */}
          {renderTrackRow(
            <>⚡ Hook &<br />Subtitle</>,
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
              <div
                className={`timeline-block${selectedBlockId === '__subtitle__' ? ' selected' : ''}`}
                style={{
                  ...blockStyle(subtitleLeft, subtitleWidth, 'rgba(50,130,184,0.4)', { cursor: 'pointer' }),
                  ...selectedOutline('__subtitle__'),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekToBlock('__subtitle__', hookEnd);
                }}
                onMouseEnter={(e) =>
                  setTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    label: '💬 Subtitle Karaoke',
                    duration: formatTimecode(outroStart - hookEnd),
                  })
                }
                onMouseMove={(e) =>
                  setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
                }
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              >
                💬 Subtitle
              </div>
              {enableOutro && (
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
          )}

          {/* ── TRACK 2: B-Roll (Draggable) ──────────────────────────────── */}
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
                        setContextMenu({ id: block.id, x: e.clientX, y: e.clientY });
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
                      🎬{' '}
                      {block.query.length > 12 ? block.query.slice(0, 12) + '…' : block.query}
                      {/* Resize handle */}
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          width: '6px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '0 4px 4px 0',
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
          )}

          {/* ── TRACK 3: Video Utama ──────────────────────────────────────── */}
          {renderTrackRow(
            <>🎥 Video<br />Utama</>,
            <div
              className={`timeline-block${selectedBlockId === '__video__' ? ' selected' : ''}`}
              style={{
                ...blockStyle('0%', '100%', '#10B981', { cursor: 'pointer', justifyContent: 'flex-start' }),
                ...selectedOutline('__video__'),
              }}
              onClick={(e) => {
                e.stopPropagation();
                seekToBlock('__video__', 0);
              }}
              onMouseEnter={(e) =>
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  label: '🎥 Video Klip Utama',
                  duration: formatTimecode(durationSec),
                })
              }
              onMouseMove={(e) =>
                setTooltip((t) => ({ ...t, x: e.clientX, y: e.clientY }))
              }
              onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
            >
              🎥 Video Klip Utama
            </div>,
          )}

          {/* ── TRACK 4: Background Music ─────────────────────────────────── */}
          {renderTrackRow(
            <>🎵 Musik<br />BG</>,
            enableMusic ? (
              <div
                className={`timeline-block${selectedBlockId === '__music__' ? ' selected' : ''}`}
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
