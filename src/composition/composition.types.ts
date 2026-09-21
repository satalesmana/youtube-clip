import type { VideoPlan } from '../types/video-plan.js';

/** Shared types for the composition engine abstraction. */

/** Engine type selector. */
export type CompositionEngineKind = 'ffmpeg-template' | 'remotion';

/** Assets needed for rendering. */
export interface CompositionAssets {
  sourceVideo: string;
  narration: string;
  channelName?: string;
  /** Social-proof badge for the first ~2s of the hook (e.g. "10RB+ Views"). */
  hookBadge?: string;
  /** Requested visual treatment for this render, selected per request. */
  style?: 'commentary' | 'sports' | 'interview';
  /** Requested composition engine for this render. */
  engine?: CompositionEngineKind | 'ffmpeg' | 'remotion';
  /** Requested FFmpeg template id when that engine is active. */
  templateId?: string;
  /** Subtitle style preset for karaoke captions (e.g. beast, hormozi, clean). */
  subtitleStyle?: string;
  /** YouTube video id — render outputs land under `outputs/{videoId}/` when provided. */
  videoId?: string;
  /** Optional custom creator logo image path */
  creatorLogo?: string;
  /**
   * Audio output mode for the final render.
   * - `strip_original`  — (default) Replace source audio with TTS narration.
   * - `keep_original`   — Preserve source audio, no TTS mixing.
   * - `voice_over`      — Mix TTS narration on top of attenuated source audio.
   */
  audioMode?: import('../types/audio-mode.js').AudioMode;
  /**
   * Linear volume level for the source audio when audioMode is `voice_over`.
   * Range: 0.0–1.0. Defaults to 0.3 (≈ −10 dB).
   */
  sourceAudioVolume?: number;
  /** Optional contextual B-roll video cutaways overlay */
  brolls?: Array<{
    start: number;
    end: number;
    videoPath: string;
    query?: string;
  }>;
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
