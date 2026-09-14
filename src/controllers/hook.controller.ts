import { dirname, join } from 'node:path';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import type { Logger } from '../utils/logger.js';
import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { IWhisperService } from '../services/whisper.service.js';
import type { IContentAngleService, ContentAngleContext } from '../content/angle.service.js';
import type { IStoryService } from '../content/story.service.js';
import type { IHookService } from '../hooks/hook.service.js';
import type { ContentCache } from '../services/content-cache.service.js';
import type { IPreviewRenderer } from '../services/preview-renderer.service.js';
import type { TranscriptDocument } from '../types/transcript.js';
import type { JobWorkspace } from '../types/job.js';
import type { AngleGenerationResult } from '../types/angle.js';
import type { SourceStory } from '../types/story.js';
import type { HookRecommendationResult, HookStyle } from '../hooks/hook.types.js';
import type { ContentGenre } from '../types/genre.js';
import { hashSeed } from '../utils/seed.js';

export interface HookControllerDeps {
  youtubeService: IYoutubeService;
  transcriptService: ITranscriptService;
  whisperService: IWhisperService;
  contentAngleService: IContentAngleService;
  storyService: IStoryService;
  hookService: IHookService;
  outputsDir: string;
  logger: Logger;
  /** Optional disk cache — same video + options returns cached stage outputs. */
  contentCache?: ContentCache;
  /** Optional preview renderer — attaches a thumbnail image and lightweight MP4 to each ranked hook. */
  previewRenderer?: IPreviewRenderer;
}

/** Request for `POST /api/hooks/generate` (Plan §7). */
export interface HookGenerateRequest {
  /** YouTube URL to process. Mutually exclusive with videoId. */
  youtubeUrl?: string;
  /** Existing processed video id (outputs/{videoId}/). Mutually exclusive with youtubeUrl. */
  videoId?: string;
  /** Candidate moment index within the video (0-based, default 0). */
  candidateId?: number;
  /** Optional explicit start time in seconds to center the hook around. */
  startTime?: number;
  /** Target language for the hooks ("auto" follows the transcript). */
  language?: 'auto' | 'id' | 'en';
  /** Preferred source-clip duration window in seconds. */
  duration?: { min?: number; max?: number };
  /** Requested hook styles (defaults to the MVP four). */
  styles?: HookStyle[];
  /** STT engine selection. Falls back to env default. */
  sttProvider?: 'faster-whisper' | 'whisper-cpp' | 'whisperx' | 'openai';
  /** Target platform (metadata only for now). */
  platform?: string;
  /** Force regeneration even when a saved hook result exists on disk. */
  refresh?: boolean;
  /**
  /**
   * Optional content genre — when supplied, biases angle types, story concept
   * detection, and hook style prioritisation for this genre.
   */
  genre?: 'podcast' | 'sports' | 'gaming' | 'tutorial' | 'commentary' | 'entertainment';
  /**
   * Optional custom instruction / tone direction for LLM stages
   * (e.g. "fokus ke momen lucu", "gaya sarkas", "jelaskan secara sederhana").
   */
  customPrompt?: string;
}

/** Response shape for `POST /api/hooks/generate` (Plan §7). */
export interface HookGenerateResponse extends HookRecommendationResult {
  success: true;
  candidateId: number;
  platform?: string;
  /** True when the result came from the on-disk cache instead of a fresh run. */
  cached?: boolean;
}

/**
 * Orchestrates the hook recommendation pipeline for `POST /api/hooks/generate`.
 * Reuses the existing editorial stages (download/transcribe, angle generation,
 * story beats) and feeds their outputs into the Hook Recommendation Engine.
 * Contains no HTTP-specific logic so it can be reused by future entry points.
 */
export class HookController {
  constructor(private readonly deps: HookControllerDeps) {}

