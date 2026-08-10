import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';
import type { IReframeService } from '../../services/reframe.service.js';

/**
 * Renders the `video` layer: trims the source clip via input-level seeking
 * and fits it into the layer's rect without ever stretching, per one of
 * three modes.
 */
export class VideoLayerBuilder implements ILayerFilterBuilder {
  constructor(private readonly reframeService: IReframeService) {}

  build({ layer, context, allocateInputIndex, allocateLabel, hints }: LayerBuildContext): LayerFilterFragment {
    const inputIndex = allocateInputIndex();
    const inStream = `${inputIndex}:v`;
    const outputLabel = allocateLabel('video');
    const { width: rectWidth, height: rectHeight } = layer.rect;
    const fit = layer.style.fit ?? 'cover';

    const filterLines: string[] = [];

    if (fit === 'contain') {
      filterLines.push(
        `[${inStream}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=decrease,pad=${rectWidth}:${rectHeight}:(ow-iw)/2:(oh-ih)/2:color=black[${outputLabel}]`,
      );
    } else if (fit === 'blur-background') {
      const bgRaw = allocateLabel('vbgraw');
      const fgRaw = allocateLabel('vfgraw');
      const bgBlur = allocateLabel('vbgblur');
      const fgFit = allocateLabel('vfgfit');

      // filterLines.push(
      //   `[${inStream}]split=2[${bgRaw}][${fgRaw}]`,
      //   `[${bgRaw}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=increase,crop=${rectWidth}:${rectHeight},gblur=sigma=25[${bgBlur}]`,
      //   `[${fgRaw}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=decrease[${fgFit}]`,
      //   `[${bgBlur}][${fgFit}]overlay=(W-w)/2:(H-h)/2[${outputLabel}]`,
      // );

      const fgHeight = Math.round(rectHeight * 0.5);

      filterLines.push(
        `[${inStream}]split=2[${bgRaw}][${fgRaw}]`,
        
        // 1. Background: Fills 100% width and 100% height with blur (no black bars)
        `[${bgRaw}]scale=${rectWidth}:${rectHeight}:force_original_aspect_ratio=increase,crop=${rectWidth}:${rectHeight},gblur=sigma=25[${bgBlur}]`,
        
        // 2. Foreground: Scaled to fill 100% width x 70% height, then cropped to fit exact bounds
        `[${fgRaw}]scale=${rectWidth}:${fgHeight}:force_original_aspect_ratio=increase,crop=${rectWidth}:${fgHeight}[${fgFit}]`,
        
        // 3. Overlay foreground directly in the center over the blurred background
        `[${bgBlur}][${fgFit}]overlay=(W-w)/2:(H-h)/2[${outputLabel}]`,
      );
    } else {
      const crop = this.reframeService.computeCropRegion(
        hints.sourceWidth,
        hints.sourceHeight,
        hints.focalPoint,
        rectWidth / rectHeight,
      );
      filterLines.push(
        `[${inStream}]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${rectWidth}:${rectHeight}[${outputLabel}]`,
      );
    }

    return {
      inputs: [
        {
          args: ['-ss', context.clip.start.toFixed(3), '-to', context.clip.end.toFixed(3), '-i', context.video.path],
          providesAudio: true,
        },
      ],
      filterLines,
      outputLabel,
    };
  }
}
