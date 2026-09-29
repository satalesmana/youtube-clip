import type { FocalPoint } from '../types/reframe.js';
import { runCommand } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';

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

/** OpenCV Haar-cascade detector. Requires Python OpenCV (cv2) on the host. */
export class OpenCvFaceDetectionService implements IFaceDetectionService {
  constructor(private readonly pythonBinary = 'python3', private readonly logger?: Logger) {}

  async detectPrimaryFace(framePath: string): Promise<FocalPoint | null> {
    return (await this.detectFacesBatch([framePath]))[0] ?? null;
  }

  async detectFacesBatch(framePaths: string[]): Promise<Array<FocalPoint | null>> {
    if (framePaths.length === 0) return [];
    try {
      const script = "import cv2,json,sys; c=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml'); out=[]\nfor p in sys.argv[1:]:\n im=cv2.imread(p); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY) if im is not None else None; fs=c.detectMultiScale(g,1.1,5,minSize=(24,24)) if g is not None else []; f=max(fs,key=lambda r:r[2]*r[3]) if len(fs) else None; out.append({'x':(f[0]+f[2]/2)/im.shape[1],'y':(f[1]+f[3]/2)/im.shape[0]} if f is not None else None)\nprint(json.dumps(out))";
      const { stdout } = await runCommand(this.pythonBinary, ['-c', script, ...framePaths]);
      const values = JSON.parse(stdout.trim()) as Array<FocalPoint | null>;
      return framePaths.map((_, index) => {
        const value = values[index];
        if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
        return { x: Math.min(1, Math.max(0, value.x)), y: Math.min(1, Math.max(0, value.y)) };
      });
    } catch {
      this.logger?.warn({ pythonBinary: this.pythonBinary }, 'OpenCV face detection failed; using default framing');
      return framePaths.map(() => null);
    }
  }
}
