import { z } from 'zod';

/** Shape of a single clip as returned by the LLM. Mirrors the prompt's required schema. */
export const highlightClipSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  score: z.number().min(0).max(100),
  title: z.string().min(1),
  reason: z.string().min(1),
  hook: z.string().min(1),
});

/** Shape of the full `{ "clips": [...] }` payload the LLM must return for one chunk. */
export const highlightChunkResponseSchema = z.object({
  clips: z.array(highlightClipSchema),
});

export type HighlightClipInput = z.infer<typeof highlightClipSchema>;
export type HighlightChunkResponse = z.infer<typeof highlightChunkResponseSchema>;
