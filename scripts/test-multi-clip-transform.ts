import { TransformController } from '../src/controllers/transform.controller.js';
import { createLogger } from '../src/utils/logger.js';
import type { TranscriptDocument } from '../src/types/transcript.js';
import type { AngleGenerationResult } from '../src/types/angle.js';
import type { OriginalScript } from '../src/types/script.js';
import type { VideoPlan } from '../src/types/video-plan.js';
import { VideoPlanService } from '../src/content/video-plan.service.js';

const logger = createLogger('test-multi-clip-transform');
const videoPlanService = new VideoPlanService({ targetDuration: 60 }, logger);

const mockTranscript: TranscriptDocument = {
  videoId: 'test_vid_123',
  sourceUrl: 'https://youtube.com/watch?v=test_vid_123',
  language: 'id',
  durationSeconds: 180,
  createdAt: new Date().toISOString(),
  segments: [
    { start: 10, end: 15, text: 'Pertandingan baru saja dimulai di babak pertama.' },
    { start: 15, end: 20, text: 'Kedua tim saling jual beli serangan dengan tempo tinggi.' },
    { start: 20, end: 25, text: 'Momen menegangkan terjadi di depan gawang.' },
    { start: 50, end: 55, text: 'Terjadi pelanggaran keras yang memicu perdebatan.' },
    { start: 55, end: 60, text: 'Wasit meniup peluit dan memberikan kartu kuning.' },
    { start: 60, end: 65, text: 'Pemain utama memprotes keputusan tersebut dengan tegas.' },
    { start: 110, end: 115, text: 'Menit-menit akhir pertandingan menjadi sangat krusial.' },
    { start: 115, end: 120, text: 'Gol kemenangan tercipta lewat tendangan spektakuler.' },
    { start: 120, end: 125, text: 'Stadion langsung bergemuruh merayakan kemenangan dramatis.' },
  ],
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

async function run() {
  let receivedPlanInput: any = null;

  const controller = new TransformController({
    youtubeService: {} as any,
    transcriptService: {
      loadTranscript: async () => mockTranscript,
    } as any,
    whisperService: {} as any,
    contentAngleService: {
      generateAngles: async (ctx) => {
        assert(ctx.selectedClips?.length === 3, 'Angle service received 3 selectedClips');
        return {
          candidateId: ctx.candidateId,
          angles: [{ id: 'ang_1', title: 'Drama Kemenangan', angleType: 'commentary', hook: 'Ini alasan momen ini viral', reason: 'Dramatis', score: 95 }],
          selectedAngleId: 'ang_1',
        };
      },
    } as any,
    storyService: {
      buildStory: async (segs) => ({
        concept: 'comeback',
        protagonist: 'Tim Juara',
        premise: 'Perjuangan dramatis berujung kemenangan spektakuler',
        beats: [
          { id: 'b1', role: 'setup', purpose: 'Intro match', start: 10, end: 20, evidence: ['Pertandingan baru saja dimulai'] },
          { id: 'b2', role: 'tension', purpose: 'Conflict', start: 50, end: 60, evidence: ['Terjadi pelanggaran keras'] },
          { id: 'b3', role: 'turningPoint', purpose: 'Goal', start: 110, end: 120, evidence: ['Gol kemenangan tercipta'] },
        ],
      }),
    } as any,
    scriptService: {
      generateScript: async (ctx) => {
        assert(ctx.selectedClips?.length === 3, 'Script service received 3 selectedClips');
        return {
          candidateId: 'test_cand',
          angleId: 'ang_1',
          angleTitle: 'Drama Kemenangan',
          language: 'id',
          sections: [
            { type: 'hook', text: 'Ini alasan momen ini viral.' },
            { type: 'context', text: 'Pertandingan dimulai dengan tempo tinggi.' },
            { type: 'source', text: 'Pelanggaran keras memicu protes besar.', sourceQuote: 'Pelanggaran keras' },
            { type: 'commentary', text: 'Namun di menit akhir semua berubah.' },
            { type: 'analysis', text: 'Gol spektakuler memastikan kemenangan.' },
            { type: 'conclusion', text: 'Dan hasil inilah yang menjadi alasan momen ini viral.' },
          ],
          originality: { status: 'PASS', notes: [] },
          estimatedDurationSeconds: 45,
        };
      },
    } as any,
    ttsService: {
      synthesizeScript: async () => ({ outputPath: '/tmp/voice.mp3', durationSeconds: 45 }),
    } as any,
    videoPlanService: {
      buildPlan: async (input) => {
        receivedPlanInput = input;
        return videoPlanService.buildPlan(input);
      },
    } as any,
    templateService: {} as any,
    templateRendererService: {} as any,
    assService: {} as any,
    subtitleService: {} as any,
    outputsDir: '/tmp',
    logger,
    assStyle: {} as any,
    compositionEngine: {} as any,
  });

  const result = await controller.transform({
    videoId: 'test_vid_123',
    candidateId: 0,
    dryRun: true,
    outputMode: 'narration',
    selectedClips: [
      { start: 10, end: 25, title: 'Babak 1' },
      { start: 50, end: 65, title: 'Insiden Kartu' },
      { start: 110, end: 125, title: 'Gol Kemenangan' },
    ],
  });

  assert(result.success === true, 'Transform dry run succeeded');
  assert(receivedPlanInput != null, 'Video plan service was called');
  assert(receivedPlanInput.selectedClips.length === 3, 'Video plan received all 3 selectedClips');

  const plan = result.videoPlan as VideoPlan;
  assert(plan.scenes.length === 6, 'Plan contains 6 scenes');
  console.log('\nGenerated Scene Sources:');
  for (const [idx, sc] of plan.scenes.entries()) {
    console.log(`Scene ${idx + 1} (${sc.type}): src=[${sc.source?.start ?? 'none'} - ${sc.source?.end ?? 'none'}]`);
  }

  console.log('\n🎉 ALL MULTI-CLIP TRANSFORM INTEGRATION TESTS PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
