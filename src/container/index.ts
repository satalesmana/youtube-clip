import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { OllamaProvider } from '../providers/ollama.provider.js';
import { RouterProvider } from '../providers/router.provider.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import { YoutubeService } from '../services/youtube.service.js';
import { TranscriptService } from '../services/transcript.service.js';
import { WhisperService } from '../services/whisper.service.js';
import { OllamaService } from '../services/ollama.service.js';
import { HighlightService } from '../services/highlight.service.js';
import { ClipRefinementService } from '../services/clip-refinement.service.js';
import { SubtitleService } from '../services/subtitle.service.js';
import { AssService } from '../services/ass.service.js';
import { NoOpFaceDetectionService } from '../services/face-detection.service.js';
import { ReframeService } from '../services/reframe.service.js';
import { ThumbnailService } from '../services/thumbnail.service.js';
import { RendererService } from '../services/renderer.service.js';
import { ProcessController } from '../controllers/process.controller.js';
import { ContentAngleService } from '../content/angle.service.js';
import { ScriptService } from '../content/script.service.js';
import { VideoPlanService } from '../content/video-plan.service.js';
import { createTtsProvider } from '../providers/tts/tts.factory.js';
import { TtsService } from '../services/tts.service.js';
import { ResearchController } from '../controllers/research.controller.js';
import { RssProvider } from '../research/rss.provider.js';
import { RedditProvider } from '../research/reddit.provider.js';
import { TrendsProvider } from '../research/trends.provider.js';
import { XProvider } from '../research/x.provider.js';
import { YouTubeSearchProvider } from '../research/youtube-search.provider.js';
import { OpenAiCompatibleLlm } from '../research/llm.provider.js';
import { ResearchService } from '../research/research.service.js';
import { parseShellArgs } from '../utils/shell-args.js';
import { ManifestService } from '../template/manifest.service.js';
import { TemplateLoaderService } from '../template/template-loader.service.js';
import { ValidationService } from '../template/validation.service.js';
import { BindingService } from '../template/binding.service.js';
import { LayoutService } from '../template/layout.service.js';
import { LayerRegistry } from '../template/layer-registry.js';
import { registerDefaultLayers } from '../template/register-default-layers.js';
import { TemplateAssService } from '../template/ass.service.js';
import { FiltergraphService } from '../template/filtergraph.service.js';
import { TemplateService } from '../template/template.service.js';
import { TemplateRendererService } from '../template/renderer.service.js';
import { RightsService } from '../rights/rights.service.js';
import { QualityCheckService } from '../rights/quality.service.js';
import { createCompositionEngine } from '../composition/engine.factory.js';
import type { AssStyleConfig } from '../types/subtitle.js';

/**
 * Composition root: this is the only module that knows about concrete
 * implementations. Everything downstream (controllers, services) depends
 * only on the interfaces exported alongside each implementation.
 */

const rootDir = process.cwd();

/**
 * Resolves the whisper binary path: when the configured path is a bare name
 * (e.g. "whisperx"), checks the project's `.venv/bin/` first — where
 * `uv`/`pip` venvs place console-scripts — before falling back to PATH.
 */
function resolveWhisperBinary(configuredPath: string): string {
  if (configuredPath.includes('/') || configuredPath.includes('\\')) {
    return configuredPath; // already absolute / relative with separators
  }
  const venvBin = resolve(rootDir, '.venv', 'bin', configuredPath);
  try {
    if (statSync(venvBin).isFile()) return venvBin;
  } catch {
    // .venv/bin/<binary> doesn't exist — fall through to PATH
  }
  return configuredPath;
}

const paths = {
  outputs: resolve(rootDir, env.OUTPUTS_DIR),
  clips: resolve(rootDir, env.OUTPUTS_DIR, 'clips'),
  subtitles: resolve(rootDir, env.OUTPUTS_DIR, 'subtitles'),
  thumbnails: resolve(rootDir, env.OUTPUTS_DIR, 'thumbnails'),
  clipMetadata: resolve(rootDir, env.OUTPUTS_DIR, 'metadata'),
  templates: resolve(rootDir, env.TEMPLATES_DIR),
};

const youtubeService = new YoutubeService(
  {
    binaryPath: env.YT_DLP_BINARY_PATH,
    downloadsDir: resolve(rootDir, 'outputs', 'downloads'),
    maxRetries: env.YT_DLP_MAX_RETRIES,
    extraArgs: parseShellArgs(env.YT_DLP_EXTRA_ARGS),
  },
  createLogger('youtube.service'),
);

const transcriptService = new TranscriptService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    tempDir: resolve(rootDir, 'outputs', 'temp'),
    transcriptsDir: resolve(rootDir, 'outputs', 'transcripts'),
    chunkMaxTokens: env.CHUNK_MAX_TOKENS,
    chunkOverlapSeconds: env.CHUNK_OVERLAP_SECONDS,
  },
  createLogger('transcript.service'),
);

