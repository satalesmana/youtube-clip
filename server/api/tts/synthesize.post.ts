import { defineEventHandler, readBody, createError } from 'h3';
import { ttsSynthesizeRequestSchema } from '../../../src/schemas/script.schema.js';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { createLogger } from '../../../src/utils/logger.js';
import type { TransformControllerDeps } from '../../../src/controllers/transform.controller.js';
import { TransformController } from '../../../src/controllers/transform.controller.js';

/**
 * POST /api/tts/synthesize
 *
 * Performs on-demand TTS audio synthesis for a custom/edited script.
 * Returns narration MP3 audio url without running video rendering.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = ttsSynthesizeRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;

  const deps: TransformControllerDeps = {
    youtubeService: container.youtubeService,
    transcriptService: container.transcriptService,
    whisperService: container.whisperService,
    contentAngleService: container.contentAngleService,
    scriptService: container.scriptService,
    ttsService: container.ttsService,
    videoPlanService: container.videoPlanService,
    storyService: container.storyService,
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    assService: container.assService,
    subtitleService: container.subtitleService,
    outputsDir: container.paths.outputs,
    logger: createLogger('tts.synthesize.controller'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
    contentCache: container.contentCache,
  };

  const controller = new TransformController(deps);
  const result = await controller.synthesizeTts(request);
  return result;
});
