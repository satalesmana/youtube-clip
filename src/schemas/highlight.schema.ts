import { z } from 'zod';

/**
 * Shape of a single clip as returned by the LLM. Mirrors the prompt's required
 * schema. `peak` is optional: the model is asked for the timestamp of the most
 * intense sentence inside the clip, but older/malformed responses may omit it
 * (duration clamping then falls back to keeping the head of the clip).
 */
export const highlightClipSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  score: z.number().min(0).max(100),
  title: z.string().min(1),
  reason: z.string().min(1),
  hook: z.string().min(1),
  peak: z.number().min(0).optional(),
});

/** Shape of the full `{ "clips": [...] }` payload the LLM must return for one chunk. */
export const highlightChunkResponseSchema = z.object({
  clips: z.array(highlightClipSchema),
});

export type HighlightClipInput = z.infer<typeof highlightClipSchema>;
export type HighlightChunkResponse = z.infer<typeof highlightChunkResponseSchema>;

// ── Second pass: global rerank ──────────────────────────────────────────────

/**
 * One candidate as echoed back by the rerank pass. Only `id` + `score` are
 * required — everything else stays as produced by the first pass.
 */
export const rerankedClipSchema = z.object({
  id: z.string().min(1),
  score: z.number().min(0).max(100),
  title: z.string().optional(),
  reason: z.string().optional(),
  hook: z.string().optional(),
});

/** Shape of the full `{ "clips": [...] }` payload the rerank pass must return. */
export const rerankResponseSchema = z.object({
  clips: z.array(rerankedClipSchema).min(1),
});

export type RerankedClip = z.infer<typeof rerankedClipSchema>;
export type RerankResponse = z.infer<typeof rerankResponseSchema>;
