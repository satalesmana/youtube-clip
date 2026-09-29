import { defineEventHandler, readBody, createError } from 'h3';
import { ttsSectionSynthesizeRequestSchema } from '../../../src/schemas/script.schema.js';
import { createTtsServiceWith, resolveTtsProviderKind } from '../../../src/container/index.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';
import { env } from '../../../src/config/env.js';

/**
 * POST /api/tts/section
 *
 * Synthesizes audio for a single section with persistent disk caching.
 * Returns the section audio URL and duration.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = ttsSectionSynthesizeRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const req = parsed.data;
  const effectiveVoice = req.ttsVoice?.trim() || env.TTS_VOICE;
  const effectiveProvider = resolveTtsProviderKind(req.ttsProvider, effectiveVoice);
  const effectiveRate = req.ttsRate ?? env.TTS_RATE;

  const ttsService = createTtsServiceWith(effectiveProvider, effectiveVoice, effectiveRate);
  const result = await ttsService.synthesizeSection(
    {
      type: req.type || 'commentary',
      text: req.text,
      spokenText: req.spokenText,
    },
    req.language ?? env.TTS_LANGUAGE ?? 'id',
  );

  const relativePath = result.outputPath.split('outputs/').pop() || result.outputPath;
  const audioUrl = `/api/media/${relativePath.replace(/^\/+/, '')}`;

  return {
    success: true,
    audioUrl,
    durationSeconds: result.durationSeconds,
    wordTimings: result.wordTimings,
  };
});
