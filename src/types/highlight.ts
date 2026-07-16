import type { RenderError, RenderedClipMetadata } from './render.js';

/** A single candidate viral clip identified by the AI model. */
export interface HighlightClip {
  start: number;
  end: number;
  score: number;
  title: string;
  reason: string;
  hook: string;
}

/** Raw shape returned by Ollama for one transcript chunk, prior to merging. */
export interface HighlightChunkResult {
  chunkIndex: number;
  clips: HighlightClip[];
}

/** Final, deduplicated and ranked set of highlight clips for a whole video. */
export interface HighlightResult {
  clips: HighlightClip[];
}

/** Full response payload for `POST /api/process`. */
export interface ProcessResult {
  video: string;
  transcript: string;
  clips: RenderedClipMetadata[];
  clipErrors: RenderError[];
}
