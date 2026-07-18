import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';

const DEFAULT_BACKGROUND_COLOR = '#0B1220';

/** Renders the `background` layer as a solid-color FFmpeg filter source sized to the full canvas. */
export class BackgroundLayerBuilder implements ILayerFilterBuilder {
  build({ layer, canvas, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    const color = layer.style.color ?? layer.style.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    const outputLabel = allocateLabel('bg');

    return {
      inputs: [],
      filterLines: [`color=c=${color}:s=${canvas.width}x${canvas.height}[${outputLabel}]`],
      outputLabel,
    };
  }
}
