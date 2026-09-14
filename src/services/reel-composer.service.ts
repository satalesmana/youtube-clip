import { join } from 'node:path';
import { stat, writeFile, rm } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import { probeDurationSeconds } from '../utils/ffmpeg.js';
import type { Logger } from '../utils/logger.js';
import type { CropRegion } from '../types/reframe.js';
import type { BrollPlacement } from '../types/b-roll.js';

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
   * Pre-made segment file (e.g. the styled hook intro `final-hook-NN.mp4` or outro card)
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
  /** Optional branded intro segment (prepended to the final video). */
  introSegment?: ReelSegment;
  /** Optional branded outro CTA segment (appended to the final video). */
  outroSegment?: ReelSegment;
  /** Optional per-segment crop regions for 9:16 focal tracking. */
  cropRegions?: Array<CropRegion | undefined>;
  /**
   * Per-segment subtitles. When present, each segment is re-encoded with its
   * own ASS file before concatenation; otherwise all segments are cut with
   * stream copy and joined losslessly. Entries may be `undefined` (no burn-in
   * for that segment — e.g. pre-made file segments carrying their own text).
   */
  subtitles?: Array<ReelSegmentSubtitle | undefined>;
  /** Optional per-segment B-roll cutaway placements to overlay over footage. */
  brolls?: Array<BrollPlacement[] | undefined>;
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

    if (input.segments.length === 0 && !input.introSegment && !input.outroSegment) {
      throw new Error('ReelComposerService needs at least one segment.');
    }

    await ensureDir(input.outputDir);
    const outputPath = join(input.outputDir, `${input.fileName}.mp4`);
    const tempDir = join(input.outputDir, `reel-parts-${Date.now()}`);
    await ensureDir(tempDir);

    // Assemble all segments in sequence
    const effectiveSegments: ReelSegment[] = [];
    const effectiveSubtitles: Array<ReelSegmentSubtitle | undefined> = [];
    const effectiveCrops: Array<CropRegion | undefined> = [];
    const effectiveBrolls: Array<BrollPlacement[] | undefined> = [];

    if (input.introSegment) {
      effectiveSegments.push(input.introSegment);
      effectiveSubtitles.push(undefined);
      effectiveCrops.push(undefined);
      effectiveBrolls.push(undefined);
    }

    input.segments.forEach((seg, i) => {
      effectiveSegments.push(seg);
      effectiveSubtitles.push(input.subtitles?.[i]);
      effectiveCrops.push(input.cropRegions?.[i]);
      effectiveBrolls.push(input.brolls?.[i]);
    });

    if (input.outroSegment) {
      effectiveSegments.push(input.outroSegment);
      effectiveSubtitles.push(undefined);
      effectiveCrops.push(undefined);
      effectiveBrolls.push(undefined);
    }

    try {
      const partPaths: string[] = [];
      for (let index = 0; index < effectiveSegments.length; index += 1) {
        const segment = effectiveSegments[index]!;
        const partPath = join(tempDir, `part-${String(index).padStart(3, '0')}.mp4`);
        const subtitle = effectiveSubtitles[index];
        const crop = effectiveCrops[index];
        const brollList = effectiveBrolls[index];

        if (segment.filePath) {
          // Pre-made segment (styled hook intro or outro card): scale to the canvas,
          // keep its styling, and replace audio with silence so the concat stays uniform.
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
          await runCommand(ffmpeg, [
            '-y',
            '-i', segment.filePath,
            '-f', 'lavfi',
            '-i', 'anullsrc=r=48000:cl=stereo',
            '-vf', vf,
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k',
            '-video_track_timescale', '90000',
            partPath,
          ]);
        } else {
          // Prepare video filter components
          const filterParts: string[] = [];
          if (crop) {
            filterParts.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`);
            filterParts.push(`scale=${width}:${height}`);
          } else {
            filterParts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
            filterParts.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`);
          }

          if (subtitle) {
            filterParts.push(`ass='${this.escapeFilterPath(subtitle.assPath)}'`);
          }

          const validBrolls = (brollList ?? []).filter((b) => Boolean(b.asset.localFilePath));

          if (validBrolls.length > 0) {
            // Complex filter overlay: place B-roll over the dialogue while preserving [0:a]
            const ffmpegArgs: string[] = [
              '-y',
              '-ss', segment.start.toFixed(3),
              '-to', segment.end.toFixed(3),
              '-i', input.videoPath,
            ];

            validBrolls.forEach((b) => {
              ffmpegArgs.push('-i', b.asset.localFilePath!);
            });

            let currV = '[0:v]';
            let filterComplex = `${currV}${filterParts.join(',')}[base];`;
            currV = '[base]';

            validBrolls.forEach((b, bIdx) => {
              const inputIdx = bIdx + 1;
              const relStart = Math.max(0, b.cue.start - segment.start).toFixed(2);
              const relEnd = Math.min(segment.end - segment.start, b.cue.end - segment.start).toFixed(2);
              const scaledTag = `[broll_${bIdx}]`;
              const nextV = `[v_out_${bIdx}]`;

              filterComplex += `[${inputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}${scaledTag};`;
              filterComplex += `${currV}${scaledTag}overlay=0:0:enable='between(t,${relStart},${relEnd})'${nextV};`;
              currV = nextV;
            });

            if (filterComplex.endsWith(';')) {
              filterComplex = filterComplex.slice(0, -1);
            }

            ffmpegArgs.push(
              '-filter_complex', filterComplex,
              '-map', currV,
              '-map', '0:a',
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
              '-c:a', 'aac', '-b:a', '160k',
              '-video_track_timescale', '90000',
              partPath,
            );

            await runCommand(ffmpeg, ffmpegArgs);
          } else if (subtitle || crop) {
            // Standard re-encode with -vf
            const vf = filterParts.join(',');
            await runCommand(ffmpeg, [
              '-y',
              '-ss', segment.start.toFixed(3),
              '-to', segment.end.toFixed(3),
              '-i', input.videoPath,
              '-vf', vf,
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
              '-c:a', 'aac', '-b:a', '160k',
              '-video_track_timescale', '90000',
              partPath,
            ]);
          } else {
            // Lossless cut + normalize to a shared timebase so concat is safe
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
