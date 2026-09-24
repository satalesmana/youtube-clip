export interface ViralityScoreBreakdown {
  overall: number;
  hookStrength: number;
  engagementFlow: number;
  trendRelevance: number;
  standaloneValue: number;
  reasons: string[];
}

/**
 * Typed union of all valid visual preset IDs.
 * Keep in sync with src/types/visual-preset.ts on the server.
 */
export type VisualPresetId =
  | 'kinetic-punch'
  | 'curiosity-stack'
  | 'story-slide'
  | 'minimal-question'
  | 'bold-impact'
  | 'data-punch'
  | 'opportunity-glow'
  | 'focus-brush'
  | 'clean-fade'
  | 'scribble-quote'
  | 'action-pointer'
  | 'burst-stat';

export type OutroPresetId =
  | 'creator-glass'
  | 'viral-neon'
  | 'minimal-clean'
  | 'comment-debate'
  | 'subscribe-bell'
  | 'link-in-bio';

export type CompositionLayout =
  | 'centered'
  | 'top-heavy'
  | 'split-proof'
  | 'full-screen-text'
  | 'subject-first'
  | 'data-focus'
  | 'question-focus';

export type AnimationPreset =
  | 'spring-punch'
  | 'word-cascade'
  | 'slide-up'
  | 'scale-burst'
  | 'fade';

export type TypographyVariant =
  | 'kinetic'
  | 'stacked'
  | 'minimal'
  | 'bold-caps'
  | 'bebas-neue'
  | 'montserrat'
  | 'anton'
  | 'archivo-black'
  | 'poppins'
  | 'oswald'
  | 'barlow-condensed';

/**
 * 8 Badge Pill Presets according to the Badge Design System.
 */
export type BadgePresetId =
  | 'neon-outline'
  | 'solid-impact'
  | 'highlight-chip'
  | 'editorial-label'
  | 'price-tag'
  | 'speech-bubble'
  | 'burst-stamp'
  | 'diagonal-slash';

export type BadgeColorVariant =
  | 'cyan'
  | 'magenta'
  | 'red'
  | 'yellow'
  | 'green'
  | 'purple'
  | 'gold'
  | 'auto';

/**
 * A user can either pick an explicit preset or let the AI auto-resolve.
 * 'auto' is a UI-only sentinel — it is NOT sent to the server.
 * When 'auto' is selected, `visualPreset` is omitted from the API payload.
 */
export type VisualPresetSelection = VisualPresetId | 'auto';

export interface ViralClip {
  id?: string;
  start: number;
  end: number;
  duration: number;
  score: number;
  reason: string;
  title: string;
  hook?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  virality?: ViralityScoreBreakdown;
  selected?: boolean;
}

export interface ViralHook {
  id?: string;
  rank?: number;
  hookText: string;
  hookType: string;
  score: number;
  explanation?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  previewPath?: string;
  finalDurationSeconds?: number;
  tag?: string;
  highlightWords?: string[];
  source?: { start: number; end: number; transcript: string };
}

export interface SampleVideo {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  views?: number;
  duration?: number;
}

export interface TrendTopic {
  topic: string;
  score: number;
  sources: string[];
  summary: string;
  suggestedSearch?: string;
  sampleVideos?: SampleVideo[];
}

export interface HistoryItem {
  id?: string;
  title: string;
  video?: string;
  outputVideo?: string;
  videoUrl?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  estDuration?: number;
  createdAt?: string;
  timestamp?: string;
  videoId?: string;
}

export interface SubtitleTemplate {
  id: string;
  name: string;
  description: string;
  previewText?: string;
  style?: Record<string, unknown>;
}

export interface ScriptSection {
  type: 'hook' | 'context' | 'source' | 'commentary' | 'analysis' | 'supporting' | 'conclusion';
  text: string;
  spokenText?: string;
}

export interface BrollCueItem {
  start: number;
  end: number;
  query: string;
  mood?: string;
}

export interface BrollAssetItem {
  id: string;
  source: 'pexels' | 'pixabay' | 'local' | 'ai-generated';
  previewUrl: string;
  downloadUrl: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  localFilePath?: string;
}

export interface BrollPlacementItem {
  id?: string;
  cue: BrollCueItem;
  asset: BrollAssetItem;
  transition?: 'cut' | 'crossfade';
  candidates?: BrollAssetItem[];
  enabled?: boolean;
}

export interface TransformRequest {
  url: string;
  language?: string;
  genre?: string;
  templateId?: string;
  audioMode?: 'keep' | 'speech' | 'music' | 'keep_original' | 'strip_original' | 'voice_over';
  targetDuration?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  enableBroll?: boolean;
  brollPlacements?: BrollPlacementItem[];
  enableIntroOutro?: boolean;
  outroPreset?: OutroPresetId;
  outroCtaText?: string;
  outroButtonText?: string;
  outroDuration?: number;
  outroChannelName?: string;
  outroLogoUrl?: string;
  channel?: { name: string; logo?: string };
  whisperProvider?: string;
  sttProvider?: string;
  customPrompt?: string;
  clipIndex?: number;
  start?: number;
  end?: number;
  outputMode?: 'reel' | 'narration';
  selectedClips?: Array<{ start: number; end: number; title?: string }>;
  customScript?: {
    language?: string;
    sections: ScriptSection[];
  };
  ttsProvider?: 'edge-tts' | 'openai';
  ttsVoice?: string;
  ttsRate?: string;
  sourceVolume?: number;
  /** Language for the output narration (used in narration mode). Separate from source transcript language. */
  outputLanguage?: 'id' | 'en';
  customHook?: string;
  hookTitle?: string;
  hookTag?: string;
  hookHighlightWords?: string[];
  hookPreviewPath?: string;
  sourceRange?: { start: number; end: number };
  /**
   * Explicit user-selected visual preset for the hook intro.
   * When omitted ("auto" mode), the server auto-resolves using hookType + angle.
   */
  visualPreset?: VisualPresetId;
  /** Optional user override for composition layout. */
  hookLayout?: CompositionLayout;
  /** Optional user override for entrance motion animation. */
  hookAnimation?: AnimationPreset;
  /** Optional user override for typography variant. */
  hookTypography?: TypographyVariant;
  /** Optional user override for badge pill design system preset. */
  hookBadgePreset?: BadgePresetId;
  /** Optional user override for badge pill color variant. */
  hookBadgeColor?: BadgeColorVariant;
}

export interface TransformProgress {
  stage: string;
  pct: number;
  message: string;
}

export interface TransformResult {
  outputVideo: string;
  videoUrl: string;
  duration: number;
  title: string;
  thumbnailUrl?: string;
  transcript?: string;
  videoId?: string;
}

export interface DownloadedVideo {
  videoId: string;
  title: string;
  durationSeconds: number;
  videoPath: string;
  thumbnailUrl: string;
  alreadyDownloaded: boolean;
  channelTitle?: string;
  channelName?: string;
}
