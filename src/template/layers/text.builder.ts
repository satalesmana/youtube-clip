import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';
import type { LayerStyle } from '../../types/template.js';

const DEFAULT_FONT = 'Arial';
const DEFAULT_FONT_SIZE = 56;
const DEFAULT_COLOR = '#FFFFFF';
const MIN_FONT_SIZE_FLOOR = 24;
const LINE_HEIGHT_RATIO = 1.15;
/** No text-measurement library is available at build time (FFmpeg's own `text_w`/`text_h` expressions are only
 *  evaluated at render time, per drawtext call, so they can't inform where to break lines beforehand) — these are
 *  rough average glyph-width-to-fontSize ratios for a typical sans-serif family, used only to pick wrap points and
 *  size the optional per-line background box. Actual glyph rendering may run slightly narrower or wider. */
const CHAR_WIDTH_RATIO = 0.55;
const BOLD_CHAR_WIDTH_RATIO = 0.62;

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

function charWidth(fontSize: number, bold: boolean): number {
  return fontSize * (bold ? BOLD_CHAR_WIDTH_RATIO : CHAR_WIDTH_RATIO);
}

function estimateTextWidth(text: string, fontSize: number, bold: boolean): number {
  return text.length * charWidth(fontSize, bold);
}

/** Greedily wraps `text` on whitespace so each line's estimated width fits `maxWidth`. */
function wrapLines(text: string, maxWidth: number, fontSize: number, bold: boolean): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth(fontSize, bold)));
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Wraps `text` to `maxWidth`, shrinking `fontSize` (down to a floor) until the wrapped block fits `maxHeight`. */
function fitTextBlock(
  text: string,
  maxWidth: number,
  maxHeight: number,
  startFontSize: number,
  bold: boolean,
  minFontSize: number | undefined,
): { lines: string[]; fontSize: number } {
  const floor = Math.max(MIN_FONT_SIZE_FLOOR, minFontSize ?? Math.round(startFontSize * 0.5));
  let fontSize = startFontSize;
  let lines = wrapLines(text, maxWidth, fontSize, bold);
  while (lines.length * fontSize * LINE_HEIGHT_RATIO > maxHeight && fontSize > floor) {
    fontSize -= 2;
    lines = wrapLines(text, maxWidth, fontSize, bold);
  }
  return { lines, fontSize };
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

/** Top of the vertically-centered/top/bottom-aligned line block within the rect — a plain number, since (unlike
 *  per-line text height) the block's total height is already known build-side once lines are wrapped. */
function blockTop(rectY: number, rectHeight: number, verticalAlign: string | undefined, padding: number, blockHeight: number): number {
  switch (verticalAlign) {
    case 'top':
      return rectY + padding;
    case 'bottom':
      return rectY + rectHeight - padding - blockHeight;
    default:
      return rectY + (rectHeight - blockHeight) / 2;
  }
}

/** Left edge for a snug per-line background box of `boxWidth`, honoring the layer's horizontal `align`. */
function boxLeft(rectX: number, rectWidth: number, align: string | undefined, boxWidth: number): number {
  switch (align) {
    case 'left':
      return rectX;
    case 'right':
      return rectX + rectWidth - boxWidth;
    default:
      return rectX + (rectWidth - boxWidth) / 2;
  }
}

/**
 * Renders `title`/`header`/`text` layers via `drawtext`, painted in-place
 * directly onto the running composite at the layer's absolute rect
 * coordinates (rather than a standalone branch `overlay`'d in) — `overlay`
 * needs real alpha to blend two independently generated `color` sources,
 * which `drawbox` does not reliably produce starting from a transparent
 * base, so in-place painting sidesteps that class of bug entirely.
 *
 * Text is wrapped to the rect's width and, if the wrapped block would
 * overflow the rect's height, `fontSize` shrinks (down to `minFontSize`)
 * until it fits — the layer never grows past the space the layout already
 * gave it. An optional `backgroundColor` box is drawn first: `'block'`
 * (default) fills the whole rect once — this is how the News template's
 * "BREAKING NEWS" banner is built — while `'line'` draws a snug box behind
 * each wrapped line individually, for a highlighted-caption look.
 */
export class TextLayerBuilder implements ILayerFilterBuilder {
  build({ layer, compositeLabel, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    const { x, y, width, height } = layer.rect;
    const style: LayerStyle = layer.style;
    const fontColor = style.color ?? DEFAULT_COLOR;
    const bold = style.bold ?? false;
    const font = bold ? `${style.font ?? DEFAULT_FONT} Bold` : (style.font ?? DEFAULT_FONT);
    const padding = style.padding ?? 0;

    const maxWidth = Math.max(1, width - padding * 2);
    const maxHeight = Math.max(1, height - padding * 2);
    const { lines, fontSize } = fitTextBlock(
      layer.value ?? '',
      maxWidth,
      maxHeight,
      style.fontSize ?? DEFAULT_FONT_SIZE,
      bold,
      style.minFontSize,
    );

    const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO);
    const blockHeight = lines.length * lineHeight;
    const top = blockTop(y, height, style.verticalAlign, padding, blockHeight);

    const backgroundFit = style.backgroundFit ?? 'block';
    const filterLines: string[] = [];
    let currentLabel = compositeLabel;

    if (style.backgroundColor && backgroundFit === 'block') {
      const boxLabel = allocateLabel('textbox');
      filterLines.push(
        `[${currentLabel}]drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=${style.backgroundColor}:t=fill[${boxLabel}]`,
      );
      currentLabel = boxLabel;
    }

    for (const [i, line] of lines.entries()) {
      const lineTop = Math.round(top + i * lineHeight);

      if (style.backgroundColor && backgroundFit === 'line' && line.length > 0) {
        const boxPadding = style.backgroundPadding ?? Math.round(fontSize * 0.3);
        const boxWidth = Math.min(maxWidth, Math.round(estimateTextWidth(line, fontSize, bold) + boxPadding * 2));
        const boxX = Math.round(boxLeft(x, width, style.align, boxWidth));
        const boxLabel = allocateLabel('textbox');
        filterLines.push(
          `[${currentLabel}]drawbox=x=${boxX}:y=${lineTop}:w=${boxWidth}:h=${lineHeight}:color=${style.backgroundColor}:t=fill[${boxLabel}]`,
        );
        currentLabel = boxLabel;
      }

      const text = escapeDrawtext(line);
      const outputLabel = allocateLabel('text');
      filterLines.push(
        `[${currentLabel}]drawtext=text='${text}':font=${font}:fontsize=${fontSize}:fontcolor=${fontColor}` +
          (style.outlineColor ? `:bordercolor=${style.outlineColor}:borderw=${style.outlineWidth ?? 2}` : '') +
          (style.shadowColor ? `:shadowcolor=${style.shadowColor}:shadowx=2:shadowy=2` : '') +
          `:x=${xExpression(x, width, style.align, padding)}:y=${lineTop}+(${lineHeight}-text_h)/2[${outputLabel}]`,
      );
      currentLabel = outputLabel;
    }

    return { inputs: [], filterLines, outputLabel: currentLabel, inPlace: true };
  }
}
