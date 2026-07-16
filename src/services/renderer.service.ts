import { join } from 'node:path';
import { access, stat, writeFile } from 'node:fs/promises';
import { runCommand, CommandError } from '../utils/exec.js';
import {
  detectSilences,
  escapeFfmpegFilterPath,
  probeDurationSeconds,
  probeResolution,
  type SilenceInterval,
  type VideoResolution,
} from '../utils/ffmpeg.js';
import { ensureDir } from '../utils/fs.js';
import { retry } from '../utils/retry.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { IClipRefinementService } from './clip-refinement.service.js';
import type { ISubtitleService } from './subtitle.service.js';
import type { IAssService } from './ass.service.js';
import type { IReframeService } from './reframe.service.js';
import type { IThumbnailService } from './thumbnail.service.js';
import type { HighlightClip } from '../types/highlight.js';
import type { TranscriptResult } from '../types/transcript.js';
import type { AssStyleConfig } from '../types/subtitle.js';
import type { CropRegion } from '../types/reframe.js';
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
  outputWidth: number;
  outputHeight: number;
  frameRate: number;
  preset: string;
  crf: number;
  audioBitrateKbps: number;
  assStyle: AssStyleConfig;
}

/** Renders every highlight into an upload-ready 9:16 short in a single FFmpeg pass. */
export interface IRendererService {
  renderAll(videoPath: string, clips: HighlightClip[], transcript: TranscriptResult): Promise<RenderSummary>;
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

function classifyFfmpegError(stderr: string | undefined): RenderErrorCode {
  const text = (stderr ?? '').toLowerCase();
  if (text.includes('no space left on device') || text.includes('permission denied')) {
    return 'OUTPUT_WRITE_FAILED';
  }
  if (
    text.includes('unsupported codec') ||
    text.includes('could not find codec parameters') ||
    text.includes('invalid data found when processing input')
  ) {
    return 'UNSUPPORTED_CODEC';
  }
  return 'FFMPEG_FAILED';
}

/**
 * Orchestrates the whole "clip refinement → subtitles → reframe → burn →
 * thumbnail" pipeline for every highlight, rendering up to `maxConcurrency`
 * clips at once and continuing past individual failures.
 */
export class RendererService implements IRendererService {
  private fontChecked = false;
  private fontAvailable = true;

  constructor(
    private readonly options: RendererServiceOptions,
    private readonly clipRefinementService: IClipRefinementService,
    private readonly subtitleService: ISubtitleService,
    private readonly assService: IAssService,
    private readonly reframeService: IReframeService,
    private readonly thumbnailService: IThumbnailService,
    private readonly logger: Logger,
  ) {}

  async renderAll(
    videoPath: string,
    clips: HighlightClip[],
    transcript: TranscriptResult,
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

    const indexed = clips.map((clip, i) => ({ clip, id: i + 1 }));

    const settled = await mapWithConcurrency(indexed, maxConcurrency, ({ clip, id }) =>
      this.generateSingleRender(videoPath, sourceResolution, sourceDuration, silences, transcript, clip, id),
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
  ): Promise<RenderedClipMetadata> {
    const label = `[Clip ${id}]`;
    this.logger.info({ id }, `${label} Started`);

    await this.ensureFontAvailable().catch((error: Error) => {
      throw new RenderFailure(id, 'MISSING_FONT', error.message);
    });

    const rawRefined = this.clipRefinementService.refine(clip, transcript, silences);
    const refined = this.validateRefinedRange(rawRefined, sourceDuration, id);
    const duration = refined.end - refined.start;

    this.logger.info({ id, duration }, `${label} Duration: ${duration.toFixed(1)} seconds`);

    const events = this.subtitleService.buildEvents(transcript, refined.start, refined.end);
    const assContent = this.assService.render(events, this.options.assStyle);
    const assPath = join(this.options.subtitlesDir, `clip-${String(id).padStart(3, '0')}.ass`);

    try {
      await writeFile(assPath, assContent, 'utf-8');
    } catch {
      throw new RenderFailure(id, 'INVALID_SUBTITLE', `Failed to write subtitle file for clip ${id}.`, refined);
    }

    const focalPoint = await this.reframeService.resolveFocalPoint(
      videoPath,
      (refined.start + refined.end) / 2,
      id,
    );
    const crop = this.reframeService.computeCropRegion(sourceResolution.width, sourceResolution.height, focalPoint);

    const videoOutputPath = join(this.options.clipsDir, `clip-${String(id).padStart(3, '0')}.mp4`);

    this.logger.info({ id }, `${label} Rendering`);

    try {
      await retry(
        () =>
          runCommand(
            this.options.ffmpegBinaryPath,
            this.buildFfmpegArgs(videoPath, refined, crop, assPath, videoOutputPath),
          ),
        {
          attempts: this.options.maxRetries,
          onRetry: (error, attempt) => {
            this.logger.warn({ id, attempt, err: error }, `${label} Retrying render`);
          },
        },
      );
    } catch (error) {
      const ffmpegStderr = error instanceof CommandError ? error.stderr : undefined;
      throw new RenderFailure(
        id,
        classifyFfmpegError(ffmpegStderr),
        `FFmpeg failed to render clip ${id}.`,
        refined,
        ffmpegStderr,
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
      resolution: `${this.options.outputWidth}x${this.options.outputHeight}`,
      video: videoOutputPath,
      subtitle: assPath,
      thumbnail: thumbnailPath,
    };
  }

  private buildFfmpegArgs(
    videoPath: string,
    refined: RefinedRange,
    crop: CropRegion,
    assPath: string,
    outputPath: string,
  ): string[] {
    const { outputWidth, outputHeight, frameRate, preset, crf, audioBitrateKbps } = this.options;

    const filter = [
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
      `scale=${outputWidth}:${outputHeight}`,
      `fps=${frameRate}`,
      `ass='${escapeFfmpegFilterPath(assPath)}'`,
    ].join(',');

    return [
      '-y',
      '-i',
      videoPath,
      '-ss',
      refined.start.toFixed(3),
      '-to',
      refined.end.toFixed(3),
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-preset',
      preset,
      '-crf',
      String(crf),
      '-c:a',
      'aac',
      '-b:a',
      `${audioBitrateKbps}k`,
      '-movflags',
      '+faststart',
      outputPath,
    ];
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

  /** Verifies the configured subtitle font is actually installed, via `fc-list` (best-effort). */
  private async ensureFontAvailable(): Promise<void> {
    if (this.fontChecked) {
      if (!this.fontAvailable) {
        throw new Error(`Configured subtitle font "${this.options.assStyle.fontName}" was not found (fc-list).`);
      }
      return;
    }
    this.fontChecked = true;

    try {
      const { stdout } = await runCommand('fc-list', [':family']);
      this.fontAvailable = stdout.toLowerCase().includes(this.options.assStyle.fontName.toLowerCase());
    } catch {
      // fc-list unavailable in this environment — inconclusive, don't hard-fail.
      this.fontAvailable = true;
      return;
    }

    if (!this.fontAvailable) {
      throw new Error(`Configured subtitle font "${this.options.assStyle.fontName}" was not found (fc-list).`);
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
