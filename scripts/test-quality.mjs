/**
 * Quality check test for Sprint F — creates a test video then validates it.
 */
import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { QualityCheckService } from '../src/rights/quality.service.js';
import { createLogger } from '../src/utils/logger.js';
import { probeAudioPresent, probeVideoPresent } from '../src/utils/probe-helpers.js';

const execAsync = promisify(exec);
const outputsRoot = join(process.cwd(), 'outputs', 'QyW1rOk-qqI');
const logger = createLogger('test.quality');
const qualityService = new QualityCheckService(logger);

async function main() {
  // Create a test video using FFmpeg (10 seconds, 1080x1920, with audio)
  const testVideoPath = join(outputsRoot, 'test-video.mp4');

  console.log('Creating test video...');
  await mkdir(outputsRoot, { recursive: true });

  // Generate 10s test video with audio
  await execAsync(`ffmpeg -y -f lavfi -i "color=c=blue:s=1080x1920:d=10:r=30" -f lavfi -i "sine=frequency=440:duration=10" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${testVideoPath}" 2>&1`);

  // Debug: check streams directly
  console.log('\n=== Debug: Stream Check ===');
  const hasAudio = await probeAudioPresent({ inputPath: testVideoPath });
  const hasVideo = await probeVideoPresent({ inputPath: testVideoPath });
  console.log('Direct probe - hasAudio:', hasAudio);
  console.log('Direct probe - hasVideo:', hasVideo);

  console.log('\n=== Quality Check on Test Video ===');
  const result = await qualityService.check({
    videoPath: testVideoPath,
    minDurationSeconds: 5,
    maxDurationSeconds: 120,
    requireAudio: true,
    requireVideo: true,
  });

  console.log('Status:', result.status);
  console.log('\nChecks:');
  for (const check of result.checks) {
    console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`);
    if (check.warning) console.log(`    ⚠️  ${check.warning}`);
    if (check.metadata) console.log(`       metadata: ${JSON.stringify(check.metadata)}`);
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:', result.warnings);
  }

  if (result.failures.length > 0) {
    console.log('\nFailures:', result.failures);
  }

  // Cleanup
  await rm(testVideoPath, { force: true });
  console.log('\nCleanup done.');
}

main().catch(console.error);
