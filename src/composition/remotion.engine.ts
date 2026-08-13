import { mkdir, writeFile, stat, link as linkFile, copyFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';
import { runCommand, CommandError } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import type { VideoPlan } from '../types/video-plan.js';
import type { RenderOutput, CompositionAssets, ICompositionEngine } from './composition.types.js';

export interface RemotionEngineOptions {
  /** Path to the compositions directory (contains `src/index.tsx` and `public/`). */
  compositionsDir: string;
  /** Root outputs directory — renders and props land here, outside the repo. */
  outputsDir: string;
  logger: Logger;
}

/** Maps COMPOSITION_STYLE env value to the registered Remotion composition id. */
const STYLE_COMPOSITIONS: Record<string, string> = {
  sports: 'SportsShort',
  interview: 'InterviewShort',
};

/** Hard-links a file into the render's staging dir, falling back to copying. */
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
 * Remotion composition engine — renders VideoPlan using Remotion.
 *
 * Remotion's renderer only serves files inside the project's `public/` folder,
 * so the source video and narration are staged there per job and referenced
 * via `public`-relative paths in the props. Props and the final render are
 * written under outputs/render/{jobId}/, outside the repo. Falls back to the
 * FFmpeg template engine when the render fails.
 */
export class RemotionCompositionEngine implements ICompositionEngine {
  readonly kind = 'remotion' as const;

  constructor(private readonly options: RemotionEngineOptions) {}

  async render(
    plan: VideoPlan,
    assets: CompositionAssets,
  ): Promise<RenderOutput> {
    const { compositionsDir, outputsDir, logger } = this.options;

    // Fresh job directory keeps renders and props out of the repo and avoids
    // stale-output collisions between runs. When a videoId is available the
    // render lands under the video's own workspace (outputs/{videoId}/render/).
    const jobId = randomUUID();
    const renderRoot = assets.videoId
      ? join(outputsDir, assets.videoId, 'render')
      : join(outputsDir, 'render');
    const outputDir = join(renderRoot, jobId);
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'rendered.mp4');
    const propsPath = join(outputDir, 'input-props.json');

    // Stage media under public/ so the Remotion render server can serve it.
    const mediaDir = join(compositionsDir, 'public', 'media', jobId);
    const sourceVideoPath = `media/${jobId}/source${extname(assets.sourceVideo) || '.mp4'}`;
    const narrationPath = assets.narration
      ? `media/${jobId}/narration${extname(assets.narration) || '.mp3'}`
      : '';

    try {
      await mkdir(mediaDir, { recursive: true });
      await stageFile(assets.sourceVideo, mediaDir, `source${extname(assets.sourceVideo) || '.mp4'}`);
      if (assets.narration) {
        await stageFile(assets.narration, mediaDir, `narration${extname(assets.narration) || '.mp3'}`);
      }

      // Write props to temp file
      await writeFile(
        propsPath,
        JSON.stringify({
          plan,
          narrationPath,
          sourceVideoPath,
          channelName: assets.channelName,
        }, null, 2),
      );

      logger.info({ path: propsPath }, 'Remotion props written');

      // Get composition ID from env or default to CommentaryShort
      const compositionId = STYLE_COMPOSITIONS[process.env.COMPOSITION_STYLE ?? ''] ?? 'CommentaryShort';

      // Resolve the project-local CLI instead of relying on `npx` (which could
      // fetch from the npm registry if node_modules is missing).
      const entry = join(compositionsDir, 'src', 'index.tsx');
      const remotionBin = join(
        compositionsDir,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'remotion.cmd' : 'remotion',
      );

      logger.info({ compositionId, outputPath }, 'Starting Remotion render');
      await runCommand(
        remotionBin,
        [
          'render',
          entry,
          compositionId,
          outputPath,
          `--props=${propsPath}`,
          '--image-format=jpeg',
          '--log=info',
        ],
        { cwd: compositionsDir, logger },
      );
      logger.info({ outputPath }, 'Remotion render complete');

      const { probeDurationSeconds } = await import('../utils/ffmpeg.js');

      const stats = await stat(outputPath);
      const duration = await probeDurationSeconds({ binaryPath: 'ffmpeg', inputPath: outputPath });

      return {
        path: outputPath,
        durationSeconds: duration,
        sizeBytes: stats.size,
      };
    } catch (error) {
      if (error instanceof CommandError) {
        logger.error(
          { stderr: error.stderr.slice(-2000), stdout: error.stdout.slice(-2000) },
          'Remotion render failed',
        );
        throw AppError.internal(`Remotion render failed: ${error.message}`);
      }
      logger.error({ error }, 'Remotion render failed');
      throw AppError.internal(`Remotion render failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await rm(mediaDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
