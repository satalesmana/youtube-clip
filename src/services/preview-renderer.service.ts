import { join } from 'node:path';
import { access, stat } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';

export interface PreviewRendererOptions {
  /** FFmpeg binary path (default `ffmpeg`). */
  ffmpegBinaryPath?: string;
  /** Output width in pixels. Height follows the source aspect ratio. */
  previewWidth?: number;
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
}

export interface PreviewRenderOutput {
  path: string;
  durationSeconds: number;
  sizeBytes: number;
}

const DEFAULT_WIDTH = 360;

/**
 * Cuts a small, fast-to-stream MP4 preview for one clip range directly from
 * the downloaded source video. Re-encodes at a reduced resolution with
 * `faststart` so the browser can start playback immediately; audio is kept
 * at low bitrate since the spoken content is part of what the user judges.
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

    await ensureDir(input.outputDir);

    // Skip re-encoding when a previous identical preview already exists.
    if (await this.fileExists(outputPath)) {
      this.logger.info({ outputPath }, 'Preview already exists — skipping render');
      return {
        path: outputPath,
        durationSeconds: duration,
        sizeBytes: (await stat(outputPath)).size,
      };
    }

    await runCommand(ffmpeg, [
      '-y',
      // Input-level seek before `-i` is fast and frame-accurate enough for previews.
      '-ss', input.start.toFixed(3),
      '-t', duration.toFixed(3),
      '-i', input.videoPath,
      '-vf', `scale=${width}:-2`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const stats = await stat(outputPath);
    this.logger.info({ outputPath, sizeBytes: stats.size }, 'Preview rendered');

    return {
      path: outputPath,
      durationSeconds: duration,
      sizeBytes: stats.size,
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    return access(path).then(() => true).catch(() => false);
  }
}
