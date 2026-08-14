import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createError, defineEventHandler, getRouterParam, sendStream, setHeader } from 'h3';
import { env } from '../../../src/config/env.js';

/**
 * Streams only completed transform assets. Keeping this allowlist avoids
 * exposing downloaded source videos or arbitrary files under `outputs/`.
 */
const allowedOutputPath = /^(?:[A-Za-z0-9_-]+\/(?:render\/[A-Za-z0-9-]+\/rendered\.mp4|transform\/[A-Za-z0-9-]+\/(?:clips\/transformed\.mp4|voice\/voice\/narration\.mp3)))$/;

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? '';
  if (!allowedOutputPath.test(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  }

  const filePath = resolve(process.cwd(), env.OUTPUTS_DIR, path);
  await access(filePath).catch(() => {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  });

  setHeader(event, 'Content-Type', path.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
  return sendStream(event, createReadStream(filePath));
});
