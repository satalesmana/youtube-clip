/**
 * Domain entities and types for AI B-Roll insertion (Clean Architecture - Layer 1).
 */

/** Visual cue extracted from spoken dialogue where B-roll should be inserted. */
export interface BrollCue {
  /** Timestamp in seconds where the B-roll overlay begins. */
  start: number;
  /** Timestamp in seconds where the B-roll overlay ends. */
  end: number;
  /** Search query representing the visual concept (e.g., 'stock market crash', 'crowd cheering'). */
  query: string;
  /** Emotional tone or mood associated with this moment. */
  mood?: string;
}

/** Stock or generated video asset candidate for B-roll overlay. */
export interface BrollAsset {
  id: string;
  source: 'pexels' | 'pixabay' | 'local' | 'ai-generated';
  previewUrl: string;
  downloadUrl: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  localFilePath?: string;
}

/** Configured B-roll placement ready for composition rendering. */
export interface BrollPlacement {
  id?: string;
  cue: BrollCue;
  asset: BrollAsset;
  /** Whether to cross-fade into B-roll or do a direct hard cut. */
  transition?: 'cut' | 'crossfade';
  /** Alternative candidate assets found for this cue */
  candidates?: BrollAsset[];
  /** Whether this placement is currently enabled by user in UI */
  enabled?: boolean;
}
