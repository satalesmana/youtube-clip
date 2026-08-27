/**
 * Verifies HighlightService.mergeAndRank never returns clips sharing source
 * seconds — using the exact scenario from the user's screenshot:
 *   clip A 47-68 (85), clip B 67-92 (92), clip C 92-129 (82)
 */
import { HighlightService } from '../src/services/highlight.service.js';
import { rangesOverlap } from '../src/utils/timestamp.js';
import type { HighlightClip } from '../src/types/highlight.js';

const silentLogger = {
  info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
} as never;

const service = new HighlightService(
  { minClipSeconds: 15, maxClipSeconds: 90, topN: 10 },
  silentLogger,
);

const candidates: HighlightClip[] = [
  { start: 47, end: 68, score: 85, title: 'Chasing the Leaders Alone', reason: '', hook: '' },
  { start: 67, end: 92, score: 92, title: 'One More Mistake Before the Finish', reason: '', hook: '' },
  { start: 92, end: 129, score: 82, title: 'Turning Failure Into Fuel', reason: '', hook: '' },
];

const result = service.mergeAndRank([candidates]);

console.log('Result:');
for (const clip of result) console.log(`  [${clip.start}, ${clip.end}] score=${clip.score} ${clip.title}`);

let failures = 0;
for (let i = 0; i < result.length; i++) {
  for (let j = i + 1; j < result.length; j++) {
    const a = result[i]!;
    const b = result[j]!;
    if (rangesOverlap(a.start, a.end, b.start, b.end)) {
      console.log(`FAIL: ${a.title} overlaps ${b.title}`);
      failures++;
    }
  }
}

// The 1-second overlap pair must have been merged into one wider clip.
if (result.length !== 2) {
  console.log(`FAIL: expected 2 clips (A+B merged, C), got ${result.length}`);
  failures++;
}
const mergedAB = result.find((c) => c.title === 'One More Mistake Before the Finish');
if (!mergedAB || mergedAB.start !== 47 || mergedAB.end !== 92) {
  console.log(`FAIL: A+B should merge into [47,92], got ${JSON.stringify(mergedAB)}`);
  failures++;
}

// Stress: clamp-induced overlap (two wide candidates sharing seconds).
const stress = service.mergeAndRank([
  [
    { start: 0, end: 200, score: 99, title: 'wide-1', reason: '', hook: '' },
    { start: 150, end: 300, score: 98, title: 'wide-2', reason: '', hook: '' },
  ],
]);
for (let i = 0; i < stress.length; i++) {
  for (let j = i + 1; j < stress.length; j++) {
    const a = stress[i]!;
    const b = stress[j]!;
    if (rangesOverlap(a.start, a.end, b.start, b.end)) {
      console.log(`FAIL(stress): ${a.title} overlaps ${b.title}`);
      failures++;
    }
  }
}

console.log(failures === 0 ? 'PASS: no shared source seconds in any scenario' : `${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
