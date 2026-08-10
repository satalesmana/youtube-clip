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
  ROUTER_MODEL: z.string().min(1).default('auto'),
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

  // --- Research pipeline ---
  // YouTube Data API v3 key for video search (primary). When missing, the
  // research service falls back to `yt-dlp` search (`ytsearch`).
  YOUTUBE_API_KEY: z.string().optional(),
  // Max videos returned per topic by the YouTube search provider.
  YOUTUBE_SEARCH_MAX_RESULTS: z.coerce.number().int().positive().default(5),
  // Timeout per YouTube search request in milliseconds.
  YOUTUBE_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // News RSS feeds (comma-separated). Each entry may include an optional
  // `[label]` prefix and a `:lang` suffix, e.g.
  // `[cnn-indonesia]https://www.cnnindonesia.com/rss:lang=id`.
  RESEARCH_RSS_FEEDS: z.string().default(
    'https://www.cnnindonesia.com/rss,https://feeds.bbci.co.uk/news/rss.xml,https://www.kompas.com/feed,https://rss.detik.com',
  ),

  // Number of recent items to read per RSS feed.
  RESEARCH_RSS_MAX_ITEMS_PER_FEED: z.coerce.number().int().positive().default(15),
  // RSS fetch timeout in milliseconds.
  RESEARCH_RSS_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Comma-separated list of subreddits to pull hot posts from (falls back to
  // the global `/r/popular` feed when empty).
  RESEARCH_REDDIT_SUBREDDITS: z.string().default('worldnews,indonesia,technology'),
  // Max posts to read per subreddit.
  RESEARCH_REDDIT_MAX_POSTS_PER_SUBREDDIT: z.coerce.number().int().positive().default(10),
  // Reddit fetch timeout in milliseconds.
  RESEARCH_REDDIT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Google News RSS (trending headlines, no API key). Topic feeds are
  // available per country, e.g. `topic/NATION` for Indonesia:
  // https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id
  RESEARCH_TRENDS_FEED_URL: z
    .url()
    .default('https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id'),
  // Max headline items to collect per fetch.
  RESEARCH_TRENDS_MAX_QUERIES: z.coerce.number().int().positive().default(20),
  // Google News RSS fetch timeout in milliseconds.
  RESEARCH_TRENDS_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // X/Twitter: search query used with the `xurl` CLI. Empty disables the X source.
  RESEARCH_X_SEARCH_QUERY: z.string().default(''),
  // Max posts to fetch from X.
  RESEARCH_X_MAX_POSTS: z.coerce.number().int().positive().default(10),

  // Research pipeline controls.
  RESEARCH_MAX_TRENDS: z.coerce.number().int().positive().default(10),
  // Max signals sent to the LLM (keeps prompt size manageable for local models).
  RESEARCH_MAX_SIGNALS_FOR_LLM: z.coerce.number().int().positive().default(80),
  // Language for LLM-generated topic titles/summaries (`auto`, `en`, `id`, ...).
  RESEARCH_LANGUAGE: z.string().min(1).default('auto'),
  // Research LLM config. A dedicated OpenAI-compatible endpoint for the
  // research LLM; when BASE_URL is empty, the main AI backend (router, then
  // local Ollama) is used instead. API key falls back to ROUTER_API_KEY.
  RESEARCH_LLM_BASE_URL: z.string().optional(),
  RESEARCH_LLM_API_KEY: z.string().optional(),
  // Research LLM model/temperature/timeout (used for the fallback backend too).
  RESEARCH_LLM_MODEL: z.string().min(1).default('qwen3:14b'),
  RESEARCH_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  RESEARCH_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  RESEARCH_LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),

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
