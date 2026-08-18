import { z } from 'zod';

/** Section types of an original short-form script. */
export const scriptSectionTypeSchema = z.enum([
  'hook',
  'context',
  'source',
  'commentary',
  'analysis',
  'supporting',
  'conclusion',
]);

/** One script section as returned by the LLM. */
export const scriptSectionSchema = z.object({
  type: scriptSectionTypeSchema,
  text: z.string().min(1),
  sourceQuote: z.string().optional(),
  evidence: z.array(z.string().min(6)).max(3).optional(),
  beatId: z.string().min(1).optional(),
});

/** Originality self-check embedded in the LLM response. */
export const scriptOriginalitySchema = z.object({
  status: z.enum(['PASS', 'WARNING', 'FAIL']),
  notes: z.array(z.string()).default([]),
});

/** Full LLM response for script generation. */
export const originalScriptResponseSchema = z.object({
  language: z.string().min(1),
  sections: z.array(scriptSectionSchema).min(3).max(10),
  originality: scriptOriginalitySchema,
});

export type ScriptSectionInput = z.infer<typeof scriptSectionSchema>;
export type OriginalScriptResponseInput = z.infer<typeof originalScriptResponseSchema>;
