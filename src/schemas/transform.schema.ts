import { z } from 'zod';
import { socialPlatformSchema } from './caption.schema.js';

/** Request schema for `POST /api/transform`. */
export const transformRequestSchema = z.object({
  /** YouTube URL to process. Mutually exclusive with videoId. */
  youtubeUrl: z.string().optional(),
  /**
   * Existing processed video ID (outputs/{videoId}/) to re-transform without
   * re-downloading / re-transcribing. Mutually exclusive with youtubeUrl.
   */
  videoId: z.string().optional(),
  /** A previously discovered candidate index (0-based) within the video. */
  candidateId: z.number().int().min(0).default(0),
  /**
   * Explicit source footage range (absolute seconds) from a recommended hook
   * (e.g. `/api/hooks/generate` → hook.source). Overrides the moment selected
   * by `candidateId`.
   */
  sourceRange: z
    .object({
      start: z.number().min(0),
      end: z.number().min(0),
    })
    .optional(),
  /** The chosen content-angle id (from the angle generation stage). */
  selectedAngleId: z.string().optional(),
  /** A custom editorial angle, overriding LLM-generated angles. */
  customAngleTitle: z.string().optional(),
  /** Custom hook text (spoken opening narration), overriding LLM-generated hooks. */
  customHook: z.string().optional(),
  /** The exact on-screen hook headline title (from recommended hook headline.text). */
  hookTitle: z.string().optional(),
  /** Pattern-interrupt category pill tag for hook title (e.g. "🔥 MOMEN VIRAL"). */
  hookTag: z.string().optional(),
  /** Words inside hook title to highlight in theme accent color. */
  hookHighlightWords: z.array(z.string()).optional(),
  /** Composition engine selection (`ffmpeg` or `remotion`). */
  engine: z.enum(['ffmpeg', 'remotion', 'ffmpeg-template']).optional(),
  /** Visual style selection (`commentary`, `sports`, `interview`). */
  style: z.enum(['commentary', 'sports', 'interview']).optional(),
  /** Template id (defaults to `commentary`). */
  template: z.string().optional(),
  /**
   * Subtitle caption style preset.
   * - `beast`   — Bold pop karaoke, yellow+cyan highlights (default).
   * - `hormozi` — White text on opaque black box, high contrast.
   * - `clean`   — Minimal elegant fade, soft colors.
   */
  subtitleStyle: z.enum(['beast', 'hormozi', 'clean']).optional(),
  /** Channel branding (name + optional logo path). */
  channel: z
    .object({
      name: z.string().optional(),
      logo: z.string().optional(),
    })
    .optional(),
  /** Social-proof badge for the first ~2s of the hook (e.g. "10RB+ Views"). */
  hookBadge: z.string().optional(),
  /**
   * Output language override (`auto` falls back to the transcript language;
   * `id`, `en`, ... for explicit languages).
   */
  language: z.enum(['auto', 'id', 'en']).default('auto'),
  /** TTS provider selection (`edge-tts` or `openai`). Falls back to env default. */
  ttsProvider: z.enum(['edge-tts', 'openai']).optional(),
  /** TTS voice identifier (provider-specific, e.g. "id-ID-ArdiNeural" or "nova"). */
  ttsVoice: z.string().optional(),
  /** TTS speaking rate adjustment (e.g. "-10%", "+0%", "+10%"). */
  ttsRate: z.string().optional(),
  /** STT engine selection. Falls back to env default (`WHISPER_PROVIDER`). */
  sttProvider: z.enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai']).optional(),
  /**
   * Output mode for the final video.
   * - `narration` (default): existing pipeline — script + TTS narration over
   *   the selected footage. Used whenever this field is absent.
   * - `reel`: direct concatenation of the selected source ranges with their
   *   original audio — no script, no TTS, no LLM stages.
   */
  outputMode: z.enum(['reel', 'narration']).optional(),
  /**
   * User-selected viral clips (from `/api/clips/recommend`) to include in the
   * output. Required for `outputMode: 'reel'`; in narration mode, enables dynamic
   * multi-clip storytelling across the selected moments (falls back to single-moment
   * when omitted).
   */
  selectedClips: z.array(z.object({
    start: z.number().min(0),
    end: z.number().min(0),
    title: z.string().optional(),
  })).min(1).optional(),
  /**
   * Optional target narration / video duration in seconds.
   * If omitted, automatically derived from selectedClips, hook sourceRange,
   * or candidate moment.
   */
  targetDuration: z.number().positive().optional(),
  /**
   * Server path of the selected hook's styled final intro video
   * (`hook.previewPath` from `/api/hooks/generate`). When provided and the
   * file exists, the reel opens with that exact file (WYSIWYG) instead of
   * re-cutting `sourceRange` from the source video.
   */
  hookPreviewPath: z.string().optional(),
  /**
   * Explicit user-selected visual preset for the hook intro headline.
   * When omitted (auto mode), the server uses resolveVisualPreset() with
   * hookType + angle from the AI pipeline (Phase 5).
   */
  visualPreset: z.enum([
    'kinetic-punch',
    'curiosity-stack',
    'story-slide',
    'minimal-question',
    'bold-impact',
    'data-punch',
    'opportunity-glow',
    'focus-brush',
    'clean-fade',
    'scribble-quote',
    'action-pointer',
    'burst-stat',
  ] as const).optional(),

  /**
   * Optional manual override for hook composition layout.
   * If omitted, the preset's native layout is used.
   */
  hookLayout: z.enum([
    'centered',
    'top-heavy',
    'split-proof',
    'full-screen-text',
    'subject-first',
    'data-focus',
    'question-focus',
  ] as const).optional(),

  /**
   * Optional manual override for hook text animation motion.
   * If omitted, the preset's native animation motion is used.
   */
  hookAnimation: z.enum([
    'spring-punch',
    'word-cascade',
    'slide-up',
    'scale-burst',
    'fade',
  ] as const).optional(),

  /**
   * Optional manual override for hook text typography style.
   * If omitted, the preset's native typography style is used.
   */
  hookTypography: z.enum([
    'kinetic',
    'stacked',
    'minimal',
    'bold-caps',
    'bebas-neue',
    'montserrat',
    'anton',
    'archivo-black',
    'poppins',
    'oswald',
    'barlow-condensed',
  ] as const).optional(),

  /**
   * Badge pill design system preset:
   * 'neon-outline' | 'solid-impact' | 'highlight-chip' | 'editorial-label' | 'price-tag' | 'speech-bubble' | 'burst-stamp' | 'diagonal-slash'
   */
  hookBadgePreset: z.enum([
    'neon-outline',
    'solid-impact',
    'highlight-chip',
    'editorial-label',
    'price-tag',
    'speech-bubble',
    'burst-stamp',
    'diagonal-slash',
  ] as const).optional(),

  /**
   * Badge pill color variant:
   * 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto'
   */
  hookBadgeColor: z.enum([
    'cyan',
    'magenta',
    'red',
    'yellow',
    'green',
    'purple',
    'gold',
    'auto',
  ] as const).optional(),

  /** If true, the response includes the script and video plan for review. */
  dryRun: z.boolean().default(false),

  /**
   * User-edited custom narration script to use for TTS and video plan,
   * bypassing automatic LLM script generation.
   */
  customScript: z
    .object({
      language: z.string().optional(),
      sections: z.array(
        z.object({
          type: z.enum([
            'hook',
            'context',
            'source',
            'commentary',
            'analysis',
            'supporting',
            'conclusion',
          ]),
          text: z.string().min(1),
          spokenText: z.string().optional(),
          sourceQuote: z.string().optional(),
          evidence: z.array(z.string()).optional(),
          beatId: z.string().optional(),
        }),
      ).min(1),
    })
    .optional(),
  /**
   * Pre-generated narration audio (e.g. from previewing TTS in script editor).
   * When provided and the audio file exists on disk, TTS generation is skipped.
   */
  existingNarration: z
    .object({
      outputPath: z.string(),
      durationSeconds: z.number().positive(),
      sections: z
        .array(
          z.object({
            type: z.string(),
            durationSeconds: z.number(),
            wordTimings: z
              .array(
                z.object({
                  word: z.string(),
                  start: z.number(),
                  end: z.number(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  /**
   * Optional content genre for the source video.
   * When supplied, all LLM stages (angle generation, story concept detection,
   * script pacing, hook style prioritisation) are biased toward the patterns
   * that work best for that genre.
   *
   * - `podcast`       — interview, talk show, long-form conversation
   * - `sports`        — highlights, match recap, live sports
   * - `gaming`        — gameplay, esports, game review
   * - `tutorial`      — how-to, education, step-by-step walkthrough
   * - `commentary`    — opinion, news analysis, explainer
   * - `entertainment` — comedy, lifestyle, vlog, reaction
   */
  genre: z.enum(['podcast', 'sports', 'gaming', 'tutorial', 'commentary', 'entertainment', 'match-highlight']).optional(),
  /**
   * Optional custom instruction / tone direction for LLM stages
   * (e.g. "fokus ke momen lucu", "gaya sarkas", "jelaskan secara sederhana").
   */
  customPrompt: z.string().max(500).optional(),
  /**
   * Watermark blurring settings.
   * - `false` / absent — disabled (default, no blur).
   * - `true`           — shorthand for `{ enabled: true, mode: "preset" }` (blurs all four corners).
   * - object form      — full control over mode, corner selection, and blur strength.
   *
   * Modes:
   * - `preset`  — blurs the chosen corner patches without any AI detection.
   * - `auto`    — runs Vision AI detection; falls back to no blur when detection fails.
   * - `custom`  — uses caller-supplied bounding boxes (requires `regions`).
   */
  blur_watermark: z.union([
    z.boolean(),
    z.object({
      enabled: z.boolean().default(true),
      mode: z.enum(['auto', 'preset', 'custom']).default('preset'),
      /** Corner positions to blur (for mode `preset`; default: all four). */
      positions: z
        .array(z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']))
        .optional(),
      /** FFmpeg boxblur sigma strength (5–50; default: 15). */
      blur_strength: z.coerce.number().int().min(5).max(50).optional(),
    }),
  ]).optional(),
  /** Target social platforms for auto caption generation. Defaults to all platforms if omitted. */
  captionPlatforms: z.array(socialPlatformSchema).optional(),
  /**
   * Custom credit line template for social media captions.
   * Supports placeholders: `{channel}` and `{url}`.
   * Empty string `""` disables credit.
   */
  captionCreditTemplate: z.string().optional(),
  /** Whether to generate viral captions during transform. Defaults to true. */
  generateCaptions: z.boolean().default(true),
  /**
   * Audio output mode for the final video.
   *
   * - `strip_original` — (default) Remove source audio, use TTS narration only.
   * - `keep_original`  — Preserve source audio (crowd, music, SFX); TTS is
   *                       skipped and the LLM script is used for subtitles only.
   *                       This is the automatic default for genre `match-highlight`.
   * - `voice_over`     — Mix TTS narration over the source audio.
   *                       Source audio is attenuated to `sourceAudioVolume`.
   */
  audioMode: z.preprocess(
    (val) => (val === 'keep' ? 'keep_original' : val === 'speech' ? 'voice_over' : val === 'music' ? 'strip_original' : val),
    z.enum(['strip_original', 'keep_original', 'voice_over']),
  ).optional(),
  /**
   * Linear volume level for the source audio when `audioMode` is `voice_over`.
   * Range: 0.0 (silent) to 1.0 (full). Defaults to 0.3 (≈ −10 dB).
   */
  sourceAudioVolume: z.number().min(0).max(1).optional(),
}).refine((data) => Boolean(data.youtubeUrl) || Boolean(data.videoId), {
  message: 'Provide at least one of: youtubeUrl OR videoId.',
  path: ['youtubeUrl'],
}).refine((data) => !data.sourceRange || data.sourceRange.end > data.sourceRange.start, {
  message: 'sourceRange.end must be greater than sourceRange.start.',
  path: ['sourceRange'],
}).refine((data) => data.outputMode !== 'reel' || (data.selectedClips?.length ?? 0) > 0, {
  message: 'outputMode "reel" requires at least one selectedClips entry.',
  path: ['selectedClips'],
});

export type TransformRequestInput = z.infer<typeof transformRequestSchema>;

/** Response for a successful transform run. */
export const transformResponseSchema = z.object({
  success: z.literal(true),
  jobId: z.string(),
  url: z.string().optional(),
  videoId: z.string(),
  candidateId: z.number(),
  angle: z.object({
    id: z.string(),
    title: z.string(),
    angleType: z.string(),
    hook: z.string(),
    reason: z.string(),
    score: z.number(),
  }),
  story: z.object({
    concept: z.string(),
    protagonist: z.string(),
    premise: z.string(),
    beats: z.array(z.object({
      id: z.string(),
      role: z.string(),
      purpose: z.string(),
      start: z.number(),
      end: z.number(),
      evidence: z.array(z.string()),
      kondisiAwal: z.string().optional(),
      konflik: z.string().optional(),
      titikBalik: z.string().optional(),
      hasil: z.string().optional(),
    })),
  }).optional(),
  script: z.object({
    language: z.string(),
    sections: z.array(
      z.object({
        type: z.string(),
        text: z.string(),
        sourceQuote: z.string().optional(),
        evidence: z.array(z.string()).optional(),
      }),
    ),
    estimatedDurationSeconds: z.number(),
    originality: z.object({
      status: z.string(),
      notes: z.array(z.string()),
    }),
  }),
  narration: z.object({
    outputPath: z.string(),
    durationSeconds: z.number(),
    url: z.string().optional(),
  }),
  videoPlan: z.object({
    duration: z.number(),
    scenes: z.array(
      z.object({
        type: z.string(),
        start: z.number(),
        end: z.number(),
        narration: z.string(),
        source: z
          .object({ start: z.number(), end: z.number() })
          .optional(),
        visual: z.string().optional(),
      }),
    ),
    captions: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        highlightWords: z.array(z.string()).optional(),
      }),
    ),
  }),
  outputVideo: z.object({
    path: z.string(),
    url: z.string(),
    durationSeconds: z.number(),
    sizeBytes: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  generatedAt: z.string(),
  dryRun: z.literal(false),
});

export type TransformResponse = z.infer<typeof transformResponseSchema>;
