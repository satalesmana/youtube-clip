/**
 * Isolated verification for the Fish Audio direct TTS provider.
 *
 * Stubs global fetch so no network call is made, then asserts:
 *   1. The exact request (URL, headers, body) that would be POSTed to
 *      api.fish.audio — this is what the user asked to capture/verify.
 *   2. The response audio bytes are written to the provider's outputDir.
 *   3. `provider: 'fish-audio'` is reported on the result.
 *
 * Run: npx tsx scripts/verify-fish-tts.ts
 */
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FishAudioTtsProvider } from '../src/providers/tts/fish-audio-tts.provider.js';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

/** Minimal valid MP3: ID3-tagged silence frame — enough for stat/size checks. */
const FAKE_MP3 = Buffer.from(
  '494433040000000000000023000000000000' + // ID3v2.4 stub
    'fffb9000' + // MPEG-1 Layer III frame sync
    '00000000000000000000000000000000',
  'hex',
);

async function run() {
  const outDir = mkdtempSync(join(tmpdir(), 'fish-tts-verify-'));
  const captured: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } = {} as never;

  // Stub fetch BEFORE the provider runs — no real network.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    captured.url = String(url);
    captured.headers = (init?.headers as Record<string, string>) ?? {};
    captured.body = JSON.parse(String(init?.body));
    return new Response(FAKE_MP3, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  }) as typeof fetch;

  try {
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => logger,
    } as never;

    const provider = new FishAudioTtsProvider({
      outputDir: outDir,
      apiKey: 'fish_key_dummy___test',
      model: 's2.1-pro-free',
      temperature: 0.8,
      topP: 0.7,
      // speed: 1, // leave unset so rate "+10%" -> 1.1
      sampleRate: 44100,
      latency: 'normal',
      logger,
    });

    const result = await provider.synthesize({
      text: '[excited] Hello, this is a test of the Fish Audio direct provider.',
      voice: '39247091274234',
      rate: '+10%',
    });

    // 1. Request shape
    assert(
      captured.url === 'https://api.fish.audio/v1/tts',
      `POSTs to api.fish.audio /v1/tts (got ${captured.url})`,
    );
    assert(
      captured.headers['Authorization'] === 'Bearer fish_key_dummy___test',
      'sends Bearer auth header with the API key',
    );
    assert(
      captured.headers['model'] === 's2.1-pro-free',
      'sends model via header (Fish Audio contract)',
    );
    assert(captured.body.reference_id === '39247091274234', 'maps voice -> reference_id');
    assert(typeof captured.body.text === 'string' && captured.body.text.includes('[excited]'),
      'passes text (incl. inline tags) through');
    assert(captured.body.temperature === 0.8, 'sends temperature 0.8');
    assert(captured.body.top_p === 0.7, 'sends top_p 0.7');
    assert(
      (captured.body.prosody as { speed: number }).speed === 1.1,
      'maps rate "+10%" -> prosody.speed 1.1',
    );
    assert(captured.body.format === 'mp3', 'defaults format to mp3');
    assert(captured.body.sample_rate === 44100, 'sends sample_rate 44100');
    assert(captured.body.latency === 'normal', 'sends latency normal');
    assert(!('input' in captured.body) && !('voice' in captured.body),
      'does NOT leak OpenAI-style fields (input/voice)');

    // 2. Output written
    assert(result.provider === 'fish-audio', 'result.provider is "fish-audio"');
    assert(existsSync(result.outputPath), `output file written at ${result.outputPath}`);
    assert(readFileSync(result.outputPath).equals(FAKE_MP3), 'output bytes match upstream audio');

    // 3. No reference_id when voice is empty
    captured.url = '';
    await provider.synthesize({ text: 'No voice here.', voice: '' });
    assert(!('reference_id' in captured.body), 'omits reference_id when voice is empty');

    console.log('\n📤 Captured request body (what 9Router never could send):');
    console.log(JSON.stringify(captured.body, null, 2));
    console.log('\n🎉 ALL FISH AUDIO DIRECT PROVIDER TESTS PASSED!');
  } finally {
    globalThis.fetch = realFetch;
    rmSync(outDir, { recursive: true, force: true });
  }
}

run().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
