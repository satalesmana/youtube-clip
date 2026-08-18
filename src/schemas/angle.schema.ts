import { z } from 'zod';

/** Content angle types the LLM may produce. */
export const angleTypeSchema = z.enum([
  'commentary',
  'analysis',
  'explainer',
  'education',
  'comparison',
  'fact-check',
  'storytelling',
  'what-you-missed',
  'news-explanation',
]);

/** One content angle as returned by the LLM. */
export const contentAngleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  angleType: angleTypeSchema,
  hook: z.string().min(1),
  reason: z.string().min(1),
  score: z.number().min(0).max(100),
});

/** Full LLM response for angle generation: a list plus the chosen id. */
export const angleGenerationResponseSchema = z.object({
  angles: z.array(contentAngleSchema).min(1).max(8),
  selectedAngleId: z.string().min(1),
});

export type AngleTypeInput = z.infer<typeof angleTypeSchema>;
export type ContentAngleInput = z.infer<typeof contentAngleSchema>;
export type AngleGenerationResponseInput = z.infer<typeof angleGenerationResponseSchema>;
