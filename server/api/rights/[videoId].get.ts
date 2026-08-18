import { defineEventHandler } from 'h3';
import { container } from '../../../src/container/index.js';
import { createError } from 'h3';

/**
 * GET /api/rights/:videoId
 * Returns rights metadata for a video.
 */
export default defineEventHandler(async (event) => {
  const videoId = event.context.params?.videoId;
  if (!videoId) {
    throw createError({ statusCode: 400, message: 'videoId is required' });
  }
  const rights = await container.rightsService.load(videoId);
  const canPublish = await container.rightsService.canPublish(videoId);
  return { ...rights, canPublish: canPublish.publishable };
});