  async generate(request: HookGenerateRequest): Promise<HookGenerateResponse> {
    const { logger } = this.deps;
    const candidateId = request.candidateId ?? 0;

    // Fast path: return the previously saved result without re-running the
    // pipeline (download/transcribe/LLM). `refresh: true` bypasses this.
    if (!request.refresh) {
      const videoId = this.resolveVideoId(request);
      if (videoId) {
        const saved = await this.loadSaved(videoId, candidateId);
        if (saved && Array.isArray(saved.hooks) && saved.hooks.length > 0) {
          logger.info({ videoId, candidateId, hookCount: saved.hooks.length }, 'Returning saved hook result (no regeneration)');
          return { ...saved, cached: true, platform: request.platform ?? saved.platform };
        }
      }
    }

    // Resolve the video + transcript (same resolution path as transform).
    const { videoId, transcript, job } = await this.resolveTranscript(request);
    logger.info({ videoId, candidateId }, 'Hook generation started');

    // Select the moment + context segments around the candidate index.
    const selection = this.selectMoment(transcript, candidateId, request.startTime);
    if (selection.momentSegments.length === 0) {
      throw AppError.validation(`Candidate index ${candidateId} is out of range for this transcript.`);
    }
    const clipStart = selection.momentSegments[0]?.start ?? 0;
    const clipEnd = selection.momentSegments.at(-1)?.end ?? 30;

    // Target output language for hooks and angles
    const language = request.language === 'auto' || !request.language
      ? transcript.language
      : request.language;

    // Stage: angles (existing ContentAngleService, cached).
    const angleContext: ContentAngleContext = {
      candidateId: `candidate_${candidateId}`,
      momentSegments: selection.momentSegments,
      contextSegments: selection.contextSegments,
      candidateTitle: 'Viral Moment',
      candidateHook: '',
      candidateReason: '',
      clipStart,
      clipEnd,
      sourceTitle: videoId,
      sourceChannel: '',
      sourceLanguage: language,
      genre: request.genre as ContentGenre | undefined,
      customPrompt: request.customPrompt,
    };
    const angleResult = await this.getAngles(
      angleContext,
      videoId,
      candidateId,
      request.genre as ContentGenre | undefined,
      language,
      request.customPrompt,
    );

    // Stage: story beats (existing StoryService, cached, optional).
    const story = await this.getStory(
      [...selection.contextSegments, ...selection.momentSegments],
      videoId,
      candidateId,
      request.genre as ContentGenre | undefined,
      request.customPrompt,
    );

    // Stage: hook recommendation engine.
    const result = await this.deps.hookService.recommend({
      videoId,
      sourceTitle: videoId,
      angles: angleResult.angles,
      story,
      segments: transcript.segments,
      styles: request.styles,
      language,
      duration: request.duration,
      genre: request.genre as ContentGenre | undefined,
      customPrompt: request.customPrompt,
    });

    const response: HookGenerateResponse = {
      success: true,
      ...result,
      candidateId,
      platform: request.platform,
    };

    // Render a lightweight preview and thumbnail per hook using previewRenderer
    // (fast FFmpeg extraction without burning hook text or running Remotion).
    if (this.deps.previewRenderer) {
      try {
        const previewsDir = join(job.root, 'hook-previews');
        const videoPath = join(job.root, 'downloads', `${videoId}.mp4`);
        const settled = await Promise.allSettled(
          response.hooks.map((hook, index) => {
            const fileName = `hook-${String(index + 1).padStart(2, '0')}`;
            return this.deps.previewRenderer!.renderPreview({
              videoPath,
              start: hook.source.start,
              end: hook.source.end,
              outputDir: previewsDir,
              fileName,
              overwrite: Boolean(request.refresh),
            });
          }),
        );
        const cacheBust = `?t=${Date.now()}`;
        response.hooks.forEach((hook, index) => {
          const outcome = settled[index];
          if (outcome?.status === 'fulfilled' && outcome.value) {
            const { path, thumbnailPath, durationSeconds } = outcome.value;
            const mediaPreviewUrl = path ? `${toMediaUrl(this.deps.outputsDir, path)}${cacheBust}` : undefined;
            const mediaThumbnailUrl = thumbnailPath
              ? `${toMediaUrl(this.deps.outputsDir, thumbnailPath)}${cacheBust}`
              : mediaPreviewUrl
              ? mediaPreviewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1')
              : undefined;

            hook.previewUrl = mediaPreviewUrl;
            hook.thumbnailUrl = mediaThumbnailUrl;
            hook.finalDurationSeconds = durationSeconds;
          }
        });
      } catch (err) {
        this.deps.logger.warn({ err }, 'Hook preview rendering failed — continuing without previews');
      }
    }

    // Persist so subsequent requests (page reloads, re-clicks) return the
    // saved result instead of re-running the pipeline.
    await this.saveResult(videoId, candidateId, response);

    return response;
  }

