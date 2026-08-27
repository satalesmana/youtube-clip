/**
 * Verification: transform berjalan penuh WALAU user tidak memilih rekomendasi
 * hook maupun klip viral (kedua step bertanda "opsional" di UI).
 *
 * 1. Mode Narasi tanpa sourceRange/customHook/selectedClips/candidateId —
 *    body persis seperti yang dikirim public/app.js saat tidak ada pilihan:
 *    pipeline 8 stage jalan, momen diambil deterministik dari awal transkrip
 *    (selectMoment, candidateId default 0), render dipanggil dengan footage
 *    sumber dari workspace, dan hasil sukses.
 * 2. Run ulang URL yang sama tetap sukses via fast-path (tanpa download baru).
 * 3. Mode Reel tanpa klip ditolak rapi: refine Zod di route + guard di
 *    transformReel (dua lapis), tanpa menyentuh downloader.
 * 4. Transkrip kosong tidak membuat crash — konteks kosong diteruskan ke
 *    stage script (diselamatkan fallback di dalam service).
 */
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { TransformController } from '../src/controllers/transform.controller.js';
import type { TransformStage } from '../src/controllers/transform.controller.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';
import type { DownloadResult } from '../src/types/media.js';
import type { JobWorkspace } from '../src/types/job.js';
import type { TranscriptDocument, TranscriptSegment } from '../src/types/transcript.js';

