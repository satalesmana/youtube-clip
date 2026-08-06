import type { ResearchSourceItem, YouTubeVideoResult } from './media.js';

/** A viral topic identified and ranked by the research pipeline. */
export interface ResearchTrend {
  /** Machine-readable topic slug, e.g. `elon-musk-twitter-rename`. */
  slug: string;
  /** Human-readable topic title in the requested language, e.g. `Elon Musk Renames Twitter`. */
  title: string;
  /** Short summary of why this topic is currently hot. */
  summary: string;
  /** Virality score 0–100 (higher = more viral). */
  score: number;
  /** Comma-separated list of search keywords to find YouTube videos, e.g. `elon musk twitter rename, twitter x rebrand`. */
  keywords: string;
  /** Category of the topic, e.g. `tech`, `politics`, `sports`. */
  category: string;
  /** Raw signals that led to this topic. */
  sources: ResearchSourceItem[];
  /** Matched YouTube videos for this topic. */
  videos: YouTubeVideoResult[];
}

/** Successful result of the research pipeline. */
export interface ResearchResult {
  /** ISO timestamp of when the research ran. */
  generatedAt: string;
  /** Total raw signals collected before analysis. */
  signalCount: number;
  /** Ranked viral topics. */
  trends: ResearchTrend[];
  /** Sources that failed or were skipped (e.g. X not authenticated). */
  skippedSources: { source: string; reason: string }[];
}
