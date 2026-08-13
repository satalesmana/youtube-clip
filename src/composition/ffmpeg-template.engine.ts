import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { probeDurationSeconds } from '../utils/ffmpeg.js';
import type { Logger } from '../utils/logger.js';
import type { VideoPlan } from '../types/video-plan.js';
import type { RenderOutput, CompositionAssets, ICompositionEngine } from './composition.types.js';
import type { ITemplateService } from '../template/template.service.js';
import type { ITemplateRendererService } from '../template/renderer.service.js';
import type { RenderContext } from '../types/template.js';

/**
 * FFmpeg template composition engine — wraps the existing template renderer.
 */
export class FfmpegTemplateCompositionEngine implements ICompositionEngine {
  readonly kind = 'ffmpeg-template' as const;

  constructor(
    private readonly templateService: ITemplateService,
    private readonly templateRendererService: ITemplateRendererService,
    private readonly outputsDir: string,
    private readonly logger: Logger,
  ) {}

  async render(
    plan: VideoPlan,
    assets: CompositionAssets,
  ): Promise<RenderOutput> {
    const { templateService, templateRendererService, outputsDir, logger } = this;

    // Build output path — per-video workspace when a videoId is available,
    // otherwise a shared render root.
    const jobId = crypto.randomUUID();
    const renderRoot = assets.videoId
      ? join(outputsDir, assets.videoId, 'render')
      : join(outputsDir, 'render');
    const outputDir = join(renderRoot, jobId);
    const outputPath = join(outputDir, 'rendered.mp4');

    // Build RenderContext
    const commentaryText = plan.scenes
      .filter((s) => s.type === 'commentary')
      .map((s) => s.narration)
      .join(' ');

    const context: RenderContext = {
      clip: { title: 'AI Commentary', score: 99, duration: plan.duration, start: 0, end: plan.duration },
      video: { path: assets.sourceVideo },
      subtitle: { ass: '', words: [] },
      channel: assets.channelName ? { name: assets.channelName } : undefined,
      commentary: { text: commentaryText },
    };

    try {
      const loaded = await templateService.load('commentary');
      const enriched = await templateService.resolveLayers(loaded, context);
      await templateRendererService.compose({
        context,
        enrichedLayers: enriched,
        canvas: loaded.template.canvas,
        templateDir: loaded.templateDir,
        assPath: '',
        outputPath,
        hints: { sourceWidth: 1920, sourceHeight: 1080, focalPoint: { x: 0.5, y: 0.5 } },
        logger,
      });

      // Add audio
      await this.addAudio(outputPath, assets.narration, plan.duration);

      const stats = await import('node:fs/promises').then(m => m.stat(outputPath));
      const duration = await probeDurationSeconds({ binaryPath: 'ffmpeg', inputPath: outputPath });

      return {
        path: outputPath,
        durationSeconds: duration,
        sizeBytes: stats.size,
      };
    } catch (error) {
      logger.warn({ error }, 'Template render failed');
      throw error;
    }
  }

  private async addAudio(videoPath: string, audioPath: string, duration: number): Promise<void> {
    const { runCommand } = await import('../utils/exec.js');
    const tempPath = join(videoPath, '..', 'temp.mp4');

    await runCommand('ffmpeg', [
      '-y', '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k',
      '-map', '0:v', '-map', '1:a',
      '-t', String(duration),
      '-shortest',
      tempPath,
    ]);

    await rename(tempPath, videoPath);
  }
}
