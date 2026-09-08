/**
 * Social media platforms supported for viral caption generation.
 */
export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube_shorts' | 'x' | 'threads' | 'facebook' | 'facebook_reels';



/**
 * Editorial tones available for caption copywriting.
 */
export type CaptionTone = 'viral_hype' | 'storytelling' | 'educational' | 'controversial' | 'humorous';

/**
 * Caption data formatted for a specific platform.
 */
export interface PlatformCaption {
  /** Target platform. */
  platform: SocialPlatform;
  /** Optional catchy video title (especially important for YouTube Shorts & TikTok). */
  title?: string;
  /** Opening hook line (the scroll-stopper / first 1-2 lines before fold). */
  hook: string;
  /** Main caption body copy. */
  body: string;
  /** Explicit call to action (e.g. Save, Share, Comment prompt). */
  callToAction: string;
  /** Curated niche & SEO hashtags (e.g. ["#teknologi", "#ai", "#chatgpt"]). */
  hashtags: string[];
  /** Complete formatted, ready-to-copy caption with whitespace, emojis, and hashtags. */
  formattedCaption: string;
  /** Target search / SEO keywords woven into this caption. */
  searchKeywords: string[];
  /** Total character count of formattedCaption. */
  characterCount: number;
  /** Strategic breakdown explaining why this caption matches the platform algorithm. */
  strategyExplanation: string;
  /** Suggested background sound / audio mood vibe. */
  recommendedAudioVibe?: string;
  /** Search tags (comma-separated for YouTube metadata). */
  tags?: string[];
  /**
   * Ready-to-paste attribution/credit line for the source creator, e.g.
   * `"📹 Credit: @ChannelName"`. Empty string or undefined = no credit shown.
   */
  creditLine?: string;
}

/**
 * Full caption generation result containing all platform variations.
 */
export interface VideoCaptionResult {
  videoId: string;
  jobId?: string;
  sourceTitle: string;
  channelName?: string;
  language: string;
  tone: CaptionTone;
  captions: Partial<Record<SocialPlatform, PlatformCaption>>;
  generatedAt: string;
  cached?: boolean;
}

/**
 * Context input passed to the caption generation service.
 */
export interface CaptionGenerationContext {
  videoId: string;
  jobId?: string;
  sourceTitle: string;
  sourceChannel?: string;
  /** Full URL of the original source video (e.g. `https://www.youtube.com/watch?v=...`). */
  sourceUrl?: string;
  videoLanguage?: string;
  targetLanguage?: string;
  genre?: string;
  /** Optional custom creator instruction or tone direction. */
  customPrompt?: string;
  tone?: CaptionTone;
  /** Optional target platforms to generate captions for. Defaults to all platforms if omitted. */
  platforms?: SocialPlatform[];
  /**
   * Custom credit line template overriding the system default.
   * Supports `{channel}` and `{url}` placeholders.
   * Set to empty string `""` to disable credit in captions.
   */
  creditTemplate?: string;
  angle?: {
    title: string;
    hook?: string;
    angleType?: string;
    reason?: string;
  };
  script?: {
    sections: Array<{
      type: string;
      text: string;
    }>;
    estimatedDurationSeconds?: number;
  };
  story?: {
    concept?: string;
    premise?: string;
    protagonist?: string;
  };
  transcriptSummary?: string;
  clips?: Array<{
    start: number;
    end: number;
    title?: string;
  }>;
  durationSeconds?: number;
}
