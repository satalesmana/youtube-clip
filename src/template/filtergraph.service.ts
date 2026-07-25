import { escapeFfmpegFilterPath } from '../utils/ffmpeg.js';
import type { ILayerRegistry, LayerBuildContext } from './layer-registry.js';
import type { Canvas, RenderContext, ResolvedLayer } from '../types/template.js';

export interface FiltergraphServiceOptions {
  frameRate: number;
}

export interface FilterGraphPlan {
  /** One entry per extra `-i` input, in the exact order they must appear on the ffmpeg argv. */
  inputArgs: string[][];
  filterComplex: string;
  videoLabel: string;
  audioInputIndex?: number;
}

export type RenderHints = LayerBuildContext['hints'];

/**
 * Walks the laid-out, z-ordered layers and builds one `-filter_complex`
 * graph: seeds a base composite from the `background` layer (or a
 * synthesized black canvas), overlays every other visual layer at its
 * computed rect via each type's registered builder, then burns the
 * `subtitle` layer's ASS file as a final whole-frame pass.
 */
export interface IFiltergraphService {
  build(
    canvas: Canvas,
    resolvedLayers: ResolvedLayer[],
    context: RenderContext,
    templateDir: string,
    assPath: string,
    hints: RenderHints,
  ): FilterGraphPlan;
}

export class FiltergraphService implements IFiltergraphService {
  constructor(
    private readonly registry: ILayerRegistry,
    private readonly options: FiltergraphServiceOptions,
  ) {}

  build(
    canvas: Canvas,
    resolvedLayers: ResolvedLayer[],
    context: RenderContext,
    templateDir: string,
    assPath: string,
    hints: RenderHints,
  ): FilterGraphPlan {
    const inputArgs: string[][] = [];
    let labelCounter = 0;
    let nextInputIndex = 0;

    const allocateLabel = (hint: string): string => `${hint}${labelCounter++}`;
    const allocateInputIndex = (): number => nextInputIndex++;

    // Invariant: every builder allocates its input indices via
    // `allocateInputIndex` and returns exactly that many `fragment.inputs`
    // entries, in the same order — building layers strictly sequentially
    // (never concurrently) keeps `inputArgs.length` in lockstep with
    // `nextInputIndex` at every step.
    const consumeFragmentInputs = (fragmentInputs: { args: string[]; providesAudio?: boolean }[]): void => {
      for (const input of fragmentInputs) {
        const index = inputArgs.length;
        inputArgs.push(input.args);
        if (input.providesAudio) audioInputIndex = index;
      }
    };

    let audioInputIndex: number | undefined;
    const filterLines: string[] = [];

    const subtitleLayer = resolvedLayers.find((l) => l.type === 'subtitle');
    const backgroundLayer = resolvedLayers.find((l) => l.type === 'background');
    const overlayLayers = resolvedLayers.filter((l) => l.type !== 'subtitle' && l.type !== 'background');

    let compositeLabel: string;

    if (backgroundLayer) {
      const builder = this.registry.get('background');
      if (!builder) throw new Error('No builder registered for layer type "background".');
      const fragment = builder.build(
        this.buildContext(backgroundLayer, canvas, templateDir, context, '', allocateInputIndex, allocateLabel, hints),
      );
      filterLines.push(...fragment.filterLines);
      consumeFragmentInputs(fragment.inputs);
      compositeLabel = fragment.outputLabel;
    } else {
      const label = allocateLabel('basefallback');
      filterLines.push(`color=c=black:s=${canvas.width}x${canvas.height}[${label}]`);
      compositeLabel = label;
    }

    for (const layer of overlayLayers) {
      const builder = this.registry.get(layer.type);
      if (!builder) throw new Error(`No builder registered for layer type "${layer.type}".`);

      const fragment = builder.build(
        this.buildContext(layer, canvas, templateDir, context, compositeLabel, allocateInputIndex, allocateLabel, hints),
      );
      filterLines.push(...fragment.filterLines);
      consumeFragmentInputs(fragment.inputs);

      if (fragment.inPlace) {
        compositeLabel = fragment.outputLabel;
      } else {
        const newLabel = allocateLabel('composite');
        filterLines.push(`[${compositeLabel}][${fragment.outputLabel}]overlay=${layer.rect.x}:${layer.rect.y}[${newLabel}]`);
        compositeLabel = newLabel;
      }
    }

    if (subtitleLayer) {
      const label = allocateLabel('withsubs');
      filterLines.push(`[${compositeLabel}]ass='${escapeFfmpegFilterPath(assPath)}'[${label}]`);
      compositeLabel = label;
    }

    const fpsLabel = allocateLabel('fps');
    filterLines.push(`[${compositeLabel}]fps=${this.options.frameRate}[${fpsLabel}]`);
    compositeLabel = fpsLabel;

    return {
      inputArgs,
      filterComplex: filterLines.join(';'),
      videoLabel: compositeLabel,
      audioInputIndex,
    };
  }

  private buildContext(
    layer: ResolvedLayer,
    canvas: Canvas,
    templateDir: string,
    context: RenderContext,
    compositeLabel: string,
    allocateInputIndex: () => number,
    allocateLabel: (hint: string) => string,
    hints: RenderHints,
  ): LayerBuildContext {
    return { layer, canvas, templateDir, context, compositeLabel, allocateInputIndex, allocateLabel, hints };
  }
}
