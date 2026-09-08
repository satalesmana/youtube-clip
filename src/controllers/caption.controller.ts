import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import type { Logger } from '../utils/logger.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { ICaptionService } from '../content/caption.service.js';
import type { GenerateCaptionRequest } from '../schemas/caption.schema.js';
import type { CaptionGenerationContext, VideoCaptionResult } from '../types/caption.js';
import type { TranscriptDocument } from '../types/transcript.js';

export interface CaptionControllerDeps {
  captionService: ICaptionService;
  transcriptService: ITranscriptService;
  outputsDir: string;
  logger: Logger;
}

export interface CaptionControllerResponse extends VideoCaptionResult {
  success: true;
}

export class CaptionController {
  constructor(private readonly deps: CaptionControllerDeps) {}

  async generate(request: GenerateCaptionRequest): Promise<CaptionControllerResponse> {
    const { logger, captionService } = this.deps;
    const videoId = this.resolveVideoId(request);

    const requestedPlatforms = request.platforms?.length
      ? request.platforms
      : request.platform
      ? [request.platform]
      : undefined;

    // Fast-path: Check for cached captions when not forcing refresh
    if (videoId && !request.refresh) {
      const saved = await captionService.getSavedCaptions(videoId, request.jobId);
      if (saved && (!request.tone || saved.tone === request.tone)) {
        const hasAllRequested = !requestedPlatforms || requestedPlatforms.every((p) => Boolean(saved.captions[p]));
        if (hasAllRequested) {
          logger.info({ videoId, jobId: request.jobId, tone: saved.tone }, 'Returning saved viral captions from disk');
          const filteredCaptions = requestedPlatforms
            ? Object.fromEntries(
                requestedPlatforms
                  .filter((p) => Boolean(saved.captions[p]))
                  .map((p) => [p, saved.captions[p]!]),
              )
            : saved.captions;
          return {
            ...saved,
            captions: filteredCaptions,
            success: true,
            cached: true,
          };
        }
      }
    }

    // Build context from request / workspace
    const context = await this.buildGenerationContext(request, videoId);
    const result = await captionService.generateCaptions(context);

    return {
      ...result,
      success: true,
      cached: false,
    };
  }

  async getSaved(videoId: string, jobId?: string): Promise<CaptionControllerResponse | null> {
    const saved = await this.deps.captionService.getSavedCaptions(videoId, jobId);
    if (!saved) return null;
    return {
      ...saved,
      success: true,
      cached: true,
    };
  }

  private resolveVideoId(request: GenerateCaptionRequest): string | undefined {
    if (request.videoId) return request.videoId;
    if (request.youtubeUrl) return extractVideoIdFromUrl(request.youtubeUrl) ?? undefined;
    return undefined;
  }

  private async buildGenerationContext(
    request: GenerateCaptionRequest,
    videoId?: string,
  ): Promise<CaptionGenerationContext> {
    const custom = request.customContext;
    const requestedPlatforms = request.platforms?.length
      ? request.platforms
      : request.platform
      ? [request.platform]
      : undefined;

    const baseContext: CaptionGenerationContext = {
      videoId: videoId || 'custom_video',
      jobId: request.jobId,
      sourceTitle: custom?.sourceTitle || (videoId ? `Video ${videoId}` : 'Video Viral Highlight'),
      sourceChannel: custom?.sourceChannel,
      genre: custom?.genre,
      customPrompt: custom?.customPrompt,
      targetLanguage: request.language === 'auto' ? undefined : request.language,
      tone: request.tone,
      platforms: requestedPlatforms,
      creditTemplate: request.creditTemplate,
      durationSeconds: custom?.durationSeconds,
    };

    if (custom?.angleTitle || custom?.angleHook) {
      baseContext.angle = {
        title: custom.angleTitle || '',
        hook: custom.angleHook,
      };
    }

    if (custom?.scriptText) {
      baseContext.script = {
        sections: [{ type: 'body', text: custom.scriptText }],
      };
    }

    if (custom?.storyConcept) {
      baseContext.story = {
        concept: custom.storyConcept,
      };
    }

    // If we have videoId and missing title/script, try reading from disk workspace
    if (videoId) {
      const videoDir = join(this.deps.outputsDir, videoId);

      // 1. Try reading transcript
      try {
        const transcriptPath = join(videoDir, 'transcripts', `${videoId}.json`);
        const raw = await readFile(transcriptPath, 'utf-8');
        const doc = JSON.parse(raw) as TranscriptDocument;
        if (!baseContext.videoLanguage) baseContext.videoLanguage = doc.language;
        if (!baseContext.transcriptSummary && doc.segments.length > 0) {
          const sample = doc.segments.slice(0, 10).map((s) => s.text).join(' ');
          baseContext.transcriptSummary = sample.length > 300 ? sample.slice(0, 300) + '...' : sample;
        }
      } catch {
        // Ignored — transcript might not exist yet
      }

      // 2. Try reading clips metadata for title/highlights
      try {
        const clipsPath = join(videoDir, 'metadata', 'clips.json');
        const raw = await readFile(clipsPath, 'utf-8');
        const clips = JSON.parse(raw) as Array<{ title?: string; start: number; end: number; hook?: string }>;
        if (Array.isArray(clips) && clips.length > 0) {
          if (baseContext.sourceTitle.startsWith('Video ') && clips[0]?.title) {
            baseContext.sourceTitle = clips[0].title;
          }
          if (!baseContext.angle && clips[0]) {
            baseContext.angle = {
              title: clips[0].title || 'Viral Moment',
              hook: clips[0].hook,
            };
          }
          baseContext.clips = clips.map((c) => ({
            start: c.start,
            end: c.end,
            title: c.title,
          }));
        }
      } catch {
        // Ignored
      }
    }

    return baseContext;
  }
}
