import { mkdir, writeFile, stat, link as linkFile, copyFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runCommand, CommandError } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import { probeDurationSeconds } from '../utils/ffmpeg.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptResult } from '../types/transcript.js';
import type { ISubtitleService } from '../services/subtitle.service.js';
import type { BrollPlacement } from '../types/b-roll.js';
import type { IReframeService } from './reframe.service.js';

/** One source range that becomes one segment of the final reel. */
export interface ReelRemotionSegment {
  /** Source video absolute start time (seconds). Ignored when `filePath` is set. */
  start: number;
  /** Source video absolute end time (seconds). Ignored when `filePath` is set. */
  end: number;
  /**
   * Pre-made segment file (e.g. the styled hook intro `final-hook-NN.mp4`).
   * When set, the file is scaled to the canvas and joined verbatim —
   * its own text/styling is already baked in; no Remotion re-render needed.
   */
  filePath?: string;
}

export interface ReelRemotionOptions {
  /** Absolute path to the Remotion `compositions/studio` directory. */
  compositionsDir: string;
  /** FFmpeg binary path (default `ffmpeg`). */
  ffmpegBinaryPath?: string;
  /** Output canvas width in pixels (default 1080). */
  canvasWidth?: number;
  /** Output canvas height in pixels (default 1920). */
  canvasHeight?: number;
  logger: Logger;
  reframeService?: IReframeService;
}

export interface ReelRemotionInput {
  /** Absolute path of the full source video. */
  videoPath: string;
  /** Ordered segments to render and concatenate. */
  segments: ReelRemotionSegment[];
  /** Whisper transcript — used to build per-segment captions. May be undefined when unavailable. */
  transcript?: TranscriptResult;
  /** Service that converts transcript ranges into caption events. */
  subtitleService?: ISubtitleService;
  /** Optional per-segment B-roll cutaway placements to overlay over footage. */
  brolls?: Array<BrollPlacement[] | undefined>;
  /** Directory the output is written to. */
  outputDir: string;
  /** Output file name (without extension). */
  fileName: string;
  /** Remotion composition id (default `CommentaryShort`, or derived from style). */
  compositionId?: string;
  /** Style name: 'commentary' | 'sports' | 'interview'. */
  style?: string;
  /** Subtitle style preset: 'beast' | 'hormozi' | 'clean' (default 'beast'). */
  subtitleStyle?: string;
  /** Subtitle font size preset: 'sm' | 'md' | 'lg' | 'xl' (default 'md'). */
  subtitleSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Seed used for deterministic theme selection (e.g. `${videoId}:reel`). */
  themeSeed?: string;
  /** Channel watermark text. */
  channelName?: string;
  /** Follow the primary detected face when rendering vertical reels. */
  autoReframe?: boolean;
}

export interface ReelRemotionOutput {
  path: string;
  durationSeconds: number;
  sizeBytes: number;
}

/** Hard-links a file into the staging dir, falling back to copying. */
async function stageFile(source: string, destDir: string, name: string): Promise<string> {
  const dest = join(destDir, name);
  try {
    await linkFile(source, dest);
  } catch {
    await copyFile(source, dest);
  }
  return dest;
}

/**
 * Maps style name to registered Remotion composition ID in studio.
 */
function resolveCompositionId(style?: string, explicitId?: string): string {
  if (explicitId) return explicitId;
  switch (style?.toLowerCase()) {
    case 'sports':
      return 'SportsShort';
    case 'interview':
      return 'InterviewShort';
    case 'commentary':
    default:
      return 'CommentaryShort';
  }
}

/**
 * Renders each reel segment individually via Remotion (`CommentaryShort` / `SportsShort` / `InterviewShort`),
 * embedding karaoke animated subtitles derived directly from the original Whisper transcript for each selected range,
 * then concatenates all segment files with FFmpeg.
 *
 * Each clip segment is rendered as a standalone Remotion video:
 *   - One scene whose `source` range trims into the source video
 *   - Captions built from the Whisper transcript, rebased to 0 for that segment
 *   - No narration audio — original source audio is kept via `sourceUnderlay: true`
 *   - `enableIntroOutro: false` to suppress Remotion's outro card
 *
 * Pre-made file segments (e.g. the styled hook intro) are kept verbatim
 * (scaled to canvas size, audio replaced with silence so concat remains clean).
 */
export class ReelRemotionService {
  constructor(private readonly options: ReelRemotionOptions) {}

