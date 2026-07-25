import { config } from 'dotenv';
import { z } from 'zod';

// Populates `process.env` from a local `.env` file (if present) before the
// schema below reads it. Real environment variables always take precedence.
config();

/**
 * Schema for all environment-driven configuration.
 * Validated once at process start so the rest of the app can trust `env`.
 */
const envSchema = z.object({
  // Selects which AI agent provider handles highlight analysis.
  AI_PROVIDER: z.enum(['ollama', 'router']).default('ollama'),

  OLLAMA_BASE_URL: z.url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen3:14b'),
  OLLAMA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  OLLAMA_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  // AI router (e.g. 9Router), an OpenAI-compatible `/v1/chat/completions` gateway.
  ROUTER_BASE_URL: z.url().optional(),
  ROUTER_API_KEY: z.string().min(1).optional(),
  ROUTER_MODEL: z.string().min(1).default('FreeModel'),
  ROUTER_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  ROUTER_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ROUTER_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  WHISPER_PROVIDER: z.enum(['faster-whisper', 'whisper-cpp']).default('faster-whisper'),
  WHISPER_BINARY_PATH: z.string().min(1).default('whisper'),
  WHISPER_MODEL: z.string().min(1).default('base'),
  WHISPER_LANGUAGE: z.string().min(1).default('auto'),

  YT_DLP_BINARY_PATH: z.string().min(1).default('yt-dlp'),
  YT_DLP_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  // Extra CLI args passed straight through to yt-dlp, e.g. for YouTube's
  // bot-check cookie requirement: --cookies-from-browser chrome
  YT_DLP_EXTRA_ARGS: z.string().default(''),

  FFMPEG_BINARY_PATH: z.string().min(1).default('ffmpeg'),

  DOWNLOADS_DIR: z.string().min(1).default('downloads'),
  TRANSCRIPTS_DIR: z.string().min(1).default('transcripts'),
  OUTPUTS_DIR: z.string().min(1).default('outputs'),
  TEMP_DIR: z.string().min(1).default('temp'),
  TEMPLATES_DIR: z.string().min(1).default('templates'),

  CHUNK_MAX_TOKENS: z.coerce.number().int().positive().default(2500),
  CHUNK_OVERLAP_SECONDS: z.coerce.number().int().min(0).default(18),

  HIGHLIGHT_MIN_SECONDS: z.coerce.number().positive().default(20),
  HIGHLIGHT_MAX_SECONDS: z.coerce.number().positive().default(60),
  HIGHLIGHT_TOP_N: z.coerce.number().int().positive().default(10),

  CLIP_MIN_SECONDS: z.coerce.number().positive().default(15),
  CLIP_MAX_SECONDS: z.coerce.number().positive().default(90),
  CLIP_MAX_CONCURRENCY: z.coerce.number().int().positive().default(2),
  CLIP_DURATION_TOLERANCE_SECONDS: z.coerce.number().min(0).default(2),
  CLIP_MAX_RETRIES: z.coerce.number().int().min(0).default(2),

  REFINEMENT_LEAD_IN_SECONDS: z.coerce.number().min(0).default(2.5),
  REFINEMENT_TRAILING_SECONDS: z.coerce.number().min(0).default(1.5),
  REFINEMENT_MIN_SECONDS: z.coerce.number().positive().default(20),
  REFINEMENT_MAX_SECONDS: z.coerce.number().positive().default(60),

  SUBTITLE_MAX_WORDS_PER_EVENT: z.coerce.number().int().positive().default(4),
  SUBTITLE_PAUSE_BREAK_SECONDS: z.coerce.number().positive().default(0.5),

  ASS_FONT_NAME: z.string().min(1).default('Arial'),
  ASS_FONT_SIZE: z.coerce.number().int().positive().default(90),
  ASS_BASE_COLOR: z.string().min(1).default('#FFFFFF'),
  ASS_HIGHLIGHT_COLOR: z.string().min(1).default('#FFE135'),
  ASS_KEYWORD_COLOR: z.string().min(1).default('#FF3B30'),
  ASS_OUTLINE_COLOR: z.string().min(1).default('#000000'),
  ASS_SHADOW_COLOR: z.string().min(1).default('#000000'),
  ASS_OUTLINE_WIDTH: z.coerce.number().min(0).default(4),
  ASS_SHADOW_DEPTH: z.coerce.number().min(0).default(2),
  ASS_VERTICAL_POSITION_FRACTION: z.coerce.number().min(0).max(1).default(0.75),
  ASS_ANIMATION_STYLE: z.enum(['none', 'karaoke', 'pop', 'fade', 'slide']).default('karaoke'),

  THUMBNAIL_CANDIDATE_COUNT: z.coerce.number().int().positive().default(5),

  RENDER_OUTPUT_WIDTH: z.coerce.number().int().positive().default(1080),
  RENDER_OUTPUT_HEIGHT: z.coerce.number().int().positive().default(1920),
  RENDER_FRAME_RATE: z.coerce.number().int().positive().default(30),
  RENDER_PRESET: z.string().min(1).default('medium'),
  RENDER_CRF: z.coerce.number().min(0).max(51).default(18),
  RENDER_AUDIO_BITRATE_KBPS: z.coerce.number().int().positive().default(192),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
}).superRefine((data, ctx) => {
  if (data.AI_PROVIDER === 'router') {
    if (!data.ROUTER_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['ROUTER_BASE_URL'],
        message: 'ROUTER_BASE_URL is required when AI_PROVIDER=router',
      });
    }
    if (!data.ROUTER_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ROUTER_API_KEY'],
        message: 'ROUTER_API_KEY is required when AI_PROVIDER=router',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

/** Validated, strongly-typed environment configuration singleton. */
export const env: Env = loadEnv();
