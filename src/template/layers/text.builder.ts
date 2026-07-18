import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';

const DEFAULT_FONT = 'Arial';
const DEFAULT_FONT_SIZE = 56;
const DEFAULT_COLOR = '#FFFFFF';

/**
 * Escapes text for safe embedding inside a single-quoted FFmpeg
 * `drawtext=text='...'` argument. Single quotes only protect against
 * whitespace splitting — FFmpeg's filtergraph parser still treats `:`
 * (option separator), `,`/`;` (filter/chain separators), and `%` (drawtext's
 * own expansion syntax) as special even inside them, so all must be
 * backslash-escaped regardless of quoting.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ');
}

function xExpression(rectX: number, rectWidth: number, align: string | undefined, padding: number): string {
  switch (align) {
    case 'left':
      return `${rectX + padding}`;
    case 'right':
      return `${rectX + rectWidth - padding}-text_w`;
    default:
      return `${rectX}+(${rectWidth}-text_w)/2`;
  }
}

function yExpression(rectY: number, rectHeight: number, verticalAlign: string | undefined, padding: number): string {
  switch (verticalAlign) {
    case 'top':
      return `${rectY + padding}`;
    case 'bottom':
      return `${rectY + rectHeight - padding}-text_h`;
    default:
      return `${rectY}+(${rectHeight}-text_h)/2`;
  }
}

/**
 * Renders `title`/`header`/`text` layers via `drawtext`, painted in-place
 * directly onto the running composite at the layer's absolute rect
 * coordinates (rather than a standalone branch `overlay`'d in) — `overlay`
 * needs real alpha to blend two independently generated `color` sources,
 * which `drawbox` does not reliably produce starting from a transparent
 * base, so in-place painting sidesteps that class of bug entirely. Draws an
 * optional full-rect background fill first (this is how the News template's
 * "BREAKING NEWS" banner is built, with no separate rectangle layer needed).
 */
export class TextLayerBuilder implements ILayerFilterBuilder {
  build({ layer, compositeLabel, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    const { x, y, width, height } = layer.rect;
    const text = escapeDrawtext(layer.value ?? '');
    const fontSize = layer.style.fontSize ?? DEFAULT_FONT_SIZE;
    const fontColor = layer.style.color ?? DEFAULT_COLOR;
    const font = layer.style.font ?? DEFAULT_FONT;
    const padding = layer.style.padding ?? 0;

    const filterLines: string[] = [];
    let currentLabel = compositeLabel;

    if (layer.style.backgroundColor) {
      const boxLabel = allocateLabel('textbox');
      filterLines.push(`[${currentLabel}]drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${layer.style.backgroundColor}:t=fill[${boxLabel}]`);
      currentLabel = boxLabel;
    }

    const outputLabel = allocateLabel('text');

    filterLines.push(
      `[${currentLabel}]drawtext=text='${text}':font=${font}:fontsize=${fontSize}:fontcolor=${fontColor}` +
        (layer.style.outlineColor ? `:bordercolor=${layer.style.outlineColor}:borderw=${layer.style.outlineWidth ?? 2}` : '') +
        (layer.style.shadowColor ? `:shadowcolor=${layer.style.shadowColor}:shadowx=2:shadowy=2` : '') +
        `:x=${xExpression(x, width, layer.style.align, padding)}:y=${yExpression(y, height, layer.style.verticalAlign, padding)}[${outputLabel}]`,
    );

    return { inputs: [], filterLines, outputLabel, inPlace: true };
  }
}
