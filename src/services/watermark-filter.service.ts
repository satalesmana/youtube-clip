import type { WatermarkBlurOptions, WatermarkRegion } from '../types/watermark.js';
import type { Logger } from '../utils/logger.js';
import type { IWatermarkDetectorService } from './watermark-detector.service.js';

/**
 * Builds FFmpeg filter-graph fragments that blur each detected watermark
 * region using a boxblur overlay. The generated fragment is designed to be
 * injected into the video processing pipeline of PreviewRendererService and
 * VideoLayerBuilder.
 *
 * Example filter graph output for one region at (x=10, y=10, 200×100):
 *
 *   [in]split=2[base_wm][wm_input0];
 *   [wm_input0]crop=200:100:10:10,boxblur=15:3[wm_blurred0];
 *   [base_wm][wm_blurred0]overlay=10:10[out]
 */

export interface WatermarkFilterResult {
  /**
   * When regions were found, contains the complete filter_complex string.
   * When no regions were found, this is undefined and the caller should
   * proceed without adding a watermark blur filter.
   */
  filterComplex: string | undefined;
  /** Number of watermark regions blurred. */
  regionCount: number;
}

export interface WatermarkFilterServiceOptions {
  ffmpegBinaryPath?: string;
  tempDir: string;
}

export interface IWatermarkFilterService {
  /**
   * Detects watermark regions from the source video and builds an FFmpeg
   * filter string that blurs all of them.
   *
   * @param videoPath   Absolute path to the source video.
   * @param blurOptions How watermarks should be discovered and blurred.
   * @returns           `filterComplex` string to inject into FFmpeg args, or
   *                    `undefined` when blurring is disabled / no region found.
   */
  buildFilter(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
  ): Promise<WatermarkFilterResult>;

  /**
   * Builds an FFmpeg filter string directly from pre-computed regions
   * (avoids the detection step — useful when regions are already known).
   */
  buildFilterFromRegions(
    regions: WatermarkRegion[],
    blurStrength?: number,
    inputLabel?: string,
    outputLabel?: string,
  ): WatermarkFilterResult;
}

export class WatermarkFilterService implements IWatermarkFilterService {
  constructor(
    private readonly detector: IWatermarkDetectorService,
    private readonly logger: Logger,
  ) {}

  async buildFilter(
    videoPath: string,
    blurOptions: WatermarkBlurOptions,
  ): Promise<WatermarkFilterResult> {
    if (blurOptions.mode === 'none') {
      return { filterComplex: undefined, regionCount: 0 };
    }

    const detection = await this.detector.detect(videoPath, blurOptions);

    if (!detection.hasWatermark || detection.regions.length === 0) {
      this.logger.debug({ videoPath }, 'Watermark filter: no regions detected, skipping blur');
      return { filterComplex: undefined, regionCount: 0 };
    }

    this.logger.info(
      { count: detection.regions.length, labels: detection.detectedLabels },
      'Watermark filter: building blur filter graph',
    );

    return this.buildFilterFromRegions(detection.regions, blurOptions.blurStrength);
  }

  buildFilterFromRegions(
    regions: WatermarkRegion[],
    blurStrength = 15,
    inputLabel = 'in',
    outputLabel = 'out',
  ): WatermarkFilterResult {
    if (regions.length === 0) {
      return { filterComplex: undefined, regionCount: 0 };
    }

    // Clamp blur strength to sane range.
    const sigma = Math.max(5, Math.min(50, blurStrength));
    // FFmpeg boxblur luma_power (how many passes).
    const power = 3;

    const lines: string[] = [];

    if (regions.length === 1) {
      // Single-region fast path: no split needed.
      const r = regions[0]!;
      const { x, y, w, h } = sanitiseRegion(r);
      lines.push(
        `[${inputLabel}]split=2[base_wm][wm_input0]`,
        `[wm_input0]crop=${w}:${h}:${x}:${y},boxblur=${sigma}:${power}[wm_blurred0]`,
        `[base_wm][wm_blurred0]overlay=${x}:${y}[${outputLabel}]`,
      );
    } else {
      // Multi-region: chain overlay nodes.
      // Step 1: split the input into N+1 streams (base + one per region).
      const splitCount = regions.length + 1;
      const baseLabel = 'base_wm';
      const splitLabels = regions.map((_, i) => `wm_input${i}`);
      const blurLabels = regions.map((_, i) => `wm_blurred${i}`);

      lines.push(
        `[${inputLabel}]split=${splitCount}[${baseLabel}]${splitLabels.map((l) => `[${l}]`).join('')}`,
      );

      // Step 2: crop + blur each region independently.
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i]!;
        const { x, y, w, h } = sanitiseRegion(r);
        lines.push(
          `[${splitLabels[i]}]crop=${w}:${h}:${x}:${y},boxblur=${sigma}:${power}[${blurLabels[i]}]`,
        );
      }

      // Step 3: chain overlays.
      let prev = baseLabel;
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i]!;
        const { x, y } = sanitiseRegion(r);
        const next = i === regions.length - 1 ? outputLabel : `wm_comp${i}`;
        lines.push(`[${prev}][${blurLabels[i]}]overlay=${x}:${y}[${next}]`);
        prev = next;
      }
    }

    return {
      filterComplex: lines.join(';'),
      regionCount: regions.length,
    };
  }
}

/**
 * Rounds and ensures all values are non-negative integers, protecting
 * FFmpeg from fractional or negative crop coordinates.
 */
function sanitiseRegion(r: WatermarkRegion): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: Math.max(0, Math.round(r.x)),
    y: Math.max(0, Math.round(r.y)),
    w: Math.max(1, Math.round(r.width)),
    h: Math.max(1, Math.round(r.height)),
  };
}
