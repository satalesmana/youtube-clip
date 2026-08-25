import { VideoPlanService } from '../src/content/video-plan.service.js';
import { createLogger } from '../src/utils/logger.js';
import { createTtsServiceWith } from '../src/container/index.js';
import type { OriginalScript } from '../src/types/script.js';
import type { TTSSectionTiming } from '../src/providers/tts/tts.types.js';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

async function run() {
  const logger = createLogger('test-synced-captions');
  const service = new VideoPlanService({ targetDuration: 60 }, logger);

  const sampleScript: OriginalScript = {
    candidateId: 'test_candidate',
    angleId: 'test_angle',
    angleTitle: 'Highlight',
    language: 'id',
    sections: [
      { type: 'hook', text: 'Momen ini sungguh luar biasa.' },
      { type: 'context', text: 'Pertandingan berjalan sangat sengit antara kedua tim papan atas.' },
      { type: 'commentary', text: 'Gol indah ini membalikkan keadaan dalam sekejap mata.' },
      { type: 'conclusion', text: 'Dan hasil inilah yang mengunci kemenangan spektakuler.' },
    ],
    originality: { status: 'PASS', notes: [] },
    estimatedDurationSeconds: 20,
  };

  // Mock TTS section timings with exact millisecond word timestamps
  const ttsSections: TTSSectionTiming[] = [
    {
      type: 'hook',
      durationSeconds: 3.0,
      wordTimings: [
        { word: 'Momen', start: 0.1, end: 0.7 },
        { word: 'ini', start: 0.8, end: 1.2 },
        { word: 'sungguh', start: 1.3, end: 1.9 },
        { word: 'luar', start: 2.0, end: 2.4 },
        { word: 'biasa.', start: 2.5, end: 2.9 },
      ],
    },
    {
      type: 'context',
      durationSeconds: 5.0,
      wordTimings: [
        { word: 'Pertandingan', start: 3.1, end: 3.8 },
        { word: 'berjalan', start: 3.9, end: 4.3 },
        { word: 'sangat', start: 4.4, end: 4.8 },
        { word: 'sengit', start: 4.9, end: 5.4 },
        { word: 'antara', start: 5.5, end: 5.9 },
        { word: 'kedua', start: 6.0, end: 6.4 },
        { word: 'tim', start: 6.5, end: 6.9 },
        { word: 'papan', start: 7.0, end: 7.4 },
        { word: 'atas.', start: 7.5, end: 7.9 },
      ],
    },
    {
      type: 'commentary',
      durationSeconds: 5.0,
      wordTimings: [
        { word: 'Gol', start: 8.1, end: 8.5 },
        { word: 'indah', start: 8.6, end: 9.0 },
        { word: 'ini', start: 9.1, end: 9.4 },
        { word: 'membalikkan', start: 9.5, end: 10.2 },
        { word: 'keadaan', start: 10.3, end: 10.8 },
        { word: 'dalam', start: 10.9, end: 11.3 },
        { word: 'sekejap', start: 11.4, end: 11.9 },
        { word: 'mata.', start: 12.0, end: 12.8 },
      ],
    },
    {
      type: 'conclusion',
      durationSeconds: 4.0,
      wordTimings: [
        { word: 'Dan', start: 13.1, end: 13.4 },
        { word: 'hasil', start: 13.5, end: 13.9 },
        { word: 'inilah', start: 14.0, end: 14.4 },
        { word: 'yang', start: 14.5, end: 14.7 },
        { word: 'mengunci', start: 14.8, end: 15.3 },
        { word: 'kemenangan', start: 15.4, end: 16.0 },
        { word: 'spektakuler.', start: 16.1, end: 16.9 },
      ],
    },
  ];

  const plan = await service.buildPlan({
    script: sampleScript,
    clipStart: 10,
    clipEnd: 40,
    narrationDurationSeconds: 17.0,
    ttsSections,
  });

  assert(plan.captions.length > 0, 'Captions were generated');
  console.log(`Generated ${plan.captions.length} captions:`);
  for (const cap of plan.captions) {
    console.log(`  [${cap.start}s - ${cap.end}s]: "${cap.text}" (wordTimings: ${cap.wordTimings?.length ?? 0})`);
    assert(cap.wordTimings != null && cap.wordTimings.length > 0, `Caption "${cap.text}" has real wordTimings`);
    assert(cap.start >= 3.0, 'Subtitles start after hook scene');
    assert(cap.end <= 17.5, 'Subtitles end within audio duration');
  }

  // Test custom rate TTS service instantiation
  const customTts = createTtsServiceWith('edge-tts', 'id-ID-ArdiNeural', '-10%');
  assert(customTts != null, 'createTtsServiceWith with custom rate -10% created successfully');

  console.log('\n🎉 ALL SYNCHRONIZED CAPTION TESTS PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
