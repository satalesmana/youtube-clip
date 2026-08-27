import { z } from 'zod';

/** Hook styles the LLM may emit (Plan §5). */
export const hookStyleSchema = z.enum([
  'curiosity',
  'controversial',
  'question',
  'shock',
  'contrarian',
  'prediction',
  'story',
  'statistic',
  'fear',
  'opportunity',
]);

/** One hook candidate as returned by the generation LLM. */
export const hookCandidateLlmSchema = z.object({
  id: z.string().min(1),
  angleId: z.string().min(1),
  style: hookStyleSchema,
  headline: z.string().min(3),
  spokenHook: z.string().min(3),
  /** Short category / pattern-interrupt badge tag (e.g. "🔥 MOMEN VIRAL", "⚡ DETIK KRUSIAL"). */
  tag: z.string().optional(),
  /** 1-2 emotional punch words from the headline to highlight in accent color. */
  highlightWords: z.array(z.string()).optional(),
  /** Source footage range in absolute seconds of the source video. */
  sourceStart: z.number().min(0),
  sourceEnd: z.number().min(0),
  /** Verbatim transcript excerpt covering the source range. */
  sourceTranscript: z.string().min(1),
  emotion: z.string().optional(),
  topic: z.string().optional(),
  reason: z.string().optional(),
});

/** Full LLM response for hook candidate generation. */
export const hookGenerationResponseSchema = z.object({
  candidates: z.array(hookCandidateLlmSchema).min(1).max(20),
});

/** One accuracy verdict as returned by the accuracy-guard LLM. */
export const hookAccuracyLlmSchema = z.object({
  id: z.string().min(1),
  score: z.number().min(0).max(100),
  supported: z.boolean(),
  confidence: z.number().min(0).max(100),
  risk: z.enum(['low', 'medium', 'high']),
  explanation: z.string().min(1),
});

/** Full LLM response for the accuracy guard (batch over all candidates). */
export const hookAccuracyResponseSchema = z.object({
  results: z.array(hookAccuracyLlmSchema).min(1),
});

/** One score card as returned by the scoring LLM. */
export const hookScoreLlmSchema = z.object({
  id: z.string().min(1),
  curiosity: z.number().min(0).max(100),
  retention: z.number().min(0).max(100),
  emotional: z.number().min(0).max(100),
  visual: z.number().min(0).max(100),
  clarity: z.number().min(0).max(100),
  relevance: z.number().min(0).max(100),
});

/** Full LLM response for hook scoring (batch over all candidates). */
export const hookScoringResponseSchema = z.object({
  scores: z.array(hookScoreLlmSchema).min(1),
});

export type HookStyleInput = z.infer<typeof hookStyleSchema>;
export type HookCandidateLlmInput = z.infer<typeof hookCandidateLlmSchema>;
export type HookGenerationResponseInput = z.infer<typeof hookGenerationResponseSchema>;
export type HookAccuracyLlmInput = z.infer<typeof hookAccuracyLlmSchema>;
export type HookScoreLlmInput = z.infer<typeof hookScoreLlmSchema>;

// ── API request schema (Plan §7) ────────────────────────────────────────

/** Request schema for `POST /api/hooks/generate`. */
export const hookGenerateRequestSchema = z
  .object({
    /** YouTube URL to process. Mutually exclusive with videoId. */
    youtubeUrl: z.string().optional(),
    /** Existing processed video id (outputs/{videoId}/). Mutually exclusive with youtubeUrl. */
    videoId: z.string().optional(),
    /** Candidate moment index within the video (0-based). */
    candidateId: z.number().int().min(0).default(0),
    /** Target language for the hooks ("auto" follows the transcript). */
    language: z.enum(['auto', 'id', 'en']).default('auto'),
    /** Preferred source-clip duration window in seconds (ideal 1.5-5s). */
    duration: z
      .object({
        min: z.number().min(0.5).max(10).optional(),
        max: z.number().min(1).max(15).optional(),
      })
      .optional(),
    /** Requested hook styles (defaults to the MVP four). */
    styles: z.array(hookStyleSchema).min(1).max(10).optional(),
    /** STT engine selection. Falls back to env default (`WHISPER_PROVIDER`). */
    sttProvider: z.enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai']).optional(),
    /** Target platform (metadata only for now). */
    platform: z.string().max(32).optional(),
    /** Force regeneration even when a saved hook result exists on disk. */
    refresh: z.boolean().optional(),
    /**
     * Optional content genre — when supplied, biases angle types, story concept
     * detection, and hook style prioritisation toward the patterns that work
     * best for that genre.
     */
    genre: z.enum(['podcast', 'sports', 'gaming', 'tutorial', 'commentary', 'entertainment']).optional(),
  })
  .refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
    message: 'Provide exactly one of: youtubeUrl OR videoId.',
    path: ['youtubeUrl'],
  })
  .refine((data) => !data.duration || !data.duration.min || !data.duration.max || data.duration.max > data.duration.min, {
    message: 'duration.max must be greater than duration.min.',
    path: ['duration'],
  });

export type HookGenerateRequestInput = z.infer<typeof hookGenerateRequestSchema>;
