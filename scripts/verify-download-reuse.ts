/**
 * Verification for the "no re-download after hook generation" fix.
 *
 * 1. HookController.generate downloads into the per-video workspace
 *    `outputs/{videoId}/downloads/{videoId}.mp4` (NOT the shared downloads dir).
 * 2. TransformController.transform then finds that file via its fast path and
 *    does NOT download again.
 * 3. Transform without a selected hook still downloads exactly once into the
 *    same workspace location (existing behaviour, now workspace-consistent),
 *    and a re-transform of the same video reuses it.
 */
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { HookController } from '../src/controllers/hook.controller.js';
import { TransformController } from '../src/controllers/transform.controller.js';
import type { DownloadResult } from '../src/types/media.js';
import type { JobWorkspace } from '../src/types/job.js';
import type { TranscriptDocument, TranscriptSegment } from '../src/types/transcript.js';

let failures = 0;
function check(label: string, ok: boolean, extra = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never;

/** Fake yt-dlp: records every download + the workspace it was given, writes a dummy file. */
const downloadCalls: Array<{ url: string; downloadsDir: string | null }> = [];
const youtubeService = {
  async downloadVideo(url: string, workspace?: Pick<JobWorkspace, 'downloads'>): Promise<DownloadResult> {
    const downloadsDir = workspace?.downloads ?? null;
    downloadCalls.push({ url, downloadsDir });
    const videoId = new URL(url).searchParams.get('v') ?? 'unknown';
    const videoPath = join(downloadsDir ?? '/shared-downloads', `${videoId}.mp4`);
    await writeFile(videoPath, 'fake-video-bytes');
    return { videoId, videoPath, title: `Title ${videoId}`, durationSeconds: 60 };
  },
};

/** Fake transcript service: loadTranscript always null (exercises the workspace fallback). */
function makeTranscriptService(saved: Map<string, TranscriptDocument>) {
  return {
    async loadTranscript() {
      return null;
    },
    async extractAudio(videoPath: string) {
      return { audioPath: videoPath.replace(/\.mp4$/, '.wav'), durationSeconds: 60 };
    },
    async saveTranscript(doc: TranscriptDocument, workspace?: Pick<JobWorkspace, 'transcripts'>) {
      const dir = workspace?.transcripts ?? '/shared-transcripts';
      const path = join(dir, `${doc.videoId}.json`);
      await writeFile(path, JSON.stringify(doc));
      saved.set(doc.videoId, doc);
      return path;
    },
    chunkTranscript() {
      return [];
    },
  };
}

const whisperService = {
  async transcribe(audioPath: string) {
    // audioPath: outputs/{videoId}/temp/{videoId}.wav — derive the video id.
    const videoId = audioPath.split('/').at(-2) ?? 'unknown';
    return {
      language: 'id',
      durationSeconds: 60,
      segments: segmentsFor(videoId),
    };
  },
};

const angleService = {
  async generateAngles() {
    return {
      candidateId: 'candidate_0',
      angles: [{ id: 'angle_01', title: 'Angle', angleType: 'commentary', hook: 'h', reason: 'r', score: 80 }],
      selectedAngleId: 'angle_01',
    };
  },
};

const storyService = {
  async buildStory() {
    return {
      concept: 'comeback',
      protagonist: 'p',
      premise: 'premise',
      hookMoment: { start: 10, end: 12, suggestedLine: 'STORY LINE' },
      beats: [],
    };
  },
};

const hookService = {
  async recommend(input: { videoId: string }) {
    return {
      videoId: input.videoId,
      hooks: [
        {
          id: 'hook_1',
          rank: 1,
          rankScore: 90,
          angle: { id: 'angle_01', type: 'commentary', title: 'Angle', description: 'd' },
          style: 'curiosity' as const,
          source: { start: 10, end: 16, transcript: 'seg' },
          headline: { text: 'HEADLINE', style: 'kinetic' },
          spokenHook: { text: 'HOOK PILIHAN USER', duration: 3 },
        },
      ],
      candidateCount: 1,
      rejectedCount: 0,
      duplicateCount: 0,
      generatedAt: new Date().toISOString(),
    };
  },
};

const scriptService = {
  async generateScript(context: { angleId: string; angleTitle: string; language?: string }) {
    return {
      candidateId: 'candidate_0',
      angleId: context.angleId,
      angleTitle: context.angleTitle,
      language: 'id',
      sections: [
        { type: 'hook' as const, text: 'HOOK PILIHAN USER' },
        { type: 'conclusion' as const, text: 'Penutup.' },
      ],
      originality: { status: 'PASS' as const, notes: [] },
      estimatedDurationSeconds: 10,
    };
  },
};

const ttsService = {
  async synthesizeScript() {
    return { outputPath: '', durationSeconds: 10 };
  },
};

const videoPlanService = {
  async buildPlan(input: { script: { candidateId: string; angleId: string; estimatedDurationSeconds: number } }) {
    return {
      candidateId: input.script.candidateId,
      angleId: input.script.angleId,
      duration: input.script.estimatedDurationSeconds,
      scenes: [],
      captions: [],
      audio: { narration: '', sourceUnderlay: true, ducking: true },
    };
  },
};

function segmentsFor(videoId: string): TranscriptSegment[] {
  return [{ start: 10, end: 16, text: `Dialog untuk ${videoId} yang cukup panjang` }];
}

async function main(): Promise<void> {
  const outputsDir = await mkdtemp(join(tmpdir(), 'verify-download-reuse-'));
  try {
    const saved = new Map<string, TranscriptDocument>();
    const transcriptService = makeTranscriptService(saved);

    const hookController = new HookController({
      youtubeService,
      transcriptService,
      whisperService,
      contentAngleService: angleService,
      storyService,
      hookService,
      outputsDir,
      logger,
    } as never);

    const transformController = new TransformController({
      youtubeService,
      transcriptService,
      whisperService,
      contentAngleService: angleService,
      scriptService,
      ttsService,
      videoPlanService,
      storyService,
      outputsDir,
      logger,
    } as never);

    const videoId = 'dlreuse0001';
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const expectedVideo = join(outputsDir, videoId, 'downloads', `${videoId}.mp4`);
    const expectedTranscript = join(outputsDir, videoId, 'transcripts', `${videoId}.json`);

    // ── 1. Generate hooks (downloads the video once) ──────────────────────
    await hookController.generate({ youtubeUrl: url, candidateId: 0 });
    check('hook generate: exactly one download', downloadCalls.length === 1, `calls: ${downloadCalls.length}`);
    check('hook generate: download lands in per-video workspace',
      downloadCalls[0]?.downloadsDir === join(outputsDir, videoId, 'downloads'),
      `dir: ${downloadCalls[0]?.downloadsDir}`);
    await access(expectedVideo);
    check('hook generate: video file at fast-path location', true);
    await access(expectedTranscript);
    check('hook generate: transcript saved to fast-path location', true);

    // ── 2. Transform with the selected hook — must NOT download again ─────
    const result = await transformController.transform({
      youtubeUrl: url,
      candidateId: 0,
      dryRun: true,
      customHook: 'HOOK PILIHAN USER',
      sourceRange: { start: 10, end: 16 },
    } as never);
    check('transform (hook selected): NO re-download', downloadCalls.length === 1, `calls: ${downloadCalls.length}`);
    check('transform (hook selected): pipeline completed via fast path',
      result.success === true && result.dryRun === true);

    // ── 3. Transform WITHOUT hook selection (existing behaviour) ──────────
    const videoId2 = 'dlreuse0002';
    const url2 = `https://www.youtube.com/watch?v=${videoId2}`;
    await transformController.transform({
      youtubeUrl: url2,
      candidateId: 0,
      dryRun: true,
    } as never);
    check('transform (no hook): downloads exactly once', downloadCalls.length === 2, `calls: ${downloadCalls.length}`);
    check('transform (no hook): also lands in per-video workspace',
      downloadCalls[1]?.downloadsDir === join(outputsDir, videoId2, 'downloads'),
      `dir: ${downloadCalls[1]?.downloadsDir}`);

    // ── 4. Re-transform of video 2 — fast path again ──────────────────────
    await transformController.transform({ youtubeUrl: url2, candidateId: 0, dryRun: true } as never);
    check('re-transform (no hook): still NO re-download', downloadCalls.length === 2, `calls: ${downloadCalls.length}`);

    // ── 5. Transcript fallback readable by transform fast path ────────────
    const raw = JSON.parse(await readFile(expectedTranscript, 'utf-8')) as TranscriptDocument;
    check('saved transcript document is well-formed',
      raw.videoId === videoId && Array.isArray(raw.segments) && raw.segments.length > 0);

    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
  } finally {
    await rm(outputsDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