  async compose(input: ReelRemotionInput): Promise<ReelRemotionOutput> {
    const { compositionsDir, logger } = this.options;
    const ffmpeg = this.options.ffmpegBinaryPath ?? 'ffmpeg';
    const width = this.options.canvasWidth ?? 1080;
    const height = this.options.canvasHeight ?? 1920;
    const compositionId = resolveCompositionId(input.style, input.compositionId);

    if (input.segments.length === 0) {
      throw new Error('ReelRemotionService needs at least one segment.');
    }

    await ensureDir(input.outputDir);
    const tempId = randomUUID();
    const tempDir = join(input.outputDir, `reel-remotion-parts-${tempId}`);
    await mkdir(tempDir, { recursive: true });

    const remotionBin = join(
      compositionsDir,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'remotion.cmd' : 'remotion',
    );

    try {
      const partPaths: string[] = [];

      for (let idx = 0; idx < input.segments.length; idx++) {
        const segment = input.segments[idx]!;
        const partPath = join(tempDir, `part-${String(idx).padStart(3, '0')}.mp4`);

        if (segment.filePath) {
          // Pre-made file (e.g. styled hook intro): scale to canvas, replace audio with silence
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
          // Render this segment via Remotion.
          const segmentDuration = Math.max(0.5, Number((segment.end - segment.start).toFixed(3)));

          // Build captions directly from Whisper transcript, rebased to 0 for this segment.
          const captions = this.buildCaptions(
            input.transcript,
            input.subtitleService,
            segment.start,
            segment.end,
          );

          // Stage source video under public/ so Remotion's render server can serve it.
          const mediaDir = join(compositionsDir, 'public', 'media', `reel-seg-${tempId}-${idx}`);
          await mkdir(mediaDir, { recursive: true });

          const sourceExt = extname(input.videoPath) || '.mp4';
          const sourcePublicPath = `media/reel-seg-${tempId}-${idx}/source${sourceExt}`;
          await stageFile(input.videoPath, mediaDir, `source${sourceExt}`);

          // Stage B-rolls for this segment if present
          const stagedBrolls: Array<{ start: number; end: number; videoPath: string; query?: string }> = [];
          const segmentBrolls = input.brolls?.[idx];
          if (segmentBrolls && segmentBrolls.length > 0) {
            for (let bIdx = 0; bIdx < segmentBrolls.length; bIdx++) {
              const b = segmentBrolls[bIdx]!;
              if (!b.asset.localFilePath) continue;
              const relStart = Math.max(0, Number((b.cue.start - segment.start).toFixed(2)));
              const relEnd = Math.min(segmentDuration, Number((b.cue.end - segment.start).toFixed(2)));
              if (relEnd <= relStart) continue;

              const brollExt = extname(b.asset.localFilePath) || '.mp4';
              const brollFileName = `broll-${bIdx}${brollExt}`;
              try {
                await stageFile(b.asset.localFilePath, mediaDir, brollFileName);
                stagedBrolls.push({
                  start: relStart,
                  end: relEnd,
                  videoPath: `media/reel-seg-${tempId}-${idx}/${brollFileName}`,
                  query: b.cue.query,
                });
              } catch (brollErr) {
                logger.warn({ brollErr, brollPath: b.asset.localFilePath }, 'Failed to stage B-roll for Remotion segment');
              }
            }
          }

          const props = {
            plan: {
              candidateId: input.themeSeed ?? 'reel',
              angleId: input.subtitleStyle ?? 'reel',
              duration: segmentDuration,
              scenes: [
                {
                  type: 'source',
                  start: 0,
                  end: segmentDuration,
                  narration: '',
                  source: { start: segment.start, end: segment.end },
                  focusPoints: input.autoReframe && this.options.reframeService?.resolveTrajectory
                    ? (await this.options.reframeService.resolveTrajectory(input.videoPath, segment.start, segment.end, 0.75)).points.filter((point) => point.confidence !== 0).map((point) => ({
                        time: point.timestampSeconds - segment.start,
                        x: point.focalPoint.x,
                        y: point.focalPoint.y,
                      }))
                    : undefined,
                },
              ],
              captions,
              audio: {
                sourceUnderlay: true,
                ducking: false,
              },
              brolls: stagedBrolls.length > 0 ? stagedBrolls : undefined,
            },
            narrationPath: '',
            sourceVideoPath: sourcePublicPath,
            channelName: input.channelName ?? '',
            subtitleStyle: input.subtitleStyle ?? 'beast',
            subtitleSize: input.subtitleSize ?? 'md',
            enableIntroOutro: false,
          };

          const propsPath = join(tempDir, `props-${String(idx).padStart(3, '0')}.json`);
          await writeFile(propsPath, JSON.stringify(props, null, 2), 'utf-8');

          logger.info(
            { idx, segmentDuration, captionCount: captions.length, compositionId },
            'Rendering reel segment via Remotion',
          );

          try {
            await runCommand(
              remotionBin,
              [
                'render',
                join(compositionsDir, 'src', 'index.tsx'),
                compositionId,
                partPath,
                `--props=${propsPath}`,
                '--concurrency=50%',
                '--image-format=jpeg',
                '--log=error',
              ],
              { cwd: compositionsDir },
            );
          } catch (renderErr) {
            const msg = renderErr instanceof CommandError
              ? renderErr.stderr.slice(-1500)
              : String(renderErr);
            logger.error({ idx, segment, msg }, 'Remotion segment render failed');
            throw renderErr;
          } finally {
            await rm(mediaDir, { recursive: true, force: true }).catch(() => undefined);
          }

          logger.info({ idx, partPath }, 'Reel segment render complete');
        }

        partPaths.push(partPath);
      }

      // Concat all part files.
      const outputPath = join(input.outputDir, `${input.fileName}.mp4`);
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

      logger.info(
        { outputPath, segments: input.segments.length, durationSeconds, sizeBytes: stats.size },
        'Reel (Remotion) composed successfully',
      );

      return { path: outputPath, durationSeconds, sizeBytes: stats.size };
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Converts Whisper transcript events within [clipStart, clipEnd] into
   * Remotion `PlanCaption` objects, with timing rebased to 0 for the segment.
   */
  private buildCaptions(
    transcript: TranscriptResult | undefined,
    subtitleService: ISubtitleService | undefined,
    clipStart: number,
    clipEnd: number,
  ): Array<{
    start: number;
    end: number;
    text: string;
    type: 'narration';
    highlightWords?: string[];
    wordTimings?: Array<{ word: string; start: number; end: number }>;
  }> {
    if (!transcript || !subtitleService) return [];

    const events = subtitleService.buildEvents(transcript, clipStart, clipEnd);
    return events.map((ev) => ({
      start: ev.start,
      end: ev.end,
      text: ev.words.map((w) => w.text).join(' '),
      type: 'narration' as const,
      highlightWords: ev.words.filter((w) => w.isKeyword).map((w) => w.text),
      wordTimings: ev.words.map((w) => ({
        word: w.text,
        start: w.start,
        end: w.end,
      })),
    }));
  }

  private escapeConcatPath(path: string): string {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
