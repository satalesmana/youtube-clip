/**
 * Verification for the highlight-quality improvements (2026-08):
 * generic transcript-only prompts + duration sync, peak-aware clamping,
 * per-chunk score normalization, two-pass rerank flow, and the
 * selection-feedback loop.
 *
 * Run: npx tsx scripts/verify-highlight-quality.ts
 *
 * Pure logic checks with stubbed collaborators — no LLM, no FFmpeg:
 *  1. Prompt builder: generic (no topic-specific text), duration bounds and
 *     language injected from config.
 *  2. HighlightService.mergeAndRank: unit-scale repair (0.0-1.0 → 0-100),
 *     per-chunk min-max normalization, peak-aware clamp vs legacy head cut.
 *  3. HighlightService.cutToTopN.
 *  4. HighlightAnalysisService.analyzeChunk / rerankCandidates against a fake provider
 *     (schema validation incl. optional `peak`, JSON-only instruction).
 *  5. ClipController two-pass wiring with a stubbed highlightAnalysisService +
 *     previewRenderer: rerank survivors/drops/failure-fallback, excerpt
 *     extraction, feedback file written on recordSelection.
 */
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HighlightService } from '../src/services/highlight.service.js';
import { HighlightAnalysisService } from '../src/services/highlight-analysis.service.js';
import { ClipController } from '../src/controllers/clip.controller.js';
import { buildViralHighlightSystemPrompt, buildRerankSystemPrompt } from '../src/prompts/viral-highlight.prompt.js';
import type { Logger } from '../src/utils/logger.js';
import type { IAiProvider } from '../src/providers/ai.provider.js';
import type { TranscriptChunk, TranscriptDocument } from '../src/types/transcript.js';
import type { HighlightClip } from '../src/types/highlight.js';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Logger;

function makeChunk(index: number, startSec: number): TranscriptChunk {
  return {
    index,
    startTime: startSec,
    endTime: startSec + 60,
    text: 'seg',
    approxTokens: 10,
    segments: [
      { start: startSec, end: startSec + 5, text: 'first segment' },
      { start: startSec + 5, end: startSec + 10, text: 'second segment' },
    ],
  };
}

