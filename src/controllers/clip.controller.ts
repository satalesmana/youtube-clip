import { join } from 'node:path';
import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import type { Logger } from '../utils/logger.js';
import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { IWhisperService } from '../services/whisper.service.js';
import type { IHighlightAnalysisService } from '../services/highlight-analysis.service.js';
import type { IHighlightService } from '../services/highlight.service.js';
import type { IPreviewRenderer } from '../services/preview-renderer.service.js';
import type { TranscriptDocument } from '../types/transcript.js';
import type { HighlightClip } from '../types/highlight.js';
import { detectAudioSpikes } from '../utils/audio-peak.js';
import type { RerankedClip } from '../schemas/highlight.schema.js';
import type { ClipRecommendRequestInput } from '../schemas/clip-recommendation.schema.js';
import type { ViralClipDto } from '../schemas/clip-recommendation.schema.js';
import type { IClipRefinementService } from '../services/clip-refinement.service.js';

export interface ClipControllerDeps {
  youtubeService: IYoutubeService;
  transcriptService: ITranscriptService;
  whisperService: IWhisperService;
  highlightAnalysisService: IHighlightAnalysisService;
  highlightService: IHighlightService;
  previewRenderer: IPreviewRenderer;
  clipRefinementService?: IClipRefinementService;
  outputsDir: string;
  logger: Logger;
  ffmpegBinaryPath?: string;
  maxConcurrency?: number;
}

/** Persisted result for `POST /api/clips/recommend` (also the GET payload). */
export interface ClipRecommendResult {
  success: true;
  videoId: string;
  clips: ViralClipDto[];
  candidateCount: number;
  cached: boolean;
  generatedAt: string;
}

/**
 * How many merged candidates survive the first pass into the rerank pool.
 * Larger than HIGHLIGHT_TOP_N so the second pass has real room to demote
 * weak moments; the final output is cut back to top-N afterwards.
 */
const RERANK_POOL_SIZE = 25;

/** Candidates below this count gain nothing from a global comparison pass. */
const RERANK_MIN_CANDIDATES = 2;

/**
 * Minimum clips to guarantee in the final output. When the rerank pass
 * drops too many candidates, the soft-fallback logic backfills from the
 * pool using the best dropped clips (with a small score discount) rather
 * than returning an under-populated result.
 */
const RERANK_MIN_OUTPUT = 5;

/**
 * Orchestrates the viral-clip recommendation stage (flow redesign step 2):
 * resolve video + transcript (reusing whatever is already on disk), analyze
 * every transcript chunk with the LLM (pass 1), rerank the pooled top
 * candidates against each other (pass 2), merge + rank highlights, and render
 * a small preview video per clip so the UI can show real footage.
 *
 * Contains no HTTP-specific logic so it can be reused by future entry points.
 */
export class ClipController {
  constructor(private readonly deps: ClipControllerDeps) {}

