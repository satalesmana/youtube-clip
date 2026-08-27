/**
 * Types for the watermark detection and blurring feature.
 *
 * A WatermarkRegion uses pixel coordinates (when normalized=false) or
 * normalised 0–1 coordinates (when normalized=true) so it can be applied
 * to any resolution. The WatermarkFilterService always converts to pixels
 * before handing off to FFmpeg.
 */

/** A rectangular area that contains a watermark. */
export interface WatermarkRegion {
  /** Left edge in pixels (or 0-1 normalised when `normalized=true`). */
  x: number;
  /** Top edge in pixels (or 0-1 normalised when `normalized=true`). */
  y: number;
  /** Width in pixels (or 0-1 normalised when `normalized=true`). */
  width: number;
  /** Height in pixels (or 0-1 normalised when `normalized=true`). */
  height: number;
  /** When true, x/y/width/height are ratios (0-1) relative to the frame size. */
  normalized?: boolean;
  /** Detection confidence 0-1 (1 = certain). */
  confidence?: number;
  /** Human-readable label (e.g. "TikTok logo", "@handle", "channel bug"). */
  label?: string;
}

/**
 * Preset corner positions that map to common watermark locations.
 * Used when the caller does not want AI detection but knows where the
 * watermark lives.
 */
export type WatermarkPresetPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Controls how watermarks are discovered and blurred.
 *
 * - `auto`   — runs Vision AI to detect watermark regions automatically.
 * - `preset` — applies blur to one or more of the four common corners
 *              (top-left, top-right, bottom-left, bottom-right) without AI.
 * - `custom` — caller supplies explicit bounding boxes (e.g. from a UI canvas).
 * - `none`   — watermark blurring is disabled (no-op).
 */
export interface WatermarkBlurOptions {
  mode: 'auto' | 'preset' | 'custom' | 'none';
  /** For mode `preset`: which corners to blur (default: all four). */
  presetPositions?: WatermarkPresetPosition[];
  /**
   * Blur strength passed to FFmpeg's `boxblur` luma_radius (default: 15).
   * Higher values produce more aggressive blur.
   */
  blurStrength?: number;
  /**
   * Percentage of the frame's shorter side used to size each corner preset
   * patch. Default: 0.12 (12 %).
   */
  presetSizeFraction?: number;
  /** For mode `custom`: explicit bounding boxes supplied by the caller. */
  customRegions?: WatermarkRegion[];
}

/** Result returned by WatermarkDetectorService. */
export interface WatermarkDetectionResult {
  /** True when at least one watermark region was found. */
  hasWatermark: boolean;
  /** All detected regions (may be empty). */
  regions: WatermarkRegion[];
  /** Human-readable descriptions of detected watermarks. */
  detectedLabels: string[];
}
