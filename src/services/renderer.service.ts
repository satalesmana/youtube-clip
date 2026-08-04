import { join } from 'node:path';
import { access, stat, writeFile } from 'node:fs/promises';
import {
  detectSilences,
  probeDurationSeconds,
  probeResolution,
  type SilenceInterval,
  type VideoResolution,
} from '../utils/ffmpeg.js';
import { ensureDir } from '../utils/fs.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IClipRefinementService } from './clip-refinement.service.js';
import type { ISubtitleService } from './subtitle.service.js';
import type { IReframeService } from './reframe.service.js';
import type { IThumbnailService } from './thumbnail.service.js';
import type { ITemplateService } from '../template/template.service.js';
import type { ITemplateRendererService } from '../template/renderer.service.js';
import { TemplateRenderError } from '../template/renderer.service.js';
import { TemplateError } from '../template/template-error.js';
import type { HighlightClip } from '../types/highlight.js';
import type { TranscriptResult } from '../types/transcript.js';
import type { RenderContext } from '../types/template.js';
import type { RefinedRange, RenderedClipMetadata, RenderError, RenderErrorCode, RenderSummary } from '../types/render.js';

export interface RendererServiceOptions {
  ffmpegBinaryPath: string;
  clipsDir: string;
  subtitlesDir: string;
  thumbnailsDir: string;
  metadataDir: string;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  maxConcurrency: number;
  maxRetries: number;
}

/**
 * Renders every highlight into an upload-ready 9:16 short in a single
 * FFmpeg pass. 100% data-driven: this service never knows whether it's
 * composing a Sports, News, or Podcast layout — it only orchestrates the
 * upstream steps (refine, caption, reframe, thumbnail) that build the
 * template-agnostic `RenderContext`, then hands off to the template engine.
 */
export interface IRendererService {
  renderAll(
    videoPath: string,
    clips: HighlightClip[],
    transcript: TranscriptResult,
    templateId?: string,
    channel?: RenderContext['channel'],
  ): Promise<RenderSummary>;
}

/** Raised for a single clip's render failure; carries enough detail to build a `RenderError`. */
class RenderFailure extends Error {
  constructor(
    readonly index: number,
    readonly code: RenderErrorCode,
    message: string,
    readonly range?: { start: number; end: number },
    readonly ffmpegStderr?: string,
  ) {
    super(message);
    this.name = 'RenderFailure';
  }
}

export class RendererService implements IRendererService {
  constructor(
    private readonly options: RendererServiceOptions,
    private readonly clipRefinementService: IClipRefinementService,
    private readonly subtitleService: ISubtitleService,
    private readonly templateService: ITemplateService,
    private readonly templateRendererService: ITemplateRendererService,
    private readonly reframeService: IReframeService,
    private readonly thumbnailService: IThumbnailService,
    private readonly logger: Logger,
  ) {}

