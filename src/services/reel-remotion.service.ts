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
  kind?: 'intro' | 'clip' | 'gap';
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
  /** Whether to render and append an Outro CTA card at the end of the reel. */
  enableIntroOutro?: boolean;
  outroPreset?: string;
  outroCtaText?: string;
  outroButtonText?: string;
  outroDuration?: number;
  /** Output timeline position where the CTA card begins. Defaults to the end. */
  outroStartSec?: number;
  outroChannelName?: string;
  outroLogoUrl?: string;
  /** Canvas aspect ratio: '9:16' | '16:9' | '1:1'. Default '9:16'. */
  aspectRatio?: '9:16' | '16:9' | '1:1';
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
    let width = this.options.canvasWidth ?? 1080;
    let height = this.options.canvasHeight ?? 1920;
    if (input.aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    } else if (input.aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
    } else if (input.aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    }
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
      let positionedOutro: { path: string; startSec: number; durationSec: number } | undefined;

      for (let idx = 0; idx < input.segments.length; idx++) {
        const segment = input.segments[idx]!;
        const partPath = join(tempDir, `part-${String(idx).padStart(3, '0')}.mp4`);

        if (segment.kind === 'gap') {
          const gapDuration = Math.max(0.05, segment.end - segment.start);
          await runCommand(ffmpeg, [
            '-y',
            '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=30:d=${gapDuration.toFixed(3)}`,
            '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
            '-t', gapDuration.toFixed(3),
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
            '-video_track_timescale', '90000',
            partPath,
          ]);
        } else if (segment.filePath) {
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
              const isRelative = b.cue.start < segmentDuration && b.cue.end <= segmentDuration + 0.5;
              const relStart = isRelative
                ? Math.max(0, Number(b.cue.start.toFixed(2)))
                : Math.max(0, Number((b.cue.start - segment.start).toFixed(2)));
              const relEnd = isRelative
                ? Math.min(segmentDuration, Number(b.cue.end.toFixed(2)))
                : Math.min(segmentDuration, Number((b.cue.end - segment.start).toFixed(2)));
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

      // Outro CTA Card: Render and append to the reel when enableIntroOutro is active
      if (input.enableIntroOutro) {
        const outroDuration = Math.max(1, Math.min(10, Number(input.outroDuration ?? 3)));
        const outroIdx = input.segments.length;
        const rawOutroPath = join(tempDir, 'raw-outro.mp4');
        const outroPartPath = join(tempDir, `part-${String(outroIdx).padStart(3, '0')}.mp4`);
        const outroPropsPath = join(tempDir, `props-${String(outroIdx).padStart(3, '0')}.json`);

        // Stage creator logo if provided
        let resolvedLogoUrl = input.outroLogoUrl;
        const outroMediaDir = join(compositionsDir, 'public', 'media', `reel-outro-${tempId}`);
        if (input.outroLogoUrl) {
          await mkdir(outroMediaDir, { recursive: true });
          if (input.outroLogoUrl.startsWith('data:image/')) {
            const matches = input.outroLogoUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            const rawExt = matches ? matches[1] : 'png';
            const ext = rawExt === 'jpeg' ? '.jpg' : rawExt === 'svg+xml' ? '.svg' : `.${rawExt}`;
            const base64Data = matches ? matches[2] : input.outroLogoUrl.split(',')[1];
            if (base64Data) {
              const dest = join(outroMediaDir, `creator-logo${ext}`);
              await writeFile(dest, Buffer.from(base64Data, 'base64'));
              resolvedLogoUrl = `media/reel-outro-${tempId}/creator-logo${ext}`;
            }
          } else if (!/^https?:\/\//.test(input.outroLogoUrl)) {
            try {
              const logoExt = extname(input.outroLogoUrl) || '.png';
              await stageFile(input.outroLogoUrl, outroMediaDir, `creator-logo${logoExt}`);
              resolvedLogoUrl = `media/reel-outro-${tempId}/creator-logo${logoExt}`;
            } catch (logoErr) {
              logger.warn({ logoErr, creatorLogo: input.outroLogoUrl }, 'Failed to stage creator logo for outro');
            }
          }
        }

        // Optional: stage source video for ambient backdrop behind Outro card
        let stagedSourceForOutro: string | undefined;
        let sourceStartForOutro = 0;
        let sourceEndForOutro = outroDuration;
        const lastSegment = input.segments[input.segments.length - 1];
        if (lastSegment && !lastSegment.filePath && input.videoPath) {
          try {
            await mkdir(outroMediaDir, { recursive: true });
            const sourceExt = extname(input.videoPath) || '.mp4';
            await stageFile(input.videoPath, outroMediaDir, `source${sourceExt}`);
            stagedSourceForOutro = `media/reel-outro-${tempId}/source${sourceExt}`;
            sourceStartForOutro = Math.max(0, lastSegment.end - outroDuration);
            sourceEndForOutro = lastSegment.end;
          } catch {
            // Ambient video backdrop is optional; OutroCardShort gracefully falls back to sleek dark theme
          }
        }

        const outroProps = {
          channelName: input.outroChannelName || input.channelName || 'kreator',
          handle: input.outroChannelName || input.channelName,
          ctaText: input.outroCtaText,
          buttonText: input.outroButtonText,
          creatorLogoUrl: resolvedLogoUrl,
          durationSeconds: outroDuration,
          themeSeed: input.themeSeed ?? 'reel:outro',
          outroPreset: input.outroPreset ?? 'creator-glass',
          sourceVideoPath: stagedSourceForOutro,
          sourceStart: sourceStartForOutro,
          sourceEnd: sourceEndForOutro,
        };

        await writeFile(outroPropsPath, JSON.stringify(outroProps, null, 2), 'utf-8');

        logger.info(
          { outroDuration, outroPreset: input.outroPreset, channelName: outroProps.channelName },
          'Rendering outro card via Remotion for reel',
        );

        try {
          await runCommand(
            remotionBin,
            [
              'render',
              join(compositionsDir, 'src', 'index.tsx'),
              'OutroCardShort',
              rawOutroPath,
              `--props=${outroPropsPath}`,
              '--concurrency=50%',
              '--image-format=jpeg',
              '--log=error',
            ],
            { cwd: compositionsDir },
          );

          // Standardize video & audio stream to match previous segments
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
          await runCommand(ffmpeg, [
            '-y',
            '-i', rawOutroPath,
            '-f', 'lavfi',
            '-i', 'anullsrc=r=48000:cl=stereo',
            '-vf', vf,
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
            '-video_track_timescale', '90000',
            outroPartPath,
          ]);

          if (input.outroStartSec !== undefined) {
            positionedOutro = { path: outroPartPath, startSec: Math.max(0, input.outroStartSec), durationSec: outroDuration };
          } else {
            partPaths.push(outroPartPath);
          }
          logger.info({ outroPartPath, outroDuration }, 'Outro card render and standardization complete');
        } catch (outroErr) {
          const msg = outroErr instanceof CommandError ? outroErr.stderr.slice(-1500) : String(outroErr);
          logger.error({ msg }, 'Failed to render Remotion outro card — skipping outro');
        } finally {
          await rm(outroMediaDir, { recursive: true, force: true }).catch(() => undefined);
        }
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

      if (positionedOutro) {
        const baseDuration = await probeDurationSeconds({ binaryPath: ffmpeg, inputPath: outputPath });
        // Preserve the usual end-card behavior as a concat. Earlier CTA positions
        // are composited over the rendered timeline while retaining its audio.
        if (positionedOutro.startSec >= baseDuration - 0.03) {
          const baseWithOutroList = join(tempDir, 'concat-with-outro.txt');
          await writeFile(baseWithOutroList, [outputPath, positionedOutro.path].map((p) => `file '${this.escapeConcatPath(p)}'`).join('\n'), 'utf-8');
          const appendedPath = join(tempDir, 'output-with-outro.mp4');
          await runCommand(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', baseWithOutroList, '-c', 'copy', '-movflags', '+faststart', appendedPath]);
          await rm(outputPath, { force: true });
          await import('node:fs/promises').then(({ rename }) => rename(appendedPath, outputPath));
        } else {
          const totalDuration = Math.max(baseDuration, positionedOutro.startSec + positionedOutro.durationSec);
          const padDuration = Math.max(0, totalDuration - baseDuration);
          const overlayPath = join(tempDir, 'output-with-positioned-outro.mp4');
          const start = positionedOutro.startSec.toFixed(3);
          const end = (positionedOutro.startSec + positionedOutro.durationSec).toFixed(3);
          const filter = `[0:v]tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(3)}[base];[1:v]setpts=PTS-STARTPTS+${start}/TB[card];[base][card]overlay=0:0:enable='between(t,${start},${end})':eof_action=pass[v]`;
          await runCommand(ffmpeg, [
            '-y', '-i', outputPath, '-i', positionedOutro.path,
            '-filter_complex', filter,
            '-map', '[v]', '-map', '0:a?',
            '-af', 'apad', '-t', totalDuration.toFixed(3),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
            '-movflags', '+faststart', overlayPath,
          ]);
          await rm(outputPath, { force: true });
          await import('node:fs/promises').then(({ rename }) => rename(overlayPath, outputPath));
        }
      }

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

    // The live editor groups transcript words in fixed four-word phrases.
    // Keep the rendered composition's phrase breaks and emphasis detection in sync.
    const words = subtitleService
      .buildEvents(transcript, clipStart, clipEnd)
      .flatMap((event) => event.words);
    const captions: Array<{
      start: number;
      end: number;
      text: string;
      type: 'narration';
      highlightWords?: string[];
      wordTimings?: Array<{ word: string; start: number; end: number }>;
    }> = [];

    for (let index = 0; index < words.length; index += 4) {
      const phrase = words.slice(index, index + 4);
      if (phrase.length === 0) continue;
      captions.push({
        start: phrase[0]!.start,
        end: phrase[phrase.length - 1]!.end,
        text: phrase.map((word) => word.text).join(' '),
        type: 'narration',
        highlightWords: phrase
          .filter((word) => /\d/.test(word.text) || word.text.length >= 7)
          .map((word) => word.text),
        wordTimings: phrase.map((word) => ({
          word: word.text,
          start: word.start,
          end: word.end,
        })),
      });
    }
    return captions;
  }

  private escapeConcatPath(path: string): string {
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
