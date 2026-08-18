/**
 * Smoke test for Sprint D — Video Planner.
 * Builds a scene plan from script.json + clip #1 timing (real data).
 *
 * Run: npx tsx scripts/test-video-plan.service.mjs
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { container } from '../src/container/index.js';

const outputsRoot = resolve(process.cwd(), 'outputs', 'QyW1rOk-qqI');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const [script, clips] = await Promise.all([
    readFile(resolve(outputsRoot, 'metadata', 'script.json'), 'utf8').then(JSON.parse),
    readFile(resolve(outputsRoot, 'metadata', 'clips.json'), 'utf8').then(JSON.parse),
  ]);

  const candidate = Array.isArray(clips) ? clips[0] : clips.clips?.[0];

  const plan = await container.videoPlanService.buildPlan({
    script,
    clipStart: candidate.start,
    clipEnd: candidate.end,
    narrationPath: resolve(outputsRoot, 'voice', 'narration.mp3'),
  });

  console.log('\n=== VIDEO PLAN ===');
  console.log(`duration: ${plan.duration}s, scenes: ${plan.scenes.length}, captions: ${plan.captions.length}`);
  for (const scene of plan.scenes) {
    const src = scene.source ? ` src=[${scene.source.start.toFixed(1)}-${scene.source.end.toFixed(1)}]` : '';
    console.log(
      `[${scene.start.toFixed(1)}-${scene.end.toFixed(1)}] ${scene.type}${src} visual=${scene.visual}`,
    );
  }
  console.log('\nfirst 3 captions:');
  for (const cap of plan.captions.slice(0, 3)) {
    console.log(`  [${cap.start}-${cap.end}] ${cap.text} ${cap.highlightWords?.length ? `(hl: ${cap.highlightWords.join(',')})` : ''}`);
  }

  // Assertions
  assert(plan.duration >= 45 && plan.duration <= 75, `duration in 45-75s (got ${plan.duration})`);
  assert(plan.scenes.length >= 5, `>= 5 scenes (got ${plan.scenes.length})`);
  const sourceScenes = plan.scenes.filter((s) => s.type === 'source');
  assert(
    sourceScenes.length > 0 && sourceScenes.every((s) => s.source),
    'source scenes have real source trim ranges',
  );
  assert(plan.captions.length > 10, `captions > 10 (got ${plan.captions.length})`);
  assert(plan.audio.narration?.endsWith('narration.mp3'), 'audio.narration points to narration.mp3');
  assert(
    plan.scenes.every((s, i, arr) => i === 0 || s.start >= arr[i - 1].end - 0.01),
    'scenes are chronological',
  );

  const { writeFile } = await import('node:fs/promises');
  await writeFile(
    resolve(outputsRoot, 'metadata', 'video-plan.json'),
    JSON.stringify(plan, null, 2),
  );
  console.log('\nSaved to outputs/QyW1rOk-qqI/metadata/video-plan.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
