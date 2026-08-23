import { createLogger } from '../utils/logger.js';
import { FfmpegTemplateCompositionEngine } from './ffmpeg-template.engine.js';
import { RemotionCompositionEngine } from './remotion.engine.js';
import type { ICompositionEngine, CompositionEngineKind } from './composition.types.js';
import type { ITemplateService } from '../template/template.service.js';
import type { ITemplateRendererService } from '../template/renderer.service.js';
import type { Logger } from '../utils/logger.js';

export interface CompositionEngineFactoryOptions {
  templateService: ITemplateService;
  templateRendererService: ITemplateRendererService;
  outputsDir: string;
  compositionsDir: string;
  engine?: CompositionEngineKind;
  logger?: Logger;
}

/**
 * Factory for creating composition engines.
 *
 * Provides a unified engine that delegates per-request based on `assets.engine`
 * ('remotion' | 'ffmpeg' | 'ffmpeg-template') or falls back to the default
 * engine configured in options.
 */
export function createCompositionEngine(options: CompositionEngineFactoryOptions): ICompositionEngine {
  const {
    templateService,
    templateRendererService,
    outputsDir,
    compositionsDir,
    engine = 'ffmpeg-template',
    logger = createLogger('composition'),
  } = options;

  const remotionEngine = new RemotionCompositionEngine({
    compositionsDir,
    outputsDir,
    logger,
  });

  const ffmpegEngine = new FfmpegTemplateCompositionEngine(
    templateService,
    templateRendererService,
    outputsDir,
    logger,
  );

  return {
    kind: engine,
    async render(plan, assets) {
      const selectedEngine = assets.engine ?? engine;
      if (selectedEngine === 'remotion' || assets.templateId === 'remotion') {
        return remotionEngine.render(plan, assets);
      }
      return ffmpegEngine.render(plan, assets);
    },
  };
}
