import type { Canvas, LayerRegion, Rect, ResolvedLayer, TemplateLayer } from '../types/template.js';

/** Per-type default z-index when a layer doesn't declare one explicitly. */
const DEFAULT_Z_INDEX: Record<string, number> = {
  background: 0,
  gradient: 1,
  rectangle: 2,
  video: 10,
  image: 15,
  logo: 16,
  header: 20,
  title: 21,
  text: 22,
  subtitle: 30,
  watermark: 40,
};

/** Regions stack in this fixed vertical order. */
const REGION_ORDER: LayerRegion[] = ['top', 'middle', 'bottom'];

const DEFAULT_HEIGHT_FRACTION = 1;

interface EnrichedLayer extends TemplateLayer {
  value?: string;
}

/**
 * Turns a template's declarative positioning into pixel rects. Absolute
 * layers resolve directly against the canvas; relative layers stack inside
 * their named region, with heights renormalized among whichever siblings
 * actually survived binding resolution — this is what prevents empty
 * placeholders when an optional layer is hidden.
 */
export interface ILayoutService {
  computeLayout(canvas: Canvas, layers: EnrichedLayer[]): ResolvedLayer[];
}

function resolveDimension(value: number | string | undefined, total: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return value;
  const match = /^(-?\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (match) return (Number(match[1]) / 100) * total;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

/** FFmpeg filter options (`s=`, `scale=`, ...) require integer dimensions. */
function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

function applyMargin(rect: Rect, margin: number | undefined): Rect {
  if (!margin) return rect;
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: Math.max(0, rect.width - margin * 2),
    height: Math.max(0, rect.height - margin * 2),
  };
}

export class LayoutService implements ILayoutService {
  computeLayout(canvas: Canvas, layers: EnrichedLayer[]): ResolvedLayer[] {
    const safeArea = canvas.safeArea ?? {};
    const contentBox: Rect = {
      x: safeArea.left ?? 0,
      y: safeArea.top ?? 0,
      width: canvas.width - (safeArea.left ?? 0) - (safeArea.right ?? 0),
      height: canvas.height - (safeArea.top ?? 0) - (safeArea.bottom ?? 0),
    };

    const relativeLayers = layers.filter((l) => l.style.position.mode === 'relative');
    const absoluteLayers = layers.filter((l) => l.style.position.mode !== 'relative');

    const rects = new Map<string, Rect>();

    // Every relative layer's heightFraction is a share of the FULL content
    // box, renormalized to sum to 1 over whatever survived binding
    // resolution — this is what keeps bands filling the canvas exactly when
    // an optional layer is hidden, instead of leaving an empty gap.
    const totalFractionAllRegions = relativeLayers.reduce(
      (sum, l) => sum + (l.style.position.heightFraction ?? DEFAULT_HEIGHT_FRACTION),
      0,
    );
    const scale = totalFractionAllRegions > 0 ? contentBox.height / totalFractionAllRegions : 0;

    let cursorY = contentBox.y;
    for (const region of REGION_ORDER) {
      const members = relativeLayers.filter((l) => l.style.position.region === region);

      for (const layer of members) {
        const height = (layer.style.position.heightFraction ?? DEFAULT_HEIGHT_FRACTION) * scale;
        const rect = applyMargin(
          { x: contentBox.x, y: cursorY, width: contentBox.width, height },
          layer.style.margin,
        );
        rects.set(layer.id, rect);
        cursorY += height;
      }
    }

    for (const layer of absoluteLayers) {
      const { position } = layer.style;
      const width = resolveDimension(position.width, canvas.width, canvas.width);
      const height = resolveDimension(position.height, canvas.height, canvas.height);
      const x = resolveDimension(position.x, canvas.width, 0);
      const y = resolveDimension(position.y, canvas.height, 0);
      rects.set(layer.id, applyMargin({ x, y, width, height }, layer.style.margin));
    }

    const resolvedLayers: ResolvedLayer[] = layers.map((layer) => ({
      ...layer,
      rect: roundRect(rects.get(layer.id) ?? { x: 0, y: 0, width: canvas.width, height: canvas.height }),
    }));

    return resolvedLayers.sort(
      (a, b) => (a.style.zIndex ?? DEFAULT_Z_INDEX[a.type] ?? 10) - (b.style.zIndex ?? DEFAULT_Z_INDEX[b.type] ?? 10),
    );
  }
}
