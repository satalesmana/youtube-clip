import { z } from 'zod';

const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

/** Validates the request body of `POST /api/process`. */
export const processRequestSchema = z.object({
  url: z
    .string({ error: 'url is required' })
    .trim()
    .min(1, 'url is required')
    .regex(YOUTUBE_URL_PATTERN, 'url must be a valid YouTube video URL'),
});

export type ProcessRequest = z.infer<typeof processRequestSchema>;
