/**
 * Smoke test: HookRanker determinism — duplicate removal + diversity penalty.
 * Run: npx tsx scripts/smoke-hook-ranker.ts
 */
import { HookRanker, textSimilarity } from '../src/hooks/hook.ranker.js';
import type { HookCandidate } from '../src/hooks/hook.types.js';

function makeCandidate(
  id: string,
  style: HookCandidate['style'],
  headline: string,
  spoken: string,
  final: number,
): HookCandidate {
  return {
    id,
    angle: { id: 'angle_01', type: 'commentary', title: 'Test Angle', description: 'test' },
    style,
    source: { start: 10, end: 13, transcript: 'test transcript' },
    headline: { text: headline, style: 'kinetic' },
    spokenHook: { text: spoken, duration: 2 },
    score: {
      curiosity: final, retention: final, emotional: final, visual: final,
      clarity: final, relevance: final, accuracy: final, final,
    },
    accuracy: { score: final, supported: true, confidence: 90, risk: 'low', explanation: 'ok' },
  };
}

const candidates: HookCandidate[] = [
  // 4 curiosity hooks, two of which are near-duplicates
  makeCandidate('h1', 'curiosity', 'APA YANG TERJADI KETIKA AI LEBIH PINTAR', 'Apa yang terjadi ketika AI lebih pintar dari kamu?', 94),
  makeCandidate('h2', 'curiosity', 'APA YANG TERJADI SAAT AI LEBIH PINTAR DARI KAMU', 'Apa yang terjadi saat AI lebih pintar dari kamu?', 91), // dup of h1
  makeCandidate('h3', 'curiosity', 'RAHASIA AI YANG TIDAK DIKETAHUI SIAPAPUN', 'Rahasia AI yang tidak diketahui siapapun', 89),
  makeCandidate('h4', 'curiosity', 'KENAPA AI BISA MENGUBAH SEGALANYA', 'Kenapa AI bisa mengubah semuanya?', 87),
  // other styles
  makeCandidate('h5', 'controversial', 'AI TIDAK AKAN MENGGANTIKAN SEMUA ORANG', 'AI tidak akan menggantikan semua orang. Tapi ini berubah.', 92),
  makeCandidate('h6', 'question', 'SIAPKAH KAMU KEHILANGAN PEKERJAAN', 'Siapkah kamu kehilangan pekerjaan karena AI?', 88),
  makeCandidate('h7', 'shock', 'KEBANYAKAN ORANG BELUM SIAP', 'Kebanyakan orang belum siap dengan yang akan datang.', 86),
  makeCandidate('h8', 'contrarian', 'SEMUA ORANG SALAH SOAL AI', 'Semua orang salah soal AI. Ini faktanya.', 84),
];

const logger = {
  info: (o: unknown, msg: string) => console.log(`[info] ${msg}`, JSON.stringify(o)),
  debug: () => {},
  warn: () => {},
} as never;

const ranker = new HookRanker(
  { topN: 5, diversityPenalty: 8, duplicateSimilarityThreshold: 0.6 },
  logger,
);

// 1) similarity sanity
const sim = textSimilarity(
  'APA YANG TERJADI KETIKA AI LEBIH PINTAR Apa yang terjadi ketika AI lebih pintar dari kamu?',
  'APA YANG TERJADI SAAT AI LEBIH PINTAR DARI KAMU Apa yang terjadi saat AI lebih pintar dari kamu?',
);
console.log(`similarity(dup pair) = ${sim.toFixed(2)} (expect >= 0.6)`);

// 2) ranking
const { ranked, duplicateCount } = ranker.rank(candidates);

console.log('\n=== TOP 5 ===');
for (const hook of ranked) {
  console.log(`#${hook.rank} [${hook.style}] score=${hook.score?.final} rankScore=${hook.rankScore} — ${hook.headline.text}`);
}
console.log(`\nduplicates dropped: ${duplicateCount}`);

// 3) assertions
const styles = ranked.map((h) => h.style);
const styleCounts = new Map<string, number>();
for (const s of styles) styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
const maxSameStyle = Math.max(...styleCounts.values());

const assert = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
};

assert(ranked.length === 5, 'returns exactly 5 hooks');
assert(duplicateCount >= 1, 'at least one semantic duplicate dropped');
assert(maxSameStyle <= 2, `no style appears more than 2x in top 5 (max=${maxSameStyle})`);
assert(ranked[0]!.id === 'h1', 'highest-scored hook ranks #1');
assert(!ranked.some((h) => h.id === 'h2'), 'duplicate h2 not in top 5');
assert(ranked.every((h, i) => h.rank === i + 1), 'ranks are sequential 1..5');

console.log('\n✅ All ranker smoke tests passed');
