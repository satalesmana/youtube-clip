/**
 * Verification script for TTS Reuse and Caching in TransformController.
 *
 * Tests:
 * 1. synthesizeTts caches output in ContentCache.
 * 2. Second call to synthesizeTts serves from ContentCache without calling ttsService.
 * 3. transform() with valid existingNarration reuses file, emits skipped TTS, and does not invoke ttsService.
 * 4. transform() without existingNarration but matching script reuses contentCache and skips TTS.
 * 5. transform() with changed script triggers fresh TTS synthesis.
 *
 * Run: npx tsx scripts/verify-tts-reuse.ts
 */
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TransformController } from '../src/controllers/transform.controller.js';
import { ContentCache } from '../src/services/content-cache.service.js';
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
  const root = await mkdtemp(join(tmpdir(), 'verify-tts-reuse-'));
  const videoId = 'testVidTtsReuse';
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
    text: 'Halo semua ini pengujian reuse narasi TTS.',
    segments: [
      { id: 0, start: 0, end: 5, text: 'Halo semua ini pengujian reuse narasi TTS' },
      { id: 1, start: 5, end: 12, text: 'agar tidak disintesis dua kali' },
    ],
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(videoDir, 'transcripts', `${videoId}.json`), JSON.stringify(dummyTranscript));

  const contentCache = new ContentCache({ dir: join(root, 'cache') });

  let ttsSynthesizeCallCount = 0;
  const dummyNarrationFile = join(root, 'dummy-narration.mp3');
  await writeFile(dummyNarrationFile, 'fake-mp3-audio-data');

  const stagesEmitted: Array<{ stage: string; skipped?: boolean }> = [];

  const mockDeps: any = {
    outputsDir: root,
    logger: createLogger('verify.tts.reuse'),
    contentCache,
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
      generateAngles: async () => ({
        candidateId: 'candidate_0',
        selectedAngleId: 'angle_01',
        angles: [{ id: 'angle_01', title: 'Test Angle', hook: 'Test Hook', angleType: 'curiosity', score: 90 }],
      }),
    },
    storyService: {
      buildStory: async () => ({
        concept: 'Concept',
        protagonist: 'User',
        premise: 'Premise',
        beats: [{ id: 'beat_1', role: 'hook', purpose: 'hook', start: 0, end: 5, evidence: [] }],
      }),
    },
    scriptService: {
      generateScript: async () => ({
        candidateId: 'candidate_0',
        angleId: 'angle_01',
        angleTitle: 'Test Angle',
        language: 'id',
        estimatedDurationSeconds: 15,
        sections: [
          { type: 'hook', text: 'Hook teks awal' },
          { type: 'conclusion', text: 'Penutup naskah' },
        ],
        originality: { status: 'PASS', notes: [] },
      }),
    },
    ttsService: {
      synthesizeScript: async (_script: any, _workspaceDir: string) => {
        ttsSynthesizeCallCount += 1;
        return {
          outputPath: dummyNarrationFile,
          durationSeconds: 12.5,
          sections: [
            { type: 'hook', durationSeconds: 6, wordTimings: [{ word: 'Hook', start: 0, end: 1 }] },
            { type: 'conclusion', durationSeconds: 6.5, wordTimings: [{ word: 'Penutup', start: 6, end: 7 }] },
          ],
        };
      },
    },
    videoPlanService: {
      buildPlan: async (input: any) => ({
        version: '1.0',
        targetDurationSeconds: input.narrationDurationSeconds || 15,
        audio: { narration: input.narrationPath },
        scenes: [],
      }),
    },
    templateService: {},
    templateRendererService: {},
    assService: {},
    subtitleService: {},
    assStyle: {} as any,
    compositionEngine: {} as any,
    onStage: (stage: string, opts?: { skipped?: boolean }) => {
      stagesEmitted.push({ stage, skipped: opts?.skipped });
    },
  };

  const controller = new TransformController(mockDeps);

  console.log('\n--- 1. synthesizeTts() populates contentCache ---');
  ttsSynthesizeCallCount = 0;
  const customScript1 = {
    language: 'id',
    sections: [
      { type: 'hook' as const, text: 'Halo selamat datang di channel ini.' },
      { type: 'conclusion' as const, text: 'Terima kasih telah menonton!' },
    ],
  };

  const tts1 = await controller.synthesizeTts({
    videoId,
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
    customScript: customScript1,
  });

  assert(tts1.success === true, 'synthesizeTts succeeds');
  assert(ttsSynthesizeCallCount === 1, 'ttsService.synthesizeScript called once on initial synthesis');

  console.log('\n--- 2. synthesizeTts() second call hits contentCache ---');
  const tts2 = await controller.synthesizeTts({
    videoId,
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
    customScript: customScript1,
  });

  assert(tts2.success === true, 'second synthesizeTts succeeds');
  assert(ttsSynthesizeCallCount === 1, 'ttsService.synthesizeScript NOT called again (served from cache)');

  console.log('\n--- 3. transform() with existingNarration skips TTS ---');
  stagesEmitted.length = 0;
  ttsSynthesizeCallCount = 0;

  const transformWithExisting = await controller.transform({
    videoId,
    candidateId: 0,
    language: 'id',
    dryRun: true,
    customScript: customScript1,
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
    existingNarration: {
      outputPath: dummyNarrationFile,
      durationSeconds: 12.5,
      sections: (tts1.narration as any).sections,
    },
  });

  assert(transformWithExisting.success === true, 'transform with existingNarration succeeds');
  assert(ttsSynthesizeCallCount === 0, 'ttsService.synthesizeScript was NOT called (0 calls)');
  const ttsStageEvent1 = stagesEmitted.find((s) => s.stage === 'tts');
  assert(ttsStageEvent1 !== undefined && ttsStageEvent1.skipped === true, 'TTS stage was emitted with skipped: true');
  assert(
    (transformWithExisting.videoPlan as any)?.audio?.narration === dummyNarrationFile,
    'videoPlan points to existingNarration outputPath',
  );

  console.log('\n--- 4. transform() without existingNarration hits contentCache ---');
  stagesEmitted.length = 0;
  ttsSynthesizeCallCount = 0;

  const transformWithCache = await controller.transform({
    videoId,
    candidateId: 0,
    language: 'id',
    dryRun: true,
    customScript: customScript1,
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
  });

  assert(transformWithCache.success === true, 'transform with cache succeeds');
  assert(ttsSynthesizeCallCount === 0, 'ttsService.synthesizeScript was NOT called (served from contentCache)');
  const ttsStageEvent2 = stagesEmitted.find((s) => s.stage === 'tts');
  assert(ttsStageEvent2 !== undefined && ttsStageEvent2.skipped === true, 'TTS stage was emitted with skipped: true via contentCache');

  console.log('\n--- 5. transform() with modified script synthesizes new TTS ---');
  stagesEmitted.length = 0;
  ttsSynthesizeCallCount = 0;

  const customScriptModified = {
    language: 'id',
    sections: [
      { type: 'hook' as const, text: 'Teks naskah yang baru saja diubah!' },
      { type: 'conclusion' as const, text: 'Penutup yang berbeda sama sekali.' },
    ],
  };

  const transformWithModified = await controller.transform({
    videoId,
    candidateId: 0,
    language: 'id',
    dryRun: true,
    customScript: customScriptModified,
    ttsProvider: 'edge-tts',
    ttsVoice: 'id-ID-ArdiNeural',
  });

  assert(transformWithModified.success === true, 'transform with modified script succeeds');
  assert(ttsSynthesizeCallCount === 1, 'ttsService.synthesizeScript WAS called for modified script');
  const ttsStageEvent3 = stagesEmitted.find((s) => s.stage === 'tts');
  assert(ttsStageEvent3 !== undefined && !ttsStageEvent3.skipped, 'TTS stage was emitted as active (not skipped)');

  await rm(root, { recursive: true, force: true });

  if (failed) {
    console.error('\nSOME VERIFICATION CHECKS FAILED');
    process.exit(1);
  } else {
    console.log('\nALL VERIFICATION CHECKS PASSED!');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
