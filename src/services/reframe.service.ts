import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extractFrame } from '../utils/ffmpeg.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { clamp } from '../utils/timestamp.js';
import type { IFaceDetectionService } from './face-detection.service.js';
import type { IFocalSmoothingService } from './focal-smoothing.service.js';
import type { CropRegion, FocalPoint, TrackedFocalPoint, SubjectTrajectory } from '../types/reframe.js';

export interface ReframeServiceOptions {
  ffmpegBinaryPath: string;
  tempDir: string;
}

const DEFAULT_TARGET_ASPECT = 9 / 16;
const CENTER_FOCAL_POINT: FocalPoint = { x: 0.5, y: 0.5 };

/**
 * Computes the 9:16 crop region for a clip.
 *
 * Clean Architecture - Layer 2: Use Case / Domain Service.
 * Adheres to:
 * - DIP (Dependency Inversion): Depends on IFaceDetectionService and IFocalSmoothingService abstractions.
 * - OCP (Open/Closed): Extensible for multi-frame tracking without altering single-frame crop computation.
 */
export interface IReframeService {
  resolveFocalPoint(videoPath: string, sampleTimestampSeconds: number, id: number, tempDir?: string): Promise<FocalPoint>;
  resolveTrajectory?(
    videoPath: string,
    startSeconds: number,
    endSeconds: number,
    sampleIntervalSeconds?: number,
  ): Promise<SubjectTrajectory>;
  computeCropRegion(
    sourceWidth: number,
    sourceHeight: number,
    focalPoint: FocalPoint,
    targetAspect?: number,
  ): CropRegion;
  computeTrajectoryCropRegion?(
    sourceWidth: number,
    sourceHeight: number,
    trajectory: SubjectTrajectory,
    targetAspect?: number,
  ): CropRegion;
}

export class ReframeService implements IReframeService {
  private readonly trajectoryCache = new Map<string, { start: number; end: number; interval: number; trajectory: SubjectTrajectory }>();

  constructor(
    private readonly options: ReframeServiceOptions,
    private readonly faceDetectionService: IFaceDetectionService,
    private readonly focalSmoothingService?: IFocalSmoothingService,
  ) {}

  /** Samples one frame near the clip's content and asks the detector where the subject is. */
  async resolveFocalPoint(
    videoPath: string,
    sampleTimestampSeconds: number,
    id: number,
    tempDir?: string,
  ): Promise<FocalPoint> {
    return (await this.resolveFocalPointSample(videoPath, sampleTimestampSeconds, id, tempDir)).focalPoint;
  }

  private async resolveFocalPointSample(
    videoPath: string,
    sampleTimestampSeconds: number,
    id: number,
    tempDir?: string,
  ): Promise<{ focalPoint: FocalPoint; detected: boolean }> {
    const dir = tempDir ?? this.options.tempDir;
    const framePath = join(dir, `reframe-sample-${id}.jpg`);

    try {
      await extractFrame({
        binaryPath: this.options.ffmpegBinaryPath,
        inputPath: videoPath,
        timestampSeconds: sampleTimestampSeconds,
        outputPath: framePath,
      });

      const detected = await this.faceDetectionService.detectPrimaryFace(framePath);
      return { focalPoint: detected ?? CENTER_FOCAL_POINT, detected: detected !== null };
    } catch {
      return { focalPoint: CENTER_FOCAL_POINT, detected: false };
    } finally {
      await rm(framePath, { force: true }).catch(() => {});
    }
  }

