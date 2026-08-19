import { z } from 'zod';

/** Request schema for `POST /api/transform`. */
export const transformRequestSchema = z.object({
  /** YouTube URL to process. Mutually exclusive with videoId. */
  youtubeUrl: z.string().optional(),
  /**
   * Existing processed video ID (outputs/{videoId}/) to re-transform without
   * re-downloading / re-transcribing. Mutually exclusive with youtubeUrl.
   */
  videoId: z.string().optional(),
  /** A previously discovered candidate index (0-based) within the video. */
  candidateId: z.number().int().min(0).default(0),
  /** The chosen content-angle id (from the angle generation stage). */
  selectedAngleId: z.string().optional(),
  /** A custom editorial angle, overriding LLM-generated angles. */
  customAngleTitle: z.string().optional(),
  /** Custom hook text, overriding LLM-generated hooks. */
  customHook: z.string().optional(),
  /** Template id (defaults to `commentary`). */
  template: z.string().optional(),
  /** Channel branding (name + optional logo path). */
  channel: z
    .object({
      name: z.string().optional(),
      logo: z.string().optional(),
    })
    .optional(),
  /** Social-proof badge for the first ~2s of the hook (e.g. "10RB+ Views"). */
  hookBadge: z.string().optional(),
  /**
   * Output language override (`auto` falls back to the transcript language;
   * `id`, `en`, ... for explicit languages).
   */
  language: z.enum(['auto', 'id', 'en']).default('auto'),
  /** If true, the response includes the script and video plan for review. */
  dryRun: z.boolean().default(false),
}).refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
  message: 'Provide exactly one of: youtubeUrl OR videoId.',
  path: ['youtubeUrl'],
});

export type TransformRequestInput = z.infer<typeof transformRequestSchema>;

/** Response for a successful transform run. */
export const transformResponseSchema = z.object({
  success: z.literal(true),
  jobId: z.string(),
  url: z.string().optional(),
  videoId: z.string(),
  candidateId: z.number(),
  angle: z.object({
    id: z.string(),
    title: z.string(),
    angleType: z.string(),
    hook: z.string(),
    reason: z.string(),
    score: z.number(),
  }),
  story: z.object({
    concept: z.string(),
    protagonist: z.string(),
    premise: z.string(),
    beats: z.array(z.object({
      id: z.string(),
      role: z.string(),
      purpose: z.string(),
      start: z.number(),
      end: z.number(),
      evidence: z.array(z.string()),
      kondisiAwal: z.string().optional(),
      konflik: z.string().optional(),
      titikBalik: z.string().optional(),
      hasil: z.string().optional(),
    })),
  }).optional(),
  script: z.object({
    language: z.string(),
    sections: z.array(
      z.object({
        type: z.string(),
        text: z.string(),
        sourceQuote: z.string().optional(),
        evidence: z.array(z.string()).optional(),
      }),
    ),
    estimatedDurationSeconds: z.number(),
    originality: z.object({
      status: z.string(),
      notes: z.array(z.string()),
    }),
  }),
  narration: z.object({
    outputPath: z.string(),
    durationSeconds: z.number(),
    url: z.string().optional(),
  }),
  videoPlan: z.object({
    duration: z.number(),
    scenes: z.array(
      z.object({
        type: z.string(),
        start: z.number(),
        end: z.number(),
        narration: z.string(),
        source: z
          .object({ start: z.number(), end: z.number() })
          .optional(),
        visual: z.string().optional(),
      }),
    ),
    captions: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        highlightWords: z.array(z.string()).optional(),
      }),
    ),
  }),
  outputVideo: z.object({
    path: z.string(),
    url: z.string(),
    durationSeconds: z.number(),
    sizeBytes: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  generatedAt: z.string(),
  dryRun: z.literal(false),
});

export type TransformResponse = z.infer<typeof transformResponseSchema>;
