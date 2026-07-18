import type { ILayerFilterBuilder, LayerBuildContext, LayerFilterFragment } from '../layer-registry.js';

const DEFAULT_GRADIENT: { from: string; to: string; direction?: 'vertical' | 'horizontal' } = {
  from: '#000000',
  to: '#000000',
};

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function lerpExpression(from: number, to: number, axisFraction: string): string {
  return `(${from}+(${to - from})*(${axisFraction}))`;
}

/**
 * Renders a two-stop linear gradient via `geq`, painted in-place: only
 * pixels inside the layer's rect are replaced with the interpolated color
 * (over `Y/H` for vertical, `X/W` for horizontal); everything outside
 * passes through the existing frame via `r(X,Y)`/`g(X,Y)`/`b(X,Y)`.
 * Registered and structurally validated, but not exercised by any of the 3
 * shipped templates — lower confidence than the other builders, flagged
 * rather than silently shipped as fully tested.
 */
export class GradientLayerBuilder implements ILayerFilterBuilder {
  build({ layer, compositeLabel, allocateLabel }: LayerBuildContext): LayerFilterFragment {
    const { x, y, width, height } = layer.rect;
    const gradient = layer.style.gradient ?? DEFAULT_GRADIENT;
    const from = parseHex(gradient.from);
    const to = parseHex(gradient.to);
    const x0 = x;
    const x1 = x + width;
    const y0 = y;
    const y1 = y + height;
    const axisFraction =
      gradient.direction === 'horizontal' ? `(X-${x0})/${width}` : `(Y-${y0})/${height}`;
    const outputLabel = allocateLabel('gradient');

    const inside = `between(X\\,${x0}\\,${x1})*between(Y\\,${y0}\\,${y1})`;
    const channelExpr = (fromVal: number, toVal: number, passthrough: string): string =>
      `if(${inside}\\,${lerpExpression(fromVal, toVal, axisFraction)}\\,${passthrough})`;

    const rExpr = channelExpr(from.r, to.r, 'r(X\\,Y)');
    const gExpr = channelExpr(from.g, to.g, 'g(X\\,Y)');
    const bExpr = channelExpr(from.b, to.b, 'b(X\\,Y)');

    return {
      inputs: [],
      filterLines: [`[${compositeLabel}]geq=r='${rExpr}':g='${gExpr}':b='${bExpr}'[${outputLabel}]`],
      outputLabel,
      inPlace: true,
    };
  }
}
