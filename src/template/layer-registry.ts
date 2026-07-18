import type { Canvas, LayerType, RenderContext, ResolvedLayer } from '../types/template.js';

/** One additional `-i` input a layer builder needs (e.g. a logo PNG, or the trimmed source video). */
export interface LayerInput {
  args: string[];
  /** True if this input's audio stream should be mapped into the final output (the `video` layer's input). */
  providesAudio?: boolean;
}

export interface LayerFilterFragment {
  inputs: LayerInput[];
  /** Filter lines to append to the graph; the last one must produce `outputLabel`. */
  filterLines: string[];
  outputLabel: string;
  /**
   * True for builders that paint directly onto the running composite (e.g.
   * `drawtext`/`drawbox` in absolute canvas coordinates) instead of
   * producing an independent branch to be `overlay`'d at the layer's rect.
   * FFmpeg's `overlay` filter needs real alpha to blend two independently
   * generated `color` sources correctly, which `drawbox` does not reliably
   * produce on a transparent base — painting in-place sidesteps that
   * entirely. When true, `filterLines` must start from `compositeLabel`.
   */
  inPlace?: boolean;
}

export interface LayerBuildContext {
  layer: ResolvedLayer;
  canvas: Canvas;
  templateDir: string;
  context: RenderContext;
  /** The current running composite's label — only meaningful for `inPlace` builders. */
  compositeLabel: string;
  /** Returns the next free FFmpeg input index and reserves it. */
  allocateInputIndex: () => number;
  /** Returns the next free FFmpeg filter label and reserves it. */
  allocateLabel: (hint: string) => string;
  /** Render-time hints unavailable from `RenderContext` alone (probed source resolution, chosen focal point). */
  hints: { sourceWidth: number; sourceHeight: number; focalPoint: { x: number; y: number } };
}

/** Builds the FFmpeg filter fragment for one layer instance. */
export interface ILayerFilterBuilder {
  build(input: LayerBuildContext): LayerFilterFragment;
}

/**
 * Maps `LayerType` → builder. This is the seam that makes new layer types
 * "registerable without touching the renderer": a future layer kind is a new
 * builder + one `register()` call, nothing else in the pipeline changes.
 */
export interface ILayerRegistry {
  register(type: LayerType, builder: ILayerFilterBuilder): void;
  get(type: LayerType): ILayerFilterBuilder | undefined;
  has(type: LayerType): boolean;
}

export class LayerRegistry implements ILayerRegistry {
  private readonly builders = new Map<LayerType, ILayerFilterBuilder>();

  register(type: LayerType, builder: ILayerFilterBuilder): void {
    this.builders.set(type, builder);
  }

  get(type: LayerType): ILayerFilterBuilder | undefined {
    return this.builders.get(type);
  }

  has(type: LayerType): boolean {
    return this.builders.has(type);
  }
}
