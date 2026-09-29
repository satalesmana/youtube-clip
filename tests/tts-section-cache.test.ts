import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TtsService } from '../src/services/tts.service.js';
import type { ITTSProvider } from '../src/providers/tts/tts.provider.js';
import type { TTSSynthesisRequest, TTSSynthesisResult } from '../src/providers/tts/tts.types.js';
import type { OriginalScript } from '../src/types/script.js';

test('Per-Section TTS Audio Caching Suite', async (suite) => {
  const testOutputDir = path.resolve(process.cwd(), 'outputs', 'test-section-tts');
  const cacheDir = path.resolve(testOutputDir, 'tts-cache');

  // Clean test directory before starting
  fs.rmSync(testOutputDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  await suite.test('synthesizeSection caches audio and avoids re-synthesizing on identical content', async () => {
    let providerCallCount = 0;

    const mockProvider: ITTSProvider = {
      kind: 'edge-tts',
      synthesize: async (req: TTSSynthesisRequest): Promise<TTSSynthesisResult> => {
        providerCallCount += 1;
        const outPath = req.outputPath ?? path.join(testOutputDir, 'dummy.mp3');
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        // Write mock mp3 bytes
        fs.writeFileSync(outPath, Buffer.from('mock-mp3-audio-bytes-12345'));
        return {
          outputPath: outPath,
          durationSeconds: 3.5,
          provider: 'edge-tts',
          wordTimings: [
            { word: 'Halo', start: 0.0, end: 0.5 },
            { word: 'dunia', start: 0.6, end: 1.2 },
          ],
        };
      },
    };

    const tts = new TtsService(
      mockProvider,
      {
        voice: 'id-ID-ArdiNeural',
        rate: '+0%',
        outputDir: testOutputDir,
        cacheDir,
        language: 'id',
      },
      {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any,
    );

    const section = {
      type: 'hook',
      text: 'Halo dunia, ini adalah tes sintesis audio!',
      spokenText: 'Halo dunia, ini adalah tes sintesis audio!',
    };

    // 1st synthesis: cache miss -> calls provider
    const res1 = await tts.synthesizeSection(section, 'id');
    assert.equal(providerCallCount, 1, 'Provider must be called on cache miss');
    assert.equal(res1.durationSeconds, 3.5);
    assert.equal(res1.wordTimings?.length, 2);
    assert.ok(fs.existsSync(res1.outputPath), 'Output audio must exist');

    // 2nd synthesis with identical text & voice -> cache HIT!
    const res2 = await tts.synthesizeSection(section, 'id');
    assert.equal(providerCallCount, 1, 'Provider must NOT be called again on cache hit');
    assert.equal(res2.durationSeconds, 3.5);
    assert.equal(res2.wordTimings?.length, 2);
    assert.ok(fs.existsSync(res2.outputPath), 'Cached audio must exist');
  });

  await suite.test('synthesizeScript only re-synthesizes modified sections upon edit', async () => {
    let providerCalls: string[] = [];

    const mockProvider: ITTSProvider = {
      kind: 'fish-audio',
      synthesize: async (req: TTSSynthesisRequest): Promise<TTSSynthesisResult> => {
        providerCalls.push(req.text);
        const outPath = req.outputPath ?? path.join(testOutputDir, 'dummy.mp3');
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, Buffer.from('mock-mp3-audio-bytes-section'));
        return {
          outputPath: outPath,
          durationSeconds: 2.0,
          provider: 'fish-audio',
          wordTimings: [{ word: 'tes', start: 0.1, end: 0.8 }],
        };
      },
    };

    const tts = new TtsService(
      mockProvider,
      {
        voice: 'fish-voice-123',
        rate: '+0%',
        outputDir: testOutputDir,
        cacheDir,
        language: 'id',
      },
      {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any,
    );
    // Stub concatenate to isolate section caching logic from ffmpeg binary decoding
    (tts as any).concatenate = async (_inputs: string[], outPath: string) => {
      fs.writeFileSync(outPath, Buffer.from('mock-combined-audio'));
    };

    // Initial 3-section script
    const initialScript: OriginalScript = {
      candidateId: 'c1',
      angleId: 'a1',
      angleTitle: 'Angle 1',
      language: 'id',
      estimatedDurationSeconds: 15,
      sections: [
        { type: 'hook', text: 'Hook Pembuka Awal', spokenText: 'Hook Pembuka Awal' },
        { type: 'context', text: 'Cerita Konteks Original', spokenText: 'Cerita Konteks Original' },
        { type: 'conclusion', text: 'CTA Penutup Original', spokenText: 'CTA Penutup Original' },
      ],
      originality: { status: 'PASS', notes: [] },
    };

    const workspace1 = path.join(testOutputDir, 'ws1');
    await tts.synthesizeScript(initialScript, workspace1);

    assert.equal(providerCalls.length, 3, 'All 3 initial sections must be synthesized');
    assert.deepEqual(providerCalls, [
      'Hook Pembuka Awal',
      'Cerita Konteks Original',
      'CTA Penutup Original',
    ]);

    // Now user EDITS only section #2 (Cerita Konteks):
    const editedScript: OriginalScript = {
      ...initialScript,
      sections: [
        { type: 'hook', text: 'Hook Pembuka Awal', spokenText: 'Hook Pembuka Awal' }, // UNCHANGED
        { type: 'context', text: 'Cerita Konteks Yang Sudah Diedit!', spokenText: 'Cerita Konteks Yang Sudah Diedit!' }, // EDITED
        { type: 'conclusion', text: 'CTA Penutup Original', spokenText: 'CTA Penutup Original' }, // UNCHANGED
      ],
    };

    providerCalls = [];
    const workspace2 = path.join(testOutputDir, 'ws2');
    await tts.synthesizeScript(editedScript, workspace2);

    // CRITICAL ASSERTION:
    // Only the edited section is called to provider! Sections 1 & 3 are served from cache!
    assert.equal(
      providerCalls.length,
      1,
      'Only the 1 edited section must be synthesized; unchanged sections must be served from cache!',
    );
    assert.equal(providerCalls[0], 'Cerita Konteks Yang Sudah Diedit!');

    // Clean up
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });
});
