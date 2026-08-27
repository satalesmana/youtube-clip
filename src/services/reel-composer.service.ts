import { join } from 'node:path';
import { stat, writeFile, rm } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import { probeDurationSeconds } from '../utils/ffmpeg.js';
import type { Logger } from '../utils/logger.js';

export interface ReelComposerOptions {
  /** FFmpeg binary path (default `ffmpeg`). */
  ffmpegBinaryPath?: string;
  /** Output canvas width in pixels. */
  canvasWidth?: number;
  /** Output canvas height in pixels. */
  canvasHeight?: number;
}

/** One source range that becomes one segment of the final video. */
export interface ReelSegment {
  start: number;
  end: number;
  /**
   * Pre-made segment file (e.g. the styled hook intro `final-hook-NN.mp4`)
   * used verbatim instead of cutting the source video. When set, `start`/
   * `end` are ignored: the file is scaled to the canvas and joined as-is.
   * Its audio track is replaced with silence (styled intros are muted).
   */
  filePath?: string;
}

/** Optional burned-in subtitle for one segment (ASS file already written). */
export interface ReelSegmentSubtitle {
  assPath: string;
}

export interface ReelComposeInput {
  /** Absolute path of the full source video. */
  videoPath: string;
  /** Ordered segments — each becomes one part of the final video. */
  segments: ReelSegment[];
  /**
   * Per-segment subtitles. When present, each segment is re-encoded with its
   * own ASS file before concatenation; otherwise all segments are cut with
   * stream copy and joined losslessly. Entries may be `undefined` (no burn-in
   * for that segment — e.g. pre-made file segments carrying their own text).
   */
  subtitles?: Array<ReelSegmentSubtitle | undefined>;
  /** Directory the output is written to. */
  outputDir: string;
  /** Output file name (without extension). */
  fileName: string;
}

export interface ReelComposeOutput {
  path: string;
  durationSeconds: number;
  sizeBytes: number;
}

/**
 * Joins multiple source ranges of ONE video into a single vertical short —
 * no narration, no LLM: the selected moments play back-to-back with their
 * original audio.
 *
 * Pipeline per run:
 *   1. Cut every segment (`-ss`/`-to`, stream copy when no burn-in needed).
 *   2. Optionally burn per-segment subtitles (re-encode, scale to canvas).
 *   3. Concat demuxer → single MP4 (+faststart).
 */
export class ReelComposerService {
  constructor(
    private readonly options: ReelComposerOptions,
    private readonly logger: Logger,
  ) {}

  async compose(input: ReelComposeInput): Promise<ReelComposeOutput> {
    const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
    const width = this.options.canvasWidth ?? 1080;
    const height = this.options.canvasHeight ?? 1920;

    if (input.segments.length === 0) {
      throw new Error('ReelComposerService needs at least one segment.');
    }

    await ensureDir(input.outputDir);
    const outputPath = join(input.outputDir, `${input.fileName}.mp4`);
    const tempDir = join(input.outputDir, `reel-parts-${Date.now()}`);
    await ensureDir(tempDir);

    try {
      const partPaths: string[] = [];
      for (let index = 0; index < input.segments.length; index += 1) {
        const segment = input.segments[index]!;
        const partPath = join(tempDir, `part-${String(index).padStart(3, '0')}.mp4`);
        const subtitle = input.subtitles?.[index];

        if (segment.filePath) {
          // Pre-made segment (styled hook intro): scale to the canvas, keep
          // its burned-in styling, and replace audio with silence so the
          // concat stays uniform with the surrounding segments.
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
          await runCommand(ffmpeg, [
            '-y',
            '-i', segment.filePath,
            '-f', 'lavfi',
            '-i', `anullsrc=r=48000:cl=stereo`,
            '-vf', vf,
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k',
            '-video_track_timescale', '90000',
            partPath,
          ]);
        } else if (subtitle) {
          // Burn-in pass: re-encode with the segment's ASS overlay.
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,ass='${this.escapeFilterPath(subtitle.assPath)}'`;
          await runCommand(ffmpeg, [
            '-y',
            '-ss', segment.start.toFixed(3),
            '-to', segment.end.toFixed(3),
            '-i', input.videoPath,
            '-vf', vf,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k',
            partPath,
          ]);
        } else {
          // Lossless cut + normalize to a shared timebase so concat is safe.
          await runCommand(ffmpeg, [
            '-y',
            '-ss', segment.start.toFixed(3),
            '-to', segment.end.toFixed(3),
            '-i', input.videoPath,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k',
            '-video_track_timescale', '90000',
            partPath,
          ]);
        }
        partPaths.push(partPath);
      }

      // Concat demuxer over an explicit list file.
      const listPath = join(tempDir, 'concat.txt');
      const listContent = partPaths.map((p) => `file '${this.escapeConcatPath(p)}'`).join('\n');
      await writeFile(listPath, listContent, 'utf-8');

      await runCommand(ffmpeg, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        outputPath,
      ]);

      const stats = await stat(outputPath);
      const durationSeconds = await probeDurationSeconds({ binaryPath: ffmpeg, inputPath: outputPath });

      this.logger.info(
        { outputPath, segments: input.segments.length, durationSeconds, sizeBytes: stats.size },
        'Reel composed',
      );

      return { path: outputPath, durationSeconds, sizeBytes: stats.size };
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Escapes a filesystem path for safe embedding inside an FFmpeg `-vf` argument. */
  private escapeFilterPath(path: string): string {
    return path.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\\\''");
  }

  /** Escapes a path for the concat demuxer list file. */
  private escapeConcatPath(path: string): string {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
