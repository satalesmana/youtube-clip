import { config } from 'dotenv';
import { z } from 'zod';

// Populates `process.env` from a local `.env` file (if present) before the
// schema below reads it. Real environment variables always take precedence.
config({ override: true });

/**
 * Normalizes an environment variable value:
 * If the value is an empty string or whitespace only, treats it as `undefined`
 * so `.optional()` and `.default(...)` resolve correctly instead of failing
 * on empty strings (e.g. `TTS_FISH_SAMPLE_RATE=` in .env).
 */
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);

/**
 * Schema for all environment-driven configuration.
 * Validated once at process start so the rest of the app can trust `env`.
 */
export const envSchema = z
  .object({
    // Selects AI agent provider (OpenAI-compatible AI router, e.g. 9Router).
    AI_PROVIDER: z.string().default('router'),

    // AI router (e.g. 9Router), an OpenAI-compatible `/v1/chat/completions` gateway.
    ROUTER_BASE_URL: emptyToUndefined(z.url().optional()),
    ROUTER_API_KEY: emptyToUndefined(z.string().min(1).optional()),
    ROUTER_MODEL: z.string().min(1).default('auto'),
    ROUTER_TEMPERATURE: emptyToUndefined(z.coerce.number().min(0).max(2).default(0.2)),
    ROUTER_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(120_000)),
    ROUTER_MAX_RETRIES: emptyToUndefined(z.coerce.number().int().min(0).default(3)),

    WHISPER_PROVIDER: z
      .enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai'])
      .default('faster-whisper'),
    WHISPER_BINARY_PATH: z.string().min(1).default('whisper'),
    WHISPER_MODEL: z.string().min(1).default('base'),
    WHISPER_LANGUAGE: z.string().min(1).default('auto'),
    // Extra CLI args passed straight through to the whisper binary, e.g.
    // WHISPER_EXTRA_ARGS="--device cuda --compute_type float16"
    WHISPER_EXTRA_ARGS: z.string().default(''),

    // OpenAI-compatible STT endpoint (only when WHISPER_PROVIDER=openai, or
    // when a request overrides the STT engine to `openai`).
    OPENAI_WHISPER_BASE_URL: emptyToUndefined(z.string().optional()),
    OPENAI_WHISPER_API_KEY: emptyToUndefined(z.string().optional()),
    OPENAI_WHISPER_MODEL: emptyToUndefined(z.string().optional()),
    // Upload size limit in MB for the STT endpoint (API hard cap: 25 MB).
    // Audio above this is split into sequential MP3 chunks via FFmpeg,
    // transcribed separately, and re-stitched onto the original timeline.
    OPENAI_WHISPER_MAX_UPLOAD_MB: emptyToUndefined(z.coerce.number().positive().default(24)),

    YT_DLP_BINARY_PATH: z.string().min(1).default('yt-dlp'),
    YT_DLP_MAX_RETRIES: emptyToUndefined(z.coerce.number().int().min(0).default(3)),
    // Extra CLI args passed straight through to yt-dlp, e.g. for YouTube's
    // bot-check cookie requirement: --cookies-from-browser chrome
    YT_DLP_EXTRA_ARGS: z.string().default(''),

    FFMPEG_BINARY_PATH: z.string().min(1).default('ffmpeg'),

    OUTPUTS_DIR: z.string().min(1).default('outputs'),
    TEMPLATES_DIR: z.string().min(1).default('templates'),
    COMPOSITIONS_DIR: z.string().min(1).default('compositions'),
    COMPOSITION_STYLE: z.enum(['commentary', 'sports', 'interview']).default('commentary'),
    COMPOSITION_ENGINE: z.enum(['ffmpeg-template', 'remotion']).default('remotion'),
    /** Set to 0 to fall back to raw-cut hook previews (no Remotion styling). */
    HOOK_PREVIEW_STYLED: z
      .string()
      .optional()
      .transform((v) => v === undefined || (v !== '0' && v !== 'false')),

    CHUNK_MAX_TOKENS: emptyToUndefined(z.coerce.number().int().positive().default(1000)),
    CHUNK_OVERLAP_SECONDS: emptyToUndefined(z.coerce.number().int().min(0).default(18)),

    HIGHLIGHT_MIN_SECONDS: emptyToUndefined(z.coerce.number().positive().default(20)),
    HIGHLIGHT_MAX_SECONDS: emptyToUndefined(z.coerce.number().positive().default(60)),
    HIGHLIGHT_TOP_N: emptyToUndefined(z.coerce.number().int().positive().default(10)),

    CLIP_MIN_SECONDS: emptyToUndefined(z.coerce.number().positive().default(15)),
    CLIP_MAX_SECONDS: emptyToUndefined(z.coerce.number().positive().default(90)),
    CLIP_MAX_CONCURRENCY: emptyToUndefined(z.coerce.number().int().positive().default(2)),
    CLIP_DURATION_TOLERANCE_SECONDS: emptyToUndefined(z.coerce.number().min(0).default(2)),
    CLIP_MAX_RETRIES: emptyToUndefined(z.coerce.number().int().min(0).default(2)),

    REFINEMENT_LEAD_IN_SECONDS: emptyToUndefined(z.coerce.number().min(0).default(2.5)),
    REFINEMENT_TRAILING_SECONDS: emptyToUndefined(z.coerce.number().min(0).default(1.5)),
    REFINEMENT_MIN_SECONDS: emptyToUndefined(z.coerce.number().positive().default(20)),
    REFINEMENT_MAX_SECONDS: emptyToUndefined(z.coerce.number().positive().default(60)),

    SUBTITLE_MAX_WORDS_PER_EVENT: emptyToUndefined(z.coerce.number().int().positive().default(4)),
    SUBTITLE_PAUSE_BREAK_SECONDS: emptyToUndefined(z.coerce.number().positive().default(0.5)),

    ASS_FONT_NAME: z.string().min(1).default('Arial'),
    ASS_FONT_SIZE: emptyToUndefined(z.coerce.number().int().positive().default(90)),
    ASS_BASE_COLOR: z.string().min(1).default('#FFFFFF'),
    ASS_HIGHLIGHT_COLOR: z.string().min(1).default('#FFE135'),
    ASS_KEYWORD_COLOR: z.string().min(1).default('#FF3B30'),
    ASS_OUTLINE_COLOR: z.string().min(1).default('#000000'),
    ASS_SHADOW_COLOR: z.string().min(1).default('#000000'),
    ASS_OUTLINE_WIDTH: emptyToUndefined(z.coerce.number().min(0).default(4)),
    ASS_SHADOW_DEPTH: emptyToUndefined(z.coerce.number().min(0).default(2)),
    ASS_VERTICAL_POSITION_FRACTION: emptyToUndefined(z.coerce.number().min(0).max(1).default(0.75)),
    ASS_ANIMATION_STYLE: z.enum(['none', 'karaoke', 'pop', 'fade', 'slide']).default('karaoke'),

    THUMBNAIL_CANDIDATE_COUNT: emptyToUndefined(z.coerce.number().int().positive().default(5)),

    RENDER_OUTPUT_WIDTH: emptyToUndefined(z.coerce.number().int().positive().default(1080)),
    RENDER_OUTPUT_HEIGHT: emptyToUndefined(z.coerce.number().int().positive().default(1920)),
    RENDER_FRAME_RATE: emptyToUndefined(z.coerce.number().int().positive().default(30)),
    RENDER_PRESET: z.string().min(1).default('medium'),
    RENDER_CRF: emptyToUndefined(z.coerce.number().min(0).max(51).default(18)),
    RENDER_AUDIO_BITRATE_KBPS: emptyToUndefined(z.coerce.number().int().positive().default(192)),

    // --- Research pipeline ---
    // YouTube Data API v3 key for video search (primary). When missing, the
    // research service falls back to `yt-dlp` search (`ytsearch`).
    YOUTUBE_API_KEY: emptyToUndefined(z.string().optional()),
    // Max videos returned per topic by the YouTube search provider.
    YOUTUBE_SEARCH_MAX_RESULTS: emptyToUndefined(z.coerce.number().int().positive().default(5)),
    // Timeout per YouTube search request in milliseconds.
    YOUTUBE_SEARCH_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(15_000)),
    // Only include videos uploaded within the last N days (0 = no filter).
    YOUTUBE_SEARCH_MAX_AGE_DAYS: emptyToUndefined(z.coerce.number().int().min(0).default(30)),

    // --- Caption credit / attribution ---
    // Template for the source-credit line appended to every generated caption.
    // Supported placeholders: {channel} = source channel name, {url} = source video URL.
    // Set to an empty string to disable the credit line entirely.
    CAPTION_CREDIT_TEMPLATE: z.string().default('🎥 Credit: @{channel}'),

    // News RSS feeds (comma-separated). Each entry may include an optional
    // `[label]` prefix and a `:lang` suffix, e.g.
    // `[cnn-indonesia]https://www.cnnindonesia.com/rss:lang=id`.
    RESEARCH_RSS_FEEDS: z
      .string()
      .default(
        'https://www.cnnindonesia.com/rss,https://feeds.bbci.co.uk/news/rss.xml,https://www.kompas.com/feed,https://rss.detik.com',
      ),

    // Number of recent items to read per RSS feed.
    RESEARCH_RSS_MAX_ITEMS_PER_FEED: emptyToUndefined(z.coerce.number().int().positive().default(15)),
    // RSS fetch timeout in milliseconds.
    RESEARCH_RSS_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(10_000)),

    // Comma-separated list of subreddits to pull hot posts from (falls back to
    // the global `/r/popular` feed when empty).
    RESEARCH_REDDIT_SUBREDDITS: z.string().default('worldnews,indonesia,technology'),
    // Max posts to read per subreddit.
    RESEARCH_REDDIT_MAX_POSTS_PER_SUBREDDIT: emptyToUndefined(z.coerce.number().int().positive().default(10)),
    // Reddit fetch timeout in milliseconds.
    RESEARCH_REDDIT_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(10_000)),

    // Google News RSS (trending headlines, no API key). Topic feeds are
    // available per country, e.g. `topic/NATION` for Indonesia:
    // https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id
    RESEARCH_TRENDS_FEED_URL: emptyToUndefined(
      z
        .url()
        .default('https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id'),
    ),
    // Max headline items to collect per fetch.
    RESEARCH_TRENDS_MAX_QUERIES: emptyToUndefined(z.coerce.number().int().positive().default(20)),
    // Google News RSS fetch timeout in milliseconds.
    RESEARCH_TRENDS_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(10_000)),

    // X/Twitter: search query used with the `xurl` CLI. Empty disables the X source.
    RESEARCH_X_SEARCH_QUERY: z.string().default(''),
    // Max posts to fetch from X.
    RESEARCH_X_MAX_POSTS: emptyToUndefined(z.coerce.number().int().positive().default(10)),

    // Research pipeline controls.
    RESEARCH_MAX_TRENDS: emptyToUndefined(z.coerce.number().int().positive().default(10)),
    // Max signals sent to the LLM (keeps prompt size manageable for local models).
    RESEARCH_MAX_SIGNALS_FOR_LLM: emptyToUndefined(z.coerce.number().int().positive().default(80)),
    // Language for LLM-generated topic titles/summaries (`auto`, `en`, `id`, ...).
    RESEARCH_LANGUAGE: z.string().min(1).default('auto'),
    // Research LLM config. A dedicated OpenAI-compatible endpoint for the
    // research LLM; when BASE_URL is empty, the main AI backend (router)
    // is used instead. API key falls back to ROUTER_API_KEY.
    RESEARCH_LLM_BASE_URL: emptyToUndefined(z.string().optional()),
    RESEARCH_LLM_API_KEY: emptyToUndefined(z.string().optional()),
    // Research LLM model/temperature/timeout (used for the fallback backend too).
    RESEARCH_LLM_MODEL: z.string().min(1).default('qwen3:14b'),
    RESEARCH_LLM_TEMPERATURE: emptyToUndefined(z.coerce.number().min(0).max(2).default(0.2)),
    RESEARCH_LLM_TIMEOUT_MS: emptyToUndefined(z.coerce.number().int().positive().default(300_000)),
    RESEARCH_LLM_MAX_RETRIES: emptyToUndefined(z.coerce.number().int().min(0).default(2)),

    // --- AI Viral Content Transformer: TTS ---
    // edge-tts (default, free, local via CLI) | openai (OpenAI-compatible)
    TTS_PROVIDER: z.enum(['edge-tts', 'openai', 'fish-audio']).default('edge-tts'),
    // Voice name, e.g. "id-ID-ArdiNeural", "en-US-AndrewMultilingualNeural"
    TTS_VOICE: z.string().min(1).default('id-ID-ArdiNeural'),
    // Speaking-rate adjustment, e.g. "+10%"
    TTS_RATE: z.string().default('+0%'),
    // Optional language hint passed to the provider (e.g. "id", "en")
    TTS_LANGUAGE: emptyToUndefined(z.string().optional()),

    // OpenAI-compatible TTS endpoint (only when TTS_PROVIDER=openai)
    TTS_BASE_URL: emptyToUndefined(z.string().optional()),
    TTS_API_KEY: emptyToUndefined(z.string().optional()),
    TTS_MODEL: emptyToUndefined(z.string().optional()),
    TTS_BINARY_PATH: emptyToUndefined(z.string().optional()),

    // Fish Audio direct endpoint (only when TTS_PROVIDER=fish-audio)
    // Bypasses the 9Router gateway; talks straight to api.fish.audio with
    // full parameter support (temperature, top_p, prosody, sample_rate).
    TTS_FISH_BASE_URL: emptyToUndefined(z.string().optional()),
    TTS_FISH_API_KEY: emptyToUndefined(z.string().optional()),
    // Fish TTS model, e.g. "s2.1-pro-free" (default) or "s2.1-pro"
    TTS_FISH_MODEL: emptyToUndefined(z.string().optional()),
    // Output format: mp3 (default) | wav | opus | pcm16
    TTS_FISH_FORMAT: emptyToUndefined(z.enum(['mp3', 'wav', 'opus', 'pcm16']).optional()),
    // Expressiveness 0-1 (default 0.7)
    TTS_FISH_TEMPERATURE: emptyToUndefined(z.coerce.number().min(0).max(1).optional()),
    // Diversity 0-1 (default 0.7)
    TTS_FISH_TOP_P: emptyToUndefined(z.coerce.number().min(0).max(1).optional()),
    // Prosody speed multiplier (default 1; TTS_RATE "+10%" -> 1.1)
    TTS_FISH_SPEED: emptyToUndefined(z.coerce.number().positive().optional()),
    // Prosody volume offset (default 0)
    TTS_FISH_VOLUME: emptyToUndefined(z.coerce.number().optional()),
    // Sample rate Hz (default 44100)
    TTS_FISH_SAMPLE_RATE: emptyToUndefined(z.coerce.number().int().positive().optional()),
    // Latency/quality trade-off (default "normal")
    TTS_FISH_LATENCY: emptyToUndefined(z.enum(['normal', 'balanced', 'low']).optional()),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    PORT: emptyToUndefined(z.coerce.number().int().positive().default(3000)),
    HOST: z.string().min(1).default('0.0.0.0'),
  })
  .superRefine((data, ctx) => {
    if (!data.ROUTER_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['ROUTER_BASE_URL'],
        message: 'ROUTER_BASE_URL is required for AI router',
      });
    }
    if (!data.ROUTER_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ROUTER_API_KEY'],
        message: 'ROUTER_API_KEY is required for AI router',
      });
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
