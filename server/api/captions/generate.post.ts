import { defineEventHandler, readBody, createError } from 'h3';
import { generateCaptionRequestSchema } from '../../../src/schemas/caption.schema.js';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * POST /api/captions/generate
 *
 * Generates or regenerates viral social media captions tailored for
 * TikTok, Instagram Reels, YouTube Shorts, X/Twitter, and Threads.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = generateCaptionRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;
  const result = await container.captionController.generate(request);
  return result;
});
