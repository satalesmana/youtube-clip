import type { IYoutubeService } from '../services/youtube.service.js';
import type { ITranscriptService } from '../services/transcript.service.js';
import type { IWhisperService } from '../services/whisper.service.js';
import { join, relative, sep } from 'node:path';
import { stat } from 'node:fs/promises';
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
}

/** Main entry point for `POST /api/transform`. */
export class TransformController {
  constructor(private readonly deps: TransformControllerDeps) {}

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

      // Download video if not already present
      const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl);
      videoPath = download.videoPath;
      videoId = download.videoId;

      // Load or transcribe
      transcript = await this.deps.transcriptService.loadTranscript(videoId);
      if (!transcript) {
        logger.info({ videoId }, 'No transcript found — extracting audio and transcribing');
        const job = await createJobWorkspace(this.deps.outputsDir, videoId);
        const audio = await this.deps.transcriptService.extractAudio(videoPath, videoId, job);
        const whisperResult = await this.deps.whisperService.transcribe(audio.audioPath, job);
        const transcriptDoc: TranscriptDocument = {
          ...whisperResult,
          videoId,
          sourceUrl: request.youtubeUrl,
          createdAt: new Date().toISOString(),
        };
        await this.deps.transcriptService.saveTranscript(transcriptDoc, job);
        transcript = transcriptDoc;
      }
    } else {
      videoId = request.videoId!;
      transcript = await this.deps.transcriptService.loadTranscript(videoId);
      if (!transcript) throw AppError.missingSourceVideo(`No transcript for ${videoId}.`);
      videoPath = join(outputsDir, videoId, 'downloads', `${videoId}.mp4`);
    }

    // Stage 1: Generate angles
    const selection = this.selectMoment(transcript, request.candidateId);
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
    try {
      angleResult = await this.deps.contentAngleService.generateAngles(angleContext);
    } catch (err) {
      logger.warn({ err }, 'Angle generation failed');
      angleResult = this.fallbackAngle(request.candidateId);
    }

    const selectedAngle = angleResult.angles.find(
      (a) => a.id === request.selectedAngleId || a.id === angleResult.selectedAngleId,
    ) ?? angleResult.angles[0]!;

    let story: Awaited<ReturnType<IStoryService['buildStory']>> | undefined;
    try {
      // Pass both moment and context segments for better story analysis
      const storySegments = [
        ...angleContext.contextSegments,
        ...selection.momentSegments,
      ];
      story = await this.deps.storyService.buildStory(storySegments);
      logger.info({ concept: story.concept, beatCount: story.beats.length }, 'Source story selected');
    } catch (err) {
      // The existing source-grounded script path remains available when the
      // extra story-planning call is unavailable.
      logger.warn({ err }, 'Source story planning failed; using compatibility script mode');
    }

    // Stage 2: Script
    let script: OriginalScript;
    try {
      const scriptContext = {
        candidateId: angleResult.candidateId,
        angleId: selectedAngle.id,
        angleTitle: request.customAngleTitle ?? selectedAngle.title,
        angleHook: request.customHook ?? selectedAngle.hook,
        angleReason: selectedAngle.reason,
        angleType: selectedAngle.angleType,
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
    } catch (err) {
      logger.warn({ err }, 'Script generation failed');
      script = this.fallbackScript(selectedAngle, transcript.language);
    }

    // Stage 3: TTS
    const workspaceDir = join(outputsDir, videoId, 'transform', jobId, 'voice');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(workspaceDir);

    let ttsResult: { outputPath: string; durationSeconds: number };
    try {
      ttsResult = await this.deps.ttsService.synthesizeScript(script, workspaceDir);
    } catch (err) {
      logger.warn({ err }, 'TTS failed');
      ttsResult = { outputPath: '', durationSeconds: script.estimatedDurationSeconds };
    }

    // Stage 4: Video Plan
    let videoPlan: VideoPlan;
    try {
      const planInput: VideoPlanBuildInput = {
        script,
        clipStart: angleContext.clipStart,
        clipEnd: angleContext.clipEnd,
        narrationPath: ttsResult.outputPath,
        narrationDurationSeconds: ttsResult.durationSeconds,
        story,
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
        script,
        narration: ttsResult,
        videoPlan,
        generatedAt: new Date().toISOString(),
        dryRun: true,
      };
    }

    // Stage 5: Render
    logger.info({ videoId, jobId }, 'Rendering commentary video');
    const outputVideo = await this.renderVideo(
      videoPath, videoId, jobId, request.template ?? 'commentary', videoPlan, ttsResult, request.channel, transcript,
    );

    return {
      success: true,
      jobId,
      videoId,
      candidateId: request.candidateId,
      angle: selectedAngle,
      story,
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

  private async renderVideo(
    videoPath: string,
    videoId: string,
    jobId: string,
    templateId: string,
    videoPlan: VideoPlan,
    ttsResult: { outputPath: string; durationSeconds: number },
    channel: TransformRequestInput['channel'],
    transcript?: TranscriptDocument | null,
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
      const context: RenderContext = {
        clip: { title: 'AI Commentary', score: 99, duration: videoPlan.duration, start: 0, end: videoPlan.duration },
        video: { path: videoPath },
        subtitle: { ass: '', words: [] },
        channel,
        commentary: { text: commentaryText },
      };

      // Generate ASS subtitles from transcript
      if (transcript && transcript.segments.length > 0) {
        const events = this.deps.subtitleService.buildEvents(transcript, 0, videoPlan.duration);
        const assContent = this.deps.assService.render(events, this.deps.assStyle);
        context.subtitle = { ass: assContent, words: events };
      }

      try {
        const loaded = await this.deps.templateService.load(templateId);
        const enriched = await this.deps.templateService.resolveLayers(loaded, context);
        await this.deps.templateRendererService.compose({
          context,
          enrichedLayers: enriched,
          canvas: loaded.template.canvas,
          templateDir: loaded.templateDir,
          assPath: '',
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

  /** Maps an output file to the narrowly-scoped media endpoint used by the UI. */
  private toMediaUrl(path: string): string {
    const relativePath = relative(this.deps.outputsDir, path);
    const safePath = relativePath.split(sep).map(encodeURIComponent).join('/');
    return `/api/media/${safePath}`;
  }
}
