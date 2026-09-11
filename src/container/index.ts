import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { RouterProvider } from '../providers/router.provider.js';
import type { IAiProvider } from '../providers/ai.provider.js';
import { YoutubeService } from '../services/youtube.service.js';
import { TranscriptService } from '../services/transcript.service.js';
import { WhisperService } from '../services/whisper.service.js';
import { HighlightAnalysisService } from '../services/highlight-analysis.service.js';
import { HighlightService } from '../services/highlight.service.js';
import { ClipRefinementService } from '../services/clip-refinement.service.js';
import { SubtitleService } from '../services/subtitle.service.js';
import { AssService } from '../services/ass.service.js';
import { NoOpFaceDetectionService } from '../services/face-detection.service.js';
import { ReframeService } from '../services/reframe.service.js';
import { ThumbnailService } from '../services/thumbnail.service.js';
import { ContentAngleService } from '../content/angle.service.js';
import { ScriptService } from '../content/script.service.js';
import { VideoPlanService } from '../content/video-plan.service.js';
import { StoryService } from '../content/story.service.js';
import { createTtsProvider } from '../providers/tts/tts.factory.js';
import { TtsService } from '../services/tts.service.js';
import { WordTimingService } from '../services/word-timing.service.js';
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
import { ContentCache } from '../services/content-cache.service.js';
import { HookGenerator } from '../hooks/hook.generator.js';
import { HookEvaluator } from '../hooks/hook.evaluator.js';
import { HookScorer } from '../hooks/hook.scorer.js';
import { HookRanker } from '../hooks/hook.ranker.js';
import { HookService } from '../hooks/hook.service.js';
import { HookController } from '../controllers/hook.controller.js';
import { PreviewRendererService } from '../services/preview-renderer.service.js';
import { StyledHookPreviewService } from '../hook-preview/styled-hook-preview.service.js';
import { ClipController } from '../controllers/clip.controller.js';
import { TranscriptController } from '../controllers/transcript.controller.js';
import type { WhisperProvider } from '../services/whisper.service.js';
import { ReelComposerService } from '../services/reel-composer.service.js';
import { createCompositionEngine } from '../composition/engine.factory.js';
import type { AssStyleConfig } from '../types/subtitle.js';
import {
  PresetWatermarkDetector,
  CustomWatermarkDetector,
  VisionWatermarkDetector,
  HybridWatermarkDetector,
} from '../services/watermark-detector.service.js';
import { WatermarkFilterService } from '../services/watermark-filter.service.js';
import { CaptionService } from '../content/caption.service.js';
import { CaptionController } from '../controllers/caption.controller.js';

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

/**
 * OpenAI-compatible STT endpoint config shared by all whisper services.
 * Falls back to the TTS endpoint config so a single gateway (e.g. 9Router)
 * that serves both `/audio/transcriptions` and `/audio/speech` works out of
 * the box; `OPENAI_WHISPER_*` takes precedence when set explicitly.
 */
const openaiWhisperConfig = {
  baseUrl: env.OPENAI_WHISPER_BASE_URL ?? env.TTS_BASE_URL ?? '',
  apiKey: env.OPENAI_WHISPER_API_KEY ?? env.TTS_API_KEY ?? '',
  model: env.OPENAI_WHISPER_MODEL,
  maxUploadMb: env.OPENAI_WHISPER_MAX_UPLOAD_MB,
  ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
};

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
    openai: openaiWhisperConfig,
  },
  createLogger('whisper.service'),
);

/**
 * Creates a WhisperService with an explicit STT provider — used when the
 * request overrides the env-configured STT engine (e.g. user picks OpenAI
 * instead of faster-whisper from the UI).
 */
export function createWhisperServiceWith(kind: WhisperProvider): WhisperService {
  return new WhisperService(
    {
      provider: kind,
      binaryPath: resolveWhisperBinary(env.WHISPER_BINARY_PATH),
      model: env.WHISPER_MODEL,
      language: env.WHISPER_LANGUAGE,
      outputDir: resolve(rootDir, 'outputs', 'temp'),
      extraArgs: env.WHISPER_EXTRA_ARGS,
      openai: openaiWhisperConfig,
    },
    createLogger(`whisper.${kind}`),
  );
}


/**
 * AI provider: OpenAI-compatible AI router (e.g. 9Router) backing highlight
 * analysis, angle generation, scripts, stories, and captions.
 */
function resolveAiProvider(): {
  provider: IAiProvider;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
} {
  return {
    provider: new RouterProvider(
      env.ROUTER_BASE_URL ?? '',
      env.ROUTER_API_KEY ?? '',
      createLogger('router.provider'),
    ),
    model: env.ROUTER_MODEL,
    temperature: env.ROUTER_TEMPERATURE,
    timeoutMs: env.ROUTER_TIMEOUT_MS,
    maxRetries: env.ROUTER_MAX_RETRIES,
  };
}

