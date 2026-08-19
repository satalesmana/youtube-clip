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

/** How keep-able a beat is in a short-form clip — drives cut decisions. */
export const storyRetentionRiskSchema = z.enum(['high', 'medium', 'low']);

/** The single strongest opening cut: 1-3s range + a scroll-stopping on-screen line. */
export const storyHookMomentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  suggestedLine: z.string().min(1),
});

export const sourceStorySchema = z.object({
  concept: storyConceptSchema,
  protagonist: z.string().min(1),
  premise: z.string().min(1),
  /** Optional: the strongest 1-3s opening cut for a short-form clip. */
  hookMoment: storyHookMomentSchema.optional(),
  beats: z.array(
    z.object({
      id: z.string().min(1),
      role: storyBeatRoleSchema,
      purpose: z.string().min(1),
      start: z.number().min(0),
      end: z.number().min(0),
      evidence: z.array(z.string().min(4)).min(1).max(2),
      ...storyBeatNarrativeSchema.shape,
      /** Engagement as short-form content (1-10), not narrative importance alone. */
      engagementScore: z.number().int().min(1).max(10).optional(),
      /** The most caption-worthy verbatim line in this beat ('' when none). */
      quotableLine: z.string().optional(),
      /** The curiosity gap / tension this beat opens (answered by a later beat). */
      openLoop: z.string().optional(),
      /** How keep-able this beat is in the final short. */
      retentionRisk: storyRetentionRiskSchema.optional(),
    }),
  ).min(4).max(7),
});
