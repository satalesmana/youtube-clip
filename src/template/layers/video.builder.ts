import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';
import type { IReframeService } from '../../services/reframe.service.js';
import type { IWatermarkFilterService } from '../../services/watermark-filter.service.js';
import type { WatermarkBlurOptions } from '../../types/watermark.js';
import type { WatermarkRegion } from '../../types/watermark.js';

export interface VideoLayerBuilderOptions {
  /**
   * Optional watermark filter service. When provided together with a
   * `WatermarkBlurOptions` on the `context.video`, boxblur overlays are
   * inserted after the reframe/crop step and before the final `overlay`.
   */
  watermarkFilterService?: IWatermarkFilterService;
}

/**
 * Renders the `video` layer: trims the source clip via input-level seeking
 * and fits it into the layer's rect without ever stretching, per one of
 * three modes.
 */
export class VideoLayerBuilder implements ILayerFilterBuilder {
  constructor(
    private readonly reframeService: IReframeService,
    private readonly wmOptions?: VideoLayerBuilderOptions,
  ) {}

  build({ layer, context, allocateInputIndex, allocateLabel, hints }: LayerBuildContext): LayerFilterFragment {
    const inputIndex = allocateInputIndex();
    const inStream = `${inputIndex}:v`;
    const outputLabel = allocateLabel('video');
    const { width: rectWidth, height: rectHeight } = layer.rect;
    const fit = layer.style.fit ?? 'cover';

    const filterLines: string[] = [];

    // ── Step 1: fit/reframe the video into the layer rect ──────────────────
    // We produce an intermediate label; watermark blur (step 2) will consume
    // it when enabled, otherwise it becomes the final outputLabel directly.
    const fittedLabel = allocateLabel('video_fitted');

    if (fit === 'contain') {
      filterLines.push(
        `[${inStream}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=decrease,pad=${rectWidth}:${rectHeight}:(ow-iw)/2:(oh-ih)/2:color=black[${fittedLabel}]`,
      );
    } else if (fit === 'blur-background') {
      const bgRaw = allocateLabel('vbgraw');
      const fgRaw = allocateLabel('vfgraw');
      const bgBlur = allocateLabel('vbgblur');
      const fgFit = allocateLabel('vfgfit');

      filterLines.push(
        `[${inStream}]split=2[${bgRaw}][${fgRaw}]`,
        `[${bgRaw}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=increase,crop=${rectWidth}:${rectHeight},gblur=sigma=25[${bgBlur}]`,
        `[${fgRaw}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=decrease[${fgFit}]`,
        `[${bgBlur}][${fgFit}]overlay=(W-w)/2:(H-h)/2[${fittedLabel}]`,
      );
    } else {
      const crop = this.reframeService.computeCropRegion(
        hints.sourceWidth,
        hints.sourceHeight,
        hints.focalPoint,
        rectWidth / rectHeight,
      );
      filterLines.push(
        `[${inStream}]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${rectWidth}:${rectHeight}[${fittedLabel}]`,
      );
    }

    // ── Step 2: optional watermark blur overlay ────────────────────────────
    const blurOptions = (context as unknown as { blurWatermark?: WatermarkBlurOptions }).blurWatermark;
    const wmFilterSvc = this.wmOptions?.watermarkFilterService;

    if (blurOptions && blurOptions.mode !== 'none' && wmFilterSvc) {
      // We have pre-computed regions stored on the context (populated by the
      // controller before the render call). Build the filter synchronously
      // from those regions.
      const precomputedRegions =
        (context as unknown as { watermarkRegions?: WatermarkRegion[] }).watermarkRegions;

      if (precomputedRegions && precomputedRegions.length > 0) {
        const { filterComplex, regionCount } = wmFilterSvc.buildFilterFromRegions(
          precomputedRegions,
          blurOptions.blurStrength,
          fittedLabel,
          outputLabel,
        );
        if (filterComplex && regionCount > 0) {
          filterLines.push(...filterComplex.split(';'));
        } else {
          // No regions — alias fittedLabel → outputLabel.
          filterLines.push(`[${fittedLabel}]null[${outputLabel}]`);
        }
      } else {
        filterLines.push(`[${fittedLabel}]null[${outputLabel}]`);
      }
    } else {
      // No blur: alias fittedLabel → outputLabel.
      filterLines.push(`[${fittedLabel}]null[${outputLabel}]`);
    }

    // Prefer the explicit source trim window (e.g. the chosen hook's range);
    // fall back to the clip context so the footage always matches the moment.
    const trimStart = context.video.sourceTrim?.start ?? context.clip.start;
    const trimEnd = context.video.sourceTrim?.end ?? context.clip.end;

    return {
      inputs: [
        {
          args: ['-ss', trimStart.toFixed(3), '-to', trimEnd.toFixed(3), '-i', context.video.path],
          providesAudio: true,
        },
      ],
      filterLines,
      outputLabel,
    };
  }
}
