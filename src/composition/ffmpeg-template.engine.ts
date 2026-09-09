import { mkdir, rename } from 'node:fs/promises';
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
    const assPath = join(outputDir, 'subtitles.ass');
    await mkdir(outputDir, { recursive: true });

    // Build RenderContext
    const commentaryText = plan.scenes
      .filter((s) => s.type === 'commentary')
      .map((s) => s.narration)
      .join(' ');

    const context: RenderContext = {
      clip: { title: 'AI Commentary', score: 99, duration: plan.duration, start: 0, end: plan.duration },
      video: { path: assets.sourceVideo },
      subtitle: { ass: assPath, words: [] },
      channel: assets.channelName ? { name: assets.channelName } : undefined,
      commentary: { text: commentaryText },
    };

    try {
      const loaded = await templateService.load(assets.templateId ?? 'commentary');
      const enriched = await templateService.resolveLayers(loaded, context);
      await templateRendererService.compose({
        context,
        enrichedLayers: enriched,
        canvas: loaded.template.canvas,
        templateDir: loaded.templateDir,
        assPath,
        outputPath,
        hints: { sourceWidth: 1920, sourceHeight: 1080, focalPoint: { x: 0.5, y: 0.5 } },
        logger,
      });

      // Add audio using the requested mode.
      await this.addAudio(
        outputPath,
        assets.narration,
        plan.duration,
        assets.audioMode,
        assets.sourceAudioVolume,
      );

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

  /**
   * Applies the requested audio mode to `videoPath`:
   *
   * - `keep_original`  — Source audio is already embedded; no FFmpeg pass needed.
   * - `strip_original` — (default) Replaces source audio track with the TTS narration.
   * - `voice_over`     — Mixes TTS narration on top of the source audio, attenuating
   *                      the source by `sourceAudioVolume` (default 0.3 ≈ −10 dB).
   */
  private async addAudio(
    videoPath: string,
    audioPath: string,
    duration: number,
    audioMode: import('../types/audio-mode.js').AudioMode = 'strip_original',
    sourceAudioVolume = 0.3,
  ): Promise<void> {
    const { runCommand } = await import('../utils/exec.js');

    if (audioMode === 'keep_original') {
      // Source audio is already in the video from the template renderer.
      // No additional FFmpeg pass is needed.
      this.logger.info({ audioMode }, 'Audio mode: keep_original — retaining source audio as-is');
      return;
    }

    const tempPath = videoPath.replace(/\.mp4$/, '.audio-temp.mp4');

    if (audioMode === 'voice_over' && audioPath) {
      // Mix TTS narration over attenuated source audio.
      // [0:v] = video track (muxed), [0:a] = source audio, [1:a] = TTS narration.
      const vol = Math.min(1, Math.max(0, sourceAudioVolume));
      this.logger.info({ audioMode, sourceAudioVolume: vol }, 'Audio mode: voice_over — mixing TTS over source audio');

      await runCommand('ffmpeg', [
        '-y',
        '-i', videoPath,       // [0] video with source audio
        '-i', audioPath,       // [1] TTS narration
        '-filter_complex', `[0:a]volume=${vol}[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-t', String(duration),
        tempPath,
      ], { logger: this.logger });
    } else {
      // strip_original (default): replace source audio with TTS narration only.
      this.logger.info({ audioMode }, 'Audio mode: strip_original — replacing source audio with TTS narration');

      await runCommand('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-map', '0:v',
        '-map', '1:a',
        '-t', String(duration),
        '-shortest',
        tempPath,
      ], { logger: this.logger });
    }

    await rename(tempPath, videoPath);
  }
}
