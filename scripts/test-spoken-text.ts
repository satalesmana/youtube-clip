/**
 * Verification test for Spoken Text vs Display Text decoupling and speech normalizer.
 * Run: npx tsx scripts/test-spoken-text.ts
 */
import { normalizeForSpeech, numberToWordsIndonesian } from '../src/utils/speech-normalizer.js';
import { VideoPlanService } from '../src/content/video-plan.service.js';
import type { OriginalScript } from '../src/types/script.js';
import type { TTSSectionTiming } from '../providers/tts/tts.types.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ OK: ${message}`);
  }
}

console.log('=== 1. TEST INDONESIAN NUMBER TO WORDS ===');
assert(numberToWordsIndonesian(0) === 'nol', '0 -> nol');
assert(numberToWordsIndonesian(1) === 'satu', '1 -> satu');
assert(numberToWordsIndonesian(11) === 'sebelas', '11 -> sebelas');
assert(numberToWordsIndonesian(25) === 'dua puluh lima', '25 -> dua puluh lima');
assert(numberToWordsIndonesian(100) === 'seratus', '100 -> seratus');
assert(numberToWordsIndonesian(105) === 'seratus lima', '105 -> seratus lima');
assert(numberToWordsIndonesian(226) === 'dua ratus dua puluh enam', '226 -> dua ratus dua puluh enam');
assert(numberToWordsIndonesian(1000) === 'seribu', '1000 -> seribu');
assert(numberToWordsIndonesian(1250) === 'seribu dua ratus lima puluh', '1250 -> seribu dua ratus lima puluh');
assert(numberToWordsIndonesian(1000000) === 'satu juta', '1000000 -> satu juta');
assert(numberToWordsIndonesian(226000000) === 'dua ratus dua puluh enam juta', '226000000 -> dua ratus dua puluh enam juta');

console.log('\n=== 2. TEST SPEECH NORMALIZER ===');
const sample1 = 'Tottenham menghabiskan 226 juta pound dalam satu bursa!';
const norm1 = normalizeForSpeech(sample1, 'id');
console.log(`Original: "${sample1}"`);
console.log(`Spoken:   "${norm1}"`);
assert(norm1.includes('Tot-nem'), 'Tottenham converted to Tot-nem');
assert(norm1.includes('dua ratus dua puluh enam'), '226 converted to dua ratus dua puluh enam');
assert(norm1.includes('paund'), 'pound converted to paund');

const sample2 = 'Chelsea membeli pemain seharga £100 juta dengan kenaikan 15,5%!';
const norm2 = normalizeForSpeech(sample2, 'id');
console.log(`Original: "${sample2}"`);
console.log(`Spoken:   "${norm2}"`);
assert(norm2.includes('Cel-si'), 'Chelsea converted to Cel-si');
assert(norm2.includes('seratus paund'), '£100 converted to seratus paund');
assert(norm2.includes('lima belas koma lima persen'), '15,5% converted to lima belas koma lima persen');

const sample3 = 'Finis di posisi ke-1 dengan hadiah Rp 50.000!';
const norm3 = normalizeForSpeech(sample3, 'id');
console.log(`Original: "${sample3}"`);
console.log(`Spoken:   "${norm3}"`);
assert(norm3.includes('pertama'), 'ke-1 converted to pertama');
assert(norm3.includes('lima puluh ribu rupiah'), 'Rp 50.000 converted to lima puluh ribu rupiah');

console.log('\n=== 3. TEST CAPTION WORD-TIMING ALIGNMENT (DISPLAY WORDS VS SPOKEN WORDS) ===');
// Create a test script where display text has 8 words and spoken text has 13 words
const mockScript: OriginalScript = {
  candidateId: 'test_cand',
  angleId: 'test_angle',
  angleTitle: 'Test Angle',
  language: 'id',
  estimatedDurationSeconds: 15,
  sections: [
    {
      type: 'hook',
      text: 'Tottenham menghabiskan 226 juta pound dalam satu bursa!',
      spokenText: 'Tot-nem menghabiskan dua ratus dua puluh enam juta paund dalam satu bursa!',
    },
    {
      type: 'context',
      text: 'Ini adalah rekor transfer terbesar klub.',
      spokenText: 'Ini adalah rekor transfer terbesar klub.',
    },
    {
      type: 'commentary',
      text: 'Banyak analis sepak bola terkejut.',
      spokenText: 'Banyak analis sepak bola terkejut.',
    },
    {
      type: 'analysis',
      text: 'Langkah ini sangat berani.',
      spokenText: 'Langkah ini sangat berani.',
    },
    {
      type: 'conclusion',
      text: 'Apakah strategi ini akan berhasil?',
      spokenText: 'Apakah strategi ini akan berhasil?',
    },
  ],
  originality: { status: 'PASS', notes: [] },
};

// Mock TTS section timings with spoken word boundaries
const mockTtsSections: TTSSectionTiming[] = [
  {
    type: 'hook',
    durationSeconds: 4.0,
    wordTimings: [
      { word: 'Tot-nem', start: 0.1, end: 0.5 },
      { word: 'menghabiskan', start: 0.5, end: 1.0 },
      { word: 'dua', start: 1.0, end: 1.2 },
      { word: 'ratus', start: 1.2, end: 1.4 },
      { word: 'dua', start: 1.4, end: 1.6 },
      { word: 'puluh', start: 1.6, end: 1.8 },
      { word: 'enam', start: 1.8, end: 2.1 },
      { word: 'juta', start: 2.1, end: 2.5 },
      { word: 'paund', start: 2.5, end: 2.9 },
      { word: 'dalam', start: 2.9, end: 3.2 },
      { word: 'satu', start: 3.2, end: 3.5 },
      { word: 'bursa!', start: 3.5, end: 3.9 },
    ],
  },
  {
    type: 'context',
    durationSeconds: 3.0,
    wordTimings: [
      { word: 'Ini', start: 4.0, end: 4.3 },
      { word: 'adalah', start: 4.3, end: 4.7 },
      { word: 'rekor', start: 4.7, end: 5.1 },
      { word: 'transfer', start: 5.1, end: 5.6 },
      { word: 'terbesar', start: 5.6, end: 6.2 },
      { word: 'klub.', start: 6.2, end: 6.8 },
    ],
  },
  {
    type: 'commentary',
    durationSeconds: 3.0,
    wordTimings: [
      { word: 'Banyak', start: 7.0, end: 7.4 },
      { word: 'analis', start: 7.4, end: 7.9 },
      { word: 'sepak', start: 7.9, end: 8.3 },
      { word: 'bola', start: 8.3, end: 8.7 },
      { word: 'terkejut.', start: 8.7, end: 9.3 },
    ],
  },
  {
    type: 'analysis',
    durationSeconds: 2.5,
    wordTimings: [
      { word: 'Langkah', start: 10.0, end: 10.5 },
      { word: 'ini', start: 10.5, end: 10.8 },
      { word: 'sangat', start: 10.8, end: 11.3 },
      { word: 'berani.', start: 11.3, end: 11.9 },
    ],
  },
  {
    type: 'conclusion',
    durationSeconds: 2.5,
    wordTimings: [
      { word: 'Apakah', start: 12.5, end: 12.9 },
      { word: 'strategi', start: 12.9, end: 13.5 },
      { word: 'ini', start: 13.5, end: 13.8 },
      { word: 'akan', start: 13.8, end: 14.1 },
      { word: 'berhasil?', start: 14.1, end: 14.8 },
    ],
  },
];

const videoPlanService = new VideoPlanService(
  { targetDuration: 60 },
  { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} } as any,
);
const plan = await videoPlanService.buildPlan({
  script: mockScript,
  clipStart: 10,
  clipEnd: 30,
  ttsSections: mockTtsSections,
});

assert(plan.captions.length > 0, 'captions generated');
console.log(`Total captions: ${plan.captions.length}`);

// Inspect first 2 captions (which cover the hook)
const hookCaps = plan.captions.slice(0, 2);
for (const cap of hookCaps) {
  console.log(`Caption: [${cap.start} - ${cap.end}] "${cap.text}"`);
  console.log(`  wordTimings:`, cap.wordTimings);
  const displayWords = cap.text.split(/\s+/).filter(Boolean);
  assert(cap.wordTimings !== undefined, 'wordTimings defined');
  assert(cap.wordTimings?.length === displayWords.length, `wordTimings count (${cap.wordTimings?.length}) matches display word count (${displayWords.length})`);
  assert(
    cap.wordTimings?.every((w, i) => w.word === displayWords[i]),
    'each wordTiming has matching display word',
  );
}

console.log('\n🎉 ALL TESTS PASSED!');
