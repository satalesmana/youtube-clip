import { z } from 'zod';

/**
 * Validates the request body of `POST /api/research`.
 * All fields are optional — a bare `{}` runs the pipeline with defaults.
 */
export const researchRequestSchema = z.object({
  /** Override the configured max trends (clamped 1–25). */
  max_trends: z.coerce.number().int().min(1).max(25).optional(),
  /** Override the configured language for titles/summaries, e.g. `id`, `en`, `auto`. */
  language: z.string().trim().min(1).optional(),
  /** Keyword for Google News search (empty = use default trending feed). */
  keyword: z.string().trim().optional(),
  /** Comma-separated subreddit override (falls back to config when absent). */
  subreddits: z.string().trim().min(1).optional(),
  /** Comma-separated RSS feed override. */
  rss_feeds: z.string().trim().min(1).optional(),
  /** Research providers to enable: 'rss', 'reddit', 'trends', 'x'. Default: all. */
  providers: z.array(z.enum(['rss', 'reddit', 'trends', 'x'])).optional(),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