const aiProvider = resolveAiProvider();

const highlightAnalysisService = new HighlightAnalysisService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
    minClipSeconds: env.HIGHLIGHT_MIN_SECONDS,
    maxClipSeconds: env.HIGHLIGHT_MAX_SECONDS,
  },
  createLogger('highlight-analysis.service'),
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

/**
 * Watermark detection + blur services.
 *
 * `HybridWatermarkDetector` handles:
 * - `auto`   → `VisionWatermarkDetector` using the active AI provider's multimodal `chatVision`
 * - `preset` → `PresetWatermarkDetector` (calculates corner patches from resolution)
 * - `custom` → `CustomWatermarkDetector` (uses caller-specified bounding boxes)
 */
const visionWatermarkDetector = new VisionWatermarkDetector(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    tempDir: resolve(rootDir, 'outputs', 'temp'),
    visionChat: async (prompt, imagePath) => {
      if (aiProvider.provider.chatVision) {
        return aiProvider.provider.chatVision({
          model: aiProvider.model,
          prompt,
          imagePath,
          timeoutMs: aiProvider.timeoutMs,
        });
      }
      return '[]';
    },
  },
  createLogger('watermark-detector.vision'),
);

const presetWatermarkDetector = new PresetWatermarkDetector(
  { ffmpegBinaryPath: env.FFMPEG_BINARY_PATH, tempDir: resolve(rootDir, 'outputs', 'temp') },
  createLogger('watermark-detector.preset'),
);

const customWatermarkDetector = new CustomWatermarkDetector(
  { ffmpegBinaryPath: env.FFMPEG_BINARY_PATH, tempDir: resolve(rootDir, 'outputs', 'temp') },
  createLogger('watermark-detector.custom'),
);

export const watermarkDetector = new HybridWatermarkDetector(
  presetWatermarkDetector,
  customWatermarkDetector,
  visionWatermarkDetector,
);

export const watermarkFilterService = new WatermarkFilterService(
  watermarkDetector,
  createLogger('watermark-filter'),
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
registerDefaultLayers(layerRegistry, { reframeService, watermarkFilterService });

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

/** Derives source-backed story beats before script writing and rendering. */
export const storyService = new StoryService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('content.story'),
);

// --- Hook Recommendation Engine (Plan M1-M5) ---

/**
 * Hook Recommendation Engine: generates 10-15 hook candidates per video,
 * guards them against the source transcript (accuracy), scores them on a
 * 7-metric quality card, and ranks a diverse Top-5. Consumes the existing
 * angle/story outputs — the editorial pipeline above is untouched.
 */
const hookGenerator = new HookGenerator(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('hooks.generator'),
);

const hookEvaluator = new HookEvaluator(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('hooks.evaluator'),
);

const hookScorer = new HookScorer(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
  },
  createLogger('hooks.scorer'),
);

const hookRanker = new HookRanker(
  { topN: 5, diversityPenalty: 8, duplicateSimilarityThreshold: 0.6 },
  createLogger('hooks.ranker'),
);

export const hookService = new HookService(
  hookGenerator,
  hookEvaluator,
  hookScorer,
  hookRanker,
  { durationMin: 1.5, durationMax: 5, topN: 5 },
  createLogger('hooks.service'),
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

  // Recover per-word timings via Whisper when the TTS provider does not
  // expose them natively (OpenAI tts-1). Kept optional so tests and tools can
  // build TtsService without a whisper backend.
  const wordAligner = new WordTimingService(whisperService, logger.child({ component: 'word-timing' }));

  return new TtsService(
    provider,
    {
      voice: env.TTS_VOICE,
      rate: env.TTS_RATE,
      outputDir: resolve(rootDir, env.OUTPUTS_DIR),
      language: env.TTS_LANGUAGE,
      wordAligner,
    },
    logger,
  );
}

/**
 * Creates a TtsService with an explicit provider kind and voice — used when
 * the request overrides the env-configured TTS provider (e.g. user picks
 * OpenAI instead of edge-tts from the UI).
 */