  async renderAll(
    videoPath: string,
    clips: HighlightClip[],
    transcript: TranscriptResult,
    templateId?: string,
    channel?: RenderContext['channel'],
  ): Promise<RenderSummary> {
    const { clipsDir, subtitlesDir, thumbnailsDir, metadataDir, ffmpegBinaryPath, maxConcurrency } = this.options;

    await Promise.all([ensureDir(clipsDir), ensureDir(subtitlesDir), ensureDir(thumbnailsDir), ensureDir(metadataDir)]);

    await access(videoPath).catch((error: unknown) => {
      throw AppError.missingSourceVideo(`Source video "${videoPath}" does not exist.`, error);
    });

    const sourceResolution = await probeResolution({ binaryPath: ffmpegBinaryPath, inputPath: videoPath });
    const sourceDuration = await probeDurationSeconds({ binaryPath: ffmpegBinaryPath, inputPath: videoPath });

    if (!sourceResolution || sourceDuration <= 0) {
      throw AppError.corruptedSourceVideo(
        `Could not read video stream info from "${videoPath}" — it may be corrupted or use an unsupported codec.`,
      );
    }

    this.logger.info({ videoPath }, 'Detecting silence intervals');
    const silences = await detectSilences({ binaryPath: ffmpegBinaryPath, inputPath: videoPath });

    // Template loading/validation is per-REQUEST (shared by every clip in
    // this job), not per-clip — a bad/missing template fails the whole
    // request up front rather than surfacing as N identical per-clip errors.
    const loaded = await this.templateService.load(templateId);
    this.logger.info({ template: loaded.manifest.id }, 'Using template');

    const indexed = clips.map((clip, i) => ({ clip, id: i + 1 }));

    const settled = await mapWithConcurrency(indexed, maxConcurrency, ({ clip, id }) =>
      this.generateSingleRender(videoPath, sourceResolution, sourceDuration, silences, transcript, clip, id, loaded, channel),
    );

    const renderedClips: RenderedClipMetadata[] = [];
    const errors: RenderError[] = [];

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        renderedClips.push(outcome.value);
      } else {
        errors.push(this.toRenderError(outcome.reason));
      }
    }

    renderedClips.sort((a, b) => a.id - b.id);

    await writeFile(
      join(metadataDir, 'clips.json'),
      JSON.stringify({ clips: renderedClips }, null, 2),
      'utf-8',
    );

    this.logger.info(
      { successCount: renderedClips.length, errorCount: errors.length },
      'Rendering completed',
    );

    return { clips: renderedClips, errors };
  }

  private async generateSingleRender(
    videoPath: string,
    sourceResolution: VideoResolution,
    sourceDuration: number,
    silences: SilenceInterval[],
    transcript: TranscriptResult,
    clip: HighlightClip,
    id: number,
    loaded: Awaited<ReturnType<ITemplateService['load']>>,
    channel: RenderContext['channel'],
  ): Promise<RenderedClipMetadata> {
    const label = `[Clip ${id}]`;
    this.logger.info({ id }, `${label} Started`);

    const rawRefined = this.clipRefinementService.refine(clip, transcript, silences);
    const refined = this.validateRefinedRange(rawRefined, sourceDuration, id);
    const duration = refined.end - refined.start;

    this.logger.info({ id, duration }, `${label} Duration: ${duration.toFixed(1)} seconds`);

    const events = this.subtitleService.buildEvents(transcript, refined.start, refined.end);
    const assPath = join(this.options.subtitlesDir, `clip-${String(id).padStart(3, '0')}.ass`);

    const focalPoint = await this.reframeService.resolveFocalPoint(
      videoPath,
      (refined.start + refined.end) / 2,
      id,
    );

    const context: RenderContext = {
      clip: {
        title: clip.title,
        score: clip.score,
        duration: Number(duration.toFixed(2)),
        start: refined.start,
        end: refined.end,
      },
      video: { path: videoPath },
      subtitle: { ass: assPath, words: events },
      channel,
    };

    let enrichedLayers: Awaited<ReturnType<ITemplateService['resolveLayers']>>;
    try {
      enrichedLayers = await this.templateService.resolveLayers(loaded, context);
    } catch (error) {
      if (error instanceof TemplateError) {
        throw new RenderFailure(id, 'TEMPLATE_BINDING_ERROR', error.message, refined);
      }
      throw new RenderFailure(id, 'TEMPLATE_BINDING_ERROR', `Failed to resolve template bindings for clip ${id}.`, refined);
    }

    const videoOutputPath = join(this.options.clipsDir, `clip-${String(id).padStart(3, '0')}.mp4`);

    this.logger.info({ id }, `${label} Rendering`);

    try {
      await this.templateRendererService.compose({
        context,
        enrichedLayers,
        canvas: loaded.template.canvas,
        templateDir: loaded.templateDir,
        assPath,
        outputPath: videoOutputPath,
        hints: {
          sourceWidth: sourceResolution.width,
          sourceHeight: sourceResolution.height,
          focalPoint,
        },
        logger: this.logger,
      });
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw new RenderFailure(id, error.code, error.message, refined, error.ffmpegStderr);
      }
      throw new RenderFailure(
        id,
        'TEMPLATE_RENDER_FAILED',
        `Failed to render clip ${id}: ${(error as Error).message}`,
        refined,
      );
    }

    await this.validateOutputFile(videoOutputPath, duration, id, refined);

    const thumbnailPath = join(this.options.thumbnailsDir, `clip-${String(id).padStart(3, '0')}.jpg`);

    try {
      await this.thumbnailService.generateThumbnail(videoOutputPath, duration, thumbnailPath, id);
    } catch (error) {
      throw new RenderFailure(
        id,
        'THUMBNAIL_FAILED',
        `Failed to generate thumbnail for clip ${id}: ${(error as Error).message}`,
        refined,
      );
    }

    this.logger.info({ id }, `${label} Completed`);

    return {
      id,
      title: clip.title,
      reason: clip.reason,
      hook: clip.hook,
      score: clip.score,
      start: refined.start,
      end: refined.end,
      duration: Number(duration.toFixed(2)),
      resolution: `${loaded.template.canvas.width}x${loaded.template.canvas.height}`,
      video: videoOutputPath,
      subtitle: assPath,
      thumbnail: thumbnailPath,
      template: loaded.manifest.id,
    };
  }

  /** Enforces the hard [minDurationSeconds, maxDurationSeconds] safety bounds after refinement. */
  private validateRefinedRange(refined: RefinedRange, sourceDuration: number, id: number): RefinedRange {
    const { minDurationSeconds, maxDurationSeconds } = this.options;

    if (!Number.isFinite(refined.start) || !Number.isFinite(refined.end)) {
      throw new RenderFailure(id, 'INVALID_TIMESTAMP', `Clip ${id} has non-numeric start/end after refinement.`);
    }
    if (refined.start < 0 || refined.start >= refined.end) {
      throw new RenderFailure(id, 'INVALID_TIMESTAMP', `Clip ${id} has an invalid refined range.`, refined);
    }
    if (sourceDuration > 0 && refined.start >= sourceDuration) {
      throw new RenderFailure(
        id,
        'INVALID_TIMESTAMP',
        `Clip ${id} start (${refined.start}s) is beyond the source video's duration (${sourceDuration}s).`,
        refined,
      );
    }

    const end = sourceDuration > 0 ? Math.min(refined.end, sourceDuration) : refined.end;
    const duration = end - refined.start;

    if (duration < minDurationSeconds || duration > maxDurationSeconds) {
      throw new RenderFailure(
        id,
        'DURATION_OUT_OF_RANGE',
        `Clip ${id} refined duration (${duration.toFixed(1)}s) is outside the allowed range [${minDurationSeconds}, ${maxDurationSeconds}]s.`,
        { start: refined.start, end },
      );
    }

    return { start: refined.start, end };
  }

  private async validateOutputFile(
    outputPath: string,
    expectedDuration: number,
    id: number,
    range: RefinedRange,
  ): Promise<void> {
    const stats = await stat(outputPath).catch(() => null);

    if (!stats || stats.size === 0) {
      throw new RenderFailure(id, 'CORRUPTED_OUTPUT', `Rendered clip ${id} is missing or empty.`, range);
    }

    const actualDuration = await probeDurationSeconds({
      binaryPath: this.options.ffmpegBinaryPath,
      inputPath: outputPath,
    });

    if (actualDuration > 0 && Math.abs(actualDuration - expectedDuration) > 2) {
      throw new RenderFailure(
        id,
        'CORRUPTED_OUTPUT',
        `Rendered clip ${id} duration (${actualDuration.toFixed(1)}s) does not match the expected duration (${expectedDuration.toFixed(1)}s).`,
        range,
      );
    }
  }

  private toRenderError(reason: unknown): RenderError {
    const timestamp = new Date().toISOString();

    if (reason instanceof RenderFailure) {
      return {
        index: reason.index,
        code: reason.code,
        message: reason.message,
        start: reason.range?.start,
        end: reason.range?.end,
        ffmpegStderr: reason.ffmpegStderr,
        timestamp,
      };
    }

    return {
      index: -1,
      code: 'FFMPEG_FAILED',
      message: reason instanceof Error ? reason.message : 'Unknown render error.',
      timestamp,
    };
  }
}
