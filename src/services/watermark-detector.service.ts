import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { extractFrame, probeResolution } from '../utils/ffmpeg.js';
import type { Logger } from '../utils/logger.js';
import type {
  WatermarkBlurOptions,
  WatermarkDetectionResult,
  WatermarkPresetPosition,
  WatermarkRegion,
} from '../types/watermark.js';

export interface WatermarkDetectorOptions {
  ffmpegBinaryPath?: string;
  tempDir: string;
}

/**
 * Pluggable watermark detector interface.
 *
 * Implementations may be swapped without touching calling code:
 *  - `NoOpWatermarkDetector`     — always returns no watermarks (safe default).
 *  - `PresetWatermarkDetector`   — maps preset corner names to pixel regions.
 *  - `VisionWatermarkDetector`   — uses a multimodal Vision LLM (future).
 */
export interface IWatermarkDetectorService {
  /**
   * Detects watermark regions from either explicit options or by inspecting a
   * frame of the source video.
   *
   * @param videoPath     Absolute path to the source video.
   * @param blurOptions   How the caller wants watermarks discovered.
   * @param timestamp     Frame timestamp to analyse (seconds, default 0.5s).
   */
  detect(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
    timestamp?: number,
  ): Promise<WatermarkDetectionResult>;
}

// ── No-op ─────────────────────────────────────────────────────────────────────

/** Safe default — never touches the video; always returns no watermarks. */
export class NoOpWatermarkDetector implements IWatermarkDetectorService {
  async detect(
    _videoPath: string,
    _blurOptions: WatermarkBlurOptions,
  ): Promise<WatermarkDetectionResult> {
    return { hasWatermark: false, regions: [], detectedLabels: [] };
  }
}

// ── Preset ─────────────────────────────────────────────────────────────────────

/**
 * Maps the four canonical corner positions ('top-left', 'top-right',
 * 'bottom-left', 'bottom-right') to pixel-space bounding boxes computed from
 * the video's actual resolution via FFmpeg probe.
 *
 * The patch size defaults to 12 % of the shorter frame dimension (width or
 * height), which covers typical platform watermarks (TikTok badge, channel
 * bug, @handle). The caller may override via `blurOptions.presetSizeFraction`.
 */
export class PresetWatermarkDetector implements IWatermarkDetectorService {
  constructor(
    private readonly options: WatermarkDetectorOptions,
    private readonly logger: Logger,
  ) {}

  async detect(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
  ): Promise<WatermarkDetectionResult> {
    if (blurOptions.mode !== 'preset' && blurOptions.mode !== 'auto') {
      return { hasWatermark: false, regions: [], detectedLabels: [] };
    }

    const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
    const resolution = await probeResolution({ binaryPath: ffmpeg, inputPath: videoPath });

    if (!resolution) {
      this.logger.warn({ videoPath }, 'Watermark detector: could not probe video resolution');
      return { hasWatermark: false, regions: [], detectedLabels: [] };
    }

    const { width, height } = resolution;
    const sizeFraction = blurOptions.presetSizeFraction ?? 0.12;
    const patchSize = Math.round(Math.min(width, height) * sizeFraction);

    const positions: WatermarkPresetPosition[] =
      blurOptions.presetPositions ?? ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

    const regions: WatermarkRegion[] = positions.map((pos) =>
      presetToRegion(pos, width, height, patchSize),
    );

    const labels = positions.map((p) => `Preset corner: ${p}`);
    this.logger.info(
      { positions, patchSize, resolution },
      'Watermark detector: preset regions calculated',
    );

    return { hasWatermark: regions.length > 0, regions, detectedLabels: labels };
  }
}

// ── Custom ─────────────────────────────────────────────────────────────────────

/**
 * Passes through caller-supplied bounding boxes without any detection step.
 * Normalised coordinates (0–1) are converted to pixels via FFmpeg probe.
 */
