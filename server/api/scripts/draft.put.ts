import { defineEventHandler, readBody, createError } from 'h3';
import { scriptSaveRequestSchema } from '../../../src/schemas/script.schema.js';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { createLogger } from '../../../src/utils/logger.js';
import { TransformController, type TransformControllerDeps } from '../../../src/controllers/transform.controller.js';
import { extractVideoIdFromUrl } from '../../../src/utils/youtube-id.js';

/**
 * PUT /api/scripts/draft
 *
 * Saves and persists user modifications to a script draft into disk cache
 * (outputs/{videoId}/scripts/draft.json) so reopened sessions retain changes.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = scriptSaveRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;
  let videoId = request.videoId?.trim();
  if (!videoId && request.youtubeUrl) {
    videoId = extractVideoIdFromUrl(request.youtubeUrl) || undefined;
  }
  if (!videoId) {
    throw createError(toHttpError(AppError.validation('Valid videoId or youtubeUrl is required.')));
  }

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
    logger: createLogger('scripts.draft.put'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
    contentCache: container.contentCache,
  };

  const controller = new TransformController(deps);
  const result = await controller.updateSavedScript(videoId, request.script);
  return result;
});
