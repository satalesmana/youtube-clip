import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTtsProviderKind, createTtsServiceWith } from '../src/container/index.js';
import { env } from '../src/config/env.js';

test('TTS Voice Override & Provider Resolution Suite', async (suite) => {
  await suite.test('resolveTtsProviderKind resolves explicitly passed provider', () => {
    assert.equal(resolveTtsProviderKind('openai', 'id-ID-ArdiNeural'), 'openai');
    assert.equal(resolveTtsProviderKind('edge-tts', 'alloy'), 'edge-tts');
  });

  await suite.test('resolveTtsProviderKind auto-detects OpenAI voices when provider is omitted', () => {
    assert.equal(resolveTtsProviderKind(undefined, 'nova'), 'openai');
    assert.equal(resolveTtsProviderKind(undefined, 'alloy'), 'openai');
    assert.equal(resolveTtsProviderKind(undefined, 'echo'), 'openai');
  });

  await suite.test('resolveTtsProviderKind defaults to env.TTS_PROVIDER for Edge voices or general voices', () => {
    assert.equal(resolveTtsProviderKind(undefined, 'id-ID-ArdiNeural'), env.TTS_PROVIDER);
    assert.equal(resolveTtsProviderKind(undefined, 'en-US-JennyNeural'), env.TTS_PROVIDER);
    assert.equal(resolveTtsProviderKind(undefined, undefined), env.TTS_PROVIDER);
  });

  await suite.test('createTtsServiceWith respects custom voice without requiring ttsProvider', () => {
    const customVoice = 'en-US-JennyNeural';
    const service = createTtsServiceWith(undefined, customVoice);
    assert.ok(service, 'TtsService should be created');

    // Access options property on TtsService instance to verify the voice is customVoice and not env.TTS_VOICE
    const opts = (service as unknown as { options: { voice: string } }).options;
    assert.equal(opts.voice, customVoice);
  });

  await suite.test('createTtsServiceWith falls back to env.TTS_VOICE when voice is empty', () => {
    const service = createTtsServiceWith(undefined, '');
    const opts = (service as unknown as { options: { voice: string } }).options;
    assert.equal(opts.voice, env.TTS_VOICE);
  });
});
