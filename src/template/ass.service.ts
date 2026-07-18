import { writeFile } from 'node:fs/promises';
import { runCommand } from '../utils/exec.js';
import type { IAssService } from '../services/ass.service.js';
import type { AssStyleConfig, SubtitleEvent } from '../types/subtitle.js';
import type { Canvas, ResolvedLayer } from '../types/template.js';

export interface TemplateAssServiceOptions {
  fallbackStyle: AssStyleConfig;
}

/**
 * Adapter between the template engine and the existing `IAssService`: turns
 * a resolved `subtitle` layer's style + layout rect into an `AssStyleConfig`
 * and delegates serialization to `src/services/ass.service.ts` unchanged —
 * reuse, not a second ASS implementation.
 */
export interface ITemplateAssService {
  render(subtitleLayer: ResolvedLayer, canvas: Canvas, events: SubtitleEvent[], assPath: string): Promise<void>;
}

export class TemplateAssService implements ITemplateAssService {
  private readonly fontAvailability = new Map<string, boolean>();

  constructor(
    private readonly assService: IAssService,
    private readonly options: TemplateAssServiceOptions,
  ) {}

  async render(subtitleLayer: ResolvedLayer, canvas: Canvas, events: SubtitleEvent[], assPath: string): Promise<void> {
    const style = this.buildStyle(subtitleLayer, canvas);
    await this.ensureFontAvailable(style.fontName);

    const content = this.assService.render(events, style);
    await writeFile(assPath, content, 'utf-8');
  }

  private buildStyle(layer: ResolvedLayer, canvas: Canvas): AssStyleConfig {
    const fallback = this.options.fallbackStyle;
    const { rect } = layer;

    // Alignment is fixed at bottom-center (see ass.service.ts); centering
    // the caption block vertically within the subtitle layer's own band
    // means expressing it as a fraction of the FULL canvas height.
    const verticalPositionFraction = canvas.height > 0 ? (rect.y + rect.height / 2) / canvas.height : fallback.verticalPositionFraction;

    return {
      fontName: layer.style.font ?? fallback.fontName,
      fontSize: layer.style.fontSize ?? fallback.fontSize,
      baseColorHex: layer.style.color ?? fallback.baseColorHex,
      highlightColorHex: fallback.highlightColorHex,
      keywordColorHex: fallback.keywordColorHex,
      outlineColorHex: layer.style.outlineColor ?? fallback.outlineColorHex,
      shadowColorHex: layer.style.shadowColor ?? fallback.shadowColorHex,
      outlineWidth: layer.style.outlineWidth ?? fallback.outlineWidth,
      shadowDepth: layer.style.shadowDepth ?? fallback.shadowDepth,
      verticalPositionFraction,
      animationStyle: fallback.animationStyle,
    };
  }

  /** Best-effort `fc-list` check, cached per font name (relocated from the old RendererService). */
  private async ensureFontAvailable(fontName: string): Promise<void> {
    if (this.fontAvailability.has(fontName)) {
      if (this.fontAvailability.get(fontName) === false) {
        throw new Error(`Configured subtitle font "${fontName}" was not found (fc-list).`);
      }
      return;
    }

    try {
      const { stdout } = await runCommand('fc-list', [':family']);
      const available = stdout.toLowerCase().includes(fontName.toLowerCase());
      this.fontAvailability.set(fontName, available);
      if (!available) {
        throw new Error(`Configured subtitle font "${fontName}" was not found (fc-list).`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('was not found')) throw error;
      // fc-list unavailable in this environment — inconclusive, don't hard-fail.
      this.fontAvailability.set(fontName, true);
    }
  }
}