export class CustomWatermarkDetector implements IWatermarkDetectorService {
  constructor(
    private readonly options: WatermarkDetectorOptions,
    private readonly logger: Logger,
  ) {}

  async detect(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
  ): Promise<WatermarkDetectionResult> {
    if (blurOptions.mode !== 'custom' || !blurOptions.customRegions?.length) {
      return { hasWatermark: false, regions: [], detectedLabels: [] };
    }

    const hasNormalized = blurOptions.customRegions.some((r) => r.normalized);
    let width = 0;
    let height = 0;

    if (hasNormalized) {
      const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
      const res = await probeResolution({ binaryPath: ffmpeg, inputPath: videoPath });
      if (!res) {
        this.logger.warn({ videoPath }, 'Watermark detector: cannot probe resolution for normalised regions');
        return { hasWatermark: false, regions: [], detectedLabels: [] };
      }
      width = res.width;
      height = res.height;
    }

    const regions: WatermarkRegion[] = blurOptions.customRegions.map((r) => {
      if (!r.normalized) return r;
      return {
        x: Math.round(r.x * width),
        y: Math.round(r.y * height),
        width: Math.round(r.width * width),
        height: Math.round(r.height * height),
        label: r.label,
        confidence: r.confidence,
      };
    });

    const labels = regions.map((r) => r.label ?? 'Custom region');
    this.logger.info({ count: regions.length }, 'Watermark detector: custom regions resolved');

    return { hasWatermark: regions.length > 0, regions, detectedLabels: labels };
  }
}

// ── Vision AI ─────────────────────────────────────────────────────────────────

export interface VisionWatermarkDetectorOptions extends WatermarkDetectorOptions {
  /** Vision LLM chat function. Receives a JPEG frame path, returns JSON string. */
  visionChat: (prompt: string, imagePath: string) => Promise<string>;
}

/**
 * Extracts a frame from the source video and sends it to a multimodal Vision
 * LLM to detect watermark bounding boxes. Falls back to returning no regions
 * if the model or frame extraction fails.
 *
 * The LLM is instructed to return a JSON array of normalised regions
 * `[{ x, y, width, height, label }]` where all values are in the 0–1 range.
 * Those are then converted to pixels using the probed frame resolution.
 */
export class VisionWatermarkDetector implements IWatermarkDetectorService {
  constructor(
    private readonly options: VisionWatermarkDetectorOptions,
    private readonly logger: Logger,
  ) {}

  async detect(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
    timestamp = 0.5,
  ): Promise<WatermarkDetectionResult> {
    if (blurOptions.mode !== 'auto') {
      return { hasWatermark: false, regions: [], detectedLabels: [] };
    }

    const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
    const framePath = join(this.options.tempDir, `wm-detect-${Date.now()}.jpg`);

    try {
      await extractFrame({
        binaryPath: ffmpeg,
        inputPath: videoPath,
        timestampSeconds: timestamp,
        outputPath: framePath,
      });

      const resolution = await probeResolution({ binaryPath: ffmpeg, inputPath: videoPath });
      if (!resolution) throw new Error('Cannot probe resolution');

      const { width, height } = resolution;

      const prompt = [
        'Analyze this video frame for watermarks, logos, platform badges, @handles, or channel branding.',
        'Return a JSON array of watermark regions found. Each element must have:',
        '  { "x": <0-1>, "y": <0-1>, "width": <0-1>, "height": <0-1>, "label": "<description>" }',
        'Coordinates are normalized (0=left/top, 1=right/bottom).',
        'Return an empty array [] if no watermark is found.',
        'Return ONLY the JSON array, no other text.',
      ].join('\n');

      const raw = await this.options.visionChat(prompt, framePath);

      let parsed: unknown;
      try {
        // Strip markdown code fences if present.
        const cleaned = raw.replace(/^```(?:json)?[\r\n]*/i, '').replace(/```[\r\n]*$/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        this.logger.warn({ raw }, 'Watermark vision detector: LLM response was not valid JSON');
        return { hasWatermark: false, regions: [], detectedLabels: [] };
      }

      if (!Array.isArray(parsed)) {
        return { hasWatermark: false, regions: [], detectedLabels: [] };
      }

      const regions: WatermarkRegion[] = [];
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null) continue;
        const r = item as Record<string, unknown>;
        if (typeof r.x !== 'number' || typeof r.y !== 'number') continue;
        if (typeof r.width !== 'number' || typeof r.height !== 'number') continue;
        regions.push({
          x: Math.round(Number(r.x) * width),
          y: Math.round(Number(r.y) * height),
          width: Math.round(Number(r.width) * width),
          height: Math.round(Number(r.height) * height),
          label: typeof r.label === 'string' ? r.label : undefined,
          confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
        });
      }

      const labels = regions.map((r) => r.label ?? 'Detected watermark');
      this.logger.info(
        { count: regions.length, labels },
        'Watermark vision detector: regions detected',
      );

      return { hasWatermark: regions.length > 0, regions, detectedLabels: labels };
    } catch (error) {
      this.logger.warn({ err: error }, 'Watermark vision detector: detection failed, skipping blur');
      return { hasWatermark: false, regions: [], detectedLabels: [] };
    } finally {
      await rm(framePath, { force: true }).catch(() => {});
    }
  }
}

