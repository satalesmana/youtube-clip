import type { FocalPoint } from '../types/reframe.js';

/**
 * Pluggable face/subject detector (Clean Architecture - Layer 3: Vision Port).
 *
 * Adheres to:
 * - ISP (Interface Segregation): Focused on face detection contract only.
 * - LSP (Liskov Substitution): Any detector (NoOp, OpenCV, MediaPipe) can substitute without side effects.
 */
export interface IFaceDetectionService {
  /** Detects normalized focal point (x, y in [0, 1]) of the primary face in a single still frame. */
  detectPrimaryFace(framePath: string): Promise<FocalPoint | null>;
  /** Batch detection across multiple frames to optimize process calls or model inference. */
  detectFacesBatch?(framePaths: string[]): Promise<Array<FocalPoint | null>>;
}

/**
 * Default no-op detector: safely falls through to center crop.
 */
export class NoOpFaceDetectionService implements IFaceDetectionService {
  async detectPrimaryFace(_framePath: string): Promise<FocalPoint | null> {
    return null;
  }

  async detectFacesBatch(framePaths: string[]): Promise<Array<FocalPoint | null>> {
    return framePaths.map(() => null);
  }
}
