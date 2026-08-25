/**
 * Verification for the "selected hook must be used" fix.
 *
 * 1. buildScriptUserPrompt emits the MANDATORY HOOK block only when fixedHook is set.
 * 2. ScriptService.enforceFixedHook replaces the LLM hook with the user's hook
 *    (and keeps the LLM hook untouched when no hook was selected).
 * 3. VideoPlanService.buildPlan puts the selected hook on the hook scene
 *    (quotableLine) and ignores story.hookMoment; without a selection the
 *    existing story-driven behaviour is unchanged.
 */
import { buildScriptUserPrompt } from '../src/content/content.prompt.js';
import { ScriptService } from '../src/content/script.service.js';
import { VideoPlanService } from '../src/content/video-plan.service.js';
import type { ScriptContext } from '../src/content/content.prompt.js';
import type { OriginalScript } from '../src/types/script.js';
import type { SourceStory } from '../src/types/story.js';

let failures = 0;
function check(label: string, ok: boolean, extra = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never;

const baseContext: ScriptContext = {
  candidateId: 'candidate_0',
  angleId: 'angle_01',
  angleTitle: 'Angle',
  angleHook: 'angle hook',
  angleReason: 'reason',
  angleType: 'commentary',
  momentSegments: [
    { start: 10, end: 16, text: 'Dia menjual kopinya sampai lima ribu cangkir per hari' },
  ],
  candidateTitle: 'Viral Moment',
  candidateHook: '',
  sourceTitle: 'abc123',
  sourceChannel: '',
};

const llmResponse = {
  language: 'id',
  sections: [
    { type: 'hook', text: 'HOOK DARI LLM — bukan pilihan user' },
    { type: 'context', text: 'Konteks singkat.', evidence: ['menjual kopinya'] },
    {
      type: 'source',
      text: 'Ia bilang lima ribu cangkir per hari.',
      sourceQuote: 'lima ribu cangkir per hari',
      evidence: ['lima ribu cangkir per hari'],
    },
    { type: 'commentary', text: 'Ini menunjukkan skala permintaan.', evidence: ['menjual kopinya'] },
    { type: 'analysis', text: 'Angka itu mengesankan.', evidence: ['lima ribu cangkir per hari'] },
    { type: 'conclusion', text: 'Penutup.' },
  ],
  originality: { status: 'PASS', notes: [] },
};

const providerReturningLlmHook = {
  chat: async () => JSON.stringify(llmResponse),
} as never;

async function main(): Promise<void> {
  // ── 1. Prompt emission ────────────────────────────────────────────────
  const withHook = buildScriptUserPrompt({ ...baseContext, fixedHook: 'HOOK PILIHAN USER' });
  const withoutHook = buildScriptUserPrompt(baseContext);
  check('prompt contains MANDATORY HOOK when fixedHook set', withHook.includes('MANDATORY HOOK') && withHook.includes('HOOK PILIHAN USER'));
  check('prompt has NO MANDATORY HOOK block when absent', !withoutHook.includes('MANDATORY HOOK'));

  // ── 2. enforceFixedHook via ScriptService ─────────────────────────────
  const options = { model: 'test', temperature: 0, timeoutMs: 1000, maxRetries: 1 };
  const svc = new ScriptService(providerReturningLlmHook, options, logger);

  const fixed: OriginalScript = await svc.generateScript({ ...baseContext, fixedHook: 'HOOK PILIHAN USER' });
  check('script hook == user-selected hook (LLM rewrite overridden)',
    fixed.sections.find((s) => s.type === 'hook')?.text === 'HOOK PILIHAN USER',
    `got: "${fixed.sections.find((s) => s.type === 'hook')?.text}"`);

  const free: OriginalScript = await svc.generateScript(baseContext);
  check('script hook == LLM hook when no hook selected (existing behaviour)',
    free.sections.find((s) => s.type === 'hook')?.text === 'HOOK DARI LLM — bukan pilihan user');

  // ── 3. VideoPlan on-screen hook ───────────────────────────────────────
  const story: SourceStory = {
    concept: 'comeback',
    protagonist: 'Penjual kopi',
    premise: 'premise',
    hookMoment: { start: 12, end: 15, suggestedLine: 'JUDUL DARI STORY (bukan pilihan user)' },
    beats: [
      { id: 'beat_1', role: 'setup', purpose: 'p', start: 10, end: 14, evidence: ['menjual kopinya'] },
      { id: 'beat_2', role: 'resolution', purpose: 'p', start: 14, end: 16, evidence: ['lima ribu cangkir'] },
    ],
  };
  const planner = new VideoPlanService({ targetDuration: 20 }, logger);
  const planInput = {
    script: fixed,
    clipStart: 10,
    clipEnd: 16,
    story,
  };

  const planWithHook = await planner.buildPlan({
    ...planInput,
    customHook: 'HOOK SPOKEN NARASI PILIHAN USER',
    hookTitle: 'JUDUL ON-SCREEN HOOK REKOMENDASI TERPILIH',
    hookTag: '⚡ DETIK KRUSIAL',
    hookHighlightWords: ['REKOMENDASI'],
  });
  const hookScene = planWithHook.scenes.find((s) => s.type === 'hook');
  check('hook scene shows the exact hookTitle as hookTitle and quotableLine',
    hookScene?.hookTitle === 'JUDUL ON-SCREEN HOOK REKOMENDASI TERPILIH' &&
    hookScene?.quotableLine === 'JUDUL ON-SCREEN HOOK REKOMENDASI TERPILIH',
    `got hookTitle: "${hookScene?.hookTitle}", quotableLine: "${hookScene?.quotableLine}"`);
  check('hook scene carries hookTag',
    hookScene?.hookTag === '⚡ DETIK KRUSIAL',
    `got: "${hookScene?.hookTag}"`);
  check('hook scene carries highlightWords',
    Boolean(hookScene?.highlightWords?.includes('REKOMENDASI')),
    `got: "${JSON.stringify(hookScene?.highlightWords)}"`);
  check('story hookMoment does NOT override the selected hook source',
    !(hookScene?.source?.start === 12 && hookScene?.source?.end === 15),
    `source: ${JSON.stringify(hookScene?.source)}`);

  const planNoHook = await planner.buildPlan(planInput);
  const hookSceneNoHook = planNoHook.scenes.find((s) => s.type === 'hook');
  check('without selection: story suggestedLine still used (existing behaviour)',
    hookSceneNoHook?.quotableLine === 'JUDUL DARI STORY (bukan pilihan user)',
    `got: "${hookSceneNoHook?.quotableLine}"`);
  check('without selection: hookMoment still drives the opening cut (existing behaviour)',
    hookSceneNoHook?.source?.start === 12 && hookSceneNoHook?.source?.end === 15,
    `source: ${JSON.stringify(hookSceneNoHook?.source)}`);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
