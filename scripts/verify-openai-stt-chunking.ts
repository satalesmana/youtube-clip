/**
 * Verify: OpenAI STT chunking for oversized audio (> upload limit).
 *
 * Follows the isolated-verification pattern: imports the REAL WhisperService,
 * stubs only the network (global fetch) with canned verbose_json responses,
 * and uses the project's real FFmpeg binary to split chunks. Asserts:
 *
 *  1. Small audio (< limit)  → exactly ONE HTTP call, timestamps untouched.
 *  2. Oversized audio        → split into N sequential MP3 chunks, every
 *     upload under the limit, timestamps shifted back onto the original
 *     timeline (segment AND word level), language + duration preserved,
 *     chunk scratch dir cleaned up.
 *  3. Missing endpoint config → clear validation error.
 *
 * Run: npx tsx scripts/verify-openai-stt-chunking.ts
 */
import { join } from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { env } from '../src/config/env.js';
import { runCommand } from '../src/utils/exec.js';
import { probeDurationSeconds } from '../src/utils/ffmpeg.js';
import { WhisperService } from '../src/services/whisper.service.js';

interface RecordedCall {
  url: string;
  authorization: string;
  model: string;
  responseFormat: string;
  blobSize: number;
}

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

/** Minimal Logger stand-in so the service can log freely during the test. */
function silentLogger(): any {
  const noop = (): undefined => undefined;
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => silentLogger(),
  };
}

// Fix createSilentLogger usage: services need a logger, build one directly.
function makeServiceWithLogger(
  tmpRoot: string,
  overrides?: { maxUploadMb?: number; baseUrl?: string },
): WhisperService {
  return new WhisperService(
    {
      provider: 'openai',
      binaryPath: '',
      model: '',
      language: 'auto',
      outputDir: tmpRoot,
      openai: {
        baseUrl: overrides?.baseUrl ?? 'https://stt.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-transcribe',
        ...(overrides?.maxUploadMb !== undefined ? { maxUploadMb: overrides.maxUploadMb } : {}),
        ffmpegBinaryPath: env.FFMPEG_BINARY_PATH,
      },
    },
    silentLogger(),
  );
}

/** Installs a fetch stub returning a canned verbose_json payload per call. */
function installFetchStub(cannedText: string): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const form: FormData = init.body;
    let model = '';
    let responseFormat = '';
    let blobSize = 0;
    for (const [name, value] of (form as any).entries()) {
      if (name === 'model') model = String(value);
      if (name === 'response_format') responseFormat = String(value);
      if (name === 'file') blobSize = (value as Blob).size;
    }
    calls.push({
      url: String(input),
      authorization: String(init.headers?.Authorization ?? ''),
      model,
      responseFormat,
      blobSize,
    });

    const payload = {
      language: 'id',
      duration: 2,
      segments: [
        {
          start: 0.5,
          end: 2,
          text: cannedText,
          words: [{ word: cannedText, start: 0.5, end: 2 }],
        },
      ],
    };
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;

  return {
    calls,
    restore: (): void => {
      globalThis.fetch = originalFetch;
    },
  };
}