let failures = 0;
function check(label: string, ok: boolean, extra = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never;

/** Fake yt-dlp: mencatat setiap panggilan — boleh dipanggil maksimal sekali. */
const downloadCalls: Array<{ url: string; downloadsDir: string | null }> = [];
const youtubeService = {
  async downloadVideo(url: string, workspace?: Pick<JobWorkspace, 'downloads'>): Promise<DownloadResult> {
    const downloadsDir = workspace?.downloads ?? null;
    downloadCalls.push({ url, downloadsDir });
    const videoId = new URL(url).searchParams.get('v') ?? 'unknown';
    const videoPath = join(downloadsDir ?? '/shared-downloads', `${videoId}.mp4`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(videoPath, 'fake-video-bytes');
    return { videoId, videoPath, title: `Title ${videoId}`, durationSeconds: 120 };
  },
};

/** Transkrip 12 segmen @5s mulai detik 0 — cukup untuk uji selectMoment. */
function makeSegments(): TranscriptSegment[] {
  return Array.from({ length: 12 }, (_, i) => ({
    start: i * 5,
    end: i * 5 + 5,
    text: `Kalimat nomor ${i + 1} dari transkrip contoh`,
  }));
}
const transcriptDoc: TranscriptDocument = {
  language: 'id',
  durationSeconds: 60,
  segments: makeSegments(),
  videoId: 'noselect0001',
  sourceUrl: '',
  createdAt: new Date().toISOString(),
};

const transcriptService = {
  async loadTranscript() {
    return null; // paksa jalur workspace fallback seperti produksi
  },
  async extractAudio(videoPath: string) {
    return { audioPath: videoPath.replace(/\.mp4$/, '.wav'), durationSeconds: 60 };
  },
  async saveTranscript(doc: TranscriptDocument, workspace?: Pick<JobWorkspace, 'transcripts'>) {
    const { writeFile } = await import('node:fs/promises');
    const dir = workspace?.transcripts ?? '/shared-transcripts';
    const path = join(dir, `${doc.videoId}.json`);
    await writeFile(path, JSON.stringify(doc));
    return path;
  },
};

const whisperService = {
  async transcribe() {
    return { ...transcriptDoc };
  },
};

const storyService = {
  async buildStory() {
    return {
      concept: 'comeback',
      protagonist: 'p',
      premise: 'premise',
      beats: [],
    };
  },
};

/** Menangkap context yang diterima stage script untuk diverifikasi. */
let capturedScriptContext: Record<string, unknown> | null = null;
const scriptService = {
  async generateScript(context: Record<string, unknown>) {
    capturedScriptContext = context;
    return {
      candidateId: 'candidate_0',
      angleId: 'angle_01',
      angleTitle: 'Angle',
      language: 'id',
      sections: [
        { type: 'hook' as const, text: 'Hook pembuka.' },
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
      scenes: [
        { type: 'hook', start: 0, end: 5, narration: 'Hook pembuka.', visual: 'graphic' },
        { type: 'conclusion', start: 5, end: 10, narration: 'Penutup.', visual: 'graphic' },
      ],
      captions: [],
      audio: { narration: '', sourceUnderlay: true, ducking: true },
    };
  },
};

/** Engine komposisi palsu: sukses tanpa FFmpeg, catat panggilannya. */
let compositionCalls: Array<{ sourceVideo: string; style: string; badge?: string }> = [];
const compositionEngine = {
  async render(_plan: unknown, assets: { sourceVideo: string; style: string; hookBadge?: string }) {
    compositionCalls.push({ sourceVideo: assets.sourceVideo, style: assets.style, badge: assets.hookBadge });
    const jobId = 'fake-render-job';
    const path = join('/tmp', jobId, 'rendered.mp4');
    return { path, durationSeconds: 10, sizeBytes: 12345 };
  },
};

async function main(): Promise<void> {
  const outputsDir = await mkdtemp(join(tmpdir(), 'verify-no-selection-'));
  try {
    const emittedStages: Array<{ stage: TransformStage; skipped?: boolean }> = [];
    const controller = new TransformController({
      youtubeService,
      transcriptService,
      whisperService,
      contentAngleService: {
        async generateAngles() {
          return {
            candidateId: 'candidate_0',
            angles: [{ id: 'angle_01', title: 'Angle', angleType: 'commentary', hook: 'h', reason: 'r', score: 80 }],
            selectedAngleId: 'angle_01',
          };
        },
      },
      scriptService,
      ttsService,
      videoPlanService,
      storyService,
      templateService: {},
      templateRendererService: {},
      assService: {},
      subtitleService: {},
      outputsDir,
      logger,
      assStyle: {},
      compositionEngine,
      onStage: (stage: TransformStage, opts?: { skipped?: boolean }) => emittedStages.push({ stage, skipped: opts?.skipped }),
    } as never);

    const videoId = 'noselect01A'; // 11 char — persis format ID YouTube
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const expectedVideo = join(outputsDir, videoId, 'downloads', `${videoId}.mp4`);

    // ── 1. Narasi TANPA pilihan hook/klip — body persis seperti app.js ────
    // (dropdown engine/TTS kosong → provider & voice undefined, sehingga
    // ttsService dependency injection yang dipakai, bukan service dinamis.)
    const uiBodyWithoutSelection = {
      youtubeUrl: url,
      template: 'commentary',
      language: 'auto',
      sttProvider: undefined,
      ttsProvider: undefined,
      ttsVoice: undefined,
      hookBadge: undefined,
      channel: { name: undefined },
      dryRun: false,
      // tidak ada sourceRange / customHook / selectedClips / candidateId
    };
    const parsed = transformRequestSchema.safeParse(uiBodyWithoutSelection);
    check('skema Zod menerima body narasi tanpa pilihan apa pun', parsed.success);
    if (!parsed.success) throw new Error('schema harus menerima body tanpa pilihan');

    const result = await controller.transform(parsed.data);
    check('transform narasi sukses tanpa pilihan', result.success === true && result.dryRun === false);
    check('download tepat satu kali ke workspace per-video',
      downloadCalls.length === 1 && downloadCalls[0]?.downloadsDir === join(outputsDir, videoId, 'downloads'),
      `calls: ${downloadCalls.length}`);

    // Semua 8 stage ter-emisi (tidak ada yang terlewati diam-diam)
    check('8 stage lengkap ter-emisi',
      JSON.stringify(emittedStages.map((s) => s.stage)) ===
      JSON.stringify(['download', 'transcript', 'angle', 'story', 'script', 'tts', 'plan', 'render']),
      emittedStages.map((s) => s.stage).join(','));

    // Momen default = selectMoment(candidateId 0): window 35s dari segmen pertama
    const ctx = capturedScriptContext as {
      momentSegments: TranscriptSegment[];
      contextSegments: TranscriptSegment[];
      fixedHook?: string;
      candidateTitle: string;
    } | null;
    check('momen otomatis dari awal transkrip (7 segmen, 0–35s)',
      ctx?.momentSegments.length === 7 &&
      ctx.momentSegments[0]?.start === 0 &&
      ctx.momentSegments.at(-1)?.end === 35,
      `moment: ${ctx?.momentSegments.length ?? 0} segmen`);
    check('segmen konteks mengikuti window (2 segmen)', ctx?.contextSegments.length === 2);
    check('tanpa customHook (headline dari LLM)', ctx?.fixedHook === undefined);

    // Render memakai footage sumber dari workspace
    check('composition engine menerima footage sumber workspace',
      compositionCalls[0]?.sourceVideo === expectedVideo,
      compositionCalls[0]?.sourceVideo ?? '-');
    check('hasil render terisi', (result as { outputVideo?: { sizeBytes?: number } }).outputVideo?.sizeBytes === 12345);

    // ── 2. Run ulang URL sama tanpa pilihan — fast-path, tanpa download ──
    emittedStages.length = 0;
    const rerun = await controller.transform(transformRequestSchema.parse(uiBodyWithoutSelection));
    check('run ulang tanpa pilihan tetap sukses', rerun.success === true);
    check('run ulang TANPA download baru (fast-path)', downloadCalls.length === 1, `calls: ${downloadCalls.length}`);
    check('run ulang menandai download+transcript skipped',
      emittedStages[0]?.stage === 'download' && emittedStages[0]?.skipped === true &&
      emittedStages[1]?.stage === 'transcript' && emittedStages[1]?.skipped === true);

    // ── 3. Mode Reel tanpa klip — dua lapis penolakan ─────────────────────
    const reelBodyNoClips = { youtubeUrl: url, outputMode: 'reel' as const, dryRun: false };
    check('refine Zod menolak reel tanpa selectedClips',
      !transformRequestSchema.safeParse(reelBodyNoClips).success);
    const reelBodyWithClip = { ...reelBodyNoClips, selectedClips: [{ start: 10, end: 30 }] };
    check('refine Zod menerima reel dengan 1 klip',
      transformRequestSchema.safeParse(reelBodyWithClip).success);
    let reelError: string | '';
    try {
      await controller.transform(reelBodyNoClips as never); // lewati Zod → guard controller
      reelError = '';
    } catch (err) {
      reelError = err instanceof Error ? err.message : String(err);
    }
    check('guard transformReel menolak reel tanpa klip',
      reelError.includes('requires at least one selected clip'), reelError || '(tidak melempar)');
    check('penolakan reel tidak memicu download', downloadCalls.length === 1, `calls: ${downloadCalls.length}`);

    // ── 4. Transkrip kosong tidak membuat crash ───────────────────────────
    const emptyDoc: TranscriptDocument = { ...transcriptDoc, segments: [] };
    const emptyWhisper = { async transcribe() { return { ...emptyDoc }; } };
    const emptyController = new TransformController({
      youtubeService,
      transcriptService,
      whisperService: emptyWhisper,
      contentAngleService: {
        async generateAngles() {
          // Produksi selalu menghasilkan ≥1 angle (ada fallbackAngle di
          // controller) — stub meniru itu, bukan mengembalikan array kosong.
          return {
            candidateId: 'candidate_0',
            angles: [{ id: 'angle_01', title: 'Angle', angleType: 'commentary', hook: 'h', reason: 'r', score: 80 }],
            selectedAngleId: 'angle_01',
          };
        },
      },
      scriptService,
      ttsService,
      videoPlanService,
      storyService,
      templateService: {},
      templateRendererService: {},
      assService: {},
      subtitleService: {},
      outputsDir,
      logger,
      assStyle: {},
      compositionEngine,
    } as never);
    let emptyError: string | '';
    try {
      await emptyController.transform({
        youtubeUrl: 'https://www.youtube.com/watch?v=noselect0002',
        template: 'commentary',
        dryRun: true,
      } as never);
      emptyError = '';
    } catch (err) {
      emptyError = err instanceof Error ? err.message : String(err);
    }
    check('transkrip kosong: pipeline tetap selesai (dry-run)', emptyError === '', emptyError || 'ok');

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