// ── Hybrid / Dispatcher ────────────────────────────────────────────────────────

/**
 * Composite detector that dispatches to the correct engine based on `blurOptions.mode`:
 * - `auto`   → delegates to VisionWatermarkDetector (AI Vision)
 * - `preset` → delegates to PresetWatermarkDetector (Calculates corner patches)
 * - `custom` → delegates to CustomWatermarkDetector (Passes caller bounding boxes)
 * - `none`   → returns empty result
 */
export class HybridWatermarkDetector implements IWatermarkDetectorService {
  constructor(
    private readonly presetDetector: PresetWatermarkDetector,
    private readonly customDetector: CustomWatermarkDetector,
    private readonly visionDetector?: VisionWatermarkDetector,
  ) {}

  async detect(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
    timestamp?: number,
  ): Promise<WatermarkDetectionResult> {
    if (blurOptions.mode === 'auto') {
      if (this.visionDetector) {
        const result = await this.visionDetector.detect(videoPath, blurOptions, timestamp);
        if (result.hasWatermark && result.regions.length > 0) {
          return result;
        }
      }
      // If vision detector is not configured or found nothing, fall back to preset corners.
      return this.presetDetector.detect(videoPath, { ...blurOptions, mode: 'preset' });
    }

    if (blurOptions.mode === 'custom') {
      return this.customDetector.detect(videoPath, blurOptions);
    }

    if (blurOptions.mode === 'preset') {
      return this.presetDetector.detect(videoPath, blurOptions);
    }

    return { hasWatermark: false, regions: [], detectedLabels: [] };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function presetToRegion(
  position: WatermarkPresetPosition,
  frameWidth: number,
  frameHeight: number,
  patchSize: number,
): WatermarkRegion {
  switch (position) {
    case 'top-left':
      return { x: 0, y: 0, width: patchSize, height: patchSize, label: 'top-left watermark' };
    case 'top-right':
      return {
        x: frameWidth - patchSize,
        y: 0,
        width: patchSize,
        height: patchSize,
        label: 'top-right watermark',
      };
    case 'bottom-left':
      return {
        x: 0,
        y: frameHeight - patchSize,
        width: patchSize,
        height: patchSize,
        label: 'bottom-left watermark',
      };
    case 'bottom-right':
      return {
        x: frameWidth - patchSize,
        y: frameHeight - patchSize,
        width: patchSize,
        height: patchSize,
        label: 'bottom-right watermark',
      };
  }
}
