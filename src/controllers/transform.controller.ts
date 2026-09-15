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
import type { ScriptDraftRequestInput, TtsSynthesizeRequestInput } from '../schemas/script.schema.js';
import type { RenderContext } from '../types/template.js';
import type { AssStyleConfig } from '../types/subtitle.js';
import type { ITemplateService } from '../template/template.service.js';
import type { ITemplateRendererService } from '../template/renderer.service.js';
import type { IAssService } from '../services/ass.service.js';
import type { ISubtitleService } from '../services/subtitle.service.js';
import type { ICompositionEngine, CompositionAssets } from '../composition/composition.types.js';
import type { ContentCache } from '../services/content-cache.service.js';
import type { ReelComposerService, ReelSegment, ReelSegmentSubtitle } from '../services/reel-composer.service.js';
import type { IWatermarkFilterService } from '../services/watermark-filter.service.js';
import type { ICaptionService } from '../content/caption.service.js';
import type { IStyledHookPreview } from '../hook-preview/styled-hook-preview.service.js';
import type { VideoCaptionResult, SocialPlatform } from '../types/caption.js';
import { planReelSegments } from '../utils/reel-plan.js';
import { hashSeed } from '../utils/seed.js';
import { normalizeForSpeech } from '../utils/speech-normalizer.js';
import { resolveAudioMode } from '../types/audio-mode.js';
import { resolveSubtitleStyle } from '../types/subtitle-style.presets.js';

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
   * Optional watermark filter service for blurring detected watermarks in source video.
   */
  watermarkFilterService?: IWatermarkFilterService;
  /**
   * Optional reel composer (flow redesign step 3, `outputMode: 'reel'`).
   * When absent, reel requests fail with a clear validation error instead of
   * silently falling back to the narration pipeline.
   */
  reelComposer?: ReelComposerService;
  /**
   * Optional caption service for generating platform-tailored viral social captions.
   */
  captionService?: ICaptionService;
  /**
   * Optional styled hook renderer for rendering kinetic typography hook intro during Step 3.
   */
  styledHookPreviewService?: IStyledHookPreview;
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

  /** Resolves video file and transcript document with fast-path reuse. */
  private async resolveTranscriptAndVideo(request: {
    youtubeUrl?: string;
    videoId?: string;
    sttProvider?: 'faster-whisper' | 'whisper-cpp' | 'whisperx' | 'openai';
  }): Promise<{ videoId: string; videoPath: string; transcript: TranscriptDocument }> {
    const { logger, outputsDir } = this.deps;
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
        this.emit('download', { skipped: true });
        this.emit('transcript', { skipped: true });
        videoPath = savedVideoPath;
        transcript = await this.deps.transcriptService.loadTranscript(videoId);
        if (!transcript) {
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
        const job = await createJobWorkspace(outputsDir, videoId);
        const download = await this.deps.youtubeService.downloadVideo(request.youtubeUrl, job);
        videoPath = download.videoPath;
        videoId = download.videoId;
        transcript = await this.deps.transcriptService.loadTranscript(videoId);
        this.emit('transcript', { skipped: true });
      } else {
        this.emit('download');
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
          const jobWorkspace = await createJobWorkspace(this.deps.outputsDir, videoId);
          const audio = await this.deps.transcriptService.extractAudio(videoPath, videoId, jobWorkspace);
          const whisperResult = await whisperService.transcribe(audio.audioPath, jobWorkspace);
          const transcriptDoc: TranscriptDocument = {
            ...whisperResult,
            videoId,
            sourceUrl: request.youtubeUrl,
            createdAt: new Date().toISOString(),
          };
          await this.deps.transcriptService.saveTranscript(transcriptDoc, jobWorkspace);
          transcript = transcriptDoc;
        } else {
          this.emit('transcript', { skipped: true });
        }
      }
    } else {
      videoId = request.videoId!;
      this.emit('download', { skipped: true });
      videoPath = join(outputsDir, videoId, 'downloads', `${videoId}.mp4`);
      transcript = await this.loadTranscriptForVideoId(videoId);
      if (!transcript) {
        const hasVideo = await access(videoPath).then(() => true).catch(() => false);
        if (hasVideo) {
          logger.info({ videoId }, 'Video found in workspace but transcript missing — transcribing');
          this.emit('transcript');
          const { createWhisperServiceWith } = await import('../container/index.js');
          const whisperService = request.sttProvider
            ? createWhisperServiceWith(request.sttProvider)
            : this.deps.whisperService;
          const jobWorkspace = await createJobWorkspace(this.deps.outputsDir, videoId);
          const audio = await this.deps.transcriptService.extractAudio(videoPath, videoId, jobWorkspace);
          const whisperResult = await whisperService.transcribe(audio.audioPath, jobWorkspace);
          const transcriptDoc: TranscriptDocument = {
            ...whisperResult,
            videoId,
            sourceUrl: request.youtubeUrl ?? `https://www.youtube.com/watch?v=${videoId}`,
            createdAt: new Date().toISOString(),
          };
          await this.deps.transcriptService.saveTranscript(transcriptDoc, jobWorkspace);
          transcript = transcriptDoc;
        } else {
          throw AppError.missingSourceVideo(`No transcript for ${videoId}.`);
        }
      } else {
        this.emit('transcript', { skipped: true });
      }
    }

    if (!transcript) {
      throw AppError.missingSourceVideo(`No transcript found for ${videoId}.`);
    }

    return { videoId, videoPath, transcript };
  }

  /**
   * Generates an original script draft WITHOUT running TTS or video rendering.
   * Enables human-in-the-loop review and saves TTS API credits.
   */
  async draftScript(request: ScriptDraftRequestInput): Promise<Record<string, unknown>> {
    const { logger } = this.deps;
    const { videoId, transcript } = await this.resolveTranscriptAndVideo(request);

    // Fast path: return previously saved script draft from disk unless refresh is requested
    if (!request.refresh) {
      const saved = await this.loadSavedScript(videoId);
      if (saved && saved.script) {
        logger.info({ videoId }, 'Returning saved script draft from disk cache');
        return saved;
      }
    }

    const selection = request.selectedClips?.length
      ? this.selectClips(transcript, request.selectedClips)
      : request.sourceRange
      ? this.selectRange(transcript, request.sourceRange.start, request.sourceRange.end)
      : this.selectMoment(transcript, request.candidateId);

    const clip = {
      start: selection.momentSegments[0]?.start ?? 0,
      end: selection.momentSegments.at(-1)?.end ?? 30,
      text: selection.momentSegments.map((segment) => segment.text).join(' '),
    };
    const targetLang = request.language === 'auto' || !request.language
      ? transcript.language
      : request.language;

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
      sourceLanguage: targetLang,
      genre: request.genre,
      customPrompt: request.customPrompt,
      selectedClips: request.selectedClips,
    };

    let angleResult: AngleGenerationResult;
    this.emit('angle');
    const rangeCacheKey = request.selectedClips?.length
      ? request.selectedClips.map((c) => `${c.start}-${c.end}`).join(';')
      : request.sourceRange
      ? `${request.sourceRange.start}-${request.sourceRange.end}`
      : undefined;
    const angleCacheKey = this.cacheKey('angle', videoId, request.candidateId, rangeCacheKey, request.genre, targetLang, request.customPrompt);
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
    const storyCacheKey = this.cacheKey('story', videoId, request.candidateId, rangeCacheKey, request.genre, request.customPrompt);
    const cachedStory = await this.deps.contentCache?.get<Awaited<ReturnType<IStoryService['buildStory']>>>(storyCacheKey);
    if (cachedStory) {
      logger.info({ cache: 'story', videoId, candidateId: request.candidateId }, 'Story planning served from cache');
      story = cachedStory;
    } else {
      try {
        const storySegments = [
          ...angleContext.contextSegments,
          ...selection.momentSegments,
        ];
        story = await this.deps.storyService.buildStory(storySegments, request.genre, request.customPrompt);
        logger.info({ concept: story.concept, beatCount: story.beats.length }, 'Source story selected');
        await this.deps.contentCache?.set(storyCacheKey, story);
      } catch (err) {
        logger.warn({ err }, 'Source story planning failed; using compatibility script mode');
      }
    }

    let script: OriginalScript;
    this.emit('script');
    const targetDurationSeconds = this.resolveTargetDurationSeconds(request, clip);
    const scriptCacheKey = this.cacheKey(
      'script',
      videoId,
      request.candidateId,
      selectedAngle.id,
      request.customAngleTitle,
      request.customHook,
      request.language,
      request.genre,
      rangeCacheKey,
      request.customPrompt,
      targetDurationSeconds ? `dur_${targetDurationSeconds}` : undefined,
    );
    let isServedFromCache = false;
    const cachedScript = !request.refresh
      ? await this.deps.contentCache?.get<OriginalScript>(scriptCacheKey)
      : undefined;
    if (cachedScript) {
      logger.info({ cache: 'script', videoId, candidateId: request.candidateId }, 'Script generation served from cache');
      script = cachedScript;
      isServedFromCache = true;
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
          genre: request.genre,
          customPrompt: request.customPrompt,
          selectedClips: request.selectedClips,
          targetDurationSeconds,
        };
        script = await this.deps.scriptService.generateScript(scriptContext);
        await this.deps.contentCache?.set(scriptCacheKey, script);
      } catch (err) {
        logger.error({ err, targetLang }, 'Script generation failed — using emergency fallback script');
        script = this.fallbackScript(selectedAngle, targetLang, request.customHook);
      }
    }

    if (script?.sections) {
      for (const section of script.sections) {
        if (!section.spokenText || !section.spokenText.trim()) {
          section.spokenText = normalizeForSpeech(section.text, script.language);
        }
      }
    }

    const returnedAngle = {
      ...selectedAngle,
      ...(request.hookTitle ? { hook: request.hookTitle } : {}),
      ...(request.customAngleTitle ? { title: request.customAngleTitle } : {}),
    };

    const draftResult = {
      candidateId: request.candidateId,
      angle: returnedAngle,
      story,
      storyApplied: story != null,
      script,
      language: targetLang,
      savedAt: new Date().toISOString(),
    };
    await this.saveScriptDraft(videoId, draftResult);

    return {
      success: true,
      videoId,
      candidateId: request.candidateId,
      angle: returnedAngle,
      story,
      storyApplied: story != null,
      script,
      cached: isServedFromCache,
    };
  }

  /**
   * On-demand TTS synthesis for a given custom or reviewed script.
   * Generates MP3 narration audio without running video rendering.
   */
  async synthesizeTts(request: TtsSynthesizeRequestInput): Promise<Record<string, unknown>> {
    const { logger, outputsDir } = this.deps;
    const jobId = crypto.randomUUID();
    let videoId: string;
    if (request.youtubeUrl) {
      const id = extractVideoIdFromUrl(request.youtubeUrl);
      if (!id) throw AppError.invalidUrl();
      videoId = id;
    } else {
      videoId = request.videoId!;
    }

    const workspaceDir = join(outputsDir, videoId, 'transform', jobId, 'voice');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(workspaceDir);

    const { createTtsServiceWith, resolveTtsProviderKind } = await import('../container/index.js');
    const { env } = await import('../config/env.js');

    const effectiveVoice = request.ttsVoice?.trim() || env.TTS_VOICE;
    const effectiveProvider = resolveTtsProviderKind(request.ttsProvider, effectiveVoice);
    const effectiveRate = request.ttsRate ?? env.TTS_RATE;

    const hasTtsOverride = Boolean(request.ttsProvider || request.ttsVoice?.trim() || request.ttsRate);
    const ttsService = hasTtsOverride
      ? createTtsServiceWith(effectiveProvider, effectiveVoice, effectiveRate)
      : this.deps.ttsService;

    const lang = request.customScript.language ?? 'id';
    const customSections = request.customScript.sections.map((s) => ({
      type: s.type,
      text: s.text.trim(),
      spokenText: s.spokenText?.trim() ? s.spokenText.trim() : normalizeForSpeech(s.text.trim(), lang),
      sourceQuote: s.sourceQuote,
      evidence: s.evidence,
      beatId: s.beatId,
    }));
    const totalWords = customSections.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
    const estDuration = Math.max(10, Math.round(totalWords / 2.5));

    const script: OriginalScript = {
      candidateId: 'candidate_0',
      angleId: 'custom_angle',
      angleTitle: 'Custom Script',
      language: request.customScript.language ?? 'id',
      estimatedDurationSeconds: estDuration,
      sections: customSections,
      originality: {
        status: 'PASS',
        notes: ['Naskah narasi disintesis on-demand'],
      },
    };

    const ttsCacheKey = this.cacheKey(
      'tts',
      videoId,
      effectiveProvider,
      effectiveVoice,
      effectiveRate,
      script.language,
      ...script.sections.map((s) => `${s.type}:${s.spokenText || s.text}`),
    );

    let ttsResult: { outputPath: string; durationSeconds: number; sections?: TTSSectionTiming[] };
    const { existsSync } = await import('node:fs');
    const cachedTts = await this.deps.contentCache?.get<{
      outputPath: string;
      durationSeconds: number;
      sections?: TTSSectionTiming[];
    }>(ttsCacheKey);

    if (cachedTts?.outputPath && existsSync(cachedTts.outputPath)) {
      logger.info({ cache: 'tts', path: cachedTts.outputPath }, 'synthesizeTts served from cache');
      ttsResult = cachedTts;
    } else {
      this.emit('tts');
      try {
        ttsResult = await ttsService.synthesizeScript(script, workspaceDir);
        await this.deps.contentCache?.set(ttsCacheKey, ttsResult);
      } catch (err) {
        logger.error({ err }, 'TTS synthesis failed');
        throw AppError.internal('Gagal melakukan sintesis audio TTS: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    const mediaUrl = ttsResult.outputPath ? this.toMediaUrl(ttsResult.outputPath) : undefined;

    return {
      success: true,
      jobId,
      videoId,
      audioUrl: mediaUrl,
      audioPath: ttsResult.outputPath,
      durationSeconds: ttsResult.durationSeconds,
      narration: {
        ...ttsResult,
        url: mediaUrl,
      },
    };
  }

  async transform(request: TransformRequestInput): Promise<Record<string, unknown>> {
    const { logger, outputsDir } = this.deps;
    const jobId = crypto.randomUUID();
    logger.info({ jobId }, 'Transform started');

    const { videoId, videoPath, transcript } = await this.resolveTranscriptAndVideo(request);

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
    const selection = request.selectedClips?.length
      ? this.selectClips(transcript, request.selectedClips)
      : request.sourceRange
      ? this.selectRange(transcript, request.sourceRange.start, request.sourceRange.end)
      : this.selectMoment(transcript, request.candidateId);
    const clip = {
      start: selection.momentSegments[0]?.start ?? 0,
      end: selection.momentSegments.at(-1)?.end ?? 30,
      text: selection.momentSegments.map((segment) => segment.text).join(' '),
    };
    const targetLang = request.language === 'auto' || !request.language
      ? transcript.language
      : request.language;

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
      sourceLanguage: targetLang,
      genre: request.genre,
      customPrompt: request.customPrompt,
      selectedClips: request.selectedClips,
    };

    let angleResult: AngleGenerationResult;
    this.emit('angle');
    // The selected hook's source range or multi-clip selection changes the moment
    // segments fed to the angle/story stages — include it so cached outputs match.
    const rangeCacheKey = request.selectedClips?.length
      ? request.selectedClips.map((c) => `${c.start}-${c.end}`).join(';')
      : request.sourceRange
      ? `${request.sourceRange.start}-${request.sourceRange.end}`
      : undefined;
    const angleCacheKey = this.cacheKey('angle', videoId, request.candidateId, rangeCacheKey, request.genre, targetLang, request.customPrompt);
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
    const storyCacheKey = this.cacheKey('story', videoId, request.candidateId, rangeCacheKey, request.genre, request.customPrompt);
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
        story = await this.deps.storyService.buildStory(storySegments, request.genre, request.customPrompt);
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

    if (request.customScript?.sections?.length) {
      logger.info({ sectionCount: request.customScript.sections.length }, 'Using user-provided custom narration script');
      const lang = request.customScript.language ?? targetLang;
      const customSections = request.customScript.sections.map((s) => ({
        type: s.type,
        text: s.text.trim(),
        spokenText: s.spokenText?.trim() ? s.spokenText.trim() : normalizeForSpeech(s.text.trim(), lang),
        sourceQuote: s.sourceQuote,
        evidence: s.evidence,
        beatId: s.beatId,
      }));
      const totalWords = customSections.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
      const estDuration = Math.max(10, Math.round(totalWords / 2.5));

      script = {
        candidateId: `candidate_${request.candidateId}`,
        angleId: selectedAngle.id,
        angleTitle: request.customAngleTitle ?? selectedAngle.title,
        language: request.customScript.language ?? targetLang,
        estimatedDurationSeconds: estDuration,
        sections: customSections,
        originality: {
          status: 'PASS',
          notes: ['Naskah narasi dikustomisasi oleh pengguna sebelum render'],
        },
      };
    } else {
      const targetDurationSeconds = this.resolveTargetDurationSeconds(request, clip);
      const scriptCacheKey = this.cacheKey(
        'script',
        videoId,
        request.candidateId,
        selectedAngle.id,
        request.customAngleTitle,
        request.customHook,
        request.language,
        request.genre,
        rangeCacheKey,
        request.customPrompt,
        targetDurationSeconds ? `dur_${targetDurationSeconds}` : undefined,
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
            genre: request.genre,
            customPrompt: request.customPrompt,
            selectedClips: request.selectedClips,
            targetDurationSeconds,
            audioMode: resolveAudioMode(request.audioMode, request.genre),
          };
          script = await this.deps.scriptService.generateScript(scriptContext);
          await this.deps.contentCache?.set(scriptCacheKey, script);
        } catch (err) {
          logger.error({ err, targetLang }, 'Script generation failed — using emergency fallback script');
          script = this.fallbackScript(selectedAngle, targetLang, request.customHook);
        }
      }
    }

    // Stage 3: TTS
    // Resolve the effective audio mode (respects genre defaults).
    const audioMode = resolveAudioMode(request.audioMode, request.genre);

    // When audioMode is 'keep_original', TTS synthesis is intentionally
    // skipped — the LLM script is used for subtitles/captions only, and the
    // source video's original audio track is preserved during rendering.
    const workspaceDir = join(outputsDir, videoId, 'transform', jobId, 'voice');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(workspaceDir);

    let ttsResult: { outputPath: string; durationSeconds: number; sections?: TTSSectionTiming[] };
    const { existsSync } = await import('node:fs');

    if (audioMode === 'keep_original') {
      logger.info({ audioMode, genre: request.genre }, 'Skipping TTS synthesis — audioMode is keep_original');
      // Use clip duration as narration duration so the video plan can still
      // calculate scene timings for subtitle placement.
      const clipDuration = (clip.end - clip.start) > 0 ? clip.end - clip.start : script.estimatedDurationSeconds;
      ttsResult = { outputPath: '', durationSeconds: clipDuration, sections: [] };
      this.emit('tts', { skipped: true });
    } else if (
      request.existingNarration?.outputPath &&
      existsSync(request.existingNarration.outputPath)
    ) {
      logger.info(
        { path: request.existingNarration.outputPath },
        'Using caller-supplied pre-synthesized narration (skipping TTS)',
      );
      ttsResult = {
        outputPath: request.existingNarration.outputPath,
        durationSeconds: request.existingNarration.durationSeconds,
        sections: request.existingNarration.sections,
      };
      this.emit('tts', { skipped: true });

      // Use per-request TTS provider/voice when specified, otherwise fall back
      // to the env-configured default service.
      const { createTtsServiceWith, resolveTtsProviderKind } = await import('../container/index.js');
      const { env } = await import('../config/env.js');

      const effectiveVoice = request.ttsVoice?.trim() || env.TTS_VOICE;
      const effectiveProvider = resolveTtsProviderKind(request.ttsProvider, effectiveVoice);
      const effectiveRate = request.ttsRate ?? env.TTS_RATE;

      const ttsCacheKey = this.cacheKey(
        'tts', videoId, effectiveProvider, effectiveVoice, effectiveRate,
        script.language, ...script.sections.map((s) => `${s.type}:${s.spokenText || s.text}`),
      );
      await this.deps.contentCache?.set(ttsCacheKey, ttsResult);
    } else {
      // Use per-request TTS provider/voice when specified, otherwise fall back
      // to the env-configured default service. Voice↔language pairing is the
      // frontend's responsibility (it syncs the dropdown on change).
      const { createTtsServiceWith, resolveTtsProviderKind } = await import('../container/index.js');
      const { env } = await import('../config/env.js');

      const effectiveVoice = request.ttsVoice?.trim() || env.TTS_VOICE;
      const effectiveProvider = resolveTtsProviderKind(request.ttsProvider, effectiveVoice);
      const effectiveRate = request.ttsRate ?? env.TTS_RATE;

      const hasTtsOverride = Boolean(request.ttsProvider || request.ttsVoice?.trim() || request.ttsRate);
      const ttsService = hasTtsOverride
        ? createTtsServiceWith(effectiveProvider, effectiveVoice, effectiveRate)
        : this.deps.ttsService;

      const ttsCacheKey = this.cacheKey(
        'tts',
        videoId,
        effectiveProvider,
        effectiveVoice,
        effectiveRate,
        script.language,
        ...script.sections.map((s) => `${s.type}:${s.spokenText || s.text}`),
      );

      const cachedTts = await this.deps.contentCache?.get<typeof ttsResult>(ttsCacheKey);
      if (cachedTts?.outputPath && existsSync(cachedTts.outputPath)) {
        logger.info({ cache: 'tts', path: cachedTts.outputPath }, 'TTS served from cache (skipping TTS)');
        ttsResult = cachedTts;
        this.emit('tts', { skipped: true });
      } else {
        this.emit('tts');
        try {
          ttsResult = await ttsService.synthesizeScript(script, workspaceDir);
          await this.deps.contentCache?.set(ttsCacheKey, ttsResult);
        } catch (err) {
          logger.warn({ err }, 'TTS failed');
          ttsResult = { outputPath: '', durationSeconds: script.estimatedDurationSeconds };
        }
      }
    }

    // Stage 4: Video Plan
    let videoPlan: VideoPlan;
    this.emit('plan');
    try {
      const planInput: VideoPlanBuildInput = {
        script,
        clipStart: angleContext.clipStart,
        clipEnd: angleContext.clipEnd,
        selectedClips: request.selectedClips,
        narrationPath: ttsResult.outputPath,
        narrationDurationSeconds: ttsResult.durationSeconds,
        ttsSections: ttsResult.sections,
        story,
        customHook: request.customHook,
        hookTitle: request.hookTitle,
        hookTag: request.hookTag,
        hookHighlightWords: request.hookHighlightWords,
        visualPreset: request.visualPreset,
      };
      videoPlan = await this.deps.videoPlanService.buildPlan(planInput);
    } catch (err) {
      logger.warn({ err }, 'Video plan failed');
      videoPlan = this.fallbackVideoPlan(script, ttsResult.outputPath);
    }

    const returnedAngle = {
      ...selectedAngle,
      ...(request.hookTitle ? { hook: request.hookTitle } : {}),
      ...(request.customAngleTitle ? { title: request.customAngleTitle } : {}),
    };

    const captionTargetLang = request.language === 'auto' ? undefined : request.language;
    const captions = request.generateCaptions !== false
      ? await this.generateCaptionsForTransform({
          videoId,
          jobId,
          sourceTitle: angleContext.sourceTitle || `Video ${videoId}`,
          sourceChannel: angleContext.sourceChannel,
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          targetLanguage: captionTargetLang,
          genre: request.genre,
          customPrompt: request.customPrompt,
          platforms: request.captionPlatforms,
          creditTemplate: request.captionCreditTemplate,
          angle: {
            title: returnedAngle.title,
            hook: returnedAngle.hook,
            angleType: returnedAngle.angleType,
            reason: returnedAngle.reason,
          },
          script: {
            sections: script.sections.map((s) => ({ type: s.type, text: s.text })),
            estimatedDurationSeconds: script.estimatedDurationSeconds,
          },
          story: story ? { concept: story.concept, premise: story.premise } : undefined,
          clips: request.selectedClips,
          durationSeconds: videoPlan.duration,
        })
      : undefined;

    // Dry-run mode
    if (request.dryRun) {
      return {
        success: true,
        jobId,
        videoId,
        candidateId: request.candidateId,
        angle: returnedAngle,
        story,
        storyApplied: story != null,
        script,
        narration: {
          ...ttsResult,
          url: ttsResult.outputPath ? this.toMediaUrl(ttsResult.outputPath) : undefined,
        },
        videoPlan,
        captions,
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
    const autoStyle = (request.genre === 'sports' || request.genre === 'match-highlight')
      ? 'sports'
      : undefined;
    const templateOrStyle = request.style ?? request.template ?? autoStyle ?? 'commentary';
    const outputVideo = await this.renderVideo(
      videoPath, videoId, jobId, templateOrStyle, videoPlan, ttsResult, request.channel, request.hookBadge, transcript, hookRange, request.engine, request.blur_watermark,
      { audioMode, sourceAudioVolume: request.sourceAudioVolume },
      request.subtitleStyle,
    );

    return {
      success: true,
      jobId,
      videoId,
      candidateId: request.candidateId,
      angle: returnedAngle,
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
      captions,
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
      ? {
          start: request.sourceRange.start,
          end: Math.min(request.sourceRange.end, request.sourceRange.start + 3.5),
        }
      : undefined;
    // Check whether the styled hook intro file (from a previous render) is
    // still accessible on disk. If the user explicitly chose a visual preset or
    // custom hook headline/tag in Step 3, re-render fresh so user presets are honored.
    let hookIntroFile: string | undefined;
    const isCustomizedHook = Boolean(request.customHook || request.hookTitle || request.hookTag || request.visualPreset);
    if (!isCustomizedHook && request.hookPreviewPath && request.hookPreviewPath.endsWith('.mp4')) {
      const { access } = await import('node:fs/promises');
      hookIntroFile = await access(request.hookPreviewPath)
        .then(() => request.hookPreviewPath)
        .catch(() => undefined);
    }

    // When no pre-rendered hook file is available on disk, but the user has
    // configured a hook intro (via request.hookTitle / request.customHook) and an
    // intro range exists, render the styled Remotion intro on-demand here in Step 3.
    if (!hookIntroFile && intro && (request.hookTitle || request.customHook) && this.deps.styledHookPreviewService) {
      try {
        const headlineText = (request.hookTitle || request.customHook || '').trim();
        const styled = await this.deps.styledHookPreviewService.render({
          videoPath,
          start: intro.start,
          end: intro.end,
          durationSeconds: Math.max(0.5, Number((intro.end - intro.start).toFixed(2))),
          headlineText,
          tag: request.hookTag,
          highlightWords: request.hookHighlightWords,
          themeSeed: `${videoId}:${request.subtitleStyle || request.template || 'default'}`,
          outputDir,
          fileName: `styled-hook-intro-${jobId}`,
          // Visual preset: user selection or auto-resolved (Phase 3/5)
          visualPreset: request.visualPreset,
        });

        hookIntroFile = styled.path;
        logger.info({ hookIntroFile, headlineText }, 'Rendered styled hook intro on-demand in Step 3 transform');
      } catch (err) {
        logger.warn({ err }, 'Styled hook intro rendering failed in Step 3 — falling back to raw intro');
      }
    }

    const hookPreviewMissing = Boolean(
      request.hookPreviewPath && request.hookPreviewPath.endsWith('.mp4') && !hookIntroFile,
    );

    const segments = planReelSegments({
      intro,
      clips: request.selectedClips.map((clip) => ({ start: clip.start, end: clip.end })),
    });
    if (segments.length === 0) {
      throw AppError.validation('All selected clips have an empty time range.');
    }

    // Build the list of original clips that were fully dropped or trimmed away
    // by the anti-repeat logic so the response can inform the UI.
    // A clip is considered "dropped" when the planner produced no output segment
    // whose (start, end) range overlaps the original clip's range.
    const droppedClips = request.selectedClips.filter((clip) => {
      const kept = segments.some(
        (s) => s.kind === 'clip' && s.start < clip.end && s.end > clip.start,
      );
      return !kept;
    });

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

    logger.info(
      {
        jobId,
        videoId,
        hasIntro: Boolean(intro),
        introFromFile: Boolean(hookIntroFile),
        hookPreviewMissing,
        requestedClips: request.selectedClips.length,
        keptSegments: segments.filter((s) => s.kind === 'clip').length,
        droppedCount: droppedClips.length,
      },
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
        const reelAssStyle = resolveSubtitleStyle(request.subtitleStyle);
        await writeFile(assPath, this.deps.assService.render(events, reelAssStyle), 'utf-8');
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

    const reelCaptions = request.generateCaptions !== false
      ? await this.generateCaptionsForTransform({
          videoId,
          jobId,
          sourceTitle: request.hookTitle || (request.selectedClips[0]?.title ? `Reel: ${request.selectedClips[0].title}` : `Reel ${videoId}`),
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          targetLanguage: request.language === 'auto' ? undefined : request.language,
          genre: request.genre,
          customPrompt: request.customPrompt,
          platforms: request.captionPlatforms,
          creditTemplate: request.captionCreditTemplate,
          angle: request.hookTitle ? { title: request.hookTitle, hook: request.hookTitle } : undefined,
          clips: request.selectedClips.map((c) => ({ start: c.start, end: c.end, title: c.title })),
          durationSeconds: reel.durationSeconds,
        })
      : undefined;

    return {
      success: true,
      jobId,
      videoId,
      candidateId: request.candidateId,
      outputMode: 'reel' as const,
      reel: {
        clipCount: segments.filter((s) => s.kind === 'clip').length,
        hasIntro: Boolean(intro),
        /** True when the styled hook intro file was used verbatim (WYSIWYG). */
        usedHookIntro: Boolean(hookIntroFile),
        /**
         * True when the caller sent a hookPreviewPath that no longer exists on
         * disk — the intro was re-cut from sourceRange instead.
         */
        hookPreviewMissing,
        segments,
        /**
         * Clips the user selected that were fully removed by the anti-repeat
         * guard (they fully overlapped the hook intro or an earlier clip).
         * The UI should surface these so the user knows their selection changed.
         */
        droppedClips: droppedClips.map((c) => ({ start: c.start, end: c.end, title: c.title })),
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
      captions: reelCaptions,
      generatedAt: new Date().toISOString(),
      dryRun: false,
    };
  }

  /** Generates platform-tailored viral social captions for the transform run. */
  private async generateCaptionsForTransform(params: {
    videoId: string;
    jobId: string;
    sourceTitle: string;
    sourceChannel?: string;
    /** Full URL of the original source video (used to populate the {url} credit placeholder). */
    sourceUrl?: string;
    targetLanguage?: string;
    genre?: string;
    customPrompt?: string;
    platforms?: SocialPlatform[];
    creditTemplate?: string;
    angle?: { title: string; hook?: string; angleType?: string; reason?: string };
    script?: { sections: Array<{ type: string; text: string }>; estimatedDurationSeconds?: number };
    story?: { concept?: string; premise?: string };
    clips?: Array<{ start: number; end: number; title?: string }>;
    durationSeconds?: number;
  }): Promise<VideoCaptionResult | undefined> {
    if (!this.deps.captionService) return undefined;
    try {
      return await this.deps.captionService.generateCaptions({
        videoId: params.videoId,
        jobId: params.jobId,
        sourceTitle: params.sourceTitle,
        sourceChannel: params.sourceChannel,
        sourceUrl: params.sourceUrl,
        targetLanguage: params.targetLanguage,
        genre: params.genre,
        customPrompt: params.customPrompt,
        platforms: params.platforms,
        creditTemplate: params.creditTemplate,
        angle: params.angle,
        script: params.script,
        story: params.story,
        clips: params.clips,
        durationSeconds: params.durationSeconds,
      });
    } catch (err) {
      this.deps.logger.warn({ err }, 'Auto caption generation failed in transform pipeline');
      return undefined;
    }
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

  /** Loads previously saved script draft from outputs/{videoId}/scripts/draft.json */
  async loadSavedScript(videoId: string): Promise<Record<string, unknown> | null> {
    try {
      const filePath = join(this.deps.outputsDir, videoId, 'scripts', 'draft.json');
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, unknown>;
      return {
        ...data,
        success: true,
        videoId,
        cached: true,
      };
    } catch {
      return null;
    }
  }

  /** Saves script draft to outputs/{videoId}/scripts/draft.json */
  async saveScriptDraft(videoId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const filePath = join(this.deps.outputsDir, videoId, 'scripts', 'draft.json');
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      this.deps.logger.warn({ err, videoId }, 'Failed to persist script draft to disk');
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
    engine?: TransformRequestInput['engine'],
    blurWatermark?: TransformRequestInput['blur_watermark'],
    /** Audio output settings derived from the request's audioMode / genre. */
    audioOptions?: { audioMode: import('../types/audio-mode.js').AudioMode; sourceAudioVolume?: number },
    /** User-chosen subtitle caption style preset (beast / hormozi / clean). */
    subtitleStyle?: string,
  ): Promise<{ path: string; durationSeconds: number; sizeBytes: number; width: number; height: number }> {
    const resolvedAssStyle = resolveSubtitleStyle(subtitleStyle);
    const outputDir = join(this.deps.outputsDir, videoId, 'transform', jobId, 'clips');
    const { ensureDir } = await import('../utils/fs.js');
    await ensureDir(outputDir);

    const outputPath = join(outputDir, 'transformed.mp4');

    // Pre-process watermark blurring on source video if requested
    let sourceVideoForRender = videoPath;
    if (blurWatermark && this.deps.watermarkFilterService) {
      const wmOpts = typeof blurWatermark === 'boolean'
        ? { enabled: blurWatermark, mode: 'preset' as const }
        : blurWatermark;
      if (wmOpts.enabled) {
        const wmDir = join(this.deps.outputsDir, videoId, 'transform', jobId, 'wm');
        const blurredVideoPath = join(wmDir, 'source-blurred.mp4');
        try {
          const filterResult = await this.deps.watermarkFilterService.buildFilter(videoPath, wmOpts);
          if (filterResult.filterComplex) {
            await ensureDir(wmDir);
            const { runCommand } = await import('../utils/exec.js');
            const adapted = filterResult.filterComplex.replace(/\[in\]/g, '[0:v]').replace(/\[out\]/g, '[vout]');
            this.deps.logger.info({ filterComplex: adapted }, 'Applying watermark blur to source video for render');
            await runCommand('ffmpeg', [
              '-y',
              '-i', videoPath,
              '-filter_complex', adapted,
              '-map', '[vout]',
              '-map', '0:a?',
              '-c:v', 'libx264',
              '-preset', 'veryfast',
              '-crf', '18',
              '-c:a', 'copy',
              blurredVideoPath,
            ], { logger: this.deps.logger });
            sourceVideoForRender = blurredVideoPath;
            this.deps.logger.info({ blurredVideoPath, regions: filterResult.regionCount }, 'Watermark blur applied to source video before rendering');
          }
        } catch (err) {
          this.deps.logger.warn({ err }, 'Watermark blurring failed; continuing with original source video');
        }
      }
    }

    // Build RenderContext with commentary text (kept for engine selection)
    const commentaryText = videoPlan.scenes
      .filter((s) => s.type === 'commentary')
      .map((s) => s.narration)
      .join(' ');

    // Build composition assets
    const assets: CompositionAssets = {
      sourceVideo: sourceVideoForRender,
      narration: ttsResult.outputPath,
      channelName: channel?.name,
      hookBadge,
      videoId,
      engine,
      style: this.toCompositionStyle(templateId),
      templateId,
      subtitleStyle: subtitleStyle || (this.deps as any)?.assStyle?.name,
      audioMode: audioOptions?.audioMode,
      sourceAudioVolume: audioOptions?.sourceAudioVolume,
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

  private fallbackScript(angle: ContentAngle, language: string, customHook?: string): OriginalScript {
    const isId = language === 'id';
    const hookText = customHook?.trim() || angle.hook;
    const contextText = isId ? 'Berikut adalah fakta penting seputar momen ini.' : 'Here is the key context behind this moment.';
    const commentaryText = angle.reason;
    const conclusionText = isId ? 'Itulah momen luar biasa yang baru saja terjadi.' : 'That concludes this incredible moment.';
    return {
      candidateId: '',
      angleId: angle.id,
      angleTitle: angle.title,
      language,
      sections: [
        { type: 'hook', text: hookText, spokenText: hookText },
        { type: 'context', text: contextText, spokenText: contextText },
        { type: 'commentary', text: commentaryText, spokenText: commentaryText },
        { type: 'conclusion', text: conclusionText, spokenText: conclusionText },
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
   * Selects transcript segments overlapping any of the user-selected viral clips,
   * sorted chronologically and deduplicated.
   */
  private selectClips(
    transcript: TranscriptDocument,
    selectedClips: Array<{ start: number; end: number }>,
  ): {
    momentSegments: TranscriptSegment[];
    contextSegments: TranscriptSegment[];
  } {
    const segments = transcript.segments;
    const momentIndices = new Set<number>();
    const contextIndices = new Set<number>();

    for (const clip of selectedClips) {
      if (clip.end <= clip.start) continue;
      let first = -1;
      let last = -1;
      for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i]!;
        if (seg.end < clip.start) continue;
        if (seg.start > clip.end) break;
        if (first === -1) first = i;
        last = i;
        momentIndices.add(i);
      }
      if (first !== -1) {
        for (let i = Math.max(0, first - 2); i < first; i += 1) {
          if (!momentIndices.has(i)) contextIndices.add(i);
        }
        for (let i = last + 1; i < Math.min(segments.length, last + 3); i += 1) {
          if (!momentIndices.has(i)) contextIndices.add(i);
        }
      }
    }

    const sortedMomentIdx = [...momentIndices].sort((a, b) => a - b);
    const sortedContextIdx = [...contextIndices].filter((i) => !momentIndices.has(i)).sort((a, b) => a - b);

    return {
      momentSegments: sortedMomentIdx.map((i) => segments[i]!),
      contextSegments: sortedContextIdx.map((i) => segments[i]!),
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

  /**
   * Resolves the target narration duration in seconds.
   * Prioritizes explicit targetDuration, then cumulative selectedClips duration,
   * then hook sourceRange duration, then candidate moment duration.
   */
  private resolveTargetDurationSeconds(
    request: {
      targetDuration?: number;
      selectedClips?: Array<{ start: number; end: number }>;
      sourceRange?: { start: number; end: number };
    },
    clip: { start: number; end: number },
  ): number | undefined {
    if (request.targetDuration && request.targetDuration > 0) {
      return Math.round(request.targetDuration);
    }
    if (request.selectedClips?.length) {
      const sum = request.selectedClips.reduce(
        (acc, c) => acc + Math.max(0, c.end - c.start),
        0,
      );
      if (sum > 0) return Math.round(sum);
    }
    if (request.sourceRange && request.sourceRange.end > request.sourceRange.start) {
      return Math.round(request.sourceRange.end - request.sourceRange.start);
    }
    if (clip.end > clip.start) {
      return Math.round(clip.end - clip.start);
    }
    return undefined;
  }

  /** Stable cache key (hex hash) from content identifiers — safe as a filename. */
  private cacheKey(...parts: (string | number | undefined)[]): string {
    return hashSeed(...parts).toString(16);
  }
}
