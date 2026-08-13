import { defineEventHandler, readBody } from 'h3';
import { transformRequestSchema } from '../../src/schemas/transform.schema.js';
import { container } from '../../src/container/index.js';
import { createError } from 'h3';
import { toHttpError } from '../../src/utils/http-error.js';
import { AppError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';
import type { TransformControllerDeps } from '../../src/controllers/transform.controller.js';
import { TransformController } from '../../src/controllers/transform.controller.js';

/**
 * POST /api/transform
 *
 * Runs the AI Viral Content Transformer pipeline:
 *   download/transcribe → content angle → script → TTS → video plan → render
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = transformRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;

  // Build deps for controller (reusing existing container services)
  const deps: TransformControllerDeps = {
    youtubeService: container.youtubeService,
    transcriptService: container.transcriptService,
    whisperService: container.whisperService,
    contentAngleService: container.contentAngleService,
    scriptService: container.scriptService,
    ttsService: container.ttsService,
    videoPlanService: container.videoPlanService,
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    assService: container.assService,
    subtitleService: container.subtitleService,
    outputsDir: container.paths.outputs,
    logger: createLogger('transform.controller'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
  };

  const controller = new TransformController(deps);
  const result = await controller.transform(request);

  return result;
});