const whisperService = new WhisperService(
  {
    provider: env.WHISPER_PROVIDER,
    binaryPath: resolveWhisperBinary(env.WHISPER_BINARY_PATH),
    model: env.WHISPER_MODEL,
    language: env.WHISPER_LANGUAGE,
    outputDir: resolve(rootDir, 'outputs', 'temp'),
    extraArgs: env.WHISPER_EXTRA_ARGS,
  },
  createLogger('whisper.service'),
);

/**
 * `AI_PROVIDER` selects which AI agent backs highlight analysis: the local
 * Ollama server, or an OpenAI-compatible AI router (e.g. 9Router).
 */
function resolveAiProvider(): {
  provider: IOllamaProvider;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
} {
  if (env.AI_PROVIDER === 'router') {
    return {
      provider: new RouterProvider(
        env.ROUTER_BASE_URL!,
        env.ROUTER_API_KEY!,
        createLogger('router.provider'),
      ),
      model: env.ROUTER_MODEL,
      temperature: env.ROUTER_TEMPERATURE,
      timeoutMs: env.ROUTER_TIMEOUT_MS,
      maxRetries: env.ROUTER_MAX_RETRIES,
    };
  }

  return {
    provider: new OllamaProvider(env.OLLAMA_BASE_URL, createLogger('ollama.provider')),
    model: env.OLLAMA_MODEL,
    temperature: env.OLLAMA_TEMPERATURE,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
    maxRetries: env.OLLAMA_MAX_RETRIES,
  };
}

const aiProvider = resolveAiProvider();

const ollamaService = new OllamaService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('ollama.service'),
);

const highlightService = new HighlightService(
  {
    minClipSeconds: env.HIGHLIGHT_MIN_SECONDS,
    maxClipSeconds: env.HIGHLIGHT_MAX_SECONDS,
    topN: env.HIGHLIGHT_TOP_N,
  },
  createLogger('highlight.service'),
);

const clipRefinementService = new ClipRefinementService({
  leadInSeconds: env.REFINEMENT_LEAD_IN_SECONDS,
  trailingSeconds: env.REFINEMENT_TRAILING_SECONDS,
  minDurationSeconds: env.REFINEMENT_MIN_SECONDS,
  maxDurationSeconds: env.REFINEMENT_MAX_SECONDS,
});

const subtitleService = new SubtitleService({
  maxWordsPerEvent: env.SUBTITLE_MAX_WORDS_PER_EVENT,
  pauseBreakThresholdSeconds: env.SUBTITLE_PAUSE_BREAK_SECONDS,
});

const assService = new AssService({
  playResX: env.RENDER_OUTPUT_WIDTH,
  playResY: env.RENDER_OUTPUT_HEIGHT,
});

const faceDetectionService = new NoOpFaceDetectionService();

const reframeService = new ReframeService(
  { ffmpegBinaryPath: env.FFMPEG_BINARY_PATH, tempDir: resolve(rootDir, 'outputs', 'temp') },
  faceDetectionService,
);

const thumbnailService = new ThumbnailService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    tempDir: resolve(rootDir, 'outputs', 'temp'),
    candidateCount: env.THUMBNAIL_CANDIDATE_COUNT,
  },
  faceDetectionService,
);

const assStyle: AssStyleConfig = {
  fontName: env.ASS_FONT_NAME,
  fontSize: env.ASS_FONT_SIZE,
  baseColorHex: env.ASS_BASE_COLOR,
  highlightColorHex: env.ASS_HIGHLIGHT_COLOR,
  keywordColorHex: env.ASS_KEYWORD_COLOR,
  outlineColorHex: env.ASS_OUTLINE_COLOR,
  shadowColorHex: env.ASS_SHADOW_COLOR,
  outlineWidth: env.ASS_OUTLINE_WIDTH,
  shadowDepth: env.ASS_SHADOW_DEPTH,
  verticalPositionFraction: env.ASS_VERTICAL_POSITION_FRACTION,
  animationStyle: env.ASS_ANIMATION_STYLE,
};

/**
 * Template engine: discovers/loads/validates `templates/*`, resolves
 * bindings, computes layout, and builds the FFmpeg filter graph. Renderer
 * services above never know which template they're composing.
 */
const manifestService = new ManifestService({ templatesDir: paths.templates });
export { manifestService };
const templateLoaderService = new TemplateLoaderService(manifestService);
const bindingService = new BindingService();
const layoutService = new LayoutService();

const layerRegistry = new LayerRegistry();
registerDefaultLayers(layerRegistry, { reframeService });

