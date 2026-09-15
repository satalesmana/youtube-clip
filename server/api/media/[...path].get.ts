import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createError, defineEventHandler, getHeader, getRouterParam, sendStream, setHeader, setResponseStatus } from 'h3';
import { env } from '../../../src/config/env.js';

/**
 * Streams completed transform assets and previews. Keeping this allowlist avoids
 * exposing downloaded source videos or arbitrary files under `outputs/`.
 */
const allowedOutputPath = /^(?:[A-Za-z0-9_-]+\/(?:render\/[A-Za-z0-9-]+\/rendered\.mp4|transform\/[A-Za-z0-9-]+\/(?:clips\/(?:transformed\.mp4|reel\.mp4)|(?:voice\/)+narration\.mp3)|clips\/clip-\d{3}\.(?:mp4|jpg|jpeg|png|webp)|clip-previews\/(?:clip|hook)-\d{2}\.(?:mp4|jpg|jpeg|png|webp)|hook-previews\/(?:(?:clip|hook)-\d{2}|final-hook-\d{2})\.(?:mp4|jpg|jpeg|png|webp)|thumbnails\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)))$/;

function getMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? '';
  if (!allowedOutputPath.test(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  }

  const filePath = resolve(process.cwd(), env.OUTPUTS_DIR, path);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' });
  }

  const mime = getMimeType(path);
  setHeader(event, 'Content-Type', mime);
  setHeader(event, 'Accept-Ranges', 'bytes');

  // Handle HTTP Range requests for video/audio seeking
  const range = getHeader(event, 'range');
  if (range && (mime.startsWith('video/') || mime.startsWith('audio/'))) {
    const parts = range.replace(/bytes=/, '').split('-');
    const firstPart = parts[0] ?? '';
    const secondPart = parts[1];
    const start = parseInt(firstPart, 10);
    const end = secondPart && secondPart.length > 0 ? parseInt(secondPart, 10) : fileStat.size - 1;

    if (isNaN(start) || start >= fileStat.size || end >= fileStat.size || start > end) {
      setHeader(event, 'Content-Range', `bytes */${fileStat.size}`);
      throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' });
    }

    const chunkSize = end - start + 1;
    setResponseStatus(event, 206);
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${fileStat.size}`);
    setHeader(event, 'Content-Length', chunkSize);
    return sendStream(event, createReadStream(filePath, { start, end }));
  }

  setHeader(event, 'Content-Length', fileStat.size);
  return sendStream(event, createReadStream(filePath));
});

