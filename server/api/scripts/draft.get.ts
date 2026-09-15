import { defineEventHandler, getQuery } from 'h3';
import { container } from '../../../src/container/index.js';
import { createLogger } from '../../../src/utils/logger.js';
import { TransformController } from '../../../src/controllers/transform.controller.js';

/**
 * GET /api/scripts/draft?videoId=...
 *
 * Fast check & retrieval of saved narration script draft from disk cache.
 * Returns cached: true and the saved script if available, or cached: false.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const videoId = query.videoId as string | undefined;

  if (!videoId) {
    return { success: false, cached: false, script: null };
  }

  const controller = new TransformController({
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
    logger: createLogger('scripts.draft.get'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
    contentCache: container.contentCache,
  });

  const saved = await controller.loadSavedScript(videoId);
  if (!saved) {
    return { success: false, cached: false, script: null };
  }

  return saved;
});
