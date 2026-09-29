/**
 * CanvasOverlayEditor — True canvas overlay ON TOP of the Remotion Player
 *
 * Design:
 * - Transparent canvas sits `position: absolute, inset: 0` over the <Player>
 * - A small floating library pill sits outside the player (right side)
 * - Inspector is a compact floating panel below the player when an overlay is selected
 * - Toggled with a button that appears in the top-right corner of the player frame
 * - Positions saved as % so they map correctly to the Remotion composition coords
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DynamicOverlayItem } from '../../types/producer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasOverlayEditorProps {
  /** Whether the overlay editor is active */
  open: boolean;
  onToggle: () => void;
  overlays: DynamicOverlayItem[];
  videoDurationSec: number;
  currentTimeSec?: number;
  onUpdateOverlay: (id: string, patch: Partial<DynamicOverlayItem>) => void;
  onAddOverlay: (overlay: Omit<DynamicOverlayItem, 'id'>) => void;
  onRemoveOverlay: (id: string) => void;
  /** Count badge shown on toggle button when closed */
  overlayCount?: number;
}

interface LibraryItem {
  emoji: string;
  label: string;
  type: DynamicOverlayItem['type'];
  content: string;
  defaultAnimation: DynamicOverlayItem['animation'];
  color?: string;
}

const LIBRARY_ITEMS: LibraryItem[] = [
  { emoji: '🔥', label: 'Api', type: 'sticker', content: '🔥', defaultAnimation: 'bounce', color: '#FF6B35' },
  { emoji: '⚡', label: 'Petir', type: 'sticker', content: '⚡', defaultAnimation: 'pulse', color: '#FFD60A' },
  { emoji: '💥', label: 'Boom', type: 'sticker', content: '💥', defaultAnimation: 'bounce', color: '#FF4D6D' },
  { emoji: '🎯', label: 'Target', type: 'sticker', content: '🎯', defaultAnimation: 'spin', color: '#00F5D4' },
  { emoji: '✨', label: 'Bintang', type: 'sticker', content: '✨', defaultAnimation: 'pulse', color: '#F8C60A' },
  { emoji: '👆', label: 'Tunjuk', type: 'sticker', content: '👆', defaultAnimation: 'bounce', color: '#FFFFFF' },
  { emoji: '💬', label: 'Callout', type: 'callout', content: 'WOW!', defaultAnimation: 'bounce', color: '#FFE500' },
  { emoji: '🏷️', label: 'Badge', type: 'badge', content: 'VIRAL', defaultAnimation: 'pulse', color: '#00F0FF' },
  { emoji: 'T', label: 'Teks', type: 'text', content: 'Ketuk untuk edit...', defaultAnimation: 'fade', color: '#FFFFFF' },
  { emoji: '📌', label: 'Label', type: 'callout', content: 'PENTING!', defaultAnimation: 'none', color: '#FF4D4D' },
];

const ANIMATION_OPTIONS: Array<DynamicOverlayItem['animation']> = [
  'none', 'bounce', 'pulse', 'fade', 'slide', 'spin',
];

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// ---------------------------------------------------------------------------
// Toggle Button (rendered by parent INSIDE the player wrapper)
// ---------------------------------------------------------------------------
export const CanvasOverlayToggleButton: React.FC<{
  open: boolean;
  onToggle: () => void;
  overlayCount: number;
}> = ({ open, onToggle, overlayCount }) => (
  <button
    type="button"
    onClick={onToggle}
    title={open ? 'Tutup Canvas Editor' : 'Buka Canvas Overlay Editor'}
    style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      background: open
        ? 'rgba(50,130,184,0.92)'
        : 'rgba(10,14,20,0.82)',
      border: `1.5px solid ${open ? '#3282B8' : 'rgba(255,255,255,0.18)'}`,
      borderRadius: '10px',
      padding: '5px 10px',
      color: open ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
      fontSize: '11px',
      fontWeight: 800,
      cursor: 'pointer',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.18s ease',
      boxShadow: open
        ? '0 0 16px rgba(50,130,184,0.6)'
        : '0 2px 10px rgba(0,0,0,0.6)',
      letterSpacing: '0.02em',
    }}
  >
    {open ? '✕ Tutup Editor' : '🎨 Canvas'}
    {!open && overlayCount > 0 && (
      <span style={{
        background: '#3282B8',
        borderRadius: '999px',
        padding: '1px 6px',
        fontSize: '9px',
        color: '#FFFFFF',
        fontWeight: 800,
      }}>
        {overlayCount}
      </span>
    )}
  </button>
);

