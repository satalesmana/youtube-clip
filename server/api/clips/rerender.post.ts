import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { clipController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

const clipRerenderSchema = z.object({
  youtubeUrl: z.string().optional(),
  videoId: z.string().optional(),
  url: z.string().optional(),
}).refine((data) => Boolean(data.youtubeUrl || data.videoId || data.url), {
  message: 'Provide youtubeUrl, videoId, or url.',
});

/**
 * POST /api/clips/rerender
 *
 * Fast preview re-rendering endpoint for clips: re-renders the 9:16 preview MP4s
 * and thumbnails using FFmpeg without re-running the full LLM analysis.
 */
export default defineEventHandler(async (event) => {
  const rawBody = (await readBody(event).catch(() => undefined)) as Record<string, unknown> | undefined;
  const body = {
    ...rawBody,
    youtubeUrl: rawBody?.youtubeUrl ?? rawBody?.url,
  };
  const parsed = clipRerenderSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await clipController.rerenderPreviews(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
