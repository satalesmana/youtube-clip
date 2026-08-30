import { createError, defineEventHandler, readBody } from 'h3';
import { transcriptUpdateRequestSchema } from '../../../src/schemas/transcript.schema.js';
import { transcriptController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `POST /api/transcript/update`
 *
 * Saves edited transcript segments back to the video workspace and shared storage.
 * Body:
 *   - `videoId`: string
 *   - `language`: optional string
 *   - `segments`: array of TranscriptSegment
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = transcriptUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await transcriptController.updateTranscript(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
