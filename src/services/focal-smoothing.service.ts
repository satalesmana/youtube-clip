import type { FocalPoint, TrackedFocalPoint, SubjectTrajectory } from '../types/reframe.js';
import { clamp } from '../utils/timestamp.js';

export interface FocalSmoothingOptions {
  /** Smoothing factor alpha for EMA (0.0 to 1.0). Default is 0.3 (lower = smoother, higher = more responsive). */
  alpha?: number;
}

export interface IFocalSmoothingService {
  smoothTrajectory(points: TrackedFocalPoint[]): SubjectTrajectory;
  interpolateFocalPoint(trajectory: SubjectTrajectory, timestampSeconds: number): FocalPoint;
}

/**
 * Service responsible for temporal smoothing and interpolation of focal points.
 *
 * Adheres to:
 * - SRP (Single Responsibility): Solely handles smoothing math, not video decoding or cropping.
 */
export class FocalSmoothingService implements IFocalSmoothingService {
  private readonly alpha: number;

  constructor(options?: FocalSmoothingOptions) {
    this.alpha = clamp(options?.alpha ?? 0.3, 0.05, 1.0);
  }

  /**
   * Applies an Exponential Moving Average (EMA) forward-backward filter to eliminate rapid jitter.
   */
  smoothTrajectory(points: TrackedFocalPoint[]): SubjectTrajectory {
    if (points.length === 0) {
      return { points: [], smoothed: true };
    }

    if (points.length === 1) {
      return { points: [...points], smoothed: true };
    }

    // Sort chronologically
    const sorted = [...points].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    const first = sorted[0];
    if (!first) {
      return { points: [], smoothed: true };
    }

    // Forward pass
    const smoothedPoints: TrackedFocalPoint[] = [];
    let prevX = first.focalPoint.x;
    let prevY = first.focalPoint.y;

    for (const pt of sorted) {
      const smoothedX = this.alpha * pt.focalPoint.x + (1 - this.alpha) * prevX;
      const smoothedY = this.alpha * pt.focalPoint.y + (1 - this.alpha) * prevY;

      smoothedPoints.push({
        timestampSeconds: pt.timestampSeconds,
        focalPoint: {
          x: clamp(smoothedX, 0, 1),
          y: clamp(smoothedY, 0, 1),
        },
        confidence: pt.confidence,
      });

      prevX = smoothedX;
      prevY = smoothedY;
    }

    return {
      points: smoothedPoints,
      smoothed: true,
    };
  }

  /**
   * Interpolates the focal point at any arbitrary timestamp using linear interpolation between closest keyframes.
   */
  interpolateFocalPoint(trajectory: SubjectTrajectory, timestampSeconds: number): FocalPoint {
    const points = trajectory.points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    if (!firstPoint || !lastPoint) {
      return { x: 0.5, y: 0.5 };
    }

    if (timestampSeconds <= firstPoint.timestampSeconds) {
      return firstPoint.focalPoint;
    }

    if (timestampSeconds >= lastPoint.timestampSeconds) {
      return lastPoint.focalPoint;
    }

    // Find bounding segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      if (p1 && p2 && timestampSeconds >= p1.timestampSeconds && timestampSeconds <= p2.timestampSeconds) {
        const delta = p2.timestampSeconds - p1.timestampSeconds;
        if (delta === 0) return p1.focalPoint;

        const t = (timestampSeconds - p1.timestampSeconds) / delta;
        return {
          x: clamp(p1.focalPoint.x + t * (p2.focalPoint.x - p1.focalPoint.x), 0, 1),
          y: clamp(p1.focalPoint.y + t * (p2.focalPoint.y - p1.focalPoint.y), 0, 1),
        };
      }
    }

    return lastPoint.focalPoint;
  }
}
