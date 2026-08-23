/**
 * Verifies the reel file-intro path: when a styled final hook intro
 * (`hookPreviewPath`) exists, transformReel swaps the planned intro range for
 * that exact file while planReelSegments still enforces anti-repeat on clips.
 * Pure logic — mirrors the controller's composeSegments mapping.
 */
import { access } from 'node:fs/promises';
import { planReelSegments } from '../src/utils/reel-plan.js';
import type { ReelSegment } from '../src/services/reel-composer.service.js';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

/** The controller's swap logic, extracted verbatim for verification. */
async function buildComposeSegments(
  hookPreviewPath: string | undefined,
  sourceRange: { start: number; end: number } | undefined,
  clips: Array<{ start: number; end: number }>,
): Promise<ReelSegment[]> {
  const intro = sourceRange && sourceRange.end > sourceRange.start ? sourceRange : undefined;
  let hookIntroFile: string | undefined;
  if (hookPreviewPath && hookPreviewPath.endsWith('.mp4')) {
    hookIntroFile = await access(hookPreviewPath).then(() => hookPreviewPath).catch(() => undefined);
  }
  const segments = planReelSegments({ intro, clips });
  return hookIntroFile
    ? segments.map((segment) => (segment.kind === 'intro' ? { ...segment, filePath: hookIntroFile! } : segment))
    : segments;
}

/** A REAL "existing" preview file (access() must find it). */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempWorkspace = await mkdtemp(join(tmpdir(), 'reel-file-intro-'));
const existingPreview = join(tempWorkspace, 'final-hook-01.mp4');
await writeFile(existingPreview, 'fake-styled-intro');

const kasusKanonik = {
  sourceRange: { start: 47, end: 68 },
  clips: [{ start: 67, end: 92 }, { start: 92, end: 129 }],
};

console.log('Skenario 1 — file intro ada: segmen intro membawa filePath:');
const s1 = await buildComposeSegments(existingPreview, kasusKanonik.sourceRange, kasusKanonik.clips);
check('intro jadi segmen file', s1[0], { start: 47, end: 68, kind: 'intro', filePath: existingPreview });
check('klip pertama tetap dipangkas (68–92)', s1[1], { start: 68, end: 92, kind: 'clip' });
check('klip kedua utuh', s1[2], { start: 92, end: 129, kind: 'clip' });

console.log('Skenario 2 — file TIDAK ada: fallback perilaku lama (cut range):');
const s2 = await buildComposeSegments('/tmp/tidak-ada-404.mp4', kasusKanonik.sourceRange, kasusKanonik.clips);
check('tanpa filePath (cut dari sumber)', s2[0], { start: 47, end: 68, kind: 'intro' });

console.log('Skenario 3 — request tanpa hookPreviewPath sama sekali:');
const s3 = await buildComposeSegments(undefined, kasusKanonik.sourceRange, kasusKanonik.clips);
check('perilaku legacy utuh', s3.length, 3);

console.log('Skenario 4 — ekstensi bukan .mp4 diabaikan:');
const s4 = await buildComposeSegments('/tmp/final-hook.txt', kasusKanonik.sourceRange, kasusKanonik.clips);
check('.txt ditolak → cut range biasa', s4[0], { start: 47, end: 68, kind: 'intro' });

console.log('Skenario 5 — tanpa hook: hanya klip, guard anti-repeat tetap jalan:');
const s5 = await buildComposeSegments(existingPreview, undefined, [
  { start: 10, end: 30 },
  { start: 20, end: 40 }, // overlaps clip 1 → trimmed/dropped
]);
check('dua klip disjoint tersisa', s5, [
  { start: 10, end: 30, kind: 'clip' },
  { start: 30, end: 40, kind: 'clip' },
]);

if (failures > 0) {
  await rm(tempWorkspace, { recursive: true, force: true }).catch(() => undefined);
  console.error(`\n${failures} cek GAGAL`);
  process.exit(1);
}
await rm(tempWorkspace, { recursive: true, force: true }).catch(() => undefined);
console.log('\nSemua cek reel-file-intro PASS');
