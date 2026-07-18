/** Metadata for one fully rendered, upload-ready short. */
export interface RenderedClipMetadata {
  id: number;
  title: string;
  reason: string;
  hook: string;
  score: number;
  start: number;
  end: number;
  duration: number;
  resolution: string;
  video: string;
  subtitle: string;
  thumbnail: string;
  /** Which template composed this clip (e.g. "sports"). */
  template: string;
}

export type RenderErrorCode =
  | 'INVALID_TIMESTAMP'
  | 'DURATION_OUT_OF_RANGE'
  | 'INVALID_SUBTITLE'
  | 'MISSING_FONT'
  | 'UNSUPPORTED_CODEC'
  | 'FFMPEG_FAILED'
  | 'OUTPUT_WRITE_FAILED'
  | 'THUMBNAIL_FAILED'
  | 'CORRUPTED_OUTPUT'
  | 'TEMPLATE_BINDING_ERROR'
  | 'TEMPLATE_RENDER_FAILED';

/** Per-clip render failure; other clips still render independently. */
export interface RenderError {
  index: number;
  code: RenderErrorCode;
  message: string;
  start?: number;
  end?: number;
  ffmpegStderr?: string;
  timestamp: string;
}

/** Aggregate result of rendering every requested short. */
export interface RenderSummary {
  clips: RenderedClipMetadata[];
  errors: RenderError[];
}

/** A refined, speech-boundary-aware clip range, ready to render. */
export interface RefinedRange {
  start: number;
  end: number;
}
