import { z } from 'zod';

export const socialPlatformSchema = z.enum([
  'tiktok',
  'instagram',
  'youtube_shorts',
  'x',
  'threads',
]);

export const captionToneSchema = z.enum([
  'viral_hype',
  'storytelling',
  'educational',
  'controversial',
  'humorous',
]);

export const platformCaptionSchema = z.object({
  platform: socialPlatformSchema,
  title: z.string().optional(),
  hook: z.string(),
  body: z.string(),
  callToAction: z.string(),
  hashtags: z.array(z.string()),
  formattedCaption: z.string(),
  searchKeywords: z.array(z.string()),
  characterCount: z.number().int().min(0),
  strategyExplanation: z.string(),
  recommendedAudioVibe: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const llmCaptionItemSchema = z.object({
  title: z.string().optional(),
  hook: z.string(),
  body: z.string(),
  callToAction: z.string(),
  hashtags: z.array(z.string()),
  searchKeywords: z.array(z.string()).default([]),
  strategyExplanation: z.string(),
  recommendedAudioVibe: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const llmCaptionsResponseSchema = z.object({
  tiktok: llmCaptionItemSchema,
  instagram: llmCaptionItemSchema,
  youtube_shorts: llmCaptionItemSchema,
  x: llmCaptionItemSchema,
  threads: llmCaptionItemSchema,
});

export const generateCaptionRequestSchema = z.object({
  /** Target video ID from outputs/ directory. */
  videoId: z.string().optional(),
  /** YouTube URL to resolve videoId from. */
  youtubeUrl: z.string().optional(),
  /** Optional job ID associated with this transform run. */
  jobId: z.string().optional(),
  /** Desired tone for the captions. Defaults to 'viral_hype'. */
  tone: captionToneSchema.default('viral_hype'),
  /** Output language ('auto', 'id', 'en'). Defaults to 'auto'. */
  language: z.enum(['auto', 'id', 'en']).default('auto'),
  /** Optional single platform filter. When omitted, all platforms are generated. */
  platform: socialPlatformSchema.optional(),
  /** Force regeneration even if a cached result exists. */
  refresh: z.boolean().default(false),
  /** Optional manual context override (e.g. from an in-memory transform result). */
  customContext: z
    .object({
      sourceTitle: z.string().optional(),
      sourceChannel: z.string().optional(),
      genre: z.string().optional(),
      angleTitle: z.string().optional(),
      angleHook: z.string().optional(),
      scriptText: z.string().optional(),
      storyConcept: z.string().optional(),
      durationSeconds: z.number().optional(),
    })
    .optional(),
}).refine((data) => Boolean(data.videoId) || Boolean(data.youtubeUrl) || Boolean(data.customContext?.sourceTitle), {
  message: 'Provide at least one of: videoId, youtubeUrl, or customContext.sourceTitle.',
  path: ['videoId'],
});

export type GenerateCaptionRequest = z.infer<typeof generateCaptionRequestSchema>;
export type PlatformCaptionDto = z.infer<typeof platformCaptionSchema>;
export type LlmCaptionsResponse = z.infer<typeof llmCaptionsResponseSchema>;
