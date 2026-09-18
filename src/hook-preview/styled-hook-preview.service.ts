import { join, extname } from 'node:path';
import { mkdir, writeFile, stat, link as linkFile, copyFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runCommand } from '../utils/exec.js';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';
import {
  type VisualPresetId,
  type HookType,
  type HookAngle,
  type CompositionLayout,
  type AnimationPreset,
  type TypographyVariant,
  type BadgePresetId,
  resolveVisualPreset,
  adaptLegacyHookStyle,
} from '../types/visual-preset.js';

export interface StyledHookPreviewOptions {
  /** Path to the compositions directory (contains `src/index.tsx` + `public/`). */
  compositionsDir: string;
  /** FFmpeg binary — used only to probe the rendered duration. */
  ffmpegBinaryPath?: string;
  logger: Logger;
}

/** Injectable command runner (tests stub this instead of spawning Remotion). */
export type CommandRunner = typeof runCommand;

export interface StyledHookPreviewInput {
  /** Absolute path of the full source video. */
  videoPath: string;
  /** Absolute seconds into the source video where the hook footage starts. */
  start: number;
  /** Absolute seconds into the source video where the hook footage ends. */
  end: number;
  /** Total intro duration in seconds (usually `spokenHook.duration`). */
  durationSeconds: number;
  /** On-screen kinetic headline (= RankedHook.headline.text). */
  headlineText: string;
  /** Optional category/pattern-interrupt tag (e.g. "🔥 MOMEN VIRAL"). */
  tag?: string;
  /** Words rendered in accent color inside the headline. */
  highlightWords?: string[];
  /** Social-proof badge shown for ~2s (e.g. "10RB+ Views"). */
  badge?: string;
  /** Channel watermark bottom-left. */
  channelName?: string;
  /** Deterministic palette seed (e.g. `${videoId}:${style}`). */
  themeSeed: string;
  /** Directory the preview file is written to. */
  outputDir: string;
  /** File name (without extension) for the preview. */
  fileName: string;

  // ── Visual style fields (Phase 3) ──────────────────────────────────────
  /**
   * Explicit user-selected visual preset ID.
   * When provided, overrides auto-resolution.
   */
  visualPreset?: VisualPresetId;
  /**
   * Structural form of the hook (from AI classification, Phase 5).
   * Used by the resolver when no manual preset is given.
   */
  hookType?: HookType;
  /**
   * Emotional/rhetorical angle (from AI classification, Phase 5).
   * Used by the resolver when no manual preset is given.
   */
  angle?: HookAngle;
  layout?: CompositionLayout;
  animation?: AnimationPreset;
  typography?: TypographyVariant;
  badgePresetId?: BadgePresetId;
  badgeColor?: string;
  /**
   * Legacy flat hook style string from the LLM pipeline.
   * Used only as a last-resort fallback via adaptLegacyHookStyle().
   * @deprecated Pass visualPreset, hookType + angle instead.
   */
  legacyHookStyle?: string;
}

export interface StyledHookPreviewOutput {
  path: string;
  durationSeconds: number;
  sizeBytes: number;
}

/** DI-friendly shape of the styled preview renderer. */
export interface IStyledHookPreview {
  render(input: StyledHookPreviewInput): Promise<StyledHookPreviewOutput>;
}

/**
 * Renders one styled hook intro (`HookIntroShort` Remotion composition) —
 * the exact opening a full clipper render produces: kinetic headline over the
 * hook's source footage, social badge, channel watermark, deterministic theme.
 * Muted by design (the reel intro plays without audio).
 *
 * Mirrors RemotionCompositionEngine's media staging (Remotion only serves
 * files from its project `public/` folder) but is far smaller: no narration,
 * no plan, no fallback engine.
 */
export class StyledHookPreviewService {
  constructor(
    private readonly options: StyledHookPreviewOptions,
    private readonly runCommandFn: CommandRunner = runCommand,
  ) {}

