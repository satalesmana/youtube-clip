/**
 * Shared media-related types for the download/transcription pipeline and the
 * research pipeline (news/social signals, YouTube search results).
 */

/** Result of downloading a YouTube video to local disk. */
export interface DownloadResult {
  videoId: string;
  videoPath: string;
  title: string;
  durationSeconds: number;
}

/** Result of extracting a mono 16kHz WAV audio track from a video file. */
export interface AudioExtractionResult {
  audioPath: string;
  durationSeconds: number;
}

/** A single raw signal item collected from any research source (RSS, Reddit, Trends, X). */
export interface ResearchSourceItem {
  /** Source that produced this item, e.g. `rss`, `reddit`, `trends`, `x`. */
  source: string;
  /** Human-readable origin label, e.g. `cnn-indonesia`, `r/popular`, `Google Trends`. */
  origin: string;
  /** Item title / headline / trend keyword. */
  title: string;
  /** Optional longer text: summary, description, post body. */
  text?: string;
  /** Optional URL of the item (news article, post, ...). */
  url?: string;
  /** Optional engagement signal: raw value (views, upvotes, score, ...). */
  engagement?: number;
  /** Optional ISO timestamp of the item. */
  publishedAt?: string;
  /** Optional ISO 639-1 language code, e.g. `en`, `id`. */
  language?: string;
}

/** A YouTube video candidate returned by the video search provider. */
export interface YouTubeVideoResult {
  /** YouTube video id (`dQw4w9WgXcQ`). */
  videoId: string;
  /** Video URL (`https://www.youtube.com/watch?v=...`). */
  url: string;
  /** Video title. */
  title: string;
  /** Channel title. */
  channel: string;
  /** Video duration in seconds, when known. */
  durationSeconds?: number;
  /** Number of views, when known. */
  viewCount?: number;
  /** ISO 8601 publish date, when known. */
  publishedAt?: string;
  /** Thumbnail URL (best available), when known. */
  thumbnailUrl?: string;
}