  /**
   * Resolves the videoId from the request WITHOUT downloading anything:
   * either the explicit `videoId` field or the id embedded in `youtubeUrl`.
   * Returns `null` when neither yields an id (fresh pipeline will handle it).
   */
  private resolveVideoId(request: HookGenerateRequest): string | null {
    if (request.videoId) return request.videoId;
    if (request.youtubeUrl) return extractVideoIdFromUrl(request.youtubeUrl);
    return null;
  }

  /** Path of the saved hook result for a video + candidate. */
  private savedPath(videoId: string, candidateId: number): string {
    return join(hookOutputDir(this.deps.outputsDir, videoId), `candidate-${candidateId}.json`);
  }

  /** Loads a previously saved hook result, or `null` when absent/corrupt. */
  private async loadSaved(videoId: string, candidateId: number): Promise<HookGenerateResponse | null> {
    try {
      const raw = await readFile(this.savedPath(videoId, candidateId), 'utf-8');
      const parsed = JSON.parse(raw) as HookGenerateResponse;
      if (!Array.isArray(parsed.hooks)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Persists the hook result to `outputs/{videoId}/hooks/`. */
  private async saveResult(videoId: string, candidateId: number, result: HookGenerateResponse): Promise<void> {
    try {
      const file = this.savedPath(videoId, candidateId);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(result, null, 2), 'utf-8');
    } catch (err) {
      this.deps.logger.warn({ err, videoId }, 'Failed to persist hook result');
    }
  }

  /**
   * Returns a previously saved hook result for `GET /api/hooks` without
   * running any pipeline stage. Throws 404 when nothing is saved yet.
   */
  async getSaved(videoId: string, candidateId = 0): Promise<HookGenerateResponse> {
    const saved = await this.loadSaved(videoId, candidateId);
    if (!saved) {
      throw AppError.validation(`No saved hooks for video "${videoId}". Run POST /api/hooks/generate first.`);
    }
    return saved;
  }

  /**
   * Fast design testing: re-renders styled preview MP4s for all saved hooks of
   * a video using the current Remotion composition layout without calling the
   * LLM or re-running candidate generation/scoring.
   */
  async rerenderPreviews(request: { youtubeUrl?: string; videoId?: string; candidateId?: number }): Promise<HookGenerateResponse> {
    const videoId = this.resolveVideoId(request);
    if (!videoId) throw AppError.validation('Provide youtubeUrl or videoId.');
    const candidateId = request.candidateId ?? 0;

    const saved = await this.loadSaved(videoId, candidateId);
    if (!saved || !saved.hooks?.length) {
      throw AppError.validation(`No saved hooks found for "${videoId}". Generate hooks first.`);
    }

    const job = await this.workspaceFor(videoId);
    const previewsDir = join(job.root, 'hook-previews');
    const videoPath = join(job.root, 'downloads', `${videoId}.mp4`);

    if (this.deps.previewRenderer) {
      const settled = await Promise.allSettled(
        saved.hooks.map((hook, index) => {
          const fileName = `hook-${String(index + 1).padStart(2, '0')}`;
          return this.deps.previewRenderer!.renderPreview({
            videoPath,
            start: hook.source.start,
            end: hook.source.end,
            outputDir: previewsDir,
            fileName,
            overwrite: true,
          });
        }),
      );

      const cacheBust = `?t=${Date.now()}`;
      saved.hooks.forEach((hook, index) => {
        const outcome = settled[index];
        if (outcome?.status === 'fulfilled' && outcome.value) {
          const { path, thumbnailPath, durationSeconds } = outcome.value;
          const mediaPreviewUrl = path ? `${toMediaUrl(this.deps.outputsDir, path)}${cacheBust}` : undefined;
          const mediaThumbnailUrl = thumbnailPath
            ? `${toMediaUrl(this.deps.outputsDir, thumbnailPath)}${cacheBust}`
            : mediaPreviewUrl
            ? mediaPreviewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1')
            : undefined;

          hook.previewUrl = mediaPreviewUrl;
          hook.thumbnailUrl = mediaThumbnailUrl;
          hook.finalDurationSeconds = durationSeconds;
        }
      });
    }

    saved.generatedAt = new Date().toISOString();
    await this.saveResult(videoId, candidateId, saved);
    return { ...saved, cached: false };
  }


  /** Resolves the videoId + transcript, downloading/transcribing when needed. */
  private async resolveTranscript(
    request: HookGenerateRequest,
  ): Promise<{ videoId: string; transcript: TranscriptDocument; job: JobWorkspace }> {
    if (request.youtubeUrl) {
      const id = extractVideoIdFromUrl(request.youtubeUrl);
      if (!id) throw AppError.invalidUrl();

      // Skip the download entirely when the video already sits in the
      // per-video workspace (mirrors the transform fast path) — yt-dlp would
      // skip the fetch anyway, but only after a ~3s metadata round-trip.
      const videoId = id;
      const savedVideoPath = join(this.deps.outputsDir, videoId, 'downloads', `${videoId}.mp4`);
      const hasVideo = await access(savedVideoPath).then(() => true).catch(() => false);
      let transcript = await this.loadTranscriptWithFallback(videoId);
      if (hasVideo && transcript) {
        this.deps.logger.info({ videoId }, 'Using existing video and transcript from workspace');
        const job = await this.workspaceFor(videoId);
        return { videoId, transcript, job };
      }

      const job = await this.workspaceFor(videoId);
      let videoPath = savedVideoPath;
      if (!hasVideo) {
        const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, job);
        videoPath = download.videoPath;
      } else {
        this.deps.logger.info({ videoId, videoPath }, 'Using existing downloaded video from workspace');
      }

      if (!transcript) {
        this.deps.logger.info({ videoId }, 'No transcript found — extracting audio and transcribing');
        const { createWhisperServiceWith } = await import('../container/index.js');
        const whisperService = request.sttProvider
          ? createWhisperServiceWith(request.sttProvider)
          : this.deps.whisperService;
        const audio = await this.deps.transcriptService.extractAudio(videoPath, videoId, job);
        const whisperResult = await whisperService.transcribe(audio.audioPath, job);
        const transcriptDoc: TranscriptDocument = {
          ...whisperResult,
          videoId,
          sourceUrl: request.youtubeUrl,
          createdAt: new Date().toISOString(),
        };
        await this.deps.transcriptService.saveTranscript(transcriptDoc, job);
        transcript = transcriptDoc;
      }
      return { videoId, transcript, job };
    }

    if (request.videoId) {
      const transcript = await this.loadTranscriptWithFallback(request.videoId);
      if (!transcript) throw AppError.missingSourceVideo(`No transcript for ${request.videoId}.`);
      const job = await this.workspaceFor(request.videoId);
      return { videoId: request.videoId, transcript, job };
    }

    throw AppError.validation('Provide exactly one of: youtubeUrl OR videoId.');
  }

  /** Per-video workspace (creates the directory tree when missing). */
  private async workspaceFor(videoId: string): Promise<JobWorkspace> {
    const { createJobWorkspace } = await import('../utils/workspace.js');
    return createJobWorkspace(this.deps.outputsDir, videoId);
  }

  /**
   * Loads a transcript via the shared TranscriptService first, then falls
   * back to the per-video job workspace (`outputs/{videoId}/transcripts/`)
   * where transform jobs persist theirs. Kept inside this controller so the
   * existing TranscriptService stays untouched.
   */
  private async loadTranscriptWithFallback(videoId: string): Promise<TranscriptDocument | null> {
    const shared = await this.deps.transcriptService.loadTranscript(videoId);
    if (shared) return shared;

    try {
      const { readFile } = await import('node:fs/promises');
      const workspacePath = join(this.deps.outputsDir, videoId, 'transcripts', `${videoId}.json`);
      const raw = await readFile(workspacePath, 'utf-8');
      return JSON.parse(raw) as TranscriptDocument;
    } catch {
      return null;
    }
  }

  /** Angles with cache + fallback (mirrors transform.controller behaviour). */
  private async getAngles(
    context: ContentAngleContext,
    videoId: string,
    candidateId: number,
    genre?: ContentGenre,
    language?: string,
    customPrompt?: string,
  ): Promise<AngleGenerationResult> {
    const cacheKey = this.cacheKey('hook-angle', videoId, candidateId, context.clipStart, genre ?? '', language ?? '', customPrompt ?? '');
    const cached = await this.deps.contentCache?.get<AngleGenerationResult>(cacheKey);
    if (cached) {
      this.deps.logger.info({ cache: 'hook-angle', videoId, candidateId }, 'Angle generation served from cache');
      return cached;
    }

    try {
      const result = await this.deps.contentAngleService.generateAngles(context);
      await this.deps.contentCache?.set(cacheKey, result);
      return result;
    } catch (err) {
      this.deps.logger.warn({ err }, 'Angle generation failed; using fallback angle');
      return {
        candidateId: context.candidateId,
        angles: [
          {
            id: 'fallback',
            title: 'Editorial',
            angleType: 'commentary',
            hook: context.momentSegments[0]?.text ?? '...',
            reason: 'fallback',
            score: 50,
          },
        ],
        selectedAngleId: 'fallback',
      };
    }
  }

  /** Story beats with cache; failure is non-fatal (hooks still work without). */
  private async getStory(
    segments: TranscriptDocument['segments'],
    videoId: string,
    candidateId: number,
    genre?: ContentGenre,
    customPrompt?: string,
  ): Promise<SourceStory | undefined> {
    const cacheKey = this.cacheKey('hook-story', videoId, candidateId, segments[0]?.start ?? 0, genre ?? '', customPrompt ?? '');
    const cached = await this.deps.contentCache?.get<SourceStory>(cacheKey);
    if (cached) {
      this.deps.logger.info({ cache: 'hook-story', videoId, candidateId }, 'Story planning served from cache');
      return cached;
    }

    try {
      const story = await this.deps.storyService.buildStory(segments, genre, customPrompt);
      await this.deps.contentCache?.set(cacheKey, story);
      return story;
    } catch (err) {
      this.deps.logger.warn({ err }, 'Story planning failed; continuing without story beats');
      return undefined;
    }
  }

  /** Builds a usable source moment around the chosen transcript segment. */
  private selectMoment(
    transcript: TranscriptDocument,
    candidateId: number,
    startTime?: number,
  ): {
    momentSegments: TranscriptDocument['segments'];
    contextSegments: TranscriptDocument['segments'];
  } {
    const segments = transcript.segments;
    let firstIndex = Math.min(candidateId, Math.max(0, segments.length - 1));

    if (startTime !== undefined && startTime >= 0) {
      const foundIndex = segments.findIndex(s => s.start >= startTime || (s.start <= startTime && s.end >= startTime));
      if (foundIndex >= 0) {
        firstIndex = foundIndex;
      }
    }

    const first = segments[firstIndex];
    if (!first) return { momentSegments: [], contextSegments: [] };

    const start = first.start;
    const maxEnd = start + 35;
    let lastIndex = firstIndex;
    for (let index = firstIndex + 1; index < segments.length; index += 1) {
      const segment = segments[index]!;
      if (segment.start >= maxEnd) break;
      lastIndex = index;
    }
    return {
      momentSegments: segments.slice(firstIndex, lastIndex + 1),
      contextSegments: [
        ...segments.slice(Math.max(0, firstIndex - 2), firstIndex),
        ...segments.slice(lastIndex + 1, lastIndex + 3),
      ],
    };
  }

  private cacheKey(...parts: (string | number)[]): string {
    return String(hashSeed(...parts.map(String)));
  }
}

/** Kept for parity with other controllers that expose their workspace root. */
export function hookOutputDir(outputsDir: string, videoId: string): string {
  return join(outputsDir, videoId, 'hooks');
}

/** Maps an absolute outputs path to its `/api/media/...` URL. */
function toMediaUrl(outputsDir: string, path: string): string {
  const marker = `${outputsDir}/`;
  const index = path.indexOf(marker);
  const relative = index >= 0 ? path.slice(index + marker.length) : path;
  return `/api/media/${relative.split('/').map(encodeURIComponent).join('/')}`;
}
