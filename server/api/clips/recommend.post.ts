import { createError, defineEventHandler, readBody } from 'h3';
import { clipRecommendRequestSchema } from '../../../src/schemas/clip-recommendation.schema.js';
import { clipController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/clips/recommend`
 *
 * Viral-clip recommendation stage (flow redesign step 2). Analyzes the whole
 * transcript with the LLM, merges + ranks the most viral moments, and renders
 * a lightweight preview video per clip so the UI can show real footage before
 * the user picks which clips join the final output.
 *
 * Body: `{ "youtubeUrl": "..." }` or `{ "videoId": "..." }`, plus optional
 * `sttProvider` and `refresh` (re-run the LLM analysis, reusing the transcript).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
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
