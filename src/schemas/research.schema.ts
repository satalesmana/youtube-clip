import { z } from 'zod';

/**
 * Validates the request body of `POST /api/research`.
 * All fields are optional — a bare `{}` runs the pipeline with defaults.
 */
const stringOrArray = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => {
    if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  })
  .optional();

export const researchRequestSchema = z.object({
  /** Override the configured max trends (clamped 1–25). */
  max_trends: z.coerce.number().int().min(1).max(25).optional(),
  maxTrends: z.coerce.number().int().min(1).max(25).optional(),
  /** Override the configured language for titles/summaries, e.g. `id`, `en`, `auto`. */
  language: z.string().trim().min(1).optional(),
  /** Keyword for Google News search (empty = use default trending feed). */
  keyword: z.string().trim().optional(),
  /** Comma-separated or array subreddit override (falls back to config when absent). */
  subreddits: stringOrArray,
  /** Comma-separated or array RSS feed override. */
  rss_feeds: stringOrArray,
  rssFeeds: stringOrArray,
  /** Research providers to enable: 'rss', 'reddit', 'trends', 'x'. Default: all. */
  providers: z.array(z.enum(['rss', 'reddit', 'trends', 'x'])).optional(),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