async function generateWav(path: string, seconds: number): Promise<void> {
  await runCommand(env.FFMPEG_BINARY_PATH, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:duration=${seconds}`,
    '-ac',
    '1',
    '-ar',
    '16000',
    path,
  ]);
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'stt-chunk-verify-'));
  try {
    // ── Scenario 1: small audio → single upload, no time shifting ──
    console.log('\n[1] Small audio (under limit)');
    {
      const wav = join(root, 'small.wav');
      await generateWav(wav, 1);
      const { calls, restore } = installFetchStub('halo');
      try {
        const service = makeServiceWithLogger(root);
        const result = await service.transcribe(wav, { temp: root });

        assert(calls.length === 1, `single HTTP call (got ${calls.length})`);
        assert(
          calls[0]!.url === 'https://stt.example.com/v1/audio/transcriptions',
          'hits /audio/transcriptions',
        );
        assert(calls[0]!.authorization === 'Bearer test-key', 'sends Authorization header');
        assert(calls[0]!.model === 'gpt-4o-transcribe', 'sends configured model');
        assert(
          calls[0]!.responseFormat === 'verbose_json',
          'requests verbose_json (first cascade attempt succeeds)',
        );
        assert(result.segments.length === 1, 'one segment returned');
        assert(
          Math.abs(result.segments[0]!.start - 0.5) < 1e-9,
          'timestamp NOT shifted for small files',
        );
      } finally {
        restore();
      }
    }

    // ── Scenario 2: oversized audio → chunked, re-stitched ──
    console.log('\n[2] Oversized audio (over limit)');
    {
      // 12 s @ 16 kHz mono s16 ≈ 384 KB. Limit 0.05 MB (~52 KB) forces splits.
      const wav = join(root, 'big.wav');
      await generateWav(wav, 12);
      const wavDuration = await probeDurationSeconds({
        binaryPath: env.FFMPEG_BINARY_PATH,
        inputPath: wav,
      });
      assert(wavDuration > 11, `fixture generated (duration ${wavDuration}s)`);

      const maxUploadMb = 0.05;
      const maxBytes = maxUploadMb * 1024 * 1024;
      const { calls, restore } = installFetchStub('uji');
      try {
        const service = makeServiceWithLogger(root, { maxUploadMb });
        const result = await service.transcribe(wav, { temp: root });

        // Expected chunk length: floor(limit / bytesPerSecond * safety) with
        // 64 kbps ⇒ 8192 B/s and 0.9 safety ⇒ 5 s per chunk → 3 chunks.
        assert(
          calls.length === Math.ceil(wavDuration / 5),
          `split into expected chunk uploads (got ${calls.length})`,
        );
        assert(
          calls.every((c) => c.blobSize <= maxBytes),
          `every upload ≤ ${maxBytes.toFixed(0)} B limit`,
        );
        assert(
          calls.every((c) => c.blobSize < 25 * 1024 * 1024),
          'every upload under the API hard cap (25 MB)',
        );
        assert(
          calls.every((c) => c.responseFormat === 'verbose_json'),
          'each chunk requests verbose_json',
        );

        assert(result.language === 'id', 'language propagated from chunk responses');
        assert(result.segments.length === calls.length, 'one stitched segment per chunk');

        // Canned chunk response always reports 0.5→2; stitched starts must be
        // chunkStart + 0.5 with uniform 5 s spacing: 0.5, 5.5, 10.5, ...
        const expectedStarts = Array.from({ length: calls.length }, (_, i) => i * 5 + 0.5);
        const actualStarts = result.segments.map((s) => s.start);
        const startsMatch = expectedStarts.every(
          (expected, i) => Math.abs(actualStarts[i]! - expected) < 1e-6,
        );
        assert(
          startsMatch,
          `segment starts shifted onto original timeline (${actualStarts.map(String).join(', ')})`,
        );

        const wordsShifted = result.segments.every(
          (s) => s.words?.length === 1 && Math.abs(s.words[0]!.start - s.start) < 1e-9,
        );
        assert(wordsShifted, 'word-level timestamps shifted too');

        const monotonic = result.segments.every(
          (s, i) => i === 0 || s.start >= result.segments[i - 1]!.end,
        );
        assert(monotonic, 'stitched timeline strictly sequential (no overlap, no gaps misordered)');

        const expectedDuration = Math.max(wavDuration, calls.length * 5 - 5 + 2);
        assert(
          Math.abs(result.durationSeconds - expectedDuration) < 1e-6,
          'duration covers full source',
        );

        const leftovers = (await readdir(root)).filter((entry) => entry.startsWith('stt-chunks-'));
        assert(leftovers.length === 0, 'chunk scratch directory cleaned up');
      } finally {
        restore();
      }
    }

    // ── Scenario 3: missing endpoint config → clear validation error ──
    console.log('\n[3] Missing endpoint configuration');
    {
      const wav = join(root, 'tiny.wav');
      await generateWav(wav, 1);
      const service = makeServiceWithLogger(root, { baseUrl: '' });
      let errorMessage = '';
      try {
        await service.transcribe(wav, { temp: root });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      assert(
        errorMessage.includes('OPENAI_WHISPER_BASE_URL'),
        'clear validation error when baseUrl/apiKey missing',
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