// ---------------------------------------------------------------------------
// DraggableOverlayHandle
// ---------------------------------------------------------------------------
interface OverlayHandleProps {
  overlay: DynamicOverlayItem;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onPositionChange: (x: number, y: number) => void;
}

const DraggableOverlayHandle: React.FC<OverlayHandleProps> = ({
  overlay,
  canvasWidth,
  canvasHeight,
  isSelected,
  isActive,
  onSelect,
  onPositionChange,
}) => {
  const dragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0 });

  const xPct = typeof overlay.position?.x === 'string'
    ? parseFloat(overlay.position.x) / 100
    : (overlay.position?.x as number ?? 50) / 100;
  const yPct = typeof overlay.position?.y === 'string'
    ? parseFloat(overlay.position.y) / 100
    : (overlay.position?.y as number ?? 50) / 100;

  const pxX = xPct * canvasWidth;
  const pxY = yPct * canvasHeight;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    dragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, elX: pxX, elY: pxY };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const newX = clamp(dragStart.current.elX + ev.clientX - dragStart.current.mouseX, 0, canvasWidth);
      const newY = clamp(dragStart.current.elY + ev.clientY - dragStart.current.mouseY, 0, canvasHeight);
      onPositionChange(newX, newY);
    };
    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [pxX, pxY, canvasWidth, canvasHeight, onSelect, onPositionChange]);

  const labelText = overlay.type === 'sticker'
    ? overlay.content
    : overlay.content.length > 14 ? overlay.content.slice(0, 14) + '…' : overlay.content;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: pxX,
        top: pxY,
        transform: 'translate(-50%, -50%)',
        cursor: isSelected ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: isSelected ? 100 : 50,
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9.5px',
          color: '#3282B8',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.95)',
          pointerEvents: 'none',
          background: 'rgba(10,14,20,0.85)',
          borderRadius: '4px',
          padding: '1px 5px',
        }}>
          ✥ Geser
        </div>
      )}
      <div style={{
        background: isSelected
          ? 'rgba(50, 130, 184, 0.9)'
          : isActive
            ? 'rgba(0, 240, 255, 0.15)'
            : 'rgba(10, 14, 20, 0.80)',
        border: `2px solid ${isSelected ? '#3282B8' : isActive ? 'rgba(0,240,255,0.7)' : 'rgba(255,255,255,0.3)'}`,
        borderRadius: '10px',
        padding: '5px 9px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        backdropFilter: 'blur(12px)',
        boxShadow: isSelected
          ? '0 0 20px rgba(50,130,184,0.8), 0 4px 12px rgba(0,0,0,0.8)'
          : '0 4px 14px rgba(0,0,0,0.7)',
        transition: 'border-color 0.12s ease, background 0.12s ease',
        whiteSpace: 'nowrap',
        maxWidth: '140px',
        overflow: 'hidden',
      }}>
        <span style={{ fontSize: overlay.type === 'sticker' ? '20px' : '14px', flexShrink: 0 }}>
          {overlay.type === 'sticker' ? overlay.content :
            overlay.type === 'callout' ? '💬' :
            overlay.type === 'badge' ? '🏷️' : 'T'}
        </span>
        {overlay.type !== 'sticker' && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {labelText}
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component — renders as overlay children (position: absolute over player)
// ---------------------------------------------------------------------------
export const CanvasOverlayEditor: React.FC<CanvasOverlayEditorProps> = ({
  open,
  onToggle,
  overlays,
  videoDurationSec,
  currentTimeSec = 0,
  onUpdateOverlay,
  onAddOverlay,
  onRemoveOverlay,
  overlayCount = 0,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedOverlay = selectedId ? overlays.find((o) => o.id === selectedId) ?? null : null;

  // Keyboard delete
  useEffect(() => {
    if (!open || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        onRemoveOverlay(selectedId);
        setSelectedId(null);
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selectedId, onRemoveOverlay]);

  // Deselect when editor closes
  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  const handleLibraryDragStart = (e: React.DragEvent, item: LibraryItem) => {
    e.dataTransfer.setData('application/canvas-overlay', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/canvas-overlay')) {
      e.preventDefault();
      setIsDragOverCanvas(true);
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    const raw = e.dataTransfer.getData('application/canvas-overlay');
    if (!raw) return;
    const item: LibraryItem = JSON.parse(raw);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 5, 95);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 5, 95);
    const tStart = Math.max(0, Math.min(currentTimeSec, videoDurationSec - 1));
    const tEnd = Math.min(videoDurationSec, tStart + 3);
    onAddOverlay({
      type: item.type,
      content: item.content,
      start: tStart,
      end: tEnd,
      position: { x: `${xPct.toFixed(1)}%`, y: `${yPct.toFixed(1)}%` },
      animation: item.defaultAnimation,
      styles: item.color ? { color: item.color } : {},
    });
  };

  const handlePositionChange = useCallback((id: string, pxX: number, pxY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onUpdateOverlay(id, {
      position: {
        x: `${clamp((pxX / rect.width) * 100, 1, 99).toFixed(1)}%`,
        y: `${clamp((pxY / rect.height) * 100, 1, 99).toFixed(1)}%`,
      },
    });
  }, [onUpdateOverlay]);

  const handleInspectorChange = (patch: Partial<DynamicOverlayItem>) => {
    if (!selectedId) return;
    onUpdateOverlay(selectedId, patch);
  };

  return (
    <>
      {/* ====================================================================
          TOGGLE BUTTON — always visible in top-right corner of player
          ==================================================================== */}
      <CanvasOverlayToggleButton
        open={open}
        onToggle={onToggle}
        overlayCount={overlayCount}
      />

      {/* ====================================================================
          TRANSPARENT CANVAS OVERLAY — only visible when open
          ==================================================================== */}
      {open && (
        <div
          ref={canvasRef}
          onClick={(e) => { if (e.target === canvasRef.current) setSelectedId(null); }}
          onDragOver={handleCanvasDragOver}
          onDragLeave={() => setIsDragOverCanvas(false)}
          onDrop={handleCanvasDrop}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 200,
            cursor: 'default',
            overflow: 'hidden',
            // Subtle blue tint when drag hovering
            background: isDragOverCanvas ? 'rgba(50,130,184,0.12)' : 'transparent',
            transition: 'background 0.15s ease',
          }}
        >
          {/* Rule-of-thirds grid */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.12,
            }}
          >
            <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="50%" cy="50%" r="3" stroke="#fff" strokeWidth="1" fill="none" />
          </svg>

          {/* Drop hint */}
          {overlays.length === 0 && !isDragOverCanvas && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10,14,20,0.8)',
              border: '1px dashed rgba(50,130,184,0.5)',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '11px',
              color: 'rgba(187,225,250,0.7)',
              fontWeight: 700,
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              ← Drag item dari library ke sini
            </div>
          )}

          {/* Drag-over hint */}
          {isDragOverCanvas && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 300,
            }}>
              <div style={{
                background: 'rgba(10,14,20,0.92)',
                border: '2px dashed #3282B8',
                borderRadius: '16px',
                padding: '16px 28px',
                fontSize: '14px',
                fontWeight: 800,
                color: '#BBE1FA',
                boxShadow: '0 0 30px rgba(50,130,184,0.4)',
              }}>
                🎯 Lepaskan di sini
              </div>
            </div>
          )}

          {/* Overlay handles */}
          {overlays.map((ov) => {
            const isActive = currentTimeSec >= ov.start && currentTimeSec <= ov.end;
            const rect = canvasRef.current;
            const w = rect?.clientWidth ?? 340;
            const h = rect?.clientHeight ?? 604;
            return (
              <DraggableOverlayHandle
                key={ov.id}
                overlay={ov}
                canvasWidth={w}
                canvasHeight={h}
                isSelected={ov.id === selectedId}
                isActive={isActive}
                onSelect={() => setSelectedId(ov.id)}
                onPositionChange={(px, py) => handlePositionChange(ov.id, px, py)}
              />
            );
          })}

          {/* Bottom status bar inside canvas */}
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}>
            <span style={{
              background: 'rgba(10,14,20,0.82)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '9.5px',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
            }}>
              📐 {overlays.length} overlay · Rule-of-thirds grid
              {selectedId && ` · ✓ ${selectedOverlay?.type} dipilih`}
            </span>
            {selectedId && (
              <span style={{
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '9.5px',
                color: '#FCA5A5',
                fontWeight: 700,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              // Note: pointerEvents inline doesn't trigger onClick cleanly from 'none' parent
              // so this is cosmetic; actual delete is via keyboard or inspector
              >
                ⌫ Del untuk hapus
              </span>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          FLOATING LIBRARY — pill on the right side of the player (outside player)
          Rendered as absolute sibling — parent must be position:relative
          We render it at zIndex 400 so it's above the canvas overlay.
          Library is a vertical strip that hugs the right edge.
          ==================================================================== */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: '-72px',
            width: '64px',
            zIndex: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            // If there's not enough space on the right, collapse to tooltip mode
          }}
        >
          {/* Library header toggle */}
          <button
            type="button"
            onClick={() => setLibraryOpen((v) => !v)}
            style={{
              background: 'rgba(50,130,184,0.9)',
              border: '1.5px solid #3282B8',
              borderRadius: '10px',
              padding: '5px',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.3,
              boxShadow: '0 4px 14px rgba(50,130,184,0.5)',
            }}
          >
            {libraryOpen ? '📦 Item' : '📦'}
          </button>

          {libraryOpen && LIBRARY_ITEMS.map((item) => (
            <div
              key={`${item.type}-${item.content}`}
              draggable
              onDragStart={(e) => handleLibraryDragStart(e, item)}
              title={`${item.label} — drag ke canvas`}
              style={{
                background: 'rgba(10,14,20,0.88)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '10px',
                padding: '6px 4px',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                userSelect: 'none',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3282B8';
                e.currentTarget.style.background = 'rgba(50,130,184,0.2)';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                e.currentTarget.style.background = 'rgba(10,14,20,0.88)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.emoji}</span>
              <span style={{
                fontSize: '8px',
                color: 'rgba(255,255,255,0.5)',
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: '54px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          INSPECTOR PANEL — floats BELOW the canvas (rendered outside player)
          Parent must position this below. We'll render it as absolute bottom.
          Actually: render it INSIDE the player as a floating bottom sheet.
          ==================================================================== */}
      {open && selectedOverlay && (
        <div
          style={{
            position: 'absolute',
            bottom: '44px', // above the status bar / player controls
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 250,
            background: 'rgba(10,14,20,0.95)',
            border: '1.5px solid rgba(50,130,184,0.6)',
            borderRadius: '14px',
            padding: '12px 14px',
            minWidth: '300px',
            maxWidth: '94%',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(50,130,184,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
          // Stop propagation so clicks in inspector don't deselect
          onClick={(e) => e.stopPropagation()}
        >
          {/* Inspector header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '13px' }}>🔧</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>Inspector</span>
              <span style={{
                background: 'rgba(50,130,184,0.25)',
                border: '1px solid rgba(50,130,184,0.5)',
                borderRadius: '5px',
                padding: '1px 7px',
                fontSize: '9.5px',
                color: '#BBE1FA',
                fontWeight: 800,
                textTransform: 'uppercase',
              }}>
                {selectedOverlay.type}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => { onRemoveOverlay(selectedOverlay.id); setSelectedId(null); }}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#FCA5A5',
                  borderRadius: '7px',
                  padding: '3px 9px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                🗑️ Hapus
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.5)',
                  borderRadius: '7px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content + Animation + Time — compact single row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'end' }}>
            {/* Content */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                Konten:
              </label>
              <input
                type="text"
                value={selectedOverlay.content}
                onChange={(e) => handleInspectorChange({ content: e.target.value })}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '7px',
                  padding: '6px 10px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Time range */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                Mulai–Selesai (s):
              </label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number" min={0} max={videoDurationSec} step={0.5}
                  value={selectedOverlay.start.toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleInspectorChange({ start: clamp(val, 0, selectedOverlay.end - 0.5) });
                  }}
                  style={{ width: '52px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px', color: '#FFFFFF', fontSize: '11px', outline: 'none', textAlign: 'center' }}
                />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>→</span>
                <input
                  type="number" min={0} max={videoDurationSec} step={0.5}
                  value={selectedOverlay.end.toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleInspectorChange({ end: clamp(val, selectedOverlay.start + 0.5, videoDurationSec) });
                  }}
                  style={{ width: '52px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px', color: '#FFFFFF', fontSize: '11px', outline: 'none', textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Position display */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                Posisi:
              </label>
              <div style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '7px',
                padding: '5px 8px',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                X {selectedOverlay.position?.x ?? '50%'}<br/>
                Y {selectedOverlay.position?.y ?? '50%'}
              </div>
            </div>
          </div>

          {/* Animation chips */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-sub)', fontWeight: 700, display: 'block', marginBottom: '5px' }}>
              Animasi:
            </label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {ANIMATION_OPTIONS.map((anim) => (
                <button
                  key={anim}
                  type="button"
                  onClick={() => handleInspectorChange({ animation: anim })}
                  style={{
                    background: selectedOverlay.animation === anim ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                    border: selectedOverlay.animation === anim ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '10px',
                    color: selectedOverlay.animation === anim ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    transition: 'all 0.12s ease',
                    letterSpacing: '0.04em',
                  }}
                >
                  {anim}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
