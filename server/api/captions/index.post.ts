import { defineEventHandler, readBody, createError } from 'h3';
import { generateCaptionRequestSchema } from '../../../src/schemas/caption.schema.js';
import { container } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/captions` (alias to `/api/captions/generate`)
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = generateCaptionRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;
  return await container.captionController.generate(request);
});