  /**
   * Samples multiple frames across a segment to construct a smoothed focal trajectory over time.
   */
  async resolveTrajectory(
    videoPath: string,
    startSeconds: number,
    endSeconds: number,
    sampleIntervalSeconds = 1.0,
  ): Promise<SubjectTrajectory> {
    const duration = Math.max(0, endSeconds - startSeconds);
    if (duration <= 0) {
      return { points: [{ timestampSeconds: startSeconds, focalPoint: CENTER_FOCAL_POINT }], smoothed: true };
    }

    const cachePrefix = `${videoPath}:`;
    const cacheEntry = [...this.trajectoryCache.entries()].find(([key, value]) =>
      key.startsWith(cachePrefix) &&
      value.interval <= sampleIntervalSeconds &&
      value.start <= startSeconds && value.end >= endSeconds,
    )?.[1];
    if (cacheEntry) {
      const sourcePoints = cacheEntry.trajectory.points;
      const interpolateAt = (timestampSeconds: number): FocalPoint => {
        if (timestampSeconds <= sourcePoints[0]!.timestampSeconds) return sourcePoints[0]!.focalPoint;
        if (timestampSeconds >= sourcePoints[sourcePoints.length - 1]!.timestampSeconds) return sourcePoints[sourcePoints.length - 1]!.focalPoint;
        for (let index = 0; index < sourcePoints.length - 1; index++) {
          const left = sourcePoints[index]!;
          const right = sourcePoints[index + 1]!;
          if (timestampSeconds < left.timestampSeconds || timestampSeconds > right.timestampSeconds) continue;
          const amount = (timestampSeconds - left.timestampSeconds) / Math.max(0.001, right.timestampSeconds - left.timestampSeconds);
          return {
            x: left.focalPoint.x + (right.focalPoint.x - left.focalPoint.x) * amount,
            y: left.focalPoint.y + (right.focalPoint.y - left.focalPoint.y) * amount,
          };
        }
        return sourcePoints[0]!.focalPoint;
      };
      const points: TrackedFocalPoint[] = [
        { timestampSeconds: startSeconds, focalPoint: interpolateAt(startSeconds), confidence: 1 },
        ...sourcePoints.filter((point) => point.timestampSeconds > startSeconds && point.timestampSeconds < endSeconds),
        { timestampSeconds: endSeconds, focalPoint: interpolateAt(endSeconds), confidence: 1 },
      ];
      return { points, smoothed: true };
    }

    const timestamps: number[] = [];
    for (let t = startSeconds; t <= endSeconds; t += sampleIntervalSeconds) {
      timestamps.push(t);
    }
    const lastTimestamp = timestamps[timestamps.length - 1];
    if (lastTimestamp !== undefined && lastTimestamp < endSeconds) {
      timestamps.push(endSeconds);
    }

    const sampleDir = await mkdtemp(join(tmpdir(), 'youtube-clip-reframe-'));
    const framePaths = timestamps.map((_, index) => join(sampleDir, `sample-${index}.jpg`));
    let trackedPoints: TrackedFocalPoint[] = [];
    try {
      const extractionResults = await mapWithConcurrency(timestamps, 3, (timestamp, index) => extractFrame({
          binaryPath: this.options.ffmpegBinaryPath,
          inputPath: videoPath,
          timestampSeconds: timestamp,
          outputPath: framePaths[index]!,
        }));
      const usableSamples = timestamps.flatMap((timestamp, index) =>
        extractionResults[index]?.status === 'fulfilled'
          ? [{ timestamp, framePath: framePaths[index]! }]
          : [],
      );
      if (usableSamples.length === 0) throw new Error('No frames could be extracted for face analysis');
      const detectedPoints = this.faceDetectionService.detectFacesBatch
        ? await this.faceDetectionService.detectFacesBatch(usableSamples.map((sample) => sample.framePath))
        : await Promise.all(usableSamples.map((sample) => this.faceDetectionService.detectPrimaryFace(sample.framePath)));
      trackedPoints = usableSamples.map((sample, index) => ({
        timestampSeconds: sample.timestamp,
        focalPoint: detectedPoints[index] ?? CENTER_FOCAL_POINT,
        confidence: detectedPoints[index] ? 1 : 0,
      }));
    } catch {
      trackedPoints = timestamps.map((timestamp) => ({
        timestampSeconds: timestamp!,
        focalPoint: CENTER_FOCAL_POINT,
        confidence: 0,
      }));
    } finally {
      await rm(sampleDir, { recursive: true, force: true }).catch(() => {});
    }

    const detectedPoints = trackedPoints.filter((point) => point.confidence !== 0);
    const trajectory = this.focalSmoothingService
      ? this.focalSmoothingService.smoothTrajectory(detectedPoints)
      : { points: detectedPoints, smoothed: false };
    if (trajectory.points.length > 0) {
      const cacheKey = `${videoPath}:${startSeconds.toFixed(3)}:${endSeconds.toFixed(3)}`;
      this.trajectoryCache.set(cacheKey, { start: startSeconds, end: endSeconds, interval: sampleIntervalSeconds, trajectory });
      if (this.trajectoryCache.size > 48) {
        const oldestKey = this.trajectoryCache.keys().next().value;
        if (oldestKey) this.trajectoryCache.delete(oldestKey);
      }
    }
    return trajectory;
  }

  /** Computes a pixel-space crop rectangle centered on `focalPoint`, clamped to the frame. */
  computeCropRegion(
    sourceWidth: number,
    sourceHeight: number,
    focalPoint: FocalPoint,
    targetAspect: number = DEFAULT_TARGET_ASPECT,
  ): CropRegion {
    const sourceAspect = sourceWidth / sourceHeight;

    let width: number;
    let height: number;

    if (sourceAspect > targetAspect) {
      // Source is relatively wider than 9:16 — crop the sides, keep full height.
      height = sourceHeight;
      width = Math.round(sourceHeight * targetAspect);
    } else {
      // Source is relatively narrower/taller than 9:16 — crop top/bottom, keep full width.
      width = sourceWidth;
      height = Math.round(sourceWidth / targetAspect);
    }

    // libx264 requires even dimensions for 4:2:0 chroma subsampling.
    width = evenFloor(Math.min(width, sourceWidth));
    height = evenFloor(Math.min(height, sourceHeight));

    const idealX = focalPoint.x * sourceWidth - width / 2;
    const idealY = focalPoint.y * sourceHeight - height / 2;

    const x = evenFloor(Math.round(clamp(idealX, 0, sourceWidth - width)));
    const y = evenFloor(Math.round(clamp(idealY, 0, sourceHeight - height)));

    return { x, y, width, height };
  }

  /**
   * Computes an average or representative crop region across a subject trajectory.
   */
  computeTrajectoryCropRegion(
    sourceWidth: number,
    sourceHeight: number,
    trajectory: SubjectTrajectory,
    targetAspect: number = DEFAULT_TARGET_ASPECT,
  ): CropRegion {
    if (trajectory.points.length === 0) {
      return this.computeCropRegion(sourceWidth, sourceHeight, CENTER_FOCAL_POINT, targetAspect);
    }
    const avgX = trajectory.points.reduce((sum, p) => sum + p.focalPoint.x, 0) / trajectory.points.length;
    const avgY = trajectory.points.reduce((sum, p) => sum + p.focalPoint.y, 0) / trajectory.points.length;
    return this.computeCropRegion(sourceWidth, sourceHeight, { x: avgX, y: avgY }, targetAspect);
  }
}

function evenFloor(value: number): number {
  return value - (value % 2);
}
