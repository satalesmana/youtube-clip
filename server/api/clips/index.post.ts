import { createError, defineEventHandler, readBody } from 'h3';
import { clipRecommendRequestSchema } from '../../../src/schemas/clip-recommendation.schema.js';
import { clipController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/clips` (alias to `/api/clips/recommend`)
 * Accepts either { url: "..." } or { youtubeUrl: "..." }.
 */
export default defineEventHandler(async (event) => {
  const rawBody = (await readBody(event).catch(() => undefined)) as Record<string, unknown> | undefined;
  const body = {
    ...rawBody,
    youtubeUrl: rawBody?.youtubeUrl ?? rawBody?.url,
  };

  const parsed = clipRecommendRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await clipController.recommend(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
