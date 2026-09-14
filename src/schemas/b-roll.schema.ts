import { z } from 'zod';

export const brollCueSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  query: z.string().min(1),
  mood: z.string().optional(),
});

export const brollResponseSchema = z.object({
  cues: z.array(brollCueSchema),
});

export type BrollCueInput = z.infer<typeof brollCueSchema>;
export type BrollResponseInput = z.infer<typeof brollResponseSchema>;
