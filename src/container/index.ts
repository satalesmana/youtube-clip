import { resolve } from 'node:path';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { OllamaProvider } from '../providers/ollama.provider.js';
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
import { parseShellArgs } from '../utils/shell-args.js';
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

const ollamaProvider = new OllamaProvider(env.OLLAMA_BASE_URL, createLogger('ollama.provider'));

const ollamaService = new OllamaService(
  ollamaProvider,
  {
    model: env.OLLAMA_MODEL,
    temperature: env.OLLAMA_TEMPERATURE,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
    maxRetries: env.OLLAMA_MAX_RETRIES,
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
    outputWidth: env.RENDER_OUTPUT_WIDTH,
    outputHeight: env.RENDER_OUTPUT_HEIGHT,
    frameRate: env.RENDER_FRAME_RATE,
    preset: env.RENDER_PRESET,
    crf: env.RENDER_CRF,
    audioBitrateKbps: env.RENDER_AUDIO_BITRATE_KBPS,
    assStyle,
  },
  clipRefinementService,
  subtitleService,
  assService,
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

/** Exposed for tests/tooling that need direct access to individual services. */
export const container = {
  paths,
  youtubeService,
  transcriptService,
  whisperService,
  ollamaProvider,
  ollamaService,
  highlightService,
  clipRefinementService,
  subtitleService,
  assService,
  faceDetectionService,
  reframeService,
  thumbnailService,
  rendererService,
  processController,
};