const validationService = new ValidationService(layerRegistry);
const templateAssService = new TemplateAssService(assService, { fallbackStyle: assStyle });
const filtergraphService = new FiltergraphService(layerRegistry, {
  frameRate: env.RENDER_FRAME_RATE,
});

const templateService = new TemplateService(
  templateLoaderService,
  validationService,
  bindingService,
);

const templateRendererService = new TemplateRendererService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    preset: env.RENDER_PRESET,
    crf: env.RENDER_CRF,
    audioBitrateKbps: env.RENDER_AUDIO_BITRATE_KBPS,
    maxRetries: env.CLIP_MAX_RETRIES,
  },
  layoutService,
  templateAssService,
  filtergraphService,
);

const rendererService = new RendererService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    clipsDir: paths.clips,
    subtitlesDir: paths.subtitles,
    thumbnailsDir: paths.thumbnails,
    metadataDir: paths.clipMetadata,
    tempDir: resolve(rootDir, 'outputs', 'temp'),
    minDurationSeconds: env.CLIP_MIN_SECONDS,
    maxDurationSeconds: env.CLIP_MAX_SECONDS,
    maxConcurrency: env.CLIP_MAX_CONCURRENCY,
    maxRetries: env.CLIP_MAX_RETRIES,
  },
  clipRefinementService,
  subtitleService,
  templateService,
  templateRendererService,
  reframeService,
  thumbnailService,
  createLogger('renderer.service'),
);

export const processController = new ProcessController({
  youtubeService,
  transcriptService,
  whisperService,
  ollamaService,
  highlightService,
  rendererService,
  outputsDir: paths.outputs,
  logger: createLogger('process.controller'),
});

// --- AI Viral Content Transformer: content pipeline (Sprint A) ---

/**
 * Content angle generator: proposes 3-5 editorial angles per viral moment
 * using the same AI backend as highlight analysis. New module — the existing
 * process pipeline above is untouched.
 */
export const contentAngleService = new ContentAngleService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('content.angle'),
);

/**
 * Script engine (Sprint B): turns a chosen content angle into an original
 * short-form narration script. New module — the existing pipelines are
 * untouched.
 */
export const scriptService = new ScriptService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('content.script'),
);

// --- TTS (Sprint C) ---

/**
 * TTS provider selection: `edge-tts` (free local CLI) by default, or an
 * OpenAI-compatible endpoint. Constructed lazily inside a function so tests
 * and tools can override the provider without touching the container.
 */
export function createTtsService(overrides?: { provider?: ReturnType<typeof createTtsProvider> }): TtsService {
  const logger = createLogger('tts.service');
  const provider =
    overrides?.provider ??
    createTtsProvider({
      kind: env.TTS_PROVIDER,
      edge: {
        outputDir: resolve(rootDir, env.OUTPUTS_DIR),
        binaryPath: env.TTS_BINARY_PATH,
        rate: env.TTS_RATE,
      },
      openai: {
        outputDir: resolve(rootDir, env.OUTPUTS_DIR),
        baseUrl: env.TTS_BASE_URL,
        apiKey: env.TTS_API_KEY,
        model: env.TTS_MODEL,
        rate: env.TTS_RATE,
      },
      logger,
    });

  return new TtsService(
    provider,
    {
      voice: env.TTS_VOICE,
      rate: env.TTS_RATE,
      outputDir: resolve(rootDir, env.OUTPUTS_DIR),
      language: env.TTS_LANGUAGE,
    },
    logger,
  );
}

export const ttsService = createTtsService();

// --- Video planner (Sprint D) ---

/** Builds a scene plan (timeline) from a script + candidate timing. */
export const videoPlanService = new VideoPlanService(
  { targetDuration: 60, wordsPerMinute: 150 },
  createLogger('content.video-plan'),
);

// --- Rights gate + Quality check (Sprint F) ---

/** Filesystem-backed rights gate — stores per-video rights metadata. */
export const rightsService = new RightsService(
  paths.outputs,
  createLogger('rights'),
);

/** Quality check service — validates output videos meet standards. */
export const qualityCheckService = new QualityCheckService(
  createLogger('quality'),
);

// --- Composition Engine (Sprint G) ---

const compositionsDir = resolve(rootDir, env.COMPOSITIONS_DIR, 'studio');
export const compositionEngine = createCompositionEngine({
  templateService,
  templateRendererService,
  outputsDir: paths.outputs,
  compositionsDir,
  engine: env.COMPOSITION_ENGINE ?? 'ffmpeg-template',
  logger: createLogger('composition'),
});

// --- Research pipeline ---

const researchLogger = createLogger('research');

