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
  spokenText: z.string().optional(),
  sourceQuote: z.string().optional(),
  evidence: z
    .preprocess((val) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed.length > 0 ? [trimmed] : undefined;
      }
      if (Array.isArray(val)) {
        const cleaned = val
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean);
        return cleaned.length > 0 ? cleaned : undefined;
      }
      return undefined;
    }, z.array(z.string()).optional())
    .optional(),
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

/** Request schema for `POST /api/scripts/draft`. */
export const scriptDraftRequestSchema = z
  .object({
    /** YouTube URL to process. Mutually exclusive with videoId. */
    youtubeUrl: z.string().optional(),
    /** Existing processed video ID. Mutually exclusive with youtubeUrl. */
    videoId: z.string().optional(),
    /** A previously discovered candidate index (0-based) within the video. */
    candidateId: z.number().int().min(0).default(0),
    /** Explicit source footage range from recommended hook. */
    sourceRange: z
      .object({
        start: z.number().min(0),
        end: z.number().min(0),
      })
      .optional(),
    /** The chosen content-angle id. */
    selectedAngleId: z.string().optional(),
    /** A custom editorial angle title. */
    customAngleTitle: z.string().optional(),
    /** Custom hook text (spoken opening narration). */
    customHook: z.string().optional(),
    /** On-screen hook headline title. */
    hookTitle: z.string().optional(),
    /** Pattern-interrupt category pill tag for hook title. */
    hookTag: z.string().optional(),
    /** Words inside hook title to highlight. */
    hookHighlightWords: z.array(z.string()).optional(),
    /** Output language override (`auto`, `id`, `en`). */
    language: z.enum(['auto', 'id', 'en']).default('auto'),
    /** STT engine selection. */
    sttProvider: z.enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai']).optional(),
    /** Optional content genre for the source video. */
    genre: z.enum(['podcast', 'sports', 'gaming', 'tutorial', 'commentary', 'entertainment', 'match-highlight']).optional(),
    /** Optional custom instruction / tone direction for script drafting. */
    customPrompt: z.string().max(500).optional(),
    /** Selected clips from `/api/clips/recommend`. */
    selectedClips: z
      .array(
        z.object({
          start: z.number().min(0),
          end: z.number().min(0),
          title: z.string().optional(),
        }),
      )
      .min(1)
      .optional(),
    /** Optional explicit target duration in seconds for narration. */
    targetDuration: z.number().positive().optional(),
  })
  .refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
    message: 'Provide exactly one of: youtubeUrl OR videoId.',
    path: ['youtubeUrl'],
  })
  .refine((data) => !data.sourceRange || data.sourceRange.end > data.sourceRange.start, {
    message: 'sourceRange.end must be greater than sourceRange.start.',
    path: ['sourceRange'],
  });

export type ScriptDraftRequestInput = z.infer<typeof scriptDraftRequestSchema>;

/** Request schema for `POST /api/tts/synthesize`. */
export const ttsSynthesizeRequestSchema = z
  .object({
    /** YouTube URL to process. Mutually exclusive with videoId. */
    youtubeUrl: z.string().optional(),
    /** Existing processed video ID. Mutually exclusive with youtubeUrl. */
    videoId: z.string().optional(),
    /** TTS provider selection (`edge-tts` or `openai`). */
    ttsProvider: z.enum(['edge-tts', 'openai']).optional(),
    /** TTS voice identifier (e.g. "id-ID-ArdiNeural" or "nova"). */
    ttsVoice: z.string().optional(),
    /** TTS speaking rate adjustment (e.g. "-10%", "+0%", "+10%"). */
    ttsRate: z.string().optional(),
    /** Script to synthesize. */
    customScript: z.object({
      language: z.string().optional(),
      sections: z
        .array(
          z.object({
            type: scriptSectionTypeSchema,
            text: z.string().min(1),
            spokenText: z.string().optional(),
            sourceQuote: z.string().optional(),
            evidence: z.array(z.string()).optional(),
            beatId: z.string().optional(),
          }),
        )
        .min(1),
    }),
  })
  .refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
    message: 'Provide exactly one of: youtubeUrl OR videoId.',
    path: ['youtubeUrl'],
  });

export type TtsSynthesizeRequestInput = z.infer<typeof ttsSynthesizeRequestSchema>;