  async recommend(request: ClipRecommendRequestInput): Promise<ClipRecommendResult> {
    const { logger } = this.deps;

    // Fast path: return the previously saved result without re-running the
    // LLM analysis. `refresh: true` bypasses this (transcript still reused).
    if (!request.refresh) {
      const videoId = this.resolveVideoId(request);
      if (videoId) {
        const saved = await this.loadSaved(videoId);
        if (saved) {
          logger.info({ videoId }, 'Returning saved clip recommendations (no regeneration)');
          return { ...saved, cached: true };
        }
      }
    }

    const { videoId, transcript } = await this.resolveTranscript(request);
    logger.info({ videoId }, 'Viral clip recommendation started');

    const method = request.detectionMethod ?? 'auto';
    const language = this.metadataLanguage(request.language);
    const chunks = this.deps.transcriptService.chunkTranscript(transcript);
    let clipGroups: HighlightClip[][] = [];

    // Step A: Run transcript LLM analysis unless user strictly selected 'audio-spike'
    if (method !== 'audio-spike' && chunks.length > 0) {
      clipGroups = await this.analyzeChunksConcurrently(chunks, language, request.genre);
    }
    let candidates = clipGroups.flat();

    // Step B: Run audio spike detection if explicitly requested, or if auto mode found no transcript candidates
    if (method === 'audio-spike' || (method === 'auto' && candidates.length === 0)) {
      logger.info(
        { videoId, method, genre: request.genre },
        'Running audio energy spike detection for viral clips',
      );
      const workspace = await this.workspaceFor(videoId);
      const audio = await this.deps.transcriptService.extractAudio(this.videoPathFor(videoId), videoId, workspace);
      const audioSpikeCandidates = await detectAudioSpikes({
        binaryPath: this.deps.ffmpegBinaryPath,
        audioPath: audio.audioPath,
        totalDurationSeconds: transcript.durationSeconds,
        genre: request.genre,
        logger,
      });

      if (audioSpikeCandidates.length > 0) {
        candidates = audioSpikeCandidates;
        clipGroups = [candidates];
      }
    }

    if (candidates.length === 0) {
      throw AppError.llmInvalidResponse(
        'No viral clips could be extracted from this video. Try again or pick a different video.',
      );
    }

    // Intermediate merge: dedupe + normalize scores, keep a pool big enough
    // for the rerank pass to make a meaningful global selection.
    const pool = this.deps.highlightService.mergeAndRank(clipGroups, RERANK_POOL_SIZE);

    // Pass 2: compare the pool against itself and drop the ones that only
    // looked good in isolation. Only run if we actually have transcript chunks to compare against.
    const reranked = chunks.length > 0
      ? await this.rerankPool(pool, transcript, language, request.genre)
      : null;
    const ranked = this.finalizeRanking(reranked ? [...pool] : pool, reranked);

    // Refine candidate boundaries against transcript sentences and acoustic silence cushions
    // so clips NEVER cut off words or start/end mid-sentence
    const refinedClips = ranked.map((clip) => {
      if (this.deps.clipRefinementService && transcript.segments.length > 0) {
        const refined = this.deps.clipRefinementService.refine(clip, transcript);
        return {
          ...clip,
          start: refined.start,
          end: refined.end,
        };
      }
      return clip;
    });

    // Stage: render a lightweight preview per clip (parallel, failures are
    // non-fatal — the clip stays in the list without a playable preview).
    const workspace = await this.workspaceFor(videoId);
    const previewsDir = join(workspace.root, 'clip-previews');

    if (request.refresh) {
      try {
        const { rm } = await import('node:fs/promises');
        await rm(previewsDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err }, 'Failed to clear old clip previews on refresh');
      }
    }

    const settledPreviews = await Promise.allSettled(
      refinedClips.map((clip, index) =>
        this.deps.previewRenderer.renderPreview({
          videoPath: this.videoPathFor(videoId),
          start: clip.start,
          end: clip.end,
          outputDir: previewsDir,
          fileName: `clip-${String(index + 1).padStart(2, '0')}`,
          overwrite: Boolean(request.refresh),
        }),
      ),
    );

    const clips: ViralClipDto[] = refinedClips.map((clip, index) => {
      const outcome = settledPreviews[index];
      const previewPath = outcome?.status === 'fulfilled' ? outcome.value.path : null;
      const thumbnailPath = outcome?.status === 'fulfilled' ? outcome.value.thumbnailPath : null;
      const roundedScore = Math.round(clip.score);
      const virality = clip.virality ?? {
        overall: roundedScore,
        hookStrength: Math.min(100, Math.max(10, Math.round(clip.score * 0.96 + 4))),
        engagementFlow: Math.min(100, Math.max(10, Math.round(clip.score * 0.92 + 3))),
        trendRelevance: Math.min(100, Math.max(10, Math.round(clip.score * 0.88 + 8))),
        standaloneValue: Math.min(100, Math.max(10, Math.round(clip.score * 0.94 + 5))),
        reasons: [clip.reason],
      };

      const cacheBust = `?t=${Date.now()}`;
      const mediaPreviewUrl = previewPath ? `${this.toMediaUrl(previewPath)}${cacheBust}` : '';
      const mediaThumbnailUrl = thumbnailPath
        ? `${this.toMediaUrl(thumbnailPath)}${cacheBust}`
        : mediaPreviewUrl
        ? mediaPreviewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1')
        : '';

      return {
        id: `clip_${String(index + 1).padStart(2, '0')}`,
        rank: index + 1,
        start: clip.start,
        end: clip.end,
        durationSeconds: Number((clip.end - clip.start).toFixed(2)),
        score: roundedScore,
        title: clip.title,
        reason: clip.reason,
        hook: clip.hook,
        previewUrl: mediaPreviewUrl,
        thumbnailUrl: mediaThumbnailUrl,
        virality,
      };
    });

