import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';

const DEFAULT_COLOR = '#FFFFFF';

/**
 * Renders a plain filled rectangle via `drawbox`, painted in-place at the
 * layer's absolute rect coordinates directly onto the running composite —
 * see `text.builder.ts` for why in-place painting (not a standalone
 * `overlay`'d branch) is required for solid-fill layers.
 */
export class RectangleLayerBuilder implements ILayerFilterBuilder {
  build({ layer, compositeLabel, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    const { x, y, width, height } = layer.rect;
    const color = layer.style.color ?? layer.style.backgroundColor ?? DEFAULT_COLOR;
    const opacity = layer.style.opacity ?? 1;
    const outputLabel = allocateLabel('rect');

    return {
      inputs: [],
      filterLines: [`[${compositeLabel}]drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${color}@${opacity}:t=fill[${outputLabel}]`],
      outputLabel,
      inPlace: true,
    };
  }
}
