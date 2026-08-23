import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { IWhisperService } from '../services/whisper.service.js';
import { join, relative, sep } from 'node:path';
import { stat, access } from 'node:fs/promises';
import { probeDurationSeconds } from '../utils/ffmpeg.js';
import { extractVideoIdFromUrl } from '../utils/youtube-id.js';
import { createJobWorkspace } from '../utils/workspace.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IContentAngleService, ContentAngleContext } from '../content/angle.service.js';
import type { IScriptService } from '../content/script.service.js';
import type { ITtsService } from '../services/tts.service.js';
import type { IVideoPlanService, VideoPlanBuildInput } from '../content/video-plan.service.js';
import type { IStoryService } from '../content/story.service.js';
import type { TTSSectionTiming } from '../providers/tts/tts.types.js';
import type { TranscriptDocument } from '../types/transcript.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { AngleGenerationResult, ContentAngle } from '../types/angle.js';
import type { OriginalScript } from '../types/script.js';
import type { VideoPlan } from '../types/video-plan.js';
import type { TransformRequestInput } from '../schemas/transform.schema.js';
import type { RenderContext } from '../types/template.js';
import type { AssStyleConfig } from '../types/subtitle.js';
import type { ITemplateService } from '../template/template.service.js';
import type { ITemplateRendererService } from '../template/renderer.service.js';
import type { IAssService } from '../services/ass.service.js';
import type { ISubtitleService } from '../services/subtitle.service.js';
import type { ICompositionEngine, CompositionAssets } from '../composition/composition.types.js';
import type { ContentCache } from '../services/content-cache.service.js';
import type { ReelComposerService, ReelSegment, ReelSegmentSubtitle } from '../services/reel-composer.service.js';
import { planReelSegments } from '../utils/reel-plan.js';
import { hashSeed } from '../utils/seed.js';

export type TransformStage = 'download' | 'transcript' | 'angle' | 'story' | 'script' | 'tts' | 'plan' | 'render';

export interface TransformControllerDeps {
  youtubeService: IYoutubeService;
  transcriptService: ITranscriptService;
  whisperService: IWhisperService;
  contentAngleService: IContentAngleService;
  scriptService: IScriptService;
  ttsService: ITtsService;
  videoPlanService: IVideoPlanService;
  storyService: IStoryService;
  templateService: ITemplateService;
  templateRendererService: ITemplateRendererService;
  assService: IAssService;
  subtitleService: ISubtitleService;
  outputsDir: string;
  logger: Logger;
  assStyle: AssStyleConfig;
  compositionEngine: ICompositionEngine;
  /** Optional disk cache — regenerating the same video returns cached LLM stage outputs. */
  contentCache?: ContentCache;
  /**
   * Optional reel composer (flow redesign step 3, `outputMode: 'reel'`).
   * When absent, reel requests fail with a clear validation error instead of
   * silently falling back to the narration pipeline.
   */
  reelComposer?: ReelComposerService;
  /** Optional real-time progress callback — called before each pipeline stage starts. */
  onStage?: (stage: TransformStage, opts?: { skipped?: boolean }) => void;
}

/** Main entry point for `POST /api/transform`. */
export class TransformController {
  constructor(private readonly deps: TransformControllerDeps) {}

  /** Sends a progress event to the optional SSE callback. */
  private emit(stage: TransformStage, opts?: { skipped?: boolean }): void {
    this.deps.onStage?.(stage, opts);
  }