    const result: ClipRecommendResult = {
      success: true,
      videoId,
      clips,
      candidateCount: candidates.length,
      cached: false,
      generatedAt: new Date().toISOString(),
    };

    await this.saveResult(videoId, result);
    return result;
  }

  /**
   * Records which recommended clips the user actually took into a transform.
   * Written to `outputs/{videoId}/feedback/selected-clips.json` as an append
   * log — future ranking/scoring work can learn from real selections.
   * Never throws: feedback must not break the transform pipeline.
   */
  async recordSelection(
    videoId: string,
    selectedClips: Array<{ start: number; end: number; title?: string }>,
  ): Promise<void> {
    try {
      const file = join(this.deps.outputsDir, videoId, 'feedback', 'selected-clips.json');
      let log: unknown[] = [];
      try {
        log = JSON.parse(await readFile(file, 'utf-8')) as unknown[];
        if (!Array.isArray(log)) log = [];
      } catch {
        // First selection for this video.
      }
      log.push({ selectedClips, selectedAt: new Date().toISOString() });
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, JSON.stringify(log, null, 2), 'utf-8');
      this.deps.logger.info(
        { videoId, count: selectedClips.length },
        'Recorded user clip selection',
      );
    } catch (err) {
      this.deps.logger.warn({ err, videoId }, 'Failed to record clip selection feedback');
    }
  }

  /**
   * Fast preview re-rendering endpoint for existing saved clips.
   * Re-cuts 9:16 preview clips and thumbnails with FFmpeg without re-calling LLM.
   */
  async rerenderPreviews(request: { youtubeUrl?: string; videoId?: string }): Promise<ClipRecommendResult> {
    const videoId = this.resolveVideoId(request);
    if (!videoId) throw AppError.validation('Provide youtubeUrl or videoId.');

    const saved = await this.loadSaved(videoId);
    if (!saved || !saved.clips?.length) {
      throw AppError.validation(`No saved clips found for "${videoId}". Generate clips first.`);
    }

    const workspace = await this.workspaceFor(videoId);
    const previewsDir = join(workspace.root, 'clip-previews');
    const videoPath = this.videoPathFor(videoId);

    // Re-refine saved clip boundaries against transcript if available so existing clips benefit from natural cuts
    const transcript = await this.deps.transcriptService.loadTranscript(videoId);
    if (this.deps.clipRefinementService && transcript && transcript.segments.length > 0) {
      saved.clips = saved.clips.map((clip) => {
        const refined = this.deps.clipRefinementService!.refine(clip, transcript);
        return {
          ...clip,
          start: refined.start,
          end: refined.end,
          durationSeconds: Number((refined.end - refined.start).toFixed(2)),
        };
      });
      await this.saveResult(videoId, saved);
    }

    // Clean old preview files to ensure fresh render
    try {
      const { rm } = await import('node:fs/promises');
      await rm(previewsDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    const settledPreviews = await Promise.allSettled(
      saved.clips.map((clip, index) =>
        this.deps.previewRenderer.renderPreview({
          videoPath,
          start: clip.start,
          end: clip.end,
          outputDir: previewsDir,
          fileName: `clip-${String(index + 1).padStart(2, '0')}`,
          overwrite: true,
        }),
      ),
    );

    const cacheBust = `?t=${Date.now()}`;
    saved.clips.forEach((clip, index) => {
      const outcome = settledPreviews[index];
      const previewPath = outcome?.status === 'fulfilled' ? outcome.value.path : null;
      const thumbnailPath = outcome?.status === 'fulfilled' ? outcome.value.thumbnailPath : null;
      if (previewPath) {
        clip.previewUrl = `${this.toMediaUrl(previewPath)}${cacheBust}`;
        clip.thumbnailUrl = thumbnailPath
          ? `${this.toMediaUrl(thumbnailPath)}${cacheBust}`
          : clip.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1');
      }
    });

    saved.generatedAt = new Date().toISOString();
    await this.saveResult(videoId, saved);
    return { ...saved, cached: false };
  }


  /**
   * Returns a previously saved clip result for `GET /api/clips` without
   * running any pipeline stage. Throws 404 when nothing is saved yet.
   */
  async getSaved(videoId: string): Promise<ClipRecommendResult> {
    const saved = await this.loadSaved(videoId);
    if (!saved) {
      throw AppError.validation(`No saved clip recommendations for video "${videoId}". Run POST /api/clips/recommend first.`);
    }
    return saved;
  }

  /**
   * Maps the request's output language to the metadata instruction language.
   * `auto`/undefined → undefined so the model mirrors the transcript.
   */
  private metadataLanguage(language?: string): string | undefined {
    if (!language || language === 'auto') return undefined;
    return language;
  }

  /**
   * Pass 2 of the analysis: sends the merged pool (with verbatim excerpts)
   * to the LLM for a global comparison. Returns `null` when the pass fails
   * or adds nothing (too few candidates) — the caller then keeps pass-1 order.
   */
  private async rerankPool(
    pool: HighlightClip[],
    transcript: TranscriptDocument,
    language?: string,
    genre?: string,
  ): Promise<RerankedClip[] | null> {
    if (pool.length < RERANK_MIN_CANDIDATES) return null;

    const excerptById: Record<string, string> = {};
    const candidates = pool.map((clip, index) => {
      const id = `cand_${String(index + 1).padStart(2, '0')}`;
      excerptById[id] = this.excerptFor(transcript, clip.start, clip.end);
      return { id, start: clip.start, end: clip.end, title: clip.title, reason: clip.reason, hook: clip.hook };
    });

    try {
      return await this.deps.highlightAnalysisService.rerankCandidates({
        videoTitle: transcript.videoId,
        candidates,
        excerptById,
        language,
        genre,
      });
    } catch (err) {
      this.deps.logger.warn({ err }, 'Rerank pass failed — keeping first-pass ranking');
      return null;
    }
  }

  /**
   * Applies rerank verdicts to the pool: survivors get fresh globally
   * calibrated scores and optional sharpened metadata; dropped candidates
   * that pushed the output below RERANK_MIN_OUTPUT are soft-backfilled from
   * the pool with a small score discount rather than being discarded outright.
   * The final list is then cut to the configured top-N.
   */
  private finalizeRanking(pool: HighlightClip[], reranked: RerankedClip[] | null): HighlightClip[] {
    if (!reranked || reranked.length === 0) {
      return this.deps.highlightService.cutToTopN(pool);
    }

    const byId = new Map(reranked.map((clip) => [clip.id, clip]));
    const survivors: HighlightClip[] = [];
    const dropped: HighlightClip[] = [];

    pool.forEach((clip, index) => {
      const verdict = byId.get(`cand_${String(index + 1).padStart(2, '0')}`);
      if (!verdict) {
        // Soft-drop: retain in the dropped list for potential backfill.
        dropped.push(clip);
        return;
      }
      survivors.push({
        ...clip,
        score: verdict.score,
        title: verdict.title?.trim() || clip.title,
        reason: verdict.reason?.trim() || clip.reason,
        hook: verdict.hook?.trim() || clip.hook,
        virality: verdict.virality ?? clip.virality,
      });
    });

    // Soft fallback: if the rerank pass discarded too many candidates and we
    // would return fewer than RERANK_MIN_OUTPUT clips, backfill from the
    // highest-scoring dropped candidates with a 15-point score discount so
    // they consistently rank below genuine rerank survivors.
    if (survivors.length < RERANK_MIN_OUTPUT && dropped.length > 0) {
      const needed = RERANK_MIN_OUTPUT - survivors.length;
      const backfill = [...dropped]
        .sort((a, b) => b.score - a.score)
        .slice(0, needed)
        .map((clip) => ({ ...clip, score: Math.max(0, clip.score - 15) }));
      survivors.push(...backfill);
      this.deps.logger.info(
        { survivorCount: survivors.length - backfill.length, backfillCount: backfill.length },
        'Soft-backfilled dropped candidates to meet minimum output',
      );
    }

    return this.deps.highlightService.cutToTopN(survivors);
  }

  /** Verbatim transcript lines inside `[start, end]`, for the rerank prompt. */
  private excerptFor(transcript: TranscriptDocument, start: number, end: number): string {
    const lines: string[] = [];
    for (const segment of transcript.segments as TranscriptSegment[]) {
      if (segment.end < start) continue;
      if (segment.start > end) break;
      lines.push(`[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`);
    }
    return lines.join('\n');
  }

  /** Resolves the videoId from the request WITHOUT downloading anything. */
  private resolveVideoId(request: { youtubeUrl?: string; videoId?: string }): string | null {
    if (request.videoId) return request.videoId;
    if (request.youtubeUrl) return extractVideoIdFromUrl(request.youtubeUrl);
    return null;
  }

  /** Path of the saved clip result for a video. */
  private savedPath(videoId: string): string {
    return join(this.deps.outputsDir, videoId, 'clips', 'recommendations.json');
  }

  /** Loads a previously saved clip result, or `null` when absent/corrupt. */
  private async loadSaved(videoId: string): Promise<ClipRecommendResult | null> {
    try {
      const raw = await readFile(this.savedPath(videoId), 'utf-8');
      const parsed = JSON.parse(raw) as ClipRecommendResult;
      if (!Array.isArray(parsed.clips)) return null;
      // Ensure all clips have thumbnailUrl populated
      parsed.clips = parsed.clips.map((c) => ({
        ...c,
        thumbnailUrl: c.thumbnailUrl || (c.previewUrl ? c.previewUrl.replace(/\.mp4$/, '.jpg') : ''),
      }));
      return parsed;
    } catch {
      return null;
    }
  }

  /** Persists the clip result to `outputs/{videoId}/clips/recommendations.json`. */
  private async saveResult(videoId: string, result: ClipRecommendResult): Promise<void> {
    try {
      const file = this.savedPath(videoId);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, JSON.stringify(result, null, 2), 'utf-8');
    } catch (err) {
      this.deps.logger.warn({ err, videoId }, 'Failed to persist clip recommendations');
    }
  }

  /**
   * Resolves the videoId + transcript, downloading/transcribing only what is
   * missing — mirrors HookController.resolveTranscript so both stages share
   * the same per-video workspace without re-downloading anything.
   */
  private async resolveTranscript(
    request: ClipRecommendRequestInput,
  ): Promise<{ videoId: string; transcript: TranscriptDocument }> {
    if (request.youtubeUrl) {
      const id = extractVideoIdFromUrl(request.youtubeUrl);
      if (!id) throw AppError.invalidUrl();

      // Skip the download entirely when the video already sits in the
      // per-video workspace (mirrors the transform fast path) — yt-dlp would
      // skip the fetch anyway, but only after a ~3s metadata round-trip.
      const videoId = id;
      const savedVideoPath = this.videoPathFor(videoId);
      const hasVideo = await access(savedVideoPath).then(() => true).catch(() => false);
      let transcript = await this.loadTranscriptWithFallback(videoId);
      if (hasVideo && transcript) {
        this.deps.logger.info({ videoId }, 'Using existing video and transcript from workspace');
        return { videoId, transcript };
      }

      const workspace = await this.workspaceFor(videoId);
      let videoPath = savedVideoPath;
      if (!hasVideo) {
        const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, workspace);
        videoPath = download.videoPath;
      } else {
        this.deps.logger.info({ videoId, videoPath }, 'Using existing downloaded video from workspace');
      }

      if (!transcript) {
        this.deps.logger.info({ videoId }, 'No transcript found — extracting audio and transcribing');
        const whisperService = request.sttProvider
          ? (await import('../container/index.js')).createWhisperServiceWith(request.sttProvider)
          : this.deps.whisperService;
        const audio = await this.deps.transcriptService.extractAudio(videoPath, videoId, workspace);
        const whisperResult = await whisperService.transcribe(audio.audioPath, workspace);
        const transcriptDoc: TranscriptDocument = {
          ...whisperResult,
          videoId,
          sourceUrl: request.youtubeUrl,
          createdAt: new Date().toISOString(),
        };
        await this.deps.transcriptService.saveTranscript(transcriptDoc, workspace);
        transcript = transcriptDoc;
      }
      return { videoId, transcript };
    }

    if (request.videoId) {
      const transcript = await this.loadTranscriptWithFallback(request.videoId);
      if (!transcript) throw AppError.missingSourceVideo(`No transcript for ${request.videoId}.`);
      return { videoId: request.videoId, transcript };
    }

    throw AppError.validation('Provide exactly one of: youtubeUrl OR videoId.');
  }

  /**
   * Loads a transcript via the shared TranscriptService first, then falls
   * back to the per-video job workspace where transform jobs persist theirs.
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

  /** Per-video workspace (creates the directory tree when missing). */
  private async workspaceFor(videoId: string) {
    const { createJobWorkspace } = await import('../utils/workspace.js');
    return createJobWorkspace(this.deps.outputsDir, videoId);
  }

  /** Source video path inside the per-video workspace. */
  private videoPathFor(videoId: string): string {
    return join(this.deps.outputsDir, videoId, 'downloads', `${videoId}.mp4`);
  }

  /**
   * Analyzes transcript chunks with bounded concurrency to prevent HTTP 429
   * (rate limit / quota exceeded) on the LLM backend.
   * A single chunk failing after exhausting retries is logged and skipped rather than
   * failing the whole request.
   */
  private async analyzeChunksConcurrently(
    chunks: ReturnType<ITranscriptService['chunkTranscript']>,
    language?: string,
    genre?: string,
  ): Promise<HighlightClip[][]> {
    if (chunks.length === 0) return [];

    const limit = Math.max(1, this.deps.maxConcurrency ?? 2);
    this.deps.logger.info(
      { totalChunks: chunks.length, concurrencyLimit: limit },
      'Analyzing transcript chunks with concurrency limit',
    );

    const results: HighlightClip[][] = [];
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < chunks.length) {
        const index = currentIndex++;
        const chunk = chunks[index];
        if (!chunk) break;

        try {
          const clips = await this.deps.highlightAnalysisService.analyzeChunk(chunk, language, genre);
          results.push(clips);
        } catch (err) {
          this.deps.logger.error(
            { chunkIndex: chunk.index, err },
            'Chunk analysis failed, skipping chunk',
          );
        }

        // Human-like pacing delay between consecutive chunk calls.
        // Uses a two-tier jitter: a base pause (500-1200ms) occasionally
        // lengthened by a secondary pause (0-1500ms) to mimic natural reading
        // pauses. This pattern is harder to fingerprint than a uniform window
        // and avoids triggering anti-bot / WAF heuristics on LLM backends.
        if (currentIndex < chunks.length) {
          const baseMs = 500 + Math.floor(Math.random() * 700);
          const extraMs = Math.random() < 0.3 ? Math.floor(Math.random() * 1500) : 0;
          await new Promise((resolve) => setTimeout(resolve, baseMs + extraMs));
        }
      }
    };

    const workers = Array.from({ length: Math.min(limit, chunks.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  /** Maps an absolute outputs path to its `/api/media/...` URL. */
  private toMediaUrl(path: string): string {
    const marker = `${this.deps.outputsDir}/`;
    const index = path.indexOf(marker);
    const relative = index >= 0 ? path.slice(index + marker.length) : path;
    return `/api/media/${relative.split('/').map(encodeURIComponent).join('/')}`;
  }
}
