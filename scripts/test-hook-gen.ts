/** Minimal test: hook generation with group-deepseek model */
import { RouterProvider } from '../src/providers/router.provider.js';
import { parseLlmJson } from '../src/utils/llm-json.js';
import { HOOK_GENERATION_SYSTEM_PROMPT, buildHookGenerationUserPrompt } from '../src/hooks/hook.prompt.js';
import type { HookGenerationContext } from '../src/hooks/hook.prompt.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Read API key from .env
const envContent = await readFile('.env', 'utf-8');
const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
if (!apiKeyMatch) throw new Error('ROUTER_API_KEY not found in .env');
const apiKey = apiKeyMatch[1]!.trim();

const provider = new RouterProvider(
  'http://127.0.0.1:20128',
  apiKey,
  {
    info: (msg: string, _o?: unknown) => console.log(`[info] ${msg}`),
    debug: () => {},
    warn: (msg: string, _o?: unknown) => console.log(`[warn] ${msg}`),
  } as any,
);

async function main() {
  const transcriptPath = join(process.cwd(), 'outputs', 'kBoAmrXotlQ', 'transcripts', 'kBoAmrXotlQ.json');
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf-8'));

  const context: HookGenerationContext = {
    videoId: 'kBoAmrXotlQ',
    sourceTitle: 'Veda P9 Finish Interview',
    angles: [
      { id: 'angle_01', angleType: 'analysis', title: 'Finis P9 tapi bersyukur', hook: 'Finis P9, tapi dia bersyukur.', reason: 'Test', score: 80 },
      { id: 'angle_02', angleType: 'education', title: '3 kesalahan Veda', hook: 'Start bagus tapi kenapa P9?', reason: 'Test', score: 75 },
    ],
    story: undefined,
    segments: transcript.segments.slice(0, 4),
    styles: ['curiosity', 'shock'] as any,
    language: 'id',
    durationMin: 2,
    durationMax: 5,
  };

  console.log('=== Testing hook generation ===');
  console.log(`Segments: ${context.segments.length}`);

  const userPrompt = buildHookGenerationUserPrompt(context);
  console.log(`Prompt length: ${userPrompt.length} chars`);

  const raw = await provider.chat({
    model: 'group-deepseek',
    system: HOOK_GENERATION_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.3,
    timeoutMs: 120000,
  });

  console.log(`Response length: ${raw.length} chars`);
  console.log(`Preview: ${raw.slice(0, 500)}`);

  if (!raw.trim()) {
    console.error('ERROR: Empty response');
    process.exit(1);
  }

  const parsed = parseLlmJson(raw);
  console.log(`\nParsed successfully!`);
  if (parsed && typeof parsed === 'object' && 'candidates' in parsed) {
    const candidates = (parsed as any).candidates;
    console.log(`Candidates: ${candidates.length}`);
    for (const c of candidates.slice(0, 3)) {
      console.log(`  - [${c.style}] ${c.headline}`);
    }
  }
}

main().catch(console.error);
