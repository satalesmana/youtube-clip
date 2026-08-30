import { defineEventHandler, getQuery, createError } from 'h3';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * GET /api/captions?videoId=...&jobId=...
 *
 * Retrieves previously saved viral captions from disk workspace.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const videoId = typeof query.videoId === 'string' ? query.videoId : undefined;
  const jobId = typeof query.jobId === 'string' ? query.jobId : undefined;

  if (!videoId) {
    throw createError(toHttpError(AppError.validation('Missing required query parameter "videoId".')));
  }

  const result = await container.captionController.getSaved(videoId, jobId);
  if (!result) {
    return {
      success: false,
      message: 'No captions found for this video/job.',
    };
  }

  return result;
});
