import { createError, defineEventHandler, getQuery } from 'h3';
import { clipController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { extractVideoIdFromUrl } from '../../../src/utils/youtube-id.js';

/**
 * `GET /api/clips?url=<youtubeUrl|videoId>`
 *
 * Returns the previously SAVED viral-clip recommendation result for a video
 * without running any pipeline stage (no download, no LLM, no preview
 * render). Used by the frontend to restore the clip panel after a reload.
 * Responds 400 when nothing is saved yet — the frontend treats that as
 * "no clips" and keeps the panel hidden.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const raw = typeof query.url === 'string' && query.url.trim()
    ? query.url.trim()
    : typeof query.videoId === 'string' && query.videoId.trim()
    ? query.videoId.trim()
    : '';
  if (!raw) {
    throw createError(toHttpError(AppError.validation('Query param "url" or "videoId" is required.')));
  }

  // Accept either a full YouTube URL or a bare videoId.
  const videoId = extractVideoIdFromUrl(raw) ?? raw;

  try {
    return await clipController.getSaved(videoId);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