export function createTtsServiceWith(kind: 'edge-tts' | 'openai', voice: string, rate?: string): TtsService {
  const logger = createLogger('tts.service');
  const effectiveRate = rate ?? env.TTS_RATE;
  const provider = createTtsProvider({
    kind,
    edge: {
      outputDir: resolve(rootDir, env.OUTPUTS_DIR),
      binaryPath: env.TTS_BINARY_PATH,
      rate: effectiveRate,
    },
    openai: {
      outputDir: resolve(rootDir, env.OUTPUTS_DIR),
      baseUrl: env.TTS_BASE_URL,
      apiKey: env.TTS_API_KEY,
      model: env.TTS_MODEL,
      rate: effectiveRate,
    },
    logger,
  });

  return new TtsService(
    provider,
    {
      voice,
      rate: effectiveRate,
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

/**
 * Disk cache for LLM pipeline stage outputs (angle/story/script), keyed by
 * content hash. Regenerating the same video returns the identical narration.
 */
export const contentCache = new ContentCache({
  dir: resolve(rootDir, 'outputs', 'transform-cache'),
});

// --- Viral clip recommendation + reel composition (flow redesign) ---

const compositionsDir = resolve(rootDir, env.COMPOSITIONS_DIR, 'studio');

/** Cuts lightweight per-clip previews shown in the UI before selection. */
export const previewRenderer = new PreviewRendererService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    previewWidth: 360,
    watermarkFilterService,
  },
  createLogger('preview-renderer'),
);

/**
 * Renders styled hook previews (HookIntroShort Remotion composition) — the
 * final clipper-style opening, reused by the reel as its intro segment.
 */
export const styledHookPreviewService = new StyledHookPreviewService({
  compositionsDir,
  ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
  logger: createLogger('styled-hook-preview'),
});

/** Entry point for `POST /api/hooks/generate` (Hook Recommendation Engine). */
export const hookController = new HookController({
  youtubeService,
  transcriptService,
  whisperService,
  contentAngleService,
  storyService,
  hookService,
  outputsDir: paths.outputs,
  logger: createLogger('hooks.controller'),
  contentCache,
  previewRenderer,
  styledPreviewRenderer: env.HOOK_PREVIEW_STYLED ? styledHookPreviewService : undefined,
});

/** Entry point for `POST /api/clips/recommend` (viral clip recommendations). */
export const clipController = new ClipController({
  youtubeService,
  transcriptService,
  whisperService,
  highlightAnalysisService,
  highlightService,
  previewRenderer,
  outputsDir: paths.outputs,
  logger: createLogger('clips.controller'),
  ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
  maxConcurrency: env.CLIP_MAX_CONCURRENCY,
});

/** Entry point for `GET /api/transcript` and `POST /api/transcript/update`. */
export const transcriptController = new TranscriptController({
  youtubeService,
  transcriptService,
  whisperService,
  outputsDir: paths.outputs,
  logger: createLogger('transcript.controller'),
  contentCache,
});

/**
 * Feedback loop for viral-clip recommendations: records which recommended
 * clips the user actually takes into a transform (see
 * ClipController.recordSelection). Exposed via the container so the transform
 * route can call it without owning the clips workspace layout.
 */
export const recordClipSelection = (
  videoId: string,
  selectedClips: Array<{ start: number; end: number; title?: string }>,
): Promise<void> => clipController.recordSelection(videoId, selectedClips);

/** Joins user-selected clip ranges into one reel (outputMode: 'reel'). */
export const reelComposer = new ReelComposerService(
  {
    ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
    canvasWidth: 1080,
    canvasHeight: 1920,
  },
  createLogger('reel-composer'),
);

// --- Composition Engine (Sprint G) ---

export const compositionEngine = createCompositionEngine({
  templateService,
  templateRendererService,
  outputsDir: paths.outputs,
  compositionsDir,
  engine: env.COMPOSITION_ENGINE ?? 'remotion',
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
    maxAgeDays: env.YOUTUBE_SEARCH_MAX_AGE_DAYS,
  },
  researchLogger.child({ component: 'youtube-search.provider' }),
);

/**
 * Research LLM: a dedicated OpenAI-compatible endpoint (`RESEARCH_LLM_*`) if
 * configured, otherwise the main AI backend (router) —
 * both expose the OpenAI-compatible `/v1/chat/completions` API.
 */
const researchLlm = new OpenAiCompatibleLlm({
  baseUrl: env.RESEARCH_LLM_BASE_URL || env.ROUTER_BASE_URL || '',
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

export const captionService = new CaptionService(
  aiProvider.provider,
  {
    model: aiProvider.model,
    temperature: aiProvider.temperature,
    timeoutMs: aiProvider.timeoutMs,
    maxRetries: aiProvider.maxRetries,
    outputsDir: paths.outputs,
    creditTemplate: env.CAPTION_CREDIT_TEMPLATE,
  },
  createLogger('caption.service'),
);

export const captionController = new CaptionController({
  captionService,
  transcriptService,
  outputsDir: paths.outputs,
  logger: createLogger('caption.controller'),
});

/** Exposed for tests/tooling that need direct access to individual services. */
export const container = {
  paths,
  youtubeService,
  transcriptService,
  whisperService,
  aiProvider: aiProvider.provider,
  highlightAnalysisService,
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
  contentAngleService,
  scriptService,
  storyService,
  hookService,
  hookController,
  clipController,
  transcriptController,
  captionService,
  captionController,
  ttsService,
  videoPlanService,
  contentCache,
  researchService,
  researchController,
  assStyle,
  compositionEngine,
  watermarkDetector,
  watermarkFilterService,
  previewRenderer,
  reelComposer,
};
