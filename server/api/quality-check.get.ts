import { defineEventHandler, getQuery } from 'h3';
import { container } from '../../src/container/index.js';
import { createError } from 'h3';

/**
 * GET /api/quality-check
 * Runs quality checks on a video and returns results.
 * Query params: videoPath, minDuration?, maxDuration?, requireAudio?
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const videoPath = query.videoPath as string;

  if (!videoPath) {
    throw createError({ statusCode: 400, message: 'videoPath is required' });
  }

  const result = await container.qualityCheckService.check({
    videoPath,
    minDurationSeconds: query.minDuration ? Number(query.minDuration) : undefined,
    maxDurationSeconds: query.maxDuration ? Number(query.maxDuration) : undefined,
    requireAudio: query.requireAudio !== 'false',
    requireVideo: query.requireVideo !== 'false',
  });

  return result;
});