async function main(): Promise<void> {
  /* ── 1. Prompt builder ──────────────────────────────────────────────── */
  console.log('\n[1] Generic prompt with config-driven bounds');
  const prompt = buildViralHighlightSystemPrompt({ minSeconds: 20, maxSeconds: 60 });
  check('contains injected min bound', prompt.includes('between 20 and 60 seconds'));
  check('no football-specific wording', !/\bgoal\b|football/i.test(prompt));
  check('no motogp-specific wording', !/motogp|moto3|rider/i.test(prompt));
  check('transcript-only honesty stated', /TRANSCRIPT ONLY/i.test(prompt));
  check('asks for peak timestamp', /"peak"/.test(prompt));
  const promptId = buildViralHighlightSystemPrompt({ minSeconds: 15, maxSeconds: 45, language: 'id' });
  check('language instruction injected', promptId.includes('in this language: id'));
  const promptAuto = buildViralHighlightSystemPrompt({ minSeconds: 20, maxSeconds: 60, language: 'auto' });
  check('auto language adds no instruction', !promptAuto.includes('in this language'));
  check('rerank prompt is generic too', !/motogp|football/i.test(buildRerankSystemPrompt()));

  /* ── 2. HighlightService merge/rank/clamp ───────────────────────────── */
  console.log('\n[2] HighlightService normalization + peak-aware clamp');
  const highlight = new HighlightService(
    { minClipSeconds: 20, maxClipSeconds: 60, topN: 10 },
    silentLogger,
  );

  // Unit-scale repair: a 0.95 "legendary" must beat a mediocre 55.
  const unitGroups: HighlightClip[][] = [
    [{ start: 0, end: 40, score: 0.95, title: 'legendary', reason: 'r', hook: 'h' }],
    [{ start: 100, end: 140, score: 55, title: 'mediocre', reason: 'r', hook: 'h' }],
  ];
  const unitRanked = highlight.mergeAndRank(unitGroups);
  check(
    'unit-scale 0.95 outranks raw 55',
    unitRanked[0]?.title === 'legendary',
    `got ${unitRanked[0]?.title}`,
  );

  // Tendency repair: chunk A rates everything 80+, chunk B caps at 60 — after
  // normalization both spreads span the full scale.
  const tendencyGroups: HighlightClip[][] = [
    [
      { start: 0, end: 30, score: 95, title: 'a-best', reason: 'r', hook: 'h' },
      { start: 30, end: 60, score: 80, title: 'a-worst', reason: 'r', hook: 'h' },
      { start: 60, end: 90, score: 87, title: 'a-mid', reason: 'r', hook: 'h' },
    ],
    [
      { start: 200, end: 230, score: 60, title: 'b-best', reason: 'r', hook: 'h' },
      { start: 230, end: 260, score: 20, title: 'b-worst', reason: 'r', hook: 'h' },
      { start: 260, end: 290, score: 40, title: 'b-mid', reason: 'r', hook: 'h' },
    ],
  ];
  const tendencyRanked = highlight.mergeAndRank(tendencyGroups);
  check(
    'tendency-normalized b-best joins the leaders',
    tendencyRanked.slice(0, 2).some((c) => c.title === 'b-best'),
    `top2=${tendencyRanked.slice(0, 2).map((c) => c.title).join(',')}`,
  );

  // Peak-aware clamp: payoff at the tail survives; no peak keeps legacy head cut.
  const longTail: HighlightClip = { start: 0, end: 120, score: 90, title: 'tail-payoff', reason: 'r', hook: 'h', peak: 110 };
  const clampedPeak = highlight.mergeAndRank([[longTail]])[0]!;
  check('peak near tail keeps the payoff window', Math.abs(clampedPeak.end - 120) < 1e-9 && Math.abs(clampedPeak.start - 60) < 1e-9, `${clampedPeak.start}-${clampedPeak.end}`);
  const longHead: HighlightClip = { start: 0, end: 120, score: 90, title: 'head-cut', reason: 'r', hook: 'h' };
  const clampedHead = highlight.mergeAndRank([[longHead]])[0]!;
  check('no peak keeps legacy head cut', clampedHead.start === 0 && Math.abs(clampedHead.end - 60) < 1e-9, `${clampedHead.start}-${clampedHead.end}`);
  const midPeak: HighlightClip = { start: 10, end: 130, score: 90, title: 'mid-peak', reason: 'r', hook: 'h', peak: 70 };
  const clampedMid = highlight.mergeAndRank([[midPeak]])[0]!;
  check('mid peak centers the window on it', Math.abs(clampedMid.start - 40) < 1e-9 && Math.abs(clampedMid.end - 100) < 1e-9, `${clampedMid.start}-${clampedMid.end}`);

  /* ── 3. cutToTopN ───────────────────────────────────────────────────── */
  console.log('\n[3] cutToTopN respects configured top-N');
  const many: HighlightClip[] = Array.from({ length: 15 }, (_, i) => ({
    start: i * 100,
    end: i * 100 + 30,
    score: 50 + i,
    title: `c${i}`,
    reason: 'r',
    hook: 'h',
  }));
  const topTen = highlight.cutToTopN(many);
  check('cuts to topN=10', topTen.length === 10);
  check('keeps highest scores', topTen.every((c) => Number(c.title.slice(1)) >= 5));

  /* ── 4. HighlightAnalysisService against a fake provider ───────────── */
  console.log('\n[4] HighlightAnalysisService analyzeChunk + rerankCandidates');
  let lastSystem = '';
  const fakeProvider: IAiProvider = {
    chat: async (params: { system?: string }) => {
      lastSystem = params.system ?? '';
      return '{"clips": [{"start": 10, "end": 45, "score": 88, "title": "t", "reason": "r", "hook": "h", "peak": 33}, {"start": 50, "end": 80, "score": 0.7, "title": "u", "reason": "q", "hook": "g"}]}';
    },
  } as unknown as IAiProvider;
  const analysisService = new HighlightAnalysisService(
    fakeProvider,
    { model: 'm', temperature: 0.2, timeoutMs: 1000, maxRetries: 1, minClipSeconds: 20, maxClipSeconds: 60 },
    silentLogger,
  );
  const clips = await analysisService.analyzeChunk(makeChunk(0, 0));
  check('accepts optional peak field', clips.length === 2 && clips[0]?.peak === 33);
  check('accepts missing peak field', clips[1]?.peak === undefined);
  check('duration bounds appear in system prompt', lastSystem.includes('between 20 and 60 seconds'));
  check('json-only instruction present', /Return ONLY valid JSON/.test(lastSystem));

  let rerankUser = '';
  const rerankProvider: IAiProvider = {
    chat: async (params: { system?: string; prompt: string }) => {
      rerankUser = params.prompt;
      return '{"clips": [{"id": "cand_01", "score": 92}, {"id": "cand_02", "score": 41, "title": "sharper"}]}';
    },
  } as unknown as IAiProvider;
  const rerankAnalysis = new HighlightAnalysisService(
    rerankProvider,
    { model: 'm', temperature: 0.2, timeoutMs: 1000, maxRetries: 1, minClipSeconds: 20, maxClipSeconds: 60 },
    silentLogger,
  );
  const verdicts = await rerankAnalysis.rerankCandidates({
    videoTitle: 'v',
    candidates: [
      { id: 'cand_01', start: 0, end: 30, title: 'a', reason: 'r', hook: 'h' },
      { id: 'cand_02', start: 100, end: 130, title: 'b', reason: 'r', hook: 'h' },
    ],
    excerptById: { cand_01: '[0 -> 5] alpha', cand_02: '[100 -> 105] beta' },
    language: 'id',
  });
  check('rerank returns calibrated verdicts', verdicts.length === 2 && verdicts[0]?.score === 92);
  check('excerpts embedded in user prompt', rerankUser.includes('[0 -> 5] alpha'));

  /* ── 5. ClipController two-pass wiring + feedback loop ──────────────── */
  console.log('\n[5] ClipController two-pass flow + selection feedback');
  const root = await mkdtemp(join(tmpdir(), 'highlight-quality-'));
  try {
    const VIDEO_ID = 'dQw4w9WgXcQ';
    // Pre-create the per-video workspace video so recommend() takes the
    // fast path (no yt-dlp download) exactly like a real second-stage run.
    await mkdir(join(root, VIDEO_ID, 'downloads'), { recursive: true });
    await writeFile(join(root, VIDEO_ID, 'downloads', `${VIDEO_ID}.mp4`), 'stub');
    const transcript: TranscriptDocument = {
      videoId: VIDEO_ID,
      sourceUrl: `https://youtu.be/${VIDEO_ID}`,
      createdAt: new Date().toISOString(),
      language: 'en',
      durationSeconds: 300,
      segments: [
        { start: 0, end: 30, text: 'alpha moment content here' },
        { start: 100, end: 130, text: 'beta moment content here' },
        { start: 200, end: 230, text: 'gamma moment content here' },
      ],
    };

    const poolClips: HighlightClip[] = [
      { start: 0, end: 30, score: 91, title: 'alpha', reason: 'r', hook: 'h' },
      { start: 100, end: 130, score: 84, title: 'beta', reason: 'r', hook: 'h' },
      { start: 200, end: 230, score: 77, title: 'gamma', reason: 'r', hook: 'h' },
    ];
    let rerankCalled = false;
    const controller = new ClipController({
      youtubeService: {} as never,
      transcriptService: {
        loadTranscript: async () => transcript,
        chunkTranscript: () => [makeChunk(0, 0)],
        extractAudio: async () => ({ audioPath: '', jobDir: '' }),
        saveTranscript: async () => '',
      } as never,
      whisperService: {} as never,
      highlightAnalysisService: {
        analyzeChunk: async () => poolClips,
        rerankCandidates: async (params: { candidates: Array<{ id: string }> }) => {
          rerankCalled = true;
          check('rerank receives full pool', params.candidates.length === 3);
          return [
            { id: 'cand_01', score: 93 },
            { id: 'cand_03', score: 88 }, // beta (cand_02) dropped by global pass
          ];
        },
      } as never,
      highlightService: new HighlightService({ minClipSeconds: 20, maxClipSeconds: 60, topN: 10 }, silentLogger),
      previewRenderer: {
        renderPreview: async () => ({ path: join(root, 'preview.mp4') }),
      } as never,
      outputsDir: root,
      logger: silentLogger,
    });

    const result = await controller.recommend({ youtubeUrl: `https://youtu.be/${VIDEO_ID}`, refresh: true });
    check('rerank pass was invoked', rerankCalled);
    check('dropped candidate removed from output', result.clips.length === 2, `len=${result.clips.length}`);
    check('survivor metadata kept', result.clips.some((c) => c.title === 'alpha'));
    check('ranks reassigned after drop', result.clips.map((c) => c.rank).join(',') === '1,2');

    // Feedback loop: recordSelection writes an append log.
    await controller.recordSelection(VIDEO_ID, [{ start: 0, end: 30, title: 'clip_01' }]);
    const first = JSON.parse(await readFile(join(root, VIDEO_ID, 'feedback', 'selected-clips.json'), 'utf-8')) as Array<{ selectedAt?: string }>;
    check('feedback file created with one entry', Array.isArray(first) && first.length === 1 && Boolean(first[0]?.selectedAt));
    await controller.recordSelection(VIDEO_ID, [{ start: 100, end: 130 }]);
    const second = JSON.parse(await readFile(join(root, VIDEO_ID, 'feedback', 'selected-clips.json'), 'utf-8')) as unknown[];
    check('second selection appends', second.length === 2);

    // Rerank failure fallback: pass-1 ranking survives.
    const failingController = new ClipController({
      youtubeService: {} as never,
      transcriptService: {
        loadTranscript: async () => transcript,
        chunkTranscript: () => [makeChunk(0, 0)],
        extractAudio: async () => ({ audioPath: '', jobDir: '' }),
        saveTranscript: async () => '',
      } as never,
      whisperService: {} as never,
      highlightAnalysisService: {
        analyzeChunk: async () => poolClips,
        rerankCandidates: async () => {
          throw new Error('rerank down');
        },
      } as never,
      highlightService: new HighlightService({ minClipSeconds: 20, maxClipSeconds: 60, topN: 10 }, silentLogger),
      previewRenderer: { renderPreview: async () => ({ path: join(root, 'p.mp4') }) } as never,
      outputsDir: root,
      logger: silentLogger,
    });
    const fallbackResult = await failingController.recommend({ videoId: 'vid', refresh: true });
    check('failed rerank falls back to first-pass ranking', fallbackResult.clips.length === 3);

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
