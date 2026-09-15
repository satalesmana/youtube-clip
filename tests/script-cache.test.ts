import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scriptDraftRequestSchema } from '../src/schemas/script.schema.js';
import { TransformController } from '../src/controllers/transform.controller.js';

test('Narration Script Disk Cache & Regenerate Suite', async (suite) => {
  await suite.test('Schema Validation: accepts optional refresh boolean', () => {
    const parsedDefault = scriptDraftRequestSchema.parse({
      videoId: 'test_vid_123',
    });
    assert.equal(parsedDefault.refresh, undefined);

    const parsedRefreshTrue = scriptDraftRequestSchema.parse({
      videoId: 'test_vid_123',
      refresh: true,
    });
    assert.equal(parsedRefreshTrue.refresh, true);

    const parsedRefreshFalse = scriptDraftRequestSchema.parse({
      videoId: 'test_vid_123',
      refresh: false,
    });
    assert.equal(parsedRefreshFalse.refresh, false);
  });

  await suite.test('Disk Cache IO: saves to outputs/{videoId}/scripts/draft.json and loads back', async () => {
    const outputsDir = path.resolve(process.cwd(), 'outputs');
    const controller = new TransformController({
      outputsDir,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any,
    } as any);
    const testVideoId = 'test_cache_dummy_vid';
    const mockScript = {
      language: 'id',
      sections: [
        { type: 'hook', text: 'Trik rahasia coding cepat!', spokenText: 'Trik rahasia coding cepat' },
        { type: 'conclusion', text: 'Follow untuk tips berikutnya.', spokenText: 'Follow untuk tips berikutnya' },
      ],
    };

    // Save to disk cache
    await controller.saveScriptDraft(testVideoId, mockScript);

    // Verify file exists on disk
    const expectedFilePath = path.resolve(outputsDir, testVideoId, 'scripts', 'draft.json');
    assert.ok(fs.existsSync(expectedFilePath), 'Draft file must exist in outputs/{videoId}/scripts/draft.json');

    // Load from disk cache
    const loaded = await controller.loadSavedScript(testVideoId);
    assert.ok(loaded, 'Loaded script should not be null');
    assert.equal(loaded?.language, 'id');
    assert.equal(loaded?.cached, true);
    const sections = (loaded as any).sections;
    assert.equal(sections?.length, 2);
    assert.equal(sections?.[0].text, 'Trik rahasia coding cepat!');

    // Clean up test artifacts
    fs.rmSync(path.resolve(outputsDir, testVideoId), { recursive: true, force: true });
  });

  await suite.test('draftScript caching behavior: returns cached draft immediately if refresh is not set', async () => {
    const outputsDir = path.resolve(process.cwd(), 'outputs');
    const controller = new TransformController({
      outputsDir,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any,
    } as any);
    const testVideoId = 'test_cache_behavior_vid';
    const mockDraftResult = {
      candidateId: 'test_c1',
      script: {
        language: 'id',
        sections: [
          { type: 'hook', text: 'Hook tersimpan dari cache', spokenText: 'Hook tersimpan dari cache' },
        ],
      },
    };

    // Pre-populate disk cache
    await controller.saveScriptDraft(testVideoId, mockDraftResult);

    // Stub resolveTranscriptAndVideo so it does not attempt real YouTube download / transcribe
    (controller as any).resolveTranscriptAndVideo = async () => ({
      videoId: testVideoId,
      videoPath: '/mock/video.mp4',
      transcript: { videoId: testVideoId, segments: [] },
    });

    // Call draftScript without refresh -> should return disk cache immediately
    const result = await controller.draftScript({
      videoId: testVideoId,
    });

    assert.equal(result.cached, true, 'Result should have cached: true');
    assert.equal((result as any).script?.sections[0].text, 'Hook tersimpan dari cache');

    // Clean up
    fs.rmSync(path.resolve(outputsDir, testVideoId), { recursive: true, force: true });
  });
});
