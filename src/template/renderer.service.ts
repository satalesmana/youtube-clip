import { runCommand, CommandError } from '../utils/exec.js';
import { retry } from '../utils/retry.js';
import type { ILayoutService } from './layout.service.js';
import type { ITemplateAssService } from './ass.service.js';
import type { IFiltergraphService, RenderHints } from './filtergraph.service.js';
import type { EnrichedLayer } from './template.service.js';
import type { Canvas, RenderContext } from '../types/template.js';
import type { Logger } from '../utils/logger.js';
export interface TemplateRendererServiceOptions {
  ffmpegBinaryPath: string;
  preset: string;
  crf: number;
  audioBitrateKbps: number;
  maxRetries: number;
}

export interface ComposeInput {
  context: RenderContext;
  enrichedLayers: EnrichedLayer[];
  canvas: Canvas;
  templateDir: string;
  assPath: string;
  outputPath: string;
  hints: RenderHints;
  logger?: Logger;
}

export type TemplateRenderErrorCode = 'TEMPLATE_RENDER_FAILED' | 'UNSUPPORTED_CODEC' | 'OUTPUT_WRITE_FAILED';

export class TemplateRenderError extends Error {
  constructor(
    readonly code: TemplateRenderErrorCode,
    message: string,
    readonly ffmpegStderr?: string,
  ) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

function classifyFfmpegError(stderr: string | undefined): TemplateRenderErrorCode {
  const text = (stderr ?? '').toLowerCase();
  if (text.includes('no space left on device') || text.includes('permission denied')) {
    return 'OUTPUT_WRITE_FAILED';
  }
  if (
    text.includes('unsupported codec') ||
    text.includes('could not find codec parameters') ||
    text.includes('invalid data found when processing input')
  ) {
    return 'UNSUPPORTED_CODEC';
  }
  return 'TEMPLATE_RENDER_FAILED';
}

/**
 * "Recalculate Layout → Generate ASS Subtitle → Generate FFmpeg Filter Graph
 * → Render" for one clip. Never knows whether it's rendering Sports, News,
 * or Podcast — everything it needs is already resolved into `enrichedLayers`
 * + `canvas` by the time `compose` is called.
 */
export interface ITemplateRendererService {
  compose(input: ComposeInput): Promise<void>;
}

export class TemplateRendererService implements ITemplateRendererService {
  constructor(
    private readonly options: TemplateRendererServiceOptions,
    private readonly layoutService: ILayoutService,
    private readonly templateAssService: ITemplateAssService,
    private readonly filtergraphService: IFiltergraphService,
  ) {}

  async compose({ context, enrichedLayers, canvas, templateDir, assPath, outputPath, hints, logger }: ComposeInput): Promise<void> {
    const resolvedLayers = this.layoutService.computeLayout(canvas, enrichedLayers);

    const subtitleLayer = resolvedLayers.find((l) => l.type === 'subtitle');
    if (subtitleLayer) {
      await this.templateAssService.render(subtitleLayer, canvas, context.subtitle.words, assPath);
    }

    const plan = this.filtergraphService.build(canvas, resolvedLayers, context, templateDir, assPath, hints);

    const args: string[] = ['-y'];
    for (const inputArgs of plan.inputArgs) {
      args.push(...inputArgs);
    }
    args.push('-filter_complex', plan.filterComplex, '-map', `[${plan.videoLabel}]`);

    if (plan.audioInputIndex !== undefined) {
      args.push('-map', `${plan.audioInputIndex}:a`, '-c:a', 'aac', '-b:a', `${this.options.audioBitrateKbps}k`);
    }

    args.push(
      '-c:v',
      'libx264',
      '-preset',
      this.options.preset,
      '-crf',
      String(this.options.crf),
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    );

    try {
      await retry(() => runCommand(this.options.ffmpegBinaryPath, args, { logger }), { attempts: this.options.maxRetries });
    } catch (error) {
      const ffmpegStderr = error instanceof CommandError ? error.stderr : undefined;
      throw new TemplateRenderError(
        classifyFfmpegError(ffmpegStderr),
        `FFmpeg failed to compose the template render.`,
        ffmpegStderr,
      );
    }
  }
}
