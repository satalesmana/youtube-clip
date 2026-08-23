import { createError, defineEventHandler, readBody } from 'h3';
import { hookGenerateRequestSchema } from '../../../src/schemas/hook.schema.js';
import { hookController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/hooks/generate`
 *
 * Hook Recommendation Engine (Plan §7). Runs the existing editorial stages
 * (download/transcribe → angles → story beats) and feeds them into the hook
 * engine: generate 10-15 candidates → accuracy guard → 7-metric scoring →
 * diverse Top-5 ranking.
 *
 * Body:
 * ```json
 * {
 *   "youtubeUrl": "https://www.youtube.com/watch?v=...",
 *   "language": "id",
 *   "duration": { "min": 2, "max": 5 },
 *   "styles": ["curiosity", "controversial", "question", "shock"],
 *   "platform": "tiktok"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "videoId": "...",
 *   "hooks": [
 *     { "id": "hook_01", "rank": 1, "rankScore": 94, "style": "controversial",
 *       "headline": { "text": "..." }, "spokenHook": { "text": "...", "duration": 2.4 },
 *       "source": { "start": 42.3, "end": 46.2, "transcript": "..." },
 *       "score": { "curiosity": 90, "retention": 88, "emotional": 80, "visual": 75,
 *                  "clarity": 92, "relevance": 85, "accuracy": 85, "final": 85.4 },
 *       "accuracy": { "score": 85, "supported": true, "confidence": 90, "risk": "low", "explanation": "..." } }
 *   ],
 *   "candidateCount": 12, "rejectedCount": 2, "duplicateCount": 1,
 *   "generatedAt": "..."
 * }
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
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
