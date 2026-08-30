/** Shared prop types for all Remotion compositions. Mirrors server VideoPlan. */

export type PlanScene = {
  type: string;
  start: number;
  end: number;
  narration: string;
  source?: { start: number; end: number };
  visual?: string;
  /** Engagement as short-form content (1-10), carried from the story beat. */
  engagementScore?: number;
  /** How keep-able this scene is in the final short. */
  retentionRisk?: 'high' | 'medium' | 'low';
  /** The curiosity gap / tension this scene opens. */
  openLoop?: string;
  /** The most caption-worthy verbatim line from the source beat. */
  quotableLine?: string;
  /** On-screen headline hook title from recommended hook. */
  hookTitle?: string;
  /** Pattern-interrupt category pill tag (e.g. "🔥 MOMEN VIRAL"). */
  hookTag?: string;
  /** Words in the hook headline rendered in accent color. */
  highlightWords?: string[];
};

export type PlanCaption = {
  start: number;
  end: number;
  text: string;
  highlightWords?: string[];
  /** 'quote' renders a larger money-line card instead of a narration caption. */
  type?: 'narration' | 'quote';
  /** Real word boundaries (absolute seconds), for voice-synced highlighting. */
  wordTimings?: Array<{ word: string; start: number; end: number }>;
};

export type CompositionPlan = {
  candidateId: string;
  angleId: string;
  duration: number;
  scenes: PlanScene[];
  captions: PlanCaption[];
  audio: {
    narration?: string;
    sourceUnderlay: boolean;
    ducking: boolean;
  };
};

export type CompositionProps = {
  plan: CompositionPlan;
  narrationPath: string;
  sourceVideoPath: string;
  channelName?: string;
  /** Social-proof badge shown during the first ~2s of the hook (e.g. "10RB+ Views"). */
  hookBadge?: string;
  /** Optional custom creator logo asset path. Defaults to 'creator-logo.png'. */
  creatorLogoUrl?: string;
};

/** Props for the standalone styled hook intro (`HookIntroShort`). */
export type HookIntroProps = {
  hook: {
    /** Total intro duration in seconds (drives the composition length). */
    duration: number;
    /** On-screen kinetic headline (= RankedHook.headline.text). */
    headlineText: string;
    /** Category / pattern-interrupt pill tag (e.g. "🔥 MOMEN VIRAL"). */
    tag?: string;
    /** Words rendered in the accent color inside the headline. */
    highlightWords?: string[];
    /** Social-proof badge shown for ~2s (e.g. "10RB+ Views"). */
    badge?: string;
    /** Channel watermark bottom-left. */
    channelName?: string;
    /** Seed for the deterministic palette (e.g. `${videoId}:${style}`). */
    themeSeed: string;
  };
  /** Staged source video (public-relative path, absolute for Studio testing). */
  sourceVideoPath: string;
  /** Source footage window (absolute seconds) playing behind the headline. */
  sourceStart: number;
  sourceEnd: number;
};
