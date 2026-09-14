import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { container } from '../../../src/container/index.js';
import { createJobWorkspace } from '../../../src/utils/workspace.js';
import { extractVideoIdFromUrl } from '../../../src/utils/youtube-id.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import { AppError } from '../../../src/utils/errors.js';

const downloadRequestSchema = z.object({
  url: z.string().min(1, 'URL video harus diisi'),
});

/**
 * `POST /api/video/download`
 *
 * Stage 1A: Ingest & download the YouTube video before configuring parameters.
 * Validates the video URL, checks if already cached in the workspace,
 * downloads via yt-dlp, and returns video metadata + thumbnail.
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event).catch(() => ({}));
  const parsed = downloadRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    throw createError(toHttpError(AppError.validation(message)));
  }

  const { url } = parsed.data;
  const videoId = extractVideoIdFromUrl(url);
  if (!videoId) {
    throw createError(toHttpError(AppError.invalidUrl('URL YouTube tidak valid.')));
  }

  try {
    const savedVideoPath = join(container.paths.outputs, videoId, 'downloads', `${videoId}.mp4`);
    const metaPath = join(container.paths.outputs, videoId, 'metadata', 'info.json');
    const hasVideo = await access(savedVideoPath).then(() => true).catch(() => false);

    if (hasVideo) {
      const { readFile } = await import('node:fs/promises');
      const cached = await readFile(metaPath, 'utf-8').then((r) => JSON.parse(r)).catch(() => null);
      if (cached) {
        return {
          videoId,
          title: cached.title || `Video ${videoId}`,
          durationSeconds: cached.durationSeconds || 0,
          videoPath: savedVideoPath,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          alreadyDownloaded: true,
        };
      }
    }

    const workspace = await createJobWorkspace(container.paths.outputs, videoId);
    const download = await container.youtubeService.downloadVideo(url, workspace);

    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(container.paths.outputs, videoId, 'metadata'), { recursive: true }).catch(() => {});
    await writeFile(metaPath, JSON.stringify({ title: download.title, durationSeconds: download.durationSeconds }), 'utf-8').catch(() => {});

    return {
      videoId,
      title: download.title || `Video ${videoId}`,
      durationSeconds: download.durationSeconds || 0,
      videoPath: download.videoPath,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      alreadyDownloaded: hasVideo,
    };
  } catch (error) {
    throw createError(toHttpError(error));
  }
});
