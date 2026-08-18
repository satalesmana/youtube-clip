import type { VideoPlan } from '../types/video-plan.js';

/** Shared types for the composition engine abstraction. */

/** Engine type selector. */
export type CompositionEngineKind = 'ffmpeg-template' | 'remotion';

/** Assets needed for rendering. */
export interface CompositionAssets {
  sourceVideo: string;
  narration: string;
  channelName?: string;
  /** Requested visual treatment for this render, selected per request. */
  style?: 'commentary' | 'sports' | 'interview';
  /** Requested FFmpeg template id when that engine is active. */
  templateId?: string;
  /** YouTube video id — render outputs land under `outputs/{videoId}/` when provided. */
  videoId?: string;
}

/** Output from a successful render. */
export interface RenderOutput {
  path: string;
  durationSeconds?: number;
  sizeBytes?: number;
}

/**
 * Interface for composition engines.
 * Both FFmpeg template and Remotion implement this.
 */
export interface ICompositionEngine {
  kind: CompositionEngineKind;
  render(plan: VideoPlan, assets: CompositionAssets): Promise<RenderOutput>;
}
