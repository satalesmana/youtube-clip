import { join } from 'node:path';
import { access, stat } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';
import type { IWatermarkFilterService } from './watermark-filter.service.js';
import type { WatermarkBlurOptions } from '../types/watermark.js';

export interface PreviewRendererOptions {
  /** FFmpeg binary path (default `ffmpeg`). */
  ffmpegBinaryPath?: string;
  /** Output width in pixels. Height follows the source aspect ratio. */
  previewWidth?: number;
  /** Optional watermark filter service injected at construction time. */
  watermarkFilterService?: IWatermarkFilterService;
}

/** Renders a lightweight MP4 preview of one source range. */
export interface IPreviewRenderer {
  renderPreview(input: PreviewRenderInput): Promise<PreviewRenderOutput>;
}

export interface PreviewRenderInput {
  /** Absolute path of the full source video. */
  videoPath: string;
  /** Absolute seconds into the source video where the clip starts. */
  start: number;
  /** Absolute seconds into the source video where the clip ends. */
  end: number;
  /** Directory the preview file is written to. */
  outputDir: string;
  /** File name (without extension) for the preview. */
  fileName: string;
  /**
   * Optional watermark blur settings. When provided and the filter service is
   * wired in, the preview will have the watermark area blurred.
   */
  blurWatermark?: WatermarkBlurOptions;
  /** Force re-render even if a preview file already exists. */
  overwrite?: boolean;
}

export interface PreviewRenderOutput {
  path: string;
  thumbnailPath?: string;
  durationSeconds: number;
  sizeBytes: number;
}

const DEFAULT_WIDTH = 360;

/**
 * Cuts a small, fast-to-stream MP4 preview for one clip range directly from
 * the downloaded source video. Re-encodes at a reduced resolution with
 * `faststart` so the browser can start playback immediately; audio is kept
 * at low bitrate since the spoken content is part of what the user judges.
 *
 * When `blurWatermark` is supplied and a `WatermarkFilterService` is
 * configured, a boxblur overlay is applied over the detected watermark region
 * before the preview is encoded.
 */
export class PreviewRendererService implements IPreviewRenderer {
  constructor(
    private readonly options: PreviewRendererOptions,
    private readonly logger: Logger,
  ) {}

  async renderPreview(input: PreviewRenderInput): Promise<PreviewRenderOutput> {
    const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
    const width = this.options.previewWidth ?? DEFAULT_WIDTH;
    const duration = Math.max(0.1, input.end - input.start);
    const outputPath = join(input.outputDir, `${input.fileName}.mp4`);
    const thumbnailPath = join(input.outputDir, `${input.fileName}.jpg`);
    const metaPath = join(input.outputDir, `${input.fileName}.meta.json`);

    await ensureDir(input.outputDir);

    const ensureThumbnail = async () => {
      if (!input.overwrite && (await this.fileExists(thumbnailPath))) return thumbnailPath;
      const sampleTime = input.start + Math.min(1.0, duration * 0.2);
      try {
        await runCommand(ffmpeg, [
          '-y',
          '-ss', sampleTime.toFixed(3),
          '-i', input.videoPath,
          '-frames:v', '1',
          '-update', '1',
          '-q:v', '2',
          thumbnailPath,
        ]);
        return thumbnailPath;
      } catch (err) {
        this.logger.warn({ err, thumbnailPath }, 'Failed to extract preview thumbnail frame');
        return undefined;
      }
    };

    // Skip re-encoding only when previous preview exists AND its start/end matches (unless overwrite is requested).
    let matchesExisting = false;
    if (!input.overwrite && (await this.fileExists(outputPath))) {
      try {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        if (
          Math.abs(meta.start - input.start) < 0.1 &&
          Math.abs(meta.end - input.end) < 0.1
        ) {
          matchesExisting = true;
        }
      } catch {
        // No metadata file or parse error: re-render to ensure preview matches the new clip boundaries
      }
    }

    if (matchesExisting) {
      this.logger.info({ outputPath, start: input.start, end: input.end }, 'Preview already exists with matching range — skipping render');
      const thumb = await ensureThumbnail();
      return {
        path: outputPath,
        thumbnailPath: thumb,
        durationSeconds: duration,
        sizeBytes: (await stat(outputPath)).size,
      };
    }

    // Build watermark blur filter (if requested and service is available).
    let vfFilter = `scale=${width}:-2`;
    const wmFilter = this.options.watermarkFilterService;
    if (input.blurWatermark && wmFilter && input.blurWatermark.mode !== 'none') {
      try {
        const { filterComplex, regionCount } = await wmFilter.buildFilter(
          input.videoPath,
          input.blurWatermark,
        );
        if (filterComplex && regionCount > 0) {
          // Wrap the watermark blur + scale into a single filter_complex chain.
          // [0:v] → split+blur overlay → scale → [vout]
          const scaleLabel = 'wm_scaled';
          const blurGraph = filterComplex
            .replace('[in]', '[0:v]')
            .replace('[out]', `[wm_out]`);
          vfFilter = `${blurGraph};[wm_out]scale=${width}:-2[${scaleLabel}]`;
          this.logger.info({ regionCount }, 'Preview renderer: watermark blur applied');
        }
      } catch (err) {
        this.logger.warn({ err }, 'Preview renderer: watermark blur failed, rendering without blur');
      }
    }

    // Choose between -vf (simple) and -filter_complex (when blur is applied).
    const isComplex = vfFilter.includes(';') || vfFilter.includes('[0:v]');
    const filterArgs: string[] = isComplex
      ? ['-filter_complex', vfFilter, '-map', '[wm_scaled]', '-map', '0:a?']
      : ['-vf', vfFilter];

    await runCommand(ffmpeg, [
      '-y',
      // Input-level seek before `-i` is fast and frame-accurate enough for previews.
      '-ss', input.start.toFixed(3),
      '-t', duration.toFixed(3),
      '-i', input.videoPath,
      ...filterArgs,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '96k',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const stats = await stat(outputPath);
    this.logger.info({ outputPath, sizeBytes: stats.size }, 'Preview rendered');

    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(metaPath, JSON.stringify({ start: input.start, end: input.end }), 'utf-8');
    } catch (err) {
      this.logger.warn({ err, metaPath }, 'Failed to write preview metadata file');
    }

    const thumb = await ensureThumbnail();

    return {
      path: outputPath,
      thumbnailPath: thumb,
      durationSeconds: duration,
      sizeBytes: stats.size,
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    return access(path).then(() => true).catch(() => false);
  }
}
