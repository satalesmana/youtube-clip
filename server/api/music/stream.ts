// server/api/music/stream.get.ts
// =============================================================================
// In-Memory Audio Streaming Proxy
// Mem-proxy stream audio eksternal (Pixabay / Jamendo / CDN) langsung ke memori
// tanpa pernah menyimpan/men-download file ke disk lokal.
// Menyertakan referer dan range-request forwarding untuk mendukung Remotion seeking.
// =============================================================================

import { Readable } from 'node:stream';
import {
  defineEventHandler,
  getQuery,
  createError,
  setHeader,
  setResponseStatus,
  getHeader,
  sendStream,
} from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const targetUrl = query.url as string;

  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    throw createError({ statusCode: 400, statusMessage: 'Parameter ?url= audio tidak valid' });
  }

  const range = getHeader(event, 'range');
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Referer: targetUrl.includes('pixabay') ? 'https://pixabay.com/' : targetUrl,
    Accept: '*/*',
  };

  if (range) {
    headers['Range'] = range;
  }

  try {
    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      throw createError({
        statusCode: upstream.status,
        statusMessage: `Gagal mem-proxy audio: ${upstream.statusText}`,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

    setHeader(event, 'Content-Type', contentType);
    setHeader(event, 'Accept-Ranges', acceptRanges);
    setHeader(event, 'Access-Control-Allow-Origin', '*');

    if (contentLength) setHeader(event, 'Content-Length', parseInt(contentLength, 10));
    if (contentRange) setHeader(event, 'Content-Range', contentRange);

    if (upstream.status === 206) {
      setResponseStatus(event, 206);
    }

    if (event.method === 'HEAD' || !upstream.body) {
      return '';
    }

    // Pipe in-memory web stream to Node stream tanpa file disk
    return sendStream(event, Readable.fromWeb(upstream.body as any));
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({
      statusCode: 502,
      statusMessage: `Proxy stream error: ${err.message}`,
    });
  }
});
