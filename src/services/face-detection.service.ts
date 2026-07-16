import type { FocalPoint } from '../types/reframe.js';

/**
 * Pluggable face/subject detector: given a still frame, returns the
 * normalized focal point of the primary subject, or `null` if none is found.
 *
 * This is the seam future work (MediaPipe, YOLO, OpenCV, a cloud Vision API)
 * plugs into — {@link ReframeService} only depends on this interface, so
 * swapping in a real detector never requires touching rendering logic.
 */
export interface IFaceDetectionService {
  detectPrimaryFace(framePath: string): Promise<FocalPoint | null>;
}

/**
 * No-op implementation: no face/speaker/motion detection is wired up yet, so
 * this always reports "nothing found," which makes {@link ReframeService}
 * fall through to a center-crop. Replace this with a real detector to
 * activate face-tracking reframing without changing any other service.
 */
export class NoOpFaceDetectionService implements IFaceDetectionService {
  async detectPrimaryFace(_framePath: string): Promise<FocalPoint | null> {
    return null;
  }
}
