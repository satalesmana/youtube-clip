import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { extractFrame } from '../utils/ffmpeg.js';
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
      return detected ?? CENTER_FOCAL_POINT;
    } catch {
      return CENTER_FOCAL_POINT;
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

    const timestamps: number[] = [];
    for (let t = startSeconds; t <= endSeconds; t += sampleIntervalSeconds) {
      timestamps.push(t);
    }
    const lastTimestamp = timestamps[timestamps.length - 1];
    if (lastTimestamp !== undefined && lastTimestamp < endSeconds) {
      timestamps.push(endSeconds);
    }

    const trackedPoints: TrackedFocalPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      if (ts === undefined) continue;
      const focal = await this.resolveFocalPoint(videoPath, ts, i);
      trackedPoints.push({
        timestampSeconds: ts,
        focalPoint: focal,
      });
    }

    if (this.focalSmoothingService) {
      return this.focalSmoothingService.smoothTrajectory(trackedPoints);
    }

    return { points: trackedPoints, smoothed: false };
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
