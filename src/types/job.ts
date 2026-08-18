/**
 * All directories for a single video processing job, isolated under
 * `outputs/{videoId}/`. Created once per request by {@link createJobWorkspace}
 * and threaded through every service that writes to disk.
 */
export interface JobWorkspace {
  /** Root: `outputs/{videoId}` */
  root: string;
  downloads: string;
  temp: string;
  transcripts: string;
  clips: string;
  subtitles: string;
  thumbnails: string;
  metadata: string;
}
