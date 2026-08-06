import { resolve } from 'node:path';
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
import { ResearchController } from '../controllers/research.controller.js';
import { RssProvider } from '../research/rss.provider.js';
import { RedditProvider } from '../research/reddit.provider.js';
import { TrendsProvider } from '../research/trends.provider.js';
import { XProvider } from '../research/x.provider.js';
import { YouTubeSearchProvider } from '../research/youtube-search.provider.js';
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
import type { AssStyleConfig } from '../types/subtitle.js';

/**
 * Composition root: this is the only module that knows about concrete
 * implementations. Everything downstream (controllers, services) depends
 * only on the interfaces exported alongside each implementation.
 */

const rootDir = process.cwd();

const paths = {
  downloads: resolve(rootDir, env.DOWNLOADS_DIR),
  transcripts: resolve(rootDir, env.TRANSCRIPTS_DIR),
  outputs: resolve(rootDir, env.OUTPUTS_DIR),
  temp: resolve(rootDir, env.TEMP_DIR),
  clips: resolve(rootDir, env.OUTPUTS_DIR, 'clips'),
  subtitles: resolve(rootDir, env.OUTPUTS_DIR, 'subtitles'),
  thumbnails: resolve(rootDir, env.OUTPUTS_DIR, 'thumbnails'),
  clipMetadata: resolve(rootDir, env.OUTPUTS_DIR, 'metadata'),
  templates: resolve(rootDir, env.TEMPLATES_DIR),
};

const youtubeService = new YoutubeService(
  {
    binaryPath: env.YT_DLP_BINARY_PATH,
    downloadsDir: paths.downloads,
    maxRetries: env.YT_DLP_MAX_RETRIES,
    extraArgs: parseShellArgs(env.YT_DLP_EXTRA_ARGS),
  },
  createLogger('youtube.service'),
);

const transcriptService = new TranscriptService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    tempDir: paths.temp,
    transcriptsDir: paths.transcripts,
    chunkMaxTokens: env.CHUNK_MAX_TOKENS,
    chunkOverlapSeconds: env.CHUNK_OVERLAP_SECONDS,
  },
  createLogger('transcript.service'),
);

const whisperService = new WhisperService(
  {
    provider: env.WHISPER_PROVIDER,
    binaryPath: env.WHISPER_BINARY_PATH,
    model: env.WHISPER_MODEL,
    language: env.WHISPER_LANGUAGE,
    // Whisper's own CLI output is an intermediate artifact, kept separate
    // from our own normalized transcript JSON written under `transcripts/`.
    outputDir: paths.temp,
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
  { ffmpegBinaryPath: env.FFMPEG_BINARY_PATH, tempDir: paths.temp },
  faceDetectionService,
);

const thumbnailService = new ThumbnailService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    tempDir: paths.temp,
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
const templateLoaderService = new TemplateLoaderService(manifestService);
const bindingService = new BindingService();
const layoutService = new LayoutService();

const layerRegistry = new LayerRegistry();
registerDefaultLayers(layerRegistry, { reframeService });

const validationService = new ValidationService(layerRegistry);
const templateAssService = new TemplateAssService(assService, { fallbackStyle: assStyle });
const filtergraphService = new FiltergraphService(layerRegistry, { frameRate: env.RENDER_FRAME_RATE });

const templateService = new TemplateService(templateLoaderService, validationService, bindingService);

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
  logger: createLogger('process.controller'),
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
    maxQueries: env.RESEARCH_TRENDS_MAX_QUERIES,
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
    ytDlpBinaryPath: env.YT_DLP_BINARY_PATH,
  },
  researchLogger.child({ component: 'youtube-search.provider' }),
);

const researchService = new ResearchService(
  {
    maxTrends: env.RESEARCH_MAX_TRENDS,
    language: env.RESEARCH_LANGUAGE,
    llm: env.RESEARCH_LLM_BASE_URL
      ? {
          baseUrl: env.RESEARCH_LLM_BASE_URL,
          apiKey: env.RESEARCH_LLM_API_KEY,
          model: env.RESEARCH_LLM_MODEL,
          temperature: env.RESEARCH_LLM_TEMPERATURE,
          timeoutMs: env.RESEARCH_LLM_TIMEOUT_MS,
          maxRetries: env.RESEARCH_LLM_MAX_RETRIES,
        }
      : undefined,
  },
  rssProvider,
  redditProvider,
  trendsProvider,
  xProvider,
  youtubeSearchProvider,
  aiProvider.provider,
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
  researchService,
  researchController,
};
