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
 * Returns the appropriate engine based on the `engine` option:
 * - 'ffmpeg-template' (default): Uses existing template renderer
 * - 'remotion': Uses Remotion for advanced compositions
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

  switch (engine) {
    case 'remotion':
      return new RemotionCompositionEngine({
        compositionsDir,
        outputsDir,
        logger,
      });
    case 'ffmpeg-template':
    default:
      return new FfmpegTemplateCompositionEngine(
        templateService,
        templateRendererService,
        outputsDir,
        logger,
      );
  }
}
