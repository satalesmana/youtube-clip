import { defineEventHandler } from 'h3';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import type { RenderedClipMetadata } from '../../src/types/render.js';
import { env } from '../../src/config/env.js';

/** Maps an outputs-relative file to its media endpoint URL, or '' if outside outputs. */
function toMediaUrl(path: string): string {
  const base = resolve(process.cwd(), env.OUTPUTS_DIR);
  const rel = relative(base, resolve(path));
  if (rel.startsWith('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return '';
  return `/api/media/${rel.split(sep).map(encodeURIComponent).join('/')}`;
}

/**
 * `GET /api/history`
 *
 * Returns the manifest of every successfully rendered clip. Workspaces are
 * isolated per video (`outputs/{videoId}/metadata/clips.json`), so this
 * aggregates all of them into a single list for the web UI.
 */
export default defineEventHandler(async () => {
  const outputsRoot = resolve(process.cwd(), env.OUTPUTS_DIR);
  const clips: RenderedClipMetadata[] = [];

  try {
    const videoDirs = await readdir(outputsRoot, { withFileTypes: true });

    for (const entry of videoDirs) {
      if (!entry.isDirectory()) continue;

      const manifestPath = join(outputsRoot, entry.name, 'metadata', 'clips.json');
      try {
        const raw = await readFile(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          clips.push(
            ...parsed.map((clip: RenderedClipMetadata) => ({
              ...clip,
              videoUrl: clip.video ? toMediaUrl(clip.video) : '',
              thumbnailUrl: clip.thumbnail ? toMediaUrl(clip.thumbnail) : '',
            })),
          );
        }
      } catch {
        // No manifest for this video (or unreadable) — skip it.
      }
    }
  } catch {
    // No outputs dir yet — report empty.
  }

  return { success: true, clips };
});