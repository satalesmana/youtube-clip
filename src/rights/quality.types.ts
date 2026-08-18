/** Quality check types for the AI Viral Content Transformer pipeline. */

/** Individual quality check result. */
export interface QualityCheckResult {
  /** Unique check identifier. */
  id: string;
  /** Check name (human-readable). */
  name: string;
  /** Whether this check passed. */
  passed: boolean;
  /** Warning message if failed or has issues. */
  warning?: string;
  /** Additional metadata (e.g. measured values). */
  metadata?: Record<string, unknown>;
}

/** Overall quality check status. */
export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL';

/** Quality check input — what to check. */
export interface QualityCheckInput {
  /** Path to the output video file. */
  videoPath: string;
  /** Expected minimum duration in seconds. */
  minDurationSeconds?: number;
  /** Expected maximum duration in seconds. */
  maxDurationSeconds?: number;
  /** Whether audio track must be present. */
  requireAudio?: boolean;
  /** Whether video track must be present. */
  requireVideo?: boolean;
}

/** Quality check output. */
export interface QualityCheckOutput {
  /** Overall status. */
  status: QualityStatus;
  /** List of all checks performed. */
  checks: QualityCheckResult[];
  /** Summary of warnings. */
  warnings: string[];
  /** Summary of failures. */
  failures: string[];
}
