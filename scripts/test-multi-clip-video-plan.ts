import { VideoPlanService } from '../src/content/video-plan.service.js';
import { createLogger } from '../src/utils/logger.js';
import type { OriginalScript } from '../src/types/script.js';

const logger = createLogger('test-multi-clip-plan');
const service = new VideoPlanService({ targetDuration: 60 }, logger);

const sampleScript: OriginalScript = {
  candidateId: 'test_candidate',
  angleId: 'test_angle',
  angleTitle: 'Multi-Clip Viral Highlight',
  language: 'id',
  sections: [
    { type: 'hook', text: 'Ini alasan mengapa momen ini sangat gila.' },
    { type: 'context', text: 'Awalnya situasi pertandingan sangat sengit dan menegangkan.' },
    { type: 'source', text: 'Pemain utama menyatakan: "Kita tidak akan menyerah hari ini."', sourceQuote: 'Kita tidak akan menyerah' },
    { type: 'commentary', text: 'Serangan balik cepat langsung membalikkan keadaan di menit krusial.' },
    { type: 'analysis', text: 'Taktik ini terbukti sukses mengecoh pertahanan lawan secara telak.' },
    { type: 'conclusion', text: 'Dan hasil inilah yang membuktikan bahwa ini alasan mengapa momen ini sangat gila.' },
  ],
  originality: { status: 'PASS', notes: [] },
  estimatedDurationSeconds: 60,
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

async function run() {
  console.log('Testing N = 1 Clip...');
  const plan1 = await service.buildPlan({
    script: sampleScript,
    clipStart: 10,
    clipEnd: 40,
    selectedClips: [{ start: 10, end: 40, title: 'Single Clip' }],
  });
  assert(plan1.scenes.length === 6, 'Plan 1 has 6 scenes');
  const bodyScenes1 = plan1.scenes.filter((s) => s.source && s.type !== 'hook' && s.type !== 'conclusion');
  assert(bodyScenes1.length === 4, 'Plan 1 has 4 body source scenes (context, source, commentary, analysis)');
  assert(bodyScenes1[0]!.source!.start >= 10 && bodyScenes1[bodyScenes1.length - 1]!.source!.end <= 40, 'Plan 1 source ranges within 10-40');

  console.log('\nTesting N = 2 Clips...');
  const plan2 = await service.buildPlan({
    script: sampleScript,
    clipStart: 10,
    clipEnd: 80,
    selectedClips: [
      { start: 10, end: 30, title: 'Clip 1 (Setup)' },
      { start: 60, end: 80, title: 'Clip 2 (Payoff)' },
    ],
  });
  const bodyScenes2 = plan2.scenes.filter((s) => s.source && s.type !== 'hook' && s.type !== 'conclusion');
  assert(bodyScenes2.length === 4, 'Plan 2 has 4 body source scenes');
  assert(bodyScenes2[0]!.source!.start >= 10 && bodyScenes2[0]!.source!.end <= 30, 'Scene 1 uses Clip 1');
  assert(bodyScenes2[1]!.source!.start >= 10 && bodyScenes2[1]!.source!.end <= 30, 'Scene 2 uses Clip 1');
  assert(bodyScenes2[2]!.source!.start >= 60 && bodyScenes2[2]!.source!.end <= 80, 'Scene 3 uses Clip 2');
  assert(bodyScenes2[3]!.source!.start >= 60 && bodyScenes2[3]!.source!.end <= 80, 'Scene 4 uses Clip 2');

  console.log('\nTesting N = 3 Clips...');
  const plan3 = await service.buildPlan({
    script: sampleScript,
    clipStart: 10,
    clipEnd: 150,
    selectedClips: [
      { start: 10, end: 30, title: 'Clip 1 (Hook/Setup)' },
      { start: 60, end: 80, title: 'Clip 2 (Conflict)' },
      { start: 120, end: 150, title: 'Clip 3 (Climax)' },
    ],
  });
  const bodyScenes3 = plan3.scenes.filter((s) => s.source && s.type !== 'hook' && s.type !== 'conclusion');
  assert(bodyScenes3.length === 4, 'Plan 3 has 4 body source scenes');
  assert(bodyScenes3[0]!.source!.start >= 10 && bodyScenes3[0]!.source!.end <= 30, 'Scene 1 maps to Clip 1 (part 1)');
  assert(bodyScenes3[1]!.source!.start >= 10 && bodyScenes3[1]!.source!.end <= 30, 'Scene 2 maps to Clip 1 (part 2)');
  assert(bodyScenes3[2]!.source!.start >= 60 && bodyScenes3[2]!.source!.end <= 80, 'Scene 3 maps to Clip 2');
  assert(bodyScenes3[3]!.source!.start >= 120 && bodyScenes3[3]!.source!.end <= 150, 'Scene 4 maps to Clip 3');

  console.log('\nTesting N = 4 Clips...');
  const plan4 = await service.buildPlan({
    script: sampleScript,
    clipStart: 10,
    clipEnd: 200,
    selectedClips: [
      { start: 10, end: 25, title: 'Clip 1' },
      { start: 50, end: 65, title: 'Clip 2' },
      { start: 100, end: 120, title: 'Clip 3' },
      { start: 170, end: 200, title: 'Clip 4' },
    ],
  });
  const bodyScenes4 = plan4.scenes.filter((s) => s.source && s.type !== 'hook' && s.type !== 'conclusion');
  assert(bodyScenes4.length === 4, 'Plan 4 has 4 body source scenes');
  assert(bodyScenes4[0]!.source!.start >= 10 && bodyScenes4[0]!.source!.end <= 25, 'Scene 1 maps to Clip 1');
  assert(bodyScenes4[1]!.source!.start >= 50 && bodyScenes4[1]!.source!.end <= 65, 'Scene 2 maps to Clip 2');
  assert(bodyScenes4[2]!.source!.start >= 100 && bodyScenes4[2]!.source!.end <= 120, 'Scene 3 maps to Clip 3');
  assert(bodyScenes4[3]!.source!.start >= 170 && bodyScenes4[3]!.source!.end <= 200, 'Scene 4 maps to Clip 4');

  console.log('\n🎉 ALL MULTI-CLIP VIDEO PLAN TESTS PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
