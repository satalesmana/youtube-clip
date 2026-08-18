import { join } from 'node:path';
import { ensureDir } from './fs.js';
import type { JobWorkspace } from '../types/job.js';

/**
 * Creates an isolated workspace directory tree for a single video processing
 * job under `outputs/{videoId}/`.
 *
 * @param outputsDir - The root outputs directory (e.g. `outputs/`)
 * @param videoId    - The YouTube video ID used as the workspace folder name
 * @returns A `JobWorkspace` with all resolved paths and created directories
 */
export async function createJobWorkspace(outputsDir: string, videoId: string): Promise<JobWorkspace> {
  const root = join(outputsDir, videoId);

  const workspace: JobWorkspace = {
    root,
    downloads: join(root, 'downloads'),
    temp: join(root, 'temp'),
    transcripts: join(root, 'transcripts'),
    clips: join(root, 'clips'),
    subtitles: join(root, 'subtitles'),
    thumbnails: join(root, 'thumbnails'),
    metadata: join(root, 'metadata'),
  };

  // Create all directories in parallel
  await Promise.all([
    ensureDir(workspace.downloads),
    ensureDir(workspace.temp),
    ensureDir(workspace.transcripts),
    ensureDir(workspace.clips),
    ensureDir(workspace.subtitles),
    ensureDir(workspace.thumbnails),
    ensureDir(workspace.metadata),
  ]);

  return workspace;
}
