import { z } from 'zod';

const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

/**
 * Validates the request body of `POST /api/process`.
 *
 * `template` is deliberately not constrained to a fixed enum here — the set
 * of valid ids is discovered dynamically from `templates/` at request time
 * (`ManifestService.resolve`), per the template engine's success criteria.
 */
export const processRequestSchema = z.object({
  url: z
    .string({ error: 'url is required' })
    .trim()
    .min(1, 'url is required')
    .regex(YOUTUBE_URL_PATTERN, 'url must be a valid YouTube video URL'),
  template: z.string().trim().min(1).optional(),
  channel: z
    .object({
      name: z.string().trim().min(1).optional(),
      logo: z.string().trim().min(1).optional(),
    })
    .optional(),
});

export type ProcessRequest = z.infer<typeof processRequestSchema>;
