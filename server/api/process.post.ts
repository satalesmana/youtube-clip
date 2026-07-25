import { createError, defineEventHandler, readBody } from 'h3';
import { processRequestSchema } from '../../src/schemas/process.schema.js';
import { processController } from '../../src/container/index.js';
import { toHttpError } from '../../src/utils/http-error.js';
import { AppError } from '../../src/utils/errors.js';

/**
 * `POST /api/process`
 *
 * Body: `{ "url": "...", "template"?: "sports"|"news"|"podcast", "channel"?: { "name"?, "logo"? }, "acting_as"?: "viral"|"goal"|"motogp", "custom_prompt"?: string }`
 * `custom_prompt`, when provided, replaces the system prompt entirely and takes precedence over `acting_as`.
 * Response: `{ "success": true, "video", "transcript", "clips", "clipErrors" }`
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = processRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw createError(toHttpError(AppError.invalidUrl(message)));
  }

  try {
    const result = await processController.process(
      parsed.data.url,
      parsed.data.template,
      parsed.data.channel,
      parsed.data.acting_as,
      parsed.data.custom_prompt,
    );
    return { success: true, ...result };
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
