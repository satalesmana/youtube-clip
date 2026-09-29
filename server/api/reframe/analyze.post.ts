import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { container } from '../../../src/container/index.js';
import { env } from '../../../src/config/env.js';
import { probeResolution } from '../../../src/utils/ffmpeg.js';

const requestSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
  start: z.number().min(0),
  end: z.number().positive(),
}).refine((value) => value.end > value.start && value.end - value.start <= 180, {
  message: 'Source range must be between 0 and 180 seconds.',
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid analysis request.' });
  }

  const { videoId, start, end } = parsed.data;
  const videoPath = join(container.paths.outputs, videoId, 'downloads', `${videoId}.mp4`);
  if (!(await stat(videoPath).catch(() => null))) {
    throw createError({ statusCode: 404, statusMessage: 'Downloaded source video not found.' });
  }

  const trajectory = await container.reframeService.resolveTrajectory(videoPath, start, end, 0.75);
  const resolution = await probeResolution({ binaryPath: env.FFMPEG_BINARY_PATH, inputPath: videoPath });
  return {
    sourceAspectRatio: resolution ? resolution.width / resolution.height : undefined,
    points: trajectory.points.map((point) => ({
      time: point.timestampSeconds - start,
      x: point.focalPoint.x,
      y: point.focalPoint.y,
    })),
  };
});
