import { BackgroundLayerBuilder } from './layers/background.builder.js';
import { VideoLayerBuilder } from './layers/video.builder.js';
import { TextLayerBuilder } from './layers/text.builder.js';
import { ImageLayerBuilder } from './layers/image.builder.js';
import { RectangleLayerBuilder } from './layers/rectangle.builder.js';
import { GradientLayerBuilder } from './layers/gradient.builder.js';
import type { ILayerRegistry } from './layer-registry.js';
import type { IReframeService } from '../services/reframe.service.js';

/**
 * Registers every built-in layer type. Adding a new layer kind (progress
 * bar, QR code, countdown, ...) means writing a new `*.builder.ts` and
 * adding one `register()` call here — nothing in the layout/filtergraph/
 * renderer services ever needs to change.
 */
export function registerDefaultLayers(registry: ILayerRegistry, deps: { reframeService: IReframeService }): void {
  const backgroundBuilder = new BackgroundLayerBuilder();
  const videoBuilder = new VideoLayerBuilder(deps.reframeService);
  const textBuilder = new TextLayerBuilder();
  const imageBuilder = new ImageLayerBuilder();
  const rectangleBuilder = new RectangleLayerBuilder();
  const gradientBuilder = new GradientLayerBuilder();

  registry.register('background', backgroundBuilder);
  registry.register('video', videoBuilder);
  registry.register('title', textBuilder);
  registry.register('header', textBuilder);
  registry.register('text', textBuilder);
  registry.register('image', imageBuilder);
  registry.register('logo', imageBuilder);
  registry.register('watermark', imageBuilder);
  registry.register('rectangle', rectangleBuilder);
  registry.register('gradient', gradientBuilder);
}
