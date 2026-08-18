import { z } from 'zod';

export const storyConceptSchema = z.enum([
  'character-journey',
  'comeback',
  'turning-point',
  'claim-consequence',
  'discovery-explainer',
]);

export const storyBeatRoleSchema = z.enum([
  'setup',
  'tension',
  'turningPoint',
  'resolution',
  'reflection',
  'conclusion',
]);

/** Optional narrative metadata for each beat. All fields are optional — not every beat has all four. */
const storyBeatNarrativeSchema = z.object({
  kondisiAwal: z.string().min(1).optional(),
  konflik: z.string().min(1).optional(),
  titikBalik: z.string().min(1).optional(),
  hasil: z.string().min(1).optional(),
});

export const sourceStorySchema = z.object({
  concept: storyConceptSchema,
  protagonist: z.string().min(1),
  premise: z.string().min(1),
  beats: z.array(
    z.object({
      id: z.string().min(1),
      role: storyBeatRoleSchema,
      purpose: z.string().min(1),
      start: z.number().min(0),
      end: z.number().min(0),
      evidence: z.array(z.string().min(4)).min(1).max(2),
      ...storyBeatNarrativeSchema.shape,
    }),
  ).min(4).max(7),
});
