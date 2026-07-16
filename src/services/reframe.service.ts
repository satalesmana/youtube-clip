import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { extractFrame } from '../utils/ffmpeg.js';
import { clamp } from '../utils/timestamp.js';
import type { IFaceDetectionService } from './face-detection.service.js';
import type { CropRegion, FocalPoint } from '../types/reframe.js';

export interface ReframeServiceOptions {
  ffmpegBinaryPath: string;
  tempDir: string;
}

const DEFAULT_TARGET_ASPECT = 9 / 16;
const CENTER_FOCAL_POINT: FocalPoint = { x: 0.5, y: 0.5 };

/**
 * Computes the 9:16 crop region for a clip. Reframing priority is:
 * face detection → (speaker tracking / multi-person / motion tracking, not
 * yet implemented — see below) → center-crop fallback.
 *
 * Speaker tracking, multi-person framing, and motion tracking are each
 * meant to be their own {@link IFaceDetectionService}-shaped strategy
 * plugged in ahead of the center-crop fallback; only face detection (as a
 * documented no-op) and the fallback are implemented today.
 */
export interface IReframeService {
  resolveFocalPoint(videoPath: string, sampleTimestampSeconds: number, id: number): Promise<FocalPoint>;
  computeCropRegion(
    sourceWidth: number,
    sourceHeight: number,
    focalPoint: FocalPoint,
    targetAspect?: number,
  ): CropRegion;
}

export class ReframeService implements IReframeService {
  constructor(
    private readonly options: ReframeServiceOptions,
    private readonly faceDetectionService: IFaceDetectionService,
  ) {}

  /** Samples one frame near the clip's content and asks the detector where the subject is. */
  async resolveFocalPoint(
    videoPath: string,
    sampleTimestampSeconds: number,
    id: number,
  ): Promise<FocalPoint> {
    const framePath = join(this.options.tempDir, `reframe-sample-${id}.jpg`);

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
}

function evenFloor(value: number): number {
  return value - (value % 2);
}
