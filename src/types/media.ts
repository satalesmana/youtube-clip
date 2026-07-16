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