  async render(input: StyledHookPreviewInput): Promise<StyledHookPreviewOutput> {
    const { compositionsDir, logger } = this.options;

    const jobId = randomUUID();
    const outputDir = join(input.outputDir);
    const outputPath = join(outputDir, `${input.fileName}.mp4`);
    const propsPath = join(outputDir, `${input.fileName}.props.json`);

    // Stage media under public/ so the Remotion render server can serve it.
    const mediaDir = join(compositionsDir, 'public', 'media', `hook-${jobId}`);
    const stagedVideoPath = `media/hook-${jobId}/source${extname(input.videoPath) || '.mp4'}`;
    const sourceDuration = Math.max(0.5, Number((input.end - input.start).toFixed(2)));
    const targetDuration = input.durationSeconds > 0
      ? Math.min(input.durationSeconds, sourceDuration)
      : sourceDuration;

    // Resolve visual preset:
    //   1. Explicit user selection wins.
    //   2. Resolver uses hookType + angle (Phase 5 — both currently undefined).
    //   3. Legacy hookStyle adapter as last-resort backward compat.
    //   4. Falls back to kinetic-punch (visual default).
    const resolvedPreset = resolveVisualPreset({
      manualPreset: input.visualPreset ?? adaptLegacyHookStyle(input.legacyHookStyle),
      hookType: input.hookType,
      angle: input.angle,
    });

    const props = {
      hook: {
        duration: targetDuration,
        headlineText: input.headlineText,
        ...(input.tag ? { tag: input.tag } : {}),
        ...(input.highlightWords?.length ? { highlightWords: input.highlightWords } : {}),
        ...(input.badge ? { badge: input.badge } : {}),
        ...(input.channelName ? { channelName: input.channelName } : {}),
        themeSeed: input.themeSeed,
        // New: visual preset ID consumed by HookIntroShort → HookHeadline.
        visualPresetId: resolvedPreset.id,
        layout: input.layout ?? resolvedPreset.layout ?? 'centered',
        ...(input.animation ? { animation: input.animation } : {}),
        ...(input.typography ? { typography: input.typography } : {}),
        ...(input.badgePresetId ? { badgePresetId: input.badgePresetId } : {}),
        ...(input.badgeColor ? { badgeColor: input.badgeColor } : {}),
      },
      sourceVideoPath: stagedVideoPath,
      sourceStart: input.start,
      sourceEnd: input.end,
    };

    try {
      await ensureDir(outputDir);
      await mkdir(mediaDir, { recursive: true });
      await this.stageFile(input.videoPath, mediaDir, `source${extname(input.videoPath) || '.mp4'}`);

      await writeFile(propsPath, JSON.stringify(props, null, 2), 'utf-8');

      const remotionBin = join(
        compositionsDir,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'remotion.cmd' : 'remotion',
      );

      logger.info({ outputPath }, 'Rendering styled hook preview');
      await this.runCommandFn(
        remotionBin,
        [
          'render',
          join(compositionsDir, 'src', 'index.tsx'),
          'HookIntroShort',
          outputPath,
          `--props=${propsPath}`,
          '--image-format=jpeg',
          '--log=error',
        ],
        { cwd: compositionsDir },
      );
      logger.info({ outputPath }, 'Styled hook preview complete');

      const stats = await stat(outputPath);
      let durationSeconds = props.hook.duration;
      try {
        const { probeDurationSeconds } = await import('../utils/ffmpeg.js');
        durationSeconds = await probeDurationSeconds({
          binaryPath: this.options.ffmpegBinaryPath ?? 'ffmpeg',
          inputPath: outputPath,
        });
      } catch {
        // Probe failure is non-fatal — keep the planned duration.
      }

      return { path: outputPath, durationSeconds, sizeBytes: stats.size };
    } finally {
      await rm(mediaDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Hard-links a file into the staging dir, falling back to copying. */
  private async stageFile(source: string, destDir: string, name: string): Promise<string> {
    const dest = join(destDir, name);
    try {
      await linkFile(source, dest);
    } catch {
      await copyFile(source, dest);
    }
    return dest;
  }
}
