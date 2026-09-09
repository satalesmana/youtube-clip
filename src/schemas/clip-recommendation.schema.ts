import { z } from 'zod';

/**
 * Request schema for `POST /api/clips/recommend`.
 *
 * Standalone viral-clip recommendation stage (flow redesign step 2): finds
 * the most viral-worthy moments across the WHOLE video, independent of the
 * hook recommendation (step 1). Reuses the same download/transcript
 * resolution path so nothing is re-downloaded.
 */
export const clipRecommendRequestSchema = z.object({
  /** YouTube URL to process. Mutually exclusive with videoId. */
  youtubeUrl: z.string().optional(),
  /** Existing processed video id (outputs/{videoId}/). Mutually exclusive with youtubeUrl. */
  videoId: z.string().optional(),
  /** STT engine selection. Falls back to env default. */
  sttProvider: z.enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai']).optional(),
  /**
   * Force regeneration even when a saved clip result exists on disk.
   * The transcript is still reused — only the LLM analysis re-runs.
   */
  refresh: z.boolean().default(false),
  /**
   * Output language for clip metadata (title/reason/hook), e.g. `id`, `en`.
   * `auto`/omitted lets the model match the transcript's language.
   */
  language: z.string().min(1).optional(),
  /**
   * Optional content genre hint.
   * For `match-highlight`, a short or empty transcript is expected and treated
   * as non-fatal. The clip controller will return a warning instead of an error
   * so the UI can prompt the user to use `outputMode: 'reel'` with manual
   * `selectedClips` instead of LLM-based highlight detection.
   */
  genre: z.enum(['podcast', 'sports', 'gaming', 'tutorial', 'commentary', 'entertainment', 'match-highlight']).optional(),
}).refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
  message: 'Provide exactly one of: youtubeUrl OR videoId.',
  path: ['youtubeUrl'],
});

export type ClipRecommendRequestInput = z.infer<typeof clipRecommendRequestSchema>;

/** One recommended viral clip with its preview render metadata. */
export const viralClipSchema = z.object({
  id: z.string(),
  rank: z.number().int().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  durationSeconds: z.number().positive(),
  score: z.number().min(0).max(100),
  title: z.string(),
  reason: z.string(),
  hook: z.string(),
  previewUrl: z.string(),
});

export type ViralClipDto = z.infer<typeof viralClipSchema>;

/** Response shape for `POST /api/clips/recommend` and `GET /api/clips`. */
export const clipRecommendResponseSchema = z.object({
  success: z.literal(true),
  videoId: z.string(),
  clips: z.array(viralClipSchema),
  candidateCount: z.number().int().min(0),
  cached: z.boolean(),
  generatedAt: z.string(),
});

export type ClipRecommendResponse = z.infer<typeof clipRecommendResponseSchema>;
