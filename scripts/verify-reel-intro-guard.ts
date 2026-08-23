/**
 * Verifies planReelSegments (the reel anti-repeat planner) never returns
 * overlapping source seconds, including the hook-intro scenarios.
 */
import { planReelSegments } from '../src/utils/reel-plan.js';

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

function assertDisjoint(name: string, segments: Array<{ start: number; end: number }>): void {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start < sorted[i - 1]!.end) {
      failures += 1;
      console.error(`  FAIL ${name}: overlap ${sorted[i - 1]!.end} > ${sorted[i]!.start}`);
      return;
    }
  }
  console.log(`  PASS ${name} (disjoint, ${segments.length} segments)`);
}

console.log('Skenario 1 — intro hook overlap klip pertama (kasus screenshot):');
const s1 = planReelSegments({
  intro: { start: 47, end: 68 },
  clips: [
    { start: 67, end: 92 },   // overlaps the intro by 1s at its head
    { start: 92, end: 129 },
  ],
});
check('intro tetap utuh di posisi output pertama', s1[0], { start: 47, end: 68, kind: 'intro' });
check('kepala klip yang kembar dipangkas', s1[1], { start: 68, end: 92, kind: 'clip' });
check('klip kedua utuh', s1[2], { start: 92, end: 129, kind: 'clip' });
assertDisjoint('s1 disjoint', s1);

console.log('Skenario 2 — klip pertama sepenuhnya di dalam intro:');
const s2 = planReelSegments({
  intro: { start: 10, end: 40 },
  clips: [
    { start: 15, end: 25 },   // fully covered by the intro → dropped
    { start: 40, end: 60 },
  ],
});
check('klip tertelan dibuang, sisanya utuh', s2, [
  { start: 10, end: 40, kind: 'intro' },
  { start: 40, end: 60, kind: 'clip' },
]);
assertDisjoint('s2 disjoint', s2);

console.log('Skenario 3 — klip membungkus intro (unique head dipertahankan):');
const s3 = planReelSegments({
  intro: { start: 20, end: 30 },
  clips: [{ start: 10, end: 50 }],
});
check('hanya kepala unik yang tersisa', s3, [
  { start: 20, end: 30, kind: 'intro' },
  { start: 10, end: 20, kind: 'clip' },
]);
assertDisjoint('s3 disjoint', s3);

console.log('Skenario 4 — tanpa intro (perilaku lama):');
const s4 = planReelSegments({
  clips: [
    { start: 92, end: 129 },
    { start: 47, end: 68 },
  ],
});
check('klip diurutkan, tanpa perubahan', s4, [
  { start: 47, end: 68, kind: 'clip' },
  { start: 92, end: 129, kind: 'clip' },
]);
assertDisjoint('s4 disjoint', s4);

console.log('Skenario 5 — intro tanpa klip tumpang tindih + klip kembar antar diri:');
const s5 = planReelSegments({
  intro: { start: 0, end: 10 },
  clips: [
    { start: 100, end: 120 },
    { start: 115, end: 140 },  // overlaps previous clip
    { start: 200, end: 210 },
  ],
});
check('klip overlap antar diri dipangkas', s5, [
  { start: 0, end: 10, kind: 'intro' },
  { start: 100, end: 120, kind: 'clip' },
  { start: 120, end: 140, kind: 'clip' },
  { start: 200, end: 210, kind: 'clip' },
]);
assertDisjoint('s5 disjoint', s5);

console.log('Skenario 6 — semua klip tertelan intro → intro saja, tanpa duplikat:');
const s6 = planReelSegments({
  intro: { start: 0, end: 100 },
  clips: [{ start: 10, end: 20 }, { start: 50, end: 90 }],
});
check('intro tetap diputar sekali, klip kembar dibuang semua', s6, [
  { start: 0, end: 100, kind: 'intro' },
]);
assertDisjoint('s6 disjoint', s6);

console.log(failures === 0 ? '\nSEMUA PASS' : `\n${failures} GAGAL`);
process.exit(failures === 0 ? 0 : 1);
