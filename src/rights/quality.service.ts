import { readFile, stat } from 'node:fs/promises';
import { probeDurationSeconds, probeResolution } from '../utils/ffmpeg.js';
import { probeAudioPresent, probeVideoPresent } from '../utils/probe-helpers.js';
import type { QualityCheckInput, QualityCheckOutput, QualityCheckResult } from './quality.types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Quality gate service — validates output videos meet minimum standards.
 *
 * Checks:
 * 1. Video exists and is readable
 * 2. Duration within expected range
 * 3. Video track present
 * 4. Audio track present (if required)
 * 5. Resolution meets minimum (no blank/black frames check yet)
 */
export class QualityCheckService {
  constructor(private readonly logger: Logger) {}

  /**
   * Run quality checks on a video file.
   * Returns a QualityCheckOutput with PASS/WARNING/FAIL status.
   */
  async check(input: QualityCheckInput): Promise<QualityCheckOutput> {
    const checks: QualityCheckResult[] = [];
    const warnings: string[] = [];
    const failures: string[] = [];

    // 1. File existence
    const exists = await this.fileExists(input.videoPath);
    checks.push({
      id: 'file_exists',
      name: 'File exists',
      passed: exists,
      warning: exists ? undefined : 'Output video file not found',
    });
    if (!exists) {
      failures.push('Output video file not found');
      return this.buildOutput('FAIL', checks, warnings, failures);
    }

    // 2. Duration checks
    let duration: number | null = null;
    try {
      duration = await probeDurationSeconds({ binaryPath: 'ffmpeg', inputPath: input.videoPath });
    } catch {
      checks.push({
        id: 'duration_probe',
        name: 'Duration probe',
        passed: false,
        warning: 'Could not probe video duration',
      });
      failures.push('Failed to probe video duration');
    }

    if (duration !== null) {
      const minOk = !input.minDurationSeconds || duration >= input.minDurationSeconds;
      const maxOk = !input.maxDurationSeconds || duration <= input.maxDurationSeconds;

      checks.push({
        id: 'duration_range',
        name: 'Duration in range',
        passed: minOk && maxOk,
        metadata: { duration, min: input.minDurationSeconds, max: input.maxDurationSeconds },
        warning: !minOk
          ? `Duration ${duration.toFixed(1)}s is below minimum ${input.minDurationSeconds}s`
          : !maxOk
          ? `Duration ${duration.toFixed(1)}s exceeds maximum ${input.maxDurationSeconds}s`
          : undefined,
      });

      if (!minOk || !maxOk) {
        warnings.push(`Duration ${duration.toFixed(1)}s outside expected range`);
      }
    }

    // 3. Video track
    const hasVideo = await probeVideoPresent({ inputPath: input.videoPath });
    checks.push({
      id: 'video_track',
      name: 'Video track present',
      passed: hasVideo,
      warning: hasVideo ? undefined : 'No video track detected',
    });
    if (!hasVideo && input.requireVideo !== false) {
      failures.push('No video track detected');
    }

    // 4. Audio track
    const hasAudio = await probeAudioPresent({ inputPath: input.videoPath });
    checks.push({
      id: 'audio_track',
      name: 'Audio track present',
      passed: hasAudio,
      warning: hasAudio ? undefined : 'No audio track detected',
    });
    if (!hasAudio && input.requireAudio !== false) {
      warnings.push('No audio track detected');
    }

    // 5. Resolution check
    try {
      const resolution = await probeResolution({ binaryPath: 'ffmpeg', inputPath: input.videoPath });
      if (resolution) {
        const minWidth = 720;
        const minHeight = 1280;
        const minOk = resolution.width >= minWidth && resolution.height >= minHeight;
        checks.push({
          id: 'resolution',
          name: 'Minimum resolution',
          passed: minOk,
          metadata: { width: resolution.width, height: resolution.height },
          warning: minOk ? undefined : `Resolution ${resolution.width}x${resolution.height} below minimum ${minWidth}x${minHeight}`,
        });
        if (!minOk) {
          warnings.push(`Low resolution: ${resolution.width}x${resolution.height}`);
        }
      }
    } catch {
      checks.push({
        id: 'resolution',
        name: 'Resolution check',
        passed: false,
        warning: 'Could not probe resolution',
      });
    }

    // 6. File size sanity
    try {
      const stats = await stat(input.videoPath);
      const minSizeBytes = 100_000; // ~100KB minimum
      checks.push({
        id: 'file_size',
        name: 'File size sane',
        passed: stats.size >= minSizeBytes,
        metadata: { sizeBytes: stats.size },
        warning: stats.size < minSizeBytes ? `File too small: ${stats.size} bytes` : undefined,
      });
      if (stats.size < minSizeBytes) {
        warnings.push('Output file unusually small');
      }
    } catch {
      checks.push({
        id: 'file_size',
        name: 'File size check',
        passed: false,
        warning: 'Could not stat output file',
      });
    }

    // Determine overall status
    const hasFailure = checks.some((c) => !c.passed && c.id !== 'duration_probe' && c.id !== 'resolution');
    const hasWarning = checks.some((c) => c.warning);

    if (hasFailure) {
      return this.buildOutput('FAIL', checks, warnings, failures);
    } else if (hasWarning) {
      return this.buildOutput('WARNING', checks, warnings, failures);
    } else {
      return this.buildOutput('PASS', checks, warnings, failures);
    }
  }

  private buildOutput(
    status: 'PASS' | 'WARNING' | 'FAIL',
    checks: QualityCheckResult[],
    warnings: string[],
    failures: string[],
  ): QualityCheckOutput {
    return { status, checks, warnings, failures };
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await readFile(path);
      return true;
    } catch {
      return false;
    }
  }
}
