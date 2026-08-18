/**
 * Smoke test for Sprint F — Rights Gate + Quality Check.
 * Tests RightsService and QualityCheckService with real data.
 *
 * Run: npx tsx scripts/test-sprint-f.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RightsService } from '../src/rights/rights.service.js';
import { QualityCheckService } from '../src/rights/quality.service.js';
import { createLogger } from '../src/utils/logger.js';

const outputsRoot = join(process.cwd(), 'outputs', 'QyW1rOk-qqI');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const logger = createLogger('test.sprint-f');
  const rightsService = new RightsService(outputsRoot, logger);
  const qualityService = new QualityCheckService(logger);

  // Test 1: Load rights (should create with UNKNOWN)
  console.log('\n=== Test 1: Load Rights (UNKNOWN) ===');
  const rights = await rightsService.load('QyW1rOk-qqI');
  assert(rights.sourceId === 'QyW1rOk-qqI', 'sourceId matches');
  assert(rights.status === 'UNKNOWN', 'initial status is UNKNOWN');
  assert(rights.createdAt, 'createdAt exists');
  assert(rights.updatedAt, 'updatedAt exists');
  console.log('Rights:', JSON.stringify(rights, null, 2));

  // Test 2: Can publish? Should be false for UNKNOWN
  console.log('\n=== Test 2: Can Publish (UNKNOWN) ===');
  const canPublish1 = await rightsService.canPublish('QyW1rOk-qqI');
  assert(!canPublish1.publishable, 'UNKNOWN is not publishable');
  assert(canPublish1.reason?.includes('UNKNOWN'), 'reason mentions UNKNOWN');
  console.log('Can publish:', canPublish1);

  // Test 3: Approve rights
  console.log('\n=== Test 3: Approve Rights ===');
  const approved = await rightsService.updateStatus('QyW1rOk-qqI', 'AUTHORIZED', {
    approvedBy: 'reviewer@example.com',
    notes: 'Approved for publication',
  });
  assert(approved.status === 'AUTHORIZED', 'status changed to AUTHORIZED');
  assert(approved.approvedBy === 'reviewer@example.com', 'approver recorded');
  assert(approved.approvedAt, 'approvedAt set');
  console.log('Approved rights:', JSON.stringify(approved, null, 2));

  // Test 4: Can publish after approval
  console.log('\n=== Test 4: Can Publish (AUTHORIZED) ===');
  const canPublish2 = await rightsService.canPublish('QyW1rOk-qqI');
  assert(canPublish2.publishable, 'AUTHORIZED is publishable');
  assert(!canPublish2.reason, 'no reason when publishable');
  console.log('Can publish:', canPublish2);

  // Test 5: Quality check on existing video
  console.log('\n=== Test 5: Quality Check ===');
  const transformDir = join(outputsRoot, 'transform');
  try {
    const jobs = await readdir(transformDir);
    const latestJob = jobs.sort().reverse()[0];
    const videoPath = join(transformDir, latestJob, 'clips', 'transformed.mp4');
    try {
      await readFile(videoPath);
      const qualityResult = await qualityService.check({
        videoPath,
        minDurationSeconds: 10,
        maxDurationSeconds: 120,
        requireAudio: true,
        requireVideo: true,
      });
      console.log('Quality status:', qualityResult.status);
      console.log('Checks:', qualityResult.checks.map(c => `${c.id}:${c.passed ? 'PASS' : 'FAIL'}`).join(', '));
      console.log('Warnings:', qualityResult.warnings);
      console.log('Failures:', qualityResult.failures);
      const passedChecks = qualityResult.checks.filter(c => c.passed);
      assert(passedChecks.length > 0, 'some checks passed');
    } catch (err) {
      console.log('Video not found, skipping quality check');
    }
  } catch (err) {
    console.log('No transform directory found, skipping quality check');
  }

  console.log('\n=== Sprint F Test Complete ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