  async transform(request: TransformRequestInput): Promise<Record<string, unknown>> {
    const { logger, outputsDir } = this.deps;
    const jobId = crypto.randomUUID();
    logger.info({ jobId }, 'Transform started');

    let videoPath: string;
    let videoId: string;
    let transcript: TranscriptDocument | null = null;

    if (request.youtubeUrl) {
      const id = extractVideoIdFromUrl(request.youtubeUrl);
      if (!id) throw AppError.invalidUrl();
      videoId = id;

      const videoWorkspaceDir = join(outputsDir, videoId);
      const savedVideoPath = join(videoWorkspaceDir, 'downloads', `${videoId}.mp4`);
      const savedTranscriptPath = join(videoWorkspaceDir, 'transcripts', `${videoId}.json`);

      // Fast path: use existing files if available
      const hasVideo = await access(savedVideoPath).then(() => true).catch(() => false);
      const hasTranscript = await access(savedTranscriptPath).then(() => true).catch(() => false);

      if (hasVideo && hasTranscript) {
        logger.info({ videoId }, 'Using existing video and transcript from workspace');
        // Both stages already satisfied — tell the UI they're done (skipped).
        this.emit('download', { skipped: true });
        this.emit('transcript', { skipped: true });
        videoPath = savedVideoPath;
        // Also try loading from shared transcripts dir
        transcript = await this.deps.transcriptService.loadTranscript(videoId);
        if (!transcript) {
          // Fall back to per-video workspace transcript
          try {
            const { readFile } = await import('node:fs/promises');
            const raw = await readFile(savedTranscriptPath, 'utf-8');
            transcript = JSON.parse(raw) as TranscriptDocument;
          } catch {
            // Ignore — will throw missing transcript error later
          }
        }
      } else if (hasVideo && !hasTranscript) {
        logger.info({ videoId }, 'Using existing video — transcribing');
        this.emit('download', { skipped: true });
        videoPath = savedVideoPath;
        this.emit('transcript');
        const { createWhisperServiceWith } = await import('../container/index.js');
        const whisperService = request.sttProvider
          ? createWhisperServiceWith(request.sttProvider)
          : this.deps.whisperService;
        const job = await createJobWorkspace(this.deps.outputsDir, videoId);
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
      } else if (!hasVideo && hasTranscript) {
        logger.info({ videoId }, 'Using existing transcript — downloading video');
        this.emit('download');
        // Land the file in the per-video workspace (same fast-path location)
        // instead of the shared downloads dir.
        const job = await createJobWorkspace(outputsDir, videoId);
        const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, job);
        videoPath = download.videoPath;
        videoId = download.videoId;
        transcript = await this.deps.transcriptService.loadTranscript(videoId);
        this.emit('transcript', { skipped: true });
      } else {
        // Full pipeline: download + transcribe
        this.emit('download');
        // Same as above — per-video workspace keeps the file where the
        // hook pipeline and future re-runs expect it.
        const job = await createJobWorkspace(outputsDir, videoId);
        const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, job);
        videoPath = download.videoPath;
        videoId = download.videoId;

        transcript = await this.deps.transcriptService.loadTranscript(videoId);
        if (!transcript) {
          logger.info({ videoId }, 'No transcript found — extracting audio and transcribing');
          this.emit('transcript');
          const { createWhisperServiceWith } = await import('../container/index.js');
          const whisperService = request.sttProvider
            ? createWhisperServiceWith(request.sttProvider)
            : this.deps.whisperService;
          const job = await createJobWorkspace(this.deps.outputsDir, videoId);
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
        } else {
          this.emit('transcript', { skipped: true });
        }
      }
    } else {
      videoId = request.videoId!;
      // Re-transform by videoId: source video + transcript already on disk.
      this.emit('download', { skipped: true });
      this.emit('transcript', { skipped: true });
      transcript = await this.deps.transcriptService.loadTranscript(videoId);
      if (!transcript) throw AppError.missingSourceVideo(`No transcript for ${videoId}.`);
      videoPath = join(outputsDir, videoId, 'downloads', `${videoId}.mp4`);
    }

    // Guard: transcript must be available for subsequent stages
    if (!transcript) {
      throw AppError.missingSourceVideo(`No transcript found for ${videoId}.`);
    }

    // Feedback loop: when this run carries user-selected recommended clips,
    // append them to outputs/{videoId}/feedback/ so future ranking work can
    // learn from real selections. Fire-and-forget — never blocks/breaks.
    if (request.selectedClips?.length) {
      void import('../container/index.js').then(({ recordClipSelection }) =>
        recordClipSelection(videoId, request.selectedClips!),
      );
    }

    // ── Reel mode (flow redesign): direct concatenation of user-selected
    // clips with their original audio. No script, no TTS, no LLM stages —
    // every narration-mode behaviour below stays untouched.
    if (request.outputMode === 'reel') {
      return this.transformReel(request, { videoId, videoPath });
    }

    // Stage 1: Generate angles
    const selection = request.sourceRange
      ? this.selectRange(transcript, request.sourceRange.start, request.sourceRange.end)
      : this.selectMoment(transcript, request.candidateId);
    const clip = {
      start: selection.momentSegments[0]?.start ?? 0,
      end: selection.momentSegments.at(-1)?.end ?? 30,
      text: selection.momentSegments.map((segment) => segment.text).join(' '),
    };
    const angleContext: ContentAngleContext = {
      candidateId: `candidate_${request.candidateId}`,
      momentSegments: selection.momentSegments,
      contextSegments: selection.contextSegments,
      candidateTitle: 'Viral Moment',
      candidateHook: '',
      candidateReason: '',
      clipStart: clip.start,
      clipEnd: clip.end,
      sourceTitle: videoId,
      sourceChannel: '',
      sourceLanguage: transcript.language,
    };

    let angleResult: AngleGenerationResult;
    this.emit('angle');
    // The selected hook's source range changes the moment segments fed to the
    // angle/story stages — include it so cached outputs always match it.
    const rangeCacheKey = request.sourceRange
      ? `${request.sourceRange.start}-${request.sourceRange.end}`
      : undefined;
    const angleCacheKey = this.cacheKey('angle', videoId, request.candidateId, rangeCacheKey);
    const cachedAngle = await this.deps.contentCache?.get<AngleGenerationResult>(angleCacheKey);
    if (cachedAngle) {
      logger.info({ cache: 'angle', videoId, candidateId: request.candidateId }, 'Angle generation served from cache');
      angleResult = cachedAngle;
    } else {
      try {
        angleResult = await this.deps.contentAngleService.generateAngles(angleContext);
        await this.deps.contentCache?.set(angleCacheKey, angleResult);
      } catch (err) {
        logger.warn({ err }, 'Angle generation failed');
        angleResult = this.fallbackAngle(request.candidateId);
      }
    }

    const selectedAngle = angleResult.angles.find(
      (a) => a.id === request.selectedAngleId || a.id === angleResult.selectedAngleId,
    ) ?? angleResult.angles[0]!;

    let story: Awaited<ReturnType<IStoryService['buildStory']>> | undefined;
    this.emit('story');
    const storyCacheKey = this.cacheKey('story', videoId, request.candidateId, rangeCacheKey);
    const cachedStory = await this.deps.contentCache?.get<Awaited<ReturnType<IStoryService['buildStory']>>>(storyCacheKey);
    if (cachedStory) {
      logger.info({ cache: 'story', videoId, candidateId: request.candidateId }, 'Story planning served from cache');
      story = cachedStory;
    } else {
      try {
        // Pass both moment and context segments for better story analysis
        const storySegments = [
          ...angleContext.contextSegments,
          ...selection.momentSegments,
        ];
        story = await this.deps.storyService.buildStory(storySegments);
        logger.info({ concept: story.concept, beatCount: story.beats.length }, 'Source story selected');
        await this.deps.contentCache?.set(storyCacheKey, story);
      } catch (err) {
        // The existing source-grounded script path remains available when the
        // extra story-planning call is unavailable.
        logger.warn({ err }, 'Source story planning failed; using compatibility script mode');
      }
    }

    // Stage 2: Script
    let script: OriginalScript;
    this.emit('script');
    const scriptCacheKey = this.cacheKey(
      'script',
      videoId,
      request.candidateId,
      selectedAngle.id,
      request.customAngleTitle,
      request.customHook,
      request.language,
    );
    const cachedScript = await this.deps.contentCache?.get<OriginalScript>(scriptCacheKey);
    if (cachedScript) {
      logger.info({ cache: 'script', videoId, candidateId: request.candidateId }, 'Script generation served from cache');
      script = cachedScript;
    } else {
      try {
        const scriptContext = {
          candidateId: angleResult.candidateId,
          angleId: selectedAngle.id,
          angleTitle: request.customAngleTitle ?? selectedAngle.title,
          angleHook: request.customHook ?? selectedAngle.hook,
          angleReason: selectedAngle.reason,
          angleType: selectedAngle.angleType,
          fixedHook: request.customHook,
          momentSegments: angleContext.momentSegments,
          contextSegments: angleContext.contextSegments,
          story,
          candidateTitle: angleContext.candidateTitle,
          candidateHook: angleContext.candidateHook,
          sourceTitle: angleContext.sourceTitle,
          sourceChannel: angleContext.sourceChannel,
          sourceLanguage: angleContext.sourceLanguage,
          targetLanguage: request.language === 'auto' ? undefined : request.language,
        };
        script = await this.deps.scriptService.generateScript(scriptContext);
        await this.deps.contentCache?.set(scriptCacheKey, script);
      } catch (err) {
        logger.warn({ err }, 'Script generation failed');
        script = this.fallbackScript(selectedAngle, transcript.language);
      }
    }

    // Stage 3: TTS
    const workspaceDir = join(outputsDir, videoId, 'transform', jobId, 'voice');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(workspaceDir);

    // Use per-request TTS provider/voice when specified, otherwise fall back
    // to the env-configured default service. Voice↔language pairing is the
    // frontend's responsibility (it syncs the dropdown on change).
    const { createTtsServiceWith } = await import('../container/index.js');
    const ttsService = (request.ttsProvider && request.ttsVoice)
      ? createTtsServiceWith(request.ttsProvider, request.ttsVoice)
      : this.deps.ttsService;

    let ttsResult: { outputPath: string; durationSeconds: number; sections?: TTSSectionTiming[] };
    this.emit('tts');
    try {
      ttsResult = await ttsService.synthesizeScript(script, workspaceDir);
    } catch (err) {
      logger.warn({ err }, 'TTS failed');
      ttsResult = { outputPath: '', durationSeconds: script.estimatedDurationSeconds };
    }

    // Stage 4: Video Plan
    let videoPlan: VideoPlan;
    this.emit('plan');
    try {
      const planInput: VideoPlanBuildInput = {
        script,
        clipStart: angleContext.clipStart,
        clipEnd: angleContext.clipEnd,
        narrationPath: ttsResult.outputPath,
        narrationDurationSeconds: ttsResult.durationSeconds,
        ttsSections: ttsResult.sections,
        story,
        customHook: request.customHook,
      };
      videoPlan = await this.deps.videoPlanService.buildPlan(planInput);
    } catch (err) {
      logger.warn({ err }, 'Video plan failed');
      videoPlan = this.fallbackVideoPlan(script, ttsResult.outputPath);
    }

    // Dry-run mode
    if (request.dryRun) {
      return {
        success: true,
        jobId,
        videoId,
        candidateId: request.candidateId,
        angle: selectedAngle,
        story,
        storyApplied: story != null,
        script,
        narration: ttsResult,
        videoPlan,
        generatedAt: new Date().toISOString(),
        dryRun: true,
      };
    }

    // Stage 5: Render
    this.emit('render');
    logger.info({ videoId, jobId }, 'Rendering commentary video');
    // The chosen hook's range drives the footage: the fallback template path
    // trims the source video to it (the Remotion engine already gets the same
    // window through the plan's scene sources). Without a hook, keep the
    // legacy full-video behaviour untouched.
    const hookRange = request.sourceRange?.end && request.sourceRange.end > request.sourceRange.start
      ? { start: request.sourceRange.start, end: request.sourceRange.end }
      : undefined;
    const outputVideo = await this.renderVideo(
      videoPath, videoId, jobId, request.template ?? 'commentary', videoPlan, ttsResult, request.channel, request.hookBadge, transcript, hookRange,
    );

    return {
      success: true,
      jobId,
      videoId,
      candidateId: request.candidateId,
      angle: selectedAngle,
      story,
      // False when story planning failed and the plan fell back to equal
      // slicing — lets the UI explain a "genericer" result honestly.
      storyApplied: story != null,
      script,
      narration: {
        ...ttsResult,
        url: ttsResult.outputPath ? this.toMediaUrl(ttsResult.outputPath) : undefined,
      },
      videoPlan,
      outputVideo: {
        ...outputVideo,
        url: this.toMediaUrl(outputVideo.path),
      },
      generatedAt: new Date().toISOString(),
      dryRun: false,
    };
  }

  /**
   * Reel mode: joins the user-selected clip ranges back-to-back into one
   * vertical short with its original audio, then (optionally) burns source
   * subtitles per segment. Emits the standard stage events so the existing
   * UI progress bar keeps working.
   */
  private async transformReel(
    request: TransformRequestInput,
    resolved: { videoId: string; videoPath: string },
  ): Promise<Record<string, unknown>> {
    const { logger, outputsDir } = this.deps;
    const jobId = crypto.randomUUID();
    const { videoId, videoPath } = resolved;

    if (!request.selectedClips?.length) {
      throw AppError.validation('outputMode "reel" requires at least one selected clip.');
    }
    if (!this.deps.reelComposer) {
      throw AppError.internal('Reel composer is not configured on this server.');
    }

    const outputDir = join(outputsDir, videoId, 'transform', jobId, 'clips');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(outputDir);

    // Ordered, anti-repeat plan: the chosen hook opens the reel, then every
    // selected clip — with seconds the intro already plays trimmed/dropped so
    // nothing is ever repeated when joined. When the hook's styled final
    // intro file exists, it is used verbatim (WYSIWYG) and the anti-repeat
    // guard still applies to the clips that follow.
    const intro = request.sourceRange?.end && request.sourceRange.end > request.sourceRange.start
      ? { start: request.sourceRange.start, end: request.sourceRange.end }
      : undefined;
    let hookIntroFile: string | undefined;
    if (request.hookPreviewPath && request.hookPreviewPath.endsWith('.mp4')) {
      const { access } = await import('node:fs/promises');
      hookIntroFile = await access(request.hookPreviewPath)
        .then(() => request.hookPreviewPath)
        .catch(() => undefined);
    }
    const segments = planReelSegments({
      intro,
      clips: request.selectedClips.map((clip) => ({ start: clip.start, end: clip.end })),
    });
    if (segments.length === 0) {
      throw AppError.validation('All selected clips have an empty time range.');
    }
    // Swap the planned intro range for the styled file when available.
    const composeSegments: ReelSegment[] = hookIntroFile
      ? segments.map((segment) =>
          segment.kind === 'intro'
            ? { ...segment, filePath: hookIntroFile }
            : segment,
        )
      : segments;

    this.emit('angle', { skipped: true });
    this.emit('story', { skipped: true });

    const droppedCount = request.selectedClips.filter(
      (clip) => !segments.some((s) => s.kind === 'clip' && s.start === clip.start),
    ).length;
    logger.info(
      { jobId, videoId, hasIntro: Boolean(intro), introFromFile: Boolean(hookIntroFile), requestedClips: request.selectedClips.length, keptSegments: segments.length, droppedCount },
      'Rendering reel (hook intro + direct clip join)',
    );

    // Burn-in source subtitles per segment when a transcript exists: each
    // segment gets its own rebased ASS file so captions match the trimmed
    // playback (same mechanism the clip renderer uses). Pre-made file segments
    // (styled hook intro) already carry their own on-screen text — no burn-in.
    let subtitles: Array<ReelSegmentSubtitle | undefined> | undefined;
    const transcript = await this.loadTranscriptForVideoId(videoId);
    if (transcript && transcript.segments.length > 0) {
      const { writeFile } = await import('node:fs/promises');
      subtitles = await Promise.all(composeSegments.map(async (segment, index) => {
        if (segment.filePath) return undefined;
        const events = this.deps.subtitleService.buildEvents(transcript, segment.start, segment.end);
        const assPath = join(outputDir, `reel-sub-${String(index).padStart(3, '0')}.ass`);
        await writeFile(assPath, this.deps.assService.render(events, this.deps.assStyle), 'utf-8');
        return { assPath };
      }));
    }

    this.emit('script', { skipped: true });
    this.emit('tts', { skipped: true });
    this.emit('plan', { skipped: true });

    this.emit('render');
    const reel = await this.deps.reelComposer.compose({
      videoPath,
      segments: composeSegments,
      subtitles,
      outputDir,
      fileName: 'reel',
    });

    return {
      success: true,
      jobId,
      videoId,
      candidateId: request.candidateId,
      outputMode: 'reel' as const,
      reel: {
        clipCount: segments.length,
        segments,
        durationSeconds: reel.durationSeconds,
        sizeBytes: reel.sizeBytes,
      },
      outputVideo: {
        path: reel.path,
        url: this.toMediaUrl(reel.path),
        durationSeconds: reel.durationSeconds,
        sizeBytes: reel.sizeBytes,
        width: 1080,
        height: 1920,
      },
      generatedAt: new Date().toISOString(),
      dryRun: false,
    };
  }

  /** Loads the per-video transcript (workspace first, shared dir second). */
  private async loadTranscriptForVideoId(videoId: string): Promise<TranscriptDocument | null> {
    try {
      const workspacePath = join(this.deps.outputsDir, videoId, 'transcripts', `${videoId}.json`);
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(workspacePath, 'utf-8');
      return JSON.parse(raw) as TranscriptDocument;
    } catch {
      return this.deps.transcriptService.loadTranscript(videoId);
    }
  }

  private async renderVideo(
    videoPath: string,
    videoId: string,
    jobId: string,
    templateId: string,
    videoPlan: VideoPlan,
    ttsResult: { outputPath: string; durationSeconds: number },
    channel: TransformRequestInput['channel'],
    hookBadge: string | undefined,
    transcript?: TranscriptDocument | null,
    /** The chosen hook's source range — drives the fallback path's footage trim. */
    hookRange?: { start: number; end: number },
  ): Promise<{ path: string; durationSeconds: number; sizeBytes: number; width: number; height: number }> {
    const outputDir = join(this.deps.outputsDir, videoId, 'transform', jobId, 'clips');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(outputDir);

    const outputPath = join(outputDir, 'transformed.mp4');

    // Build RenderContext with commentary text (kept for engine selection)
    const commentaryText = videoPlan.scenes
      .filter((s) => s.type === 'commentary')
      .map((s) => s.narration)
      .join(' ');

    // Build composition assets
    const assets: CompositionAssets = {
      sourceVideo: videoPath,
      narration: ttsResult.outputPath,
      channelName: channel?.name,
      hookBadge,
      videoId,
      style: this.toCompositionStyle(templateId),
      templateId,
    };

    try {
      // Try composition engine (Remotion or FFmpeg template)
      const result = await this.deps.compositionEngine.render(videoPlan, assets);
      return {
        path: result.path,
        durationSeconds: result.durationSeconds ?? 0,
        sizeBytes: result.sizeBytes ?? 0,
        width: 1080,
        height: 1920,
      };
    } catch (engineError) {
      this.deps.logger.warn({ error: engineError }, 'Composition engine failed, falling back to direct template render');
      // Fallback: direct template render (existing behavior)
      // Generate ASS subtitles from transcript into the output workspace.
      const assPath = join(outputDir, 'subtitles.ass');
      const context: RenderContext = {
        clip: { title: 'AI Commentary', score: 99, duration: videoPlan.duration, start: 0, end: videoPlan.duration },
        video: {
          path: videoPath,
          // Trim to the chosen hook's range so the footage opens on the
          // selected moment (legacy behaviour — second 0 — when absent).
          ...(hookRange ? { sourceTrim: hookRange } : {}),
        },
        subtitle: { ass: assPath, words: [] },
        channel,
        commentary: { text: commentaryText },
      };

      if (transcript && transcript.segments.length > 0) {
        const events = this.deps.subtitleService.buildEvents(transcript, 0, videoPlan.duration);
        context.subtitle = { ass: assPath, words: events };
      }

      try {
        const loaded = await this.deps.templateService.load(templateId);
        const enriched = await this.deps.templateService.resolveLayers(loaded, context);
        await this.deps.templateRendererService.compose({
          context,
          enrichedLayers: enriched,
          canvas: loaded.template.canvas,
          templateDir: loaded.templateDir,
          assPath,
          outputPath,
          hints: { sourceWidth: 1920, sourceHeight: 1080, focalPoint: { x: 0.5, y: 0.5 } },
          logger: this.deps.logger,
        });
      } catch (error) {
        this.deps.logger.warn({ error }, 'Template render failed');
        // Fallback to simple FFmpeg trim
        await this.renderFallback(videoPath, outputPath, videoPlan.duration, ttsResult.outputPath || undefined);
      }
    }

    const stats = await stat(outputPath);
    const durationSeconds = await probeDurationSeconds({ binaryPath: 'ffmpeg', inputPath: outputPath });

    return { path: outputPath, durationSeconds, sizeBytes: stats.size, width: 1080, height: 1920 };
  }

  private async renderFallback(input: string, output: string, duration: number, narrationPath?: string): Promise<void> {
    const { runCommand } = await import('../utils/exec.js');
    if (narrationPath) {
      await runCommand('ffmpeg', [
        '-y',
        '-i', input,
        '-i', narrationPath,
        '-t', String(duration),
        '-filter_complex',
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v];[1:a]apad=whole_dur=' + duration + '[a]',
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k',
        output,
      ]);
    } else {
      await runCommand('ffmpeg', [
        '-y', '-i', input,
        '-t', String(duration),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-an',
        output,
      ]);
    }
  }

  private fallbackAngle(candidateId: number): AngleGenerationResult {
    return {
      candidateId: `candidate_${candidateId}`,
      angles: [{ id: 'fallback', title: 'Editorial', angleType: 'commentary', hook: '...', reason: 'fallback', score: 50 }],
      selectedAngleId: 'fallback',
    };
  }

  private fallbackScript(angle: ContentAngle, language: string): OriginalScript {
    return {
      candidateId: '', angleId: angle.id, angleTitle: angle.title, language,
      sections: [
        { type: 'hook', text: angle.hook },
        { type: 'commentary', text: angle.reason },
        { type: 'conclusion', text: 'Tuntas.' },
      ],
      originality: { status: 'WARNING', notes: ['fallback'] },
      estimatedDurationSeconds: 30,
    };
  }

  private fallbackVideoPlan(script: OriginalScript, narrationPath: string): VideoPlan {
    const sections = script.sections.filter((section) => section.text.trim());
    const duration = Math.max(1, script.estimatedDurationSeconds);
    const perScene = duration / Math.max(1, sections.length);
    return {
      candidateId: script.candidateId, angleId: script.angleId,
      duration,
      scenes: sections.map((s, index) => ({
        type: s.type,
        start: Number((index * perScene).toFixed(2)),
        end: Number(((index + 1) * perScene).toFixed(2)),
        narration: s.text,
        visual: s.type === 'hook' || s.type === 'conclusion' ? 'graphic' : 'speaker',
      })),
      captions: [],
      audio: { narration: narrationPath, sourceUnderlay: true, ducking: true },
    };
  }

  private toCompositionStyle(templateId: string): CompositionAssets['style'] {
    return templateId === 'sports' || templateId === 'interview' ? templateId : 'commentary';
  }

  /**
   * Builds a usable source moment around the chosen transcript segment. A
   * single Whisper segment is commonly only 2–6 seconds long, which made
   * every planned scene reuse the same few frames.
   */
  private selectMoment(transcript: TranscriptDocument, candidateId: number): {
    momentSegments: TranscriptSegment[];
    contextSegments: TranscriptSegment[];
  } {
    const segments = transcript.segments;
    const firstIndex = Math.min(candidateId, Math.max(0, segments.length - 1));
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

  /**
   * Selects the transcript segments overlapping an explicit source range
   * (from a recommended hook), plus a small context window around it.
   */
  private selectRange(
    transcript: TranscriptDocument,
    start: number,
    end: number,
  ): {
    momentSegments: TranscriptSegment[];
    contextSegments: TranscriptSegment[];
  } {
    const segments = transcript.segments;
    let firstIndex = -1;
    let lastIndex = -1;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      if (segment.end < start) continue;
      if (segment.start > end) break;
      if (firstIndex === -1) firstIndex = index;
      lastIndex = index;
    }
    if (firstIndex === -1) {
      return { momentSegments: [], contextSegments: [] };
    }
    return {
      momentSegments: segments.slice(firstIndex, lastIndex + 1),
      contextSegments: [
        ...segments.slice(Math.max(0, firstIndex - 2), firstIndex),
        ...segments.slice(lastIndex + 1, lastIndex + 3),
      ],
    };
  }

  /** Maps an output file to the narrowly-scoped media endpoint used by the UI. */
  private toMediaUrl(path: string): string {
    const relativePath = relative(this.deps.outputsDir, path);
    const safePath = relativePath.split(sep).map(encodeURIComponent).join('/');
    return `/api/media/${safePath}`;
  }

  /** Stable cache key (hex hash) from content identifiers — safe as a filename. */
  private cacheKey(...parts: (string | number | undefined)[]): string {
    return hashSeed(...parts).toString(16);
  }
}
