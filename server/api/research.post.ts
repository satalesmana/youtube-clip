import { createError, defineEventHandler, readBody } from 'h3';
import { researchRequestSchema } from '../../src/schemas/research.schema.js';
import { researchController } from '../../src/container/index.js';
import { toHttpError } from '../../src/utils/http-error.js';
import { AppError } from '../../src/utils/errors.js';

/**
 * `POST /api/research`
 *
 * Body (all optional):
 * ```json
 * { "max_trends": 10, "language": "id", "subreddits": "worldnews,indonesia", "rss_feeds": "...", "providers": ["rss", "reddit"] }
 * ```
 *
 * Collects viral signals from news RSS, Reddit, Google Trends and X, ranks
 * them with the AI, and matches YouTube videos for each topic.
 * Response: `{ "success": true, "generatedAt", "signalCount", "trends": [{ slug, title, summary, score, keywords, category, sources, videos }], "skippedSources" }`
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = researchRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    const result = await researchController.research(parsed.data);
    return { success: true, ...result };
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
