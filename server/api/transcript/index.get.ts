import { createError, defineEventHandler, getQuery } from 'h3';
import { transcriptGetQuerySchema } from '../../../src/schemas/transcript.schema.js';
import { transcriptController } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

/**
 * `GET /api/transcript`
 *
 * Resolves or fetches the transcript for a video (from disk workspace or downloading/transcribing).
 * Query params:
 *   - `youtubeUrl`: YouTube URL
 *   - `videoId`: Processed video ID
 *   - `sttProvider`: STT engine override
 *   - `force`: boolean to force re-transcription
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const parsed = transcriptGetQuerySchema.safeParse(query);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  try {
    return await transcriptController.getOrCreateTranscript(parsed.data);
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
