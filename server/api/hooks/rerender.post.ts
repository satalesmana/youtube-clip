import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { hookController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

const hookRerenderSchema = z.object({
  youtubeUrl: z.string().optional(),
  videoId: z.string().optional(),
  candidateId: z.number().int().min(0).default(0),
}).refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
  message: 'Provide exactly one of: youtubeUrl OR videoId.',
  path: ['youtubeUrl'],
});

/**
 * POST /api/hooks/rerender
 *
 * Fast design testing endpoint: Re-renders styled preview videos for existing
 * saved hook recommendations using the latest Remotion composition code,
 * completely skipping transcript analysis and LLM calls.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = hookRerenderSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await hookController.rerenderPreviews(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
