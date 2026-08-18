import { join } from 'node:path';
import { copyFile, rm, stat } from 'node:fs/promises';
import { extractFrame } from '../utils/ffmpeg.js';
import type { IFaceDetectionService } from './face-detection.service.js';

export interface ThumbnailServiceOptions {
  ffmpegBinaryPath: string;
  tempDir: string;
  candidateCount: number;
}

/** Picks and saves a representative thumbnail frame for a rendered clip. */
export interface IThumbnailService {
  generateThumbnail(videoPath: string, durationSeconds: number, outputPath: string, id: number, tempDir?: string): Promise<void>;
}

/**
 * Samples a handful of candidate frames spread across the clip (skipping the
 * very start/end, where fades or blank frames are common), prefers any
 * candidate where {@link IFaceDetectionService} finds a subject, and
 * otherwise falls back to the largest JPEG by file size — a cheap, real
 * proxy for "more detail / less motion blur / less flat content" that needs
 * no extra dependencies. This is a heuristic, not true blur/emotion
 * detection; swapping in a real detector only requires a better
 * `IFaceDetectionService`, not changes here.
 */
export class ThumbnailService implements IThumbnailService {
  constructor(
    private readonly options: ThumbnailServiceOptions,
    private readonly faceDetectionService: IFaceDetectionService,
  ) {}

  async generateThumbnail(
    videoPath: string,
    durationSeconds: number,
    outputPath: string,
    id: number,
    tempDir?: string,
  ): Promise<void> {
    const dir = tempDir ?? this.options.tempDir;
    const count = Math.max(1, this.options.candidateCount);
    const edgeMargin = durationSeconds * 0.1;
    const usableSpan = Math.max(0, durationSeconds - edgeMargin * 2);

    const candidates = Array.from({ length: count }, (_, i) => ({
      path: join(dir, `thumb-candidate-${id}-${i}.jpg`),
      timestamp: count === 1 ? durationSeconds / 2 : edgeMargin + (usableSpan * i) / (count - 1),
    }));

    try {
      for (const candidate of candidates) {
        await extractFrame({
          binaryPath: this.options.ffmpegBinaryPath,
          inputPath: videoPath,
          timestampSeconds: candidate.timestamp,
          outputPath: candidate.path,
        });
      }

      const scored = await Promise.all(
        candidates.map(async (candidate) => {
          const hasFace = (await this.faceDetectionService.detectPrimaryFace(candidate.path)) !== null;
          const stats = await stat(candidate.path).catch(() => null);
          return { path: candidate.path, hasFace, size: stats?.size ?? 0 };
        }),
      );

      scored.sort((a, b) => {
        if (a.hasFace !== b.hasFace) return a.hasFace ? -1 : 1;
        return b.size - a.size;
      });

      const winner = scored[0];
      if (!winner || winner.size === 0) {
        throw new Error('No valid thumbnail candidate frame could be extracted.');
      }

      await copyFile(winner.path, outputPath);
    } finally {
      await Promise.all(candidates.map((c) => rm(c.path, { force: true }).catch(() => {})));
    }
  }
}
