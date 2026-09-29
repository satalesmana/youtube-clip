import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scriptDraftRequestSchema, scriptSaveRequestSchema } from '../src/schemas/script.schema.js';
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

  await suite.test('User Edit Save: updateSavedScript updates draft.json and preserves edits on reload', async () => {
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
    const testVideoId = 'test_cache_edit_vid';

    // 1. Initial AI draft
    const initialDraft = {
      candidateId: 'test_c1',
      script: {
        language: 'id',
        sections: [
          { type: 'hook', text: 'Teks Asli AI Hook', spokenText: 'Teks Asli AI Hook' },
          { type: 'conclusion', text: 'Teks Asli AI CTA', spokenText: 'Teks Asli AI CTA' },
        ],
      },
    };
    await controller.saveScriptDraft(testVideoId, initialDraft);

    // 2. User edits subtitle and TTS pronunciation
    const userEditedScript = {
      language: 'id',
      sections: [
        {
          type: 'hook' as const,
          text: 'Teks Subtitle Hasil Editan Pengguna!',
          spokenText: 'Pelafalan TTS Kustom Khusus Pengguna',
        },
        {
          type: 'conclusion' as const,
          text: 'Teks CTA Baru Editan',
          spokenText: 'Teks CTA Baru Editan',
        },
      ],
    };

    // Validate payload against schema
    const validated = scriptSaveRequestSchema.parse({
      videoId: testVideoId,
      script: userEditedScript,
    });
    assert.equal(validated.videoId, testVideoId);

    // Persist via updateSavedScript
    const saveResult = await controller.updateSavedScript(testVideoId, userEditedScript);
    assert.equal(saveResult.success, true);
    assert.equal((saveResult as any).script?.sections[0].text, 'Teks Subtitle Hasil Editan Pengguna!');
    assert.equal((saveResult as any).script?.sections[0].spokenText, 'Pelafalan TTS Kustom Khusus Pengguna');

    // 3. Reopen / reload from disk cache
    const reloaded = await controller.loadSavedScript(testVideoId);
    assert.ok(reloaded, 'Must find saved draft on disk');
    const reloadedScript = (reloaded as any).script;
    assert.equal(reloadedScript.sections[0].text, 'Teks Subtitle Hasil Editan Pengguna!');
    assert.equal(reloadedScript.sections[0].spokenText, 'Pelafalan TTS Kustom Khusus Pengguna');
    assert.equal(reloaded?.userEdited, true);

    // Clean up
    fs.rmSync(path.resolve(outputsDir, testVideoId), { recursive: true, force: true });
  });

  await suite.test('Audio Metadata Persistence: updateSavedScript persists audioUrl, ttsSections, durationSeconds', async () => {
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
    const testVideoId = 'test_audio_meta_vid';
    const mockScript = {
      language: 'id',
      sections: [
        { type: 'hook' as const, text: 'Hook teks', spokenText: 'Hook pelafalan' },
      ],
    };
    const mockAudioMeta = {
      audioUrl: '/api/media/test_audio_meta_vid/transform/job123/voice/narration.mp3',
      sections: [{ type: 'hook', durationSeconds: 3.5 }],
      durationSeconds: 3.5,
    };

    const saved = await controller.updateSavedScript(testVideoId, mockScript, mockAudioMeta);
    assert.equal(saved.success, true);
    assert.equal(saved.audioUrl, mockAudioMeta.audioUrl);
    assert.equal(saved.durationSeconds, 3.5);

    const reloaded = await controller.loadSavedScript(testVideoId);
    assert.ok(reloaded);
    assert.equal(reloaded?.audioUrl, mockAudioMeta.audioUrl);
    assert.equal(reloaded?.durationSeconds, 3.5);
    assert.deepEqual(reloaded?.ttsSections, mockAudioMeta.sections);

    // Clean up
    fs.rmSync(path.resolve(outputsDir, testVideoId), { recursive: true, force: true });
  });
});
