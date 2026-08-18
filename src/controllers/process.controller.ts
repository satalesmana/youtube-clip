import type { Logger } from '../utils/logger.js';
import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { IWhisperService } from '../services/whisper.service.js';
import type { IOllamaService } from '../services/ollama.service.js';
import type { IHighlightService } from '../services/highlight.service.js';
import type { IRendererService } from '../services/renderer.service.js';
import type { HighlightClip, ProcessResult } from '../types/highlight.js';
import type { TranscriptChunk, TranscriptDocument } from '../types/transcript.js';
import type { RenderContext } from '../types/template.js';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import { createJobWorkspace } from '../utils/workspace.js';

export interface ProcessControllerDeps {
  youtubeService: IYoutubeService;
  transcriptService: ITranscriptService;
  whisperService: IWhisperService;
  ollamaService: IOllamaService;
  highlightService: IHighlightService;
  rendererService: IRendererService;
  outputsDir: string;
  logger: Logger;
}

/**
 * Orchestrates the end-to-end pipeline for `POST /api/process`: download,
 * audio extraction, transcription, chunking, AI analysis, and merging.
 *
 * Contains no HTTP-specific logic so it can be reused by future entry points
 * (e.g. a job queue worker) without modification.
 */
export class ProcessController {
  constructor(private readonly deps: ProcessControllerDeps) {}

  /** Runs the full highlight-extraction and clip-rendering pipeline for a single YouTube URL. */
  async process(
    url: string,
    template?: string,
    channel?: RenderContext['channel'],
    actingAs?: string,
    customPrompt?: string,
  ): Promise<ProcessResult> {
    const {
      youtubeService,
      transcriptService,
      whisperService,
      ollamaService,
      highlightService,
      rendererService,
      outputsDir,
      logger,
    } = this.deps;

    // Extract video ID from URL up-front so the download lands directly in
    // its isolated workspace. Non-YouTube/non-standard URLs fall back to a
    // shared downloads dir, then get their own workspace from the actual ID.
    const videoIdFromUrl = extractVideoIdFromUrl(url);
    const workspace = videoIdFromUrl
      ? await createJobWorkspace(outputsDir, videoIdFromUrl)
      : null;
    const download = await youtubeService.downloadVideo(url, workspace ?? undefined);
    const job = workspace ?? (await createJobWorkspace(outputsDir, download.videoId));
    logger.info({ workspace: job.root }, 'Job workspace ready');

    const audio = await transcriptService.extractAudio(download.videoPath, download.videoId, job);

    const transcriptResult = await whisperService.transcribe(audio.audioPath, job);

    const transcriptDocument: TranscriptDocument = {
      ...transcriptResult,
      videoId: download.videoId,
      sourceUrl: url,
      createdAt: new Date().toISOString(),
    };
    const transcriptPath = await transcriptService.saveTranscript(transcriptDocument, job);

    const chunks = transcriptService.chunkTranscript(transcriptResult);
    const clipGroups = await this.analyzeChunksConcurrently(
      chunks,
      ollamaService,
      logger,
      actingAs,
      customPrompt,
    );

    const highlights = highlightService.mergeAndRank(clipGroups);

    const { clips, errors: clipErrors } = await rendererService.renderAll(
      download.videoPath,
      highlights,
      transcriptResult,
      template,
      channel,
      job,
    );

    logger.info(
      { videoId: download.videoId, clipCount: clips.length, clipErrorCount: clipErrors.length },
      'Completed',
    );

    return {
      video: download.videoPath,
      transcript: transcriptPath,
      clips,
      clipErrors,
    };
  }

  /**
   * Analyzes every transcript chunk concurrently. A single chunk failing
   * (e.g. after exhausting Ollama retries) is logged and skipped rather than
   * failing the whole request.
   */
  private async analyzeChunksConcurrently(
    chunks: TranscriptChunk[],
    ollamaService: IOllamaService,
    logger: Logger,
    actingAs?: string,
    customPrompt?: string,
  ): Promise<HighlightClip[][]> {
    const settled = await Promise.allSettled(
      chunks.map((chunk) => ollamaService.analyzeChunk(chunk, actingAs, customPrompt)),
    );

    return settled.flatMap((outcome, index) => {
      if (outcome.status === 'fulfilled') return [outcome.value];

      logger.error(
        { chunkIndex: chunks[index]?.index, err: outcome.reason },
        'Chunk analysis failed, skipping chunk',
      );
      return [];
    });
  }
}
