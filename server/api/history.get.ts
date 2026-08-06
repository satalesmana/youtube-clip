import { defineEventHandler } from 'h3';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../../src/config/env.js';

/**
 * `GET /api/history`
 *
 * Returns the manifest of every successfully rendered clip
 * (`outputs/metadata/clips.json`) so the web UI can list past work.
 */
export default defineEventHandler(async () => {
  const manifestPath = resolve(process.cwd(), env.OUTPUTS_DIR, 'metadata', 'clips.json');

  try {
    const raw = await readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return { success: true, clips: Array.isArray(parsed) ? parsed : [] };
  } catch {
    // No manifest yet (or unreadable) — that's fine, just report empty.
    return { success: true, clips: [] };
  }
});
