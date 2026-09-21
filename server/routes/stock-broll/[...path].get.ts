import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createError, defineEventHandler, getHeader, getRouterParam, sendStream, setHeader, setResponseStatus } from 'h3';

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, 'path') ?? '';
  const cleanName = basename(param);

  if (!cleanName.endsWith('.mp4') && !cleanName.endsWith('.webm')) {
    throw createError({ statusCode: 404, statusMessage: 'Stock video not found' });
  }

  const filePath = resolve(process.cwd(), 'client/public/stock-broll', cleanName);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) {
    throw createError({ statusCode: 404, statusMessage: 'Stock video not found' });
  }

  setHeader(event, 'Content-Type', 'video/mp4');
  setHeader(event, 'Accept-Ranges', 'bytes');
  setHeader(event, 'Access-Control-Allow-Origin', '*');

  const range = getHeader(event, 'range');
  if (range) {
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
