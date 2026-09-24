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
  /** Visual preset id for the hook intro headline. */
  visualPreset?: string;
  /** Badge pill preset id */
  hookBadgePresetId?:
    | 'neon-outline'
    | 'solid-impact'
    | 'highlight-chip'
    | 'editorial-label'
    | 'price-tag'
    | 'speech-bubble'
    | 'burst-stamp'
    | 'diagonal-slash';
  /** Badge pill color variant: 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto' */
  hookBadgeColor?: string;
  /** Composition layout mode override from Hook Klip design system */
  hookLayout?: string;
  /** Motion animation override from Hook Klip design system */
  hookAnimation?: string;
  /** Typography variant override from Hook Klip design system */
  hookTypography?: string;
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
  brolls?: Array<{
    start: number;
    end: number;
    videoPath: string;
    query?: string;
  }>;
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
  /** Subtitle style preset: 'beast', 'hormozi', 'clean'. */
  subtitleStyle?: string;
  /** Whether outro CTA is enabled (defaults to true). */
  enableIntroOutro?: boolean;
  /** Outro style preset id (e.g. 'creator-glass', 'viral-neon', etc.). */
  outroPreset?: string;
  /** Custom call-to-action headline text for the outro card. */
  outroCtaText?: string;
  /** Custom action button text for the outro card. */
  outroButtonText?: string;
  /** Duration in seconds for the outro card (default 3s). */
  outroDuration?: number;
  /** Custom channel name / handle for the outro card. */
  outroChannelName?: string;
  /** Custom logo image URL, data URL, or file path for the outro card. */
  outroLogoUrl?: string;
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
    /**
     * Visual preset ID resolved by the server (Phase 3+).
     * When present, drives which headline renderer Remotion uses.
     * When absent, falls back to KineticRenderer (backward compat).
     */
    visualPresetId?: string;
    /** Composition layout mode from the Hook Klip design system. */
    layout?: string;
    /** Animation motion override from the Hook Klip design system. */
    animation?: string;
    /** Typography variant override from the Hook Klip design system. */
    typography?: string;
    /** Badge pill preset id */
    badgePresetId?:
      | 'neon-outline'
      | 'solid-impact'
      | 'highlight-chip'
      | 'editorial-label'
      | 'price-tag'
      | 'speech-bubble'
      | 'burst-stamp'
      | 'diagonal-slash';
    /** Badge pill color variant: 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto' */
    badgeColor?: string;
  };
  /** Staged source video (public-relative path, absolute for Studio testing). */
  sourceVideoPath: string;
  /** Source footage window (absolute seconds) playing behind the headline. */
  sourceStart: number;
  sourceEnd: number;
};


/** Props for the standalone styled outro CTA card (`OutroCardShort`). */
export type OutroCardShortProps = {
  channelName?: string;
  ctaText?: string;
  handle?: string;
  creatorLogoUrl?: string;
  durationSeconds?: number;
  themeSeed?: string;
  outroPreset?: string;
  buttonText?: string;
};
