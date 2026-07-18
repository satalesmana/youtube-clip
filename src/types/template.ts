import type { SubtitleEvent } from './subtitle.js';

/** The set of layer techniques the renderer ships with; new kinds register via `LayerRegistry`. */
export type LayerType =
  | 'background'
  | 'gradient'
  | 'rectangle'
  | 'image'
  | 'logo'
  | 'header'
  | 'title'
  | 'text'
  | 'video'
  | 'subtitle'
  | 'watermark';

export interface SafeArea {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Canvas {
  width: number;
  height: number;
  safeArea?: SafeArea;
}

export type LayerRegion = 'top' | 'middle' | 'bottom';

export interface LayerPosition {
  mode: 'absolute' | 'relative';
  /** Absolute mode: pixels, or a `"NN%"` string relative to the canvas. */
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  /** Relative mode: which vertical band this layer stacks into. */
  region?: LayerRegion;
  /** Relative mode: this layer's share of its region's stack height, renormalized among visible siblings. */
  heightFraction?: number;
}

export type VideoFit = 'contain' | 'cover' | 'blur-background';

export interface LayerStyle {
  position: LayerPosition;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  padding?: number;
  margin?: number;
  zIndex?: number;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  gradient?: { from: string; to: string; direction?: 'vertical' | 'horizontal' };
  font?: string;
  fontSize?: number;
  bold?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowDepth?: number;
  /** `video` layer only. */
  fit?: VideoFit;
  /** Static asset path, relative to the template folder (background/image/logo layers without a `binding`). */
  src?: string;
  /** Forward-compat: future layer kinds (progress bar, QR, ...) may carry arbitrary extra style props. */
  [key: string]: unknown;
}

export interface TemplateLayer {
  id: string;
  type: LayerType;
  /** Dynamic value reference, e.g. `"{{clip.title}}"`. */
  binding?: string;
  /** Static literal content (e.g. a "BREAKING NEWS" header label). Mutually exclusive with `binding`. */
  text?: string;
  /** If true and `binding` resolves to nothing, the layer is dropped instead of failing the render. */
  optional?: boolean;
  /** Explicit hard override; defaults to true. */
  visible?: boolean;
  style: LayerStyle;
}

export interface Template {
  id: string;
  canvas: Canvas;
  layers: TemplateLayer[];
}

export interface TemplateManifest {
  id: string;
  name: string;
  version: string;
  default?: boolean;
  description?: string;
  aspectRatio: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A layer that survived binding resolution, with its resolved value and computed pixel rect. */
export interface ResolvedLayer extends TemplateLayer {
  value?: string;
  rect: Rect;
}

/** Every template receives the same rendering context — the template's only source of truth. */
export interface RenderContext {
  clip: {
    title: string;
    score: number;
    duration: number;
    start: number;
    end: number;
  };
  /** The original source video; `clip.start`/`clip.end` are the trim points into it. */
  video: {
    path: string;
  };
  subtitle: {
    /** Destination path the ASS file is (or will be) written to. */
    ass: string;
    words: SubtitleEvent[];
  };
  thumbnail?: {
    path: string;
  };
  channel?: {
    name?: string;
    logo?: string;
  };
}
