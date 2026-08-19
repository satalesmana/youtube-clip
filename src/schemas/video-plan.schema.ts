import { z } from 'zod';

/** Scene types in a generated short-form video plan. */
export const planSceneTypeSchema = z.enum([
  'hook',
  'context',
  'source',
  'commentary',
  'analysis',
  'supporting',
  'conclusion',
]);

/** One planned scene. */
export const planSceneSchema = z.object({
  type: planSceneTypeSchema,
  start: z.number().min(0),
  end: z.number().min(0),
  narration: z.string().min(1),
  source: z
    .object({ start: z.number().min(0), end: z.number().min(0) })
    .optional(),
  visual: z.string().optional(),
  /** Engagement as short-form content (1-10), carried from the story beat. */
  engagementScore: z.number().int().min(1).max(10).optional(),
  /** How keep-able this scene is in the final short. */
  retentionRisk: z.enum(['high', 'medium', 'low']).optional(),
  /** The curiosity gap / tension this scene opens. */
  openLoop: z.string().optional(),
  /** The most caption-worthy verbatim line from the source beat. */
  quotableLine: z.string().optional(),
});

/** A caption event with word-level timing. */
export const planCaptionSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1),
  highlightWords: z.array(z.string()).optional(),
  /** 'quote' renders a larger money-line card instead of a narration caption. */
  type: z.enum(['narration', 'quote']).optional(),
  /** Real word boundaries (absolute seconds), for voice-synced highlighting. */
  wordTimings: z
    .array(z.object({ word: z.string(), start: z.number(), end: z.number() }))
    .optional(),
});

/** Full video plan as validated. */
export const videoPlanSchema = z.object({
  candidateId: z.string().min(1),
  angleId: z.string().min(1),
  duration: z.number().positive(),
  scenes: z.array(planSceneSchema).min(1),
  captions: z.array(planCaptionSchema).default([]),
  audio: z.object({
    narration: z.string().optional(),
    sourceUnderlay: z.boolean().default(true),
    ducking: z.boolean().default(false),
  }),
});

export type PlanSceneInput = z.infer<typeof planSceneSchema>;
export type PlanCaptionInput = z.infer<typeof planCaptionSchema>;
export type VideoPlanInput = z.infer<typeof videoPlanSchema>;
