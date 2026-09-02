/**
 * Verification script for decoupled AI Script Drafting and On-Demand TTS Synthesis.
 *
 * Tests:
 * 1. POST /api/scripts/draft creates an AI script (Angle -> Story -> Script) WITHOUT calling TTS.
 * 2. POST /api/tts/synthesize synthesizes TTS audio for a custom script on-demand WITHOUT LLM/rendering.
 * 3. Validation and schema checks for both new endpoints.
 *
 * Run: npx tsx scripts/verify-script-tts-decoupled.ts
 */
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TransformController } from '../src/controllers/transform.controller.js';
import { scriptDraftRequestSchema, ttsSynthesizeRequestSchema } from '../src/schemas/script.schema.js';
import { createLogger } from '../src/utils/logger.js';
import type { TranscriptDocument } from '../src/types/transcript.js';

let failed = false;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`PASS  ${msg}`);
  }
}

async function run() {
  const root = await mkdtemp(join(tmpdir(), 'verify-script-decoupled-'));
  const videoId = 'testVid01';
  const videoDir = join(root, videoId);
  await mkdir(join(videoDir, 'downloads'), { recursive: true });
  await mkdir(join(videoDir, 'transcripts'), { recursive: true });

  const dummyMp4 = join(videoDir, 'downloads', `${videoId}.mp4`);
  await writeFile(dummyMp4, 'dummy-mp4-data');

  const dummyTranscript: TranscriptDocument = {
    videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    language: 'id',
    duration: 60,
    text: 'Halo semua ini adalah video pengujian pembuatan draf naskah AI tanpa TTS.',
    segments: [
      { id: 0, start: 0, end: 5, text: 'Halo semua ini adalah video pengujian' },
      { id: 1, start: 5, end: 12, text: 'pembuatan draf naskah AI tanpa TTS' },
      { id: 2, start: 12, end: 20, text: 'agar hemat kuota dan bisa direview terlebih dahulu' },
      { id: 3, start: 20, end: 30, text: 'sebelum kita memutuskan untuk merender video final' },
    ],
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(videoDir, 'transcripts', `${videoId}.json`), JSON.stringify(dummyTranscript));

  let ttsCalled = false;
  let scriptServiceCalled = false;
  let angleServiceCalled = false;

  const mockDeps: any = {
    outputsDir: root,
    logger: createLogger('verify.script.decoupled'),
    youtubeService: {
      downloadVideo: async () => {
        throw new Error('Should not download in fast-path mode');
      },
    },
    transcriptService: {
      loadTranscript: async (id: string) => {
        if (id === videoId) return dummyTranscript;
        return null;
      },
      saveTranscript: async () => {},
    },
    whisperService: {},
    contentAngleService: {
      generateAngles: async () => {
        angleServiceCalled = true;
        return {
          candidateId: 'candidate_0',
          selectedAngleId: 'angle_01',
          angles: [
            {
              id: 'angle_01',
              title: 'Rahasia Hemat Kuota AI',
              angleType: 'curiosity',
              hook: 'Tahukah kamu cara hemat kuota TTS?',
              reason: 'Menarik perhatian kreator',
              score: 95,
            },
          ],
        };
      },
    },
    storyService: {
      buildStory: async () => ({
        concept: 'Proses pemisahan draf naskah dan TTS',
        protagonist: 'Content Creator',
        premise: 'Hemat biaya dengan review sebelum render',
        beats: [{ id: 'beat_1', role: 'hook', purpose: 'hook', start: 0, end: 10, evidence: [] }],
      }),
    },
    scriptService: {
      generateScript: async () => {
        scriptServiceCalled = true;
        return {
          candidateId: 'candidate_0',
          angleId: 'angle_01',
          angleTitle: 'Rahasia Hemat Kuota AI',
          language: 'id',
          estimatedDurationSeconds: 25,
          sections: [
            { type: 'hook', text: 'Tahukah kamu cara hemat kuota TTS?' },
            { type: 'context', text: 'Kita bisa menyusun naskah terlebih dahulu tanpa membuat audio.' },
            { type: 'conclusion', text: 'Hasilnya jauh lebih hemat dan terkontrol!' },
          ],
          originality: { status: 'PASS', notes: [] },
        };
      },
    },
    ttsService: {
      synthesizeScript: async () => {
        ttsCalled = true;
        return {
          outputPath: join(root, videoId, 'transform', 'job1', 'voice', 'narration.mp3'),
          durationSeconds: 25,
        };
      },
    },
    videoPlanService: {},
    templateService: {},
    templateRendererService: {},
    assService: {},
    subtitleService: {},
    assStyle: {} as any,
    compositionEngine: {} as any,
  };

  const controller = new TransformController(mockDeps);

  console.log('\n--- 1. Schema Validation Checks ---');
  const validDraftReq = scriptDraftRequestSchema.safeParse({
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    candidateId: 0,
    language: 'id',
  });
  assert(validDraftReq.success === true, 'scriptDraftRequestSchema accepts valid draft request');

  const invalidDraftReq = scriptDraftRequestSchema.safeParse({
    candidateId: 0,
  });
  assert(invalidDraftReq.success === false, 'scriptDraftRequestSchema rejects request without youtubeUrl or videoId');

  const validTtsReq = ttsSynthesizeRequestSchema.safeParse({
    videoId,
    ttsProvider: 'edge-tts',
    customScript: {
      language: 'id',
      sections: [{ type: 'hook', text: 'Halo dunia' }],
    },
  });
  assert(validTtsReq.success === true, 'ttsSynthesizeRequestSchema accepts valid TTS request');

  console.log('\n--- 2. draftScript() Execution (No TTS verification) ---');
  ttsCalled = false;
  scriptServiceCalled = false;
  angleServiceCalled = false;

  const draftResult = (await controller.draftScript({
    videoId,
    candidateId: 0,
    language: 'id',
  })) as any;

  assert(draftResult.success === true, 'draftScript returns success: true');
  assert(angleServiceCalled === true, 'contentAngleService was called');
  assert(scriptServiceCalled === true, 'scriptService was called');
  assert(ttsCalled === false, 'ttsService was NOT called during script drafting (0 TTS calls)');
  assert(draftResult.script?.sections?.length === 3, 'script sections generated correctly');
  assert(draftResult.narration === undefined, 'narration is undefined in draft result');
  assert(draftResult.videoPlan === undefined, 'videoPlan is undefined in draft result');

  console.log('\n--- 3. synthesizeTts() Execution (On-demand TTS verification) ---');
  ttsCalled = false;

  const ttsResult = (await controller.synthesizeTts({
    videoId,
    customScript: {
      language: 'id',
      sections: [
        { type: 'hook', text: 'Naskah yang sudah saya review dan edit.' },
        { type: 'conclusion', text: 'Audio siap dibuat on-demand!' },
      ],
    },
  })) as any;

  assert(ttsResult.success === true, 'synthesizeTts returns success: true');
  assert(ttsCalled === true, 'ttsService was called when explicitly requested');
  assert(ttsResult.narration?.outputPath !== undefined, 'narration outputPath returned');
  assert(ttsResult.narration?.durationSeconds === 25, 'narration duration returned');

  await rm(root, { recursive: true, force: true });

  if (failed) {
    console.error('\nSOME CHECKS FAILED');
    process.exit(1);
  } else {
    console.log('\nALL CHECKS PASSED');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
