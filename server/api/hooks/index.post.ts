import { createError, defineEventHandler, readBody } from 'h3';
import { hookGenerateRequestSchema } from '../../../src/schemas/hook.schema.js';
import { hookController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/hooks` (alias to `/api/hooks/generate`)
 * Accepts either { url: "..." } or { youtubeUrl: "..." }.
 */
export default defineEventHandler(async (event) => {
  const rawBody = (await readBody(event).catch(() => undefined)) as Record<string, unknown> | undefined;
  const body = {
    ...rawBody,
    youtubeUrl: rawBody?.youtubeUrl ?? rawBody?.url,
  };

  const parsed = hookGenerateRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await hookController.generate(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
