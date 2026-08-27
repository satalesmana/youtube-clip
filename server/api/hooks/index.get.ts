import { createError, defineEventHandler, getQuery } from 'h3';
import { hookController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { extractVideoIdFromUrl } from '../../../src/utils/youtube-id.js';

/**
 * `GET /api/hooks?url=<youtubeUrl|videoId>&candidateId=0`
 *
 * Returns the previously SAVED hook recommendation result for a video,
 * without running any pipeline stage (no download, no LLM). Used by the
 * frontend to restore the hook panel after a page reload.
 *
 * Responds 400 when nothing is saved yet — the frontend treats that as
 * "no hooks" and keeps the panel hidden.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = typeof query.url === 'string' ? query.url.trim() : '';
  if (!url) {
    throw createError(toHttpError(AppError.validation('Query param "url" is required.')));
  }

  // Accept either a full YouTube URL or a bare videoId.
  const videoId = extractVideoIdFromUrl(url) ?? url;
  const candidateId = Number(query.candidateId ?? 0) || 0;

  try {
    return await hookController.getSaved(videoId, candidateId);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
