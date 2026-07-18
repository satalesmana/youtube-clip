import { join } from 'node:path';
import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';

/**
 * Renders `image`/`logo`/`watermark` layers: overlays a PNG, scaled to fit
 * inside its rect without stretching. The source is either a dynamic
 * binding (`channel.logo`, already existence-checked by `binding.service`)
 * or a static `style.src` relative to the template folder.
 */
export class ImageLayerBuilder implements ILayerFilterBuilder {
  build({ layer, templateDir, allocateInputIndex, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    // A dynamic binding (e.g. channel.logo) is a user-supplied path, resolved
    // relative to the process cwd (same as when binding.service checked it
    // exists); a static `style.src` is always relative to the template folder.
    const resolvedSource = layer.value ?? (layer.style.src ? join(templateDir, layer.style.src) : undefined);
    if (!resolvedSource) {
      throw new Error(`Layer "${layer.id}" of type "${layer.type}" has no image source.`);
    }

    const inputIndex = allocateInputIndex();
    const { width, height } = layer.rect;
    const opacity = layer.style.opacity ?? 1;
    const outputLabel = allocateLabel('image');

    const scaleLine = `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,format=rgba`;
    const opacityLine = opacity < 1 ? `,colorchannelmixer=aa=${opacity}` : '';

    return {
      inputs: [{ args: ['-i', resolvedSource] }],
      filterLines: [`${scaleLine}${opacityLine}[${outputLabel}]`],
      outputLabel,
    };
  }
}
