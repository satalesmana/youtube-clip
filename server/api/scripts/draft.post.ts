import { defineEventHandler, readBody, createError } from 'h3';
import { scriptDraftRequestSchema } from '../../../src/schemas/script.schema.js';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { createLogger } from '../../../src/utils/logger.js';
import type { TransformControllerDeps } from '../../../src/controllers/transform.controller.js';
import { TransformController } from '../../../src/controllers/transform.controller.js';

/**
 * POST /api/scripts/draft
 *
 * Generates an original script draft without running TTS or video rendering.
 * Allows human-in-the-loop review and saves TTS API credits.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = scriptDraftRequestSchema.safeParse(body);

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
    logger: createLogger('scripts.draft.controller'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
    contentCache: container.contentCache,
  };

  const controller = new TransformController(deps);
  const result = await controller.draftScript(request);
  return result;
});