/** Parses `RESEARCH_RSS_FEEDS` entries like `[label]url:lang=id` into feed configs. */
function parseRssFeeds(raw: string): { url: string; label?: string; language?: string }[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let label: string | undefined;
      let language: string | undefined;

      const langMatch = /:lang=([a-zA-Z-]+)\s*$/.exec(entry);
      if (langMatch) {
        language = langMatch[1];
        entry = entry.slice(0, langMatch.index);
      }

      const labelMatch = /^\[([^\]]+)\]\s*(.*)$/.exec(entry);
      if (labelMatch) {
        label = labelMatch[1];
        entry = labelMatch[2] ?? '';
      }

      return { url: entry.trim(), label, language };
    })
    .filter((feed) => feed.url.length > 0);
}

const rssProvider = new RssProvider(
  {
    feeds: parseRssFeeds(env.RESEARCH_RSS_FEEDS),
    maxItemsPerFeed: env.RESEARCH_RSS_MAX_ITEMS_PER_FEED,
    timeoutMs: env.RESEARCH_RSS_TIMEOUT_MS,
  },
  researchLogger.child({ component: 'rss.provider' }),
);

const redditProvider = new RedditProvider(
  {
    subreddits: env.RESEARCH_REDDIT_SUBREDDITS.split(',')
      .map((sub) => sub.trim())
      .filter(Boolean),
    maxPostsPerSubreddit: env.RESEARCH_REDDIT_MAX_POSTS_PER_SUBREDDIT,
    timeoutMs: env.RESEARCH_REDDIT_TIMEOUT_MS,
  },
  researchLogger.child({ component: 'reddit.provider' }),
);

const trendsProvider = new TrendsProvider(
  {
    feedUrl: env.RESEARCH_TRENDS_FEED_URL,
    maxQueries: env.RESEARCH_TRENDS_MAX_QUERIES,
    timeoutMs: env.RESEARCH_TRENDS_TIMEOUT_MS,
  },
  researchLogger.child({ component: 'trends.provider' }),
);

const xProvider = new XProvider(
  {
    searchQuery: env.RESEARCH_X_SEARCH_QUERY,
    maxPosts: env.RESEARCH_X_MAX_POSTS,
  },
  researchLogger.child({ component: 'x.provider' }),
);

const youtubeSearchProvider = new YouTubeSearchProvider(
  {
    apiKey: env.YOUTUBE_API_KEY,
    maxResults: env.YOUTUBE_SEARCH_MAX_RESULTS,
    timeoutMs: env.YOUTUBE_SEARCH_TIMEOUT_MS,
    ytDlpBinaryPath: env.YT_DLP_BINARY_PATH,
  },
  researchLogger.child({ component: 'youtube-search.provider' }),
);

/**
 * Research LLM: a dedicated OpenAI-compatible endpoint (`RESEARCH_LLM_*`) if
 * configured, otherwise the main AI backend (router, then local Ollama) —
 * both expose the OpenAI-compatible `/v1/chat/completions` API.
 */
const researchLlm = new OpenAiCompatibleLlm({
  baseUrl: env.RESEARCH_LLM_BASE_URL || env.ROUTER_BASE_URL || env.OLLAMA_BASE_URL,
  apiKey: env.RESEARCH_LLM_API_KEY ?? env.ROUTER_API_KEY,
  model: env.RESEARCH_LLM_MODEL,
  temperature: env.RESEARCH_LLM_TEMPERATURE,
  timeoutMs: env.RESEARCH_LLM_TIMEOUT_MS,
  maxRetries: env.RESEARCH_LLM_MAX_RETRIES ?? 2,
  logger: researchLogger.child({ component: 'research.llm' }),
});

const researchService = new ResearchService(
  {
    maxTrends: env.RESEARCH_MAX_TRENDS,
    maxSignalsForLlm: env.RESEARCH_MAX_SIGNALS_FOR_LLM,
    language: env.RESEARCH_LANGUAGE,
  },
  rssProvider,
  redditProvider,
  trendsProvider,
  xProvider,
  youtubeSearchProvider,
  researchLlm,
  researchLogger,
);

export const researchController = new ResearchController({
  researchService,
  logger: createLogger('research.controller'),
});

/** Exposed for tests/tooling that need direct access to individual services. */
export const container = {
  paths,
  youtubeService,
  transcriptService,
  whisperService,
  aiProvider: aiProvider.provider,
  ollamaService,
  highlightService,
  clipRefinementService,
  subtitleService,
  assService,
  faceDetectionService,
  reframeService,
  thumbnailService,
  manifestService,
  templateLoaderService,
  validationService,
  bindingService,
  layoutService,
  layerRegistry,
  templateAssService,
  filtergraphService,
  templateService,
  templateRendererService,
  rendererService,
  processController,
  contentAngleService,
  scriptService,
  ttsService,
  videoPlanService,
  rightsService,
  qualityCheckService,
  researchService,
  researchController,
  assStyle,
  compositionEngine,
};
