import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import { createJobWorkspace } from '../utils/workspace.js';
import type { Logger } from '../utils/logger.js';
import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { IWhisperService } from '../services/whisper.service.js';
import type { ContentCache } from '../services/content-cache.service.js';
import type { TranscriptDocument } from '../types/transcript.js';
import type {
  TranscriptGetQueryInput,
  TranscriptUpdateRequestInput,
} from '../schemas/transcript.schema.js';

export interface TranscriptControllerDeps {
  youtubeService: IYoutubeService;
  transcriptService: ITranscriptService;
  whisperService: IWhisperService;
  outputsDir: string;
  logger: Logger;
  contentCache?: ContentCache;
}

export interface TranscriptGetResult {
  success: true;
  videoId: string;
  transcript: TranscriptDocument;
  cached: boolean;
}

export interface TranscriptUpdateResult {
  success: true;
  videoId: string;
  segmentCount: number;
  message: string;
}

export class TranscriptController {
  constructor(private readonly deps: TranscriptControllerDeps) {}

  /**
   * Resolves or generates the transcript for the requested video.
   */
  async getOrCreateTranscript(request: TranscriptGetQueryInput): Promise<TranscriptGetResult> {
    const { logger } = this.deps;

    let videoId: string;
    let sourceUrl = '';

    if (request.youtubeUrl) {
      const id = extractVideoIdFromUrl(request.youtubeUrl);
      if (!id) throw AppError.invalidUrl();
      videoId = id;
      sourceUrl = request.youtubeUrl;
    } else if (request.videoId) {
      videoId = request.videoId;
    } else {
      throw AppError.validation('Provide youtubeUrl or videoId.');
    }

    if (!request.force) {
      const existing = await this.loadTranscriptWithFallback(videoId);
      if (existing) {
        logger.info({ videoId }, 'Returning existing transcript');
        return {
          success: true,
          videoId,
          transcript: existing,
          cached: true,
        };
      }
    }

    // Transcript does not exist yet; must download/transcribe if URL is available.
    if (!request.youtubeUrl) {
      throw AppError.missingSourceVideo(
        `Transcript not found for videoId "${videoId}". Provide youtubeUrl to download and transcribe.`,
      );
    }

    logger.info({ videoId }, 'Downloading video and transcribing audio for transcript view/edit');
    const job = await createJobWorkspace(this.deps.outputsDir, videoId);
    const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, job);

    const { createWhisperServiceWith } = await import('../container/index.js');
    const whisperService = request.sttProvider
      ? createWhisperServiceWith(request.sttProvider)
      : this.deps.whisperService;

    const audio = await this.deps.transcriptService.extractAudio(download.videoPath, videoId, job);
    const whisperResult = await whisperService.transcribe(audio.audioPath, job);

    const transcriptDoc: TranscriptDocument = {
      ...whisperResult,
      videoId,
      sourceUrl,
      createdAt: new Date().toISOString(),
    };

    await this.deps.transcriptService.saveTranscript(transcriptDoc, job);

    return {
      success: true,
      videoId,
      transcript: transcriptDoc,
      cached: false,
    };
  }

  /**
   * Saves updated transcript segments back to disk.
   */
  async updateTranscript(request: TranscriptUpdateRequestInput): Promise<TranscriptUpdateResult> {
    const { videoId, segments, language } = request;
    const { logger, outputsDir } = this.deps;

    logger.info({ videoId, segmentCount: segments.length }, 'Updating transcript segments');

    const existing = await this.loadTranscriptWithFallback(videoId);
    const durationSeconds = segments.length > 0
      ? Math.max(...segments.map((s) => s.end), existing?.durationSeconds ?? 0)
      : (existing?.durationSeconds ?? 0);

    const updatedDoc: TranscriptDocument = {
      videoId,
      sourceUrl: existing?.sourceUrl ?? '',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      language: language ?? existing?.language ?? 'id',
      durationSeconds,
      segments: segments.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        words: s.words,
      })),
    };

    // Save to shared transcripts directory
    await this.deps.transcriptService.saveTranscript(updatedDoc);

    // Also save to per-video workspace transcripts directory if workspace exists
    const workspaceTranscriptsDir = join(outputsDir, videoId, 'transcripts');
    try {
      await mkdir(workspaceTranscriptsDir, { recursive: true });
      const workspaceFile = join(workspaceTranscriptsDir, `${videoId}.json`);
      await writeFile(workspaceFile, JSON.stringify(updatedDoc, null, 2), 'utf-8');
    } catch (err) {
      logger.warn({ err, videoId }, 'Could not write to workspace transcripts dir');
    }

    return {
      success: true,
      videoId,
      segmentCount: segments.length,
      message: 'Transkrip berhasil disimpan dan disinkronkan.',
    };
  }

  /**
   * Helper to load transcript from shared transcripts dir or per-video workspace.
   */
  private async loadTranscriptWithFallback(videoId: string): Promise<TranscriptDocument | null> {
    const shared = await this.deps.transcriptService.loadTranscript(videoId);
    if (shared) return shared;

    try {
      const workspacePath = join(this.deps.outputsDir, videoId, 'transcripts', `${videoId}.json`);
      const raw = await readFile(workspacePath, 'utf-8');
      return JSON.parse(raw) as TranscriptDocument;
    } catch {
      return null;
    }
  }
}
