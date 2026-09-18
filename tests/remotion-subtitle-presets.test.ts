import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSubtitleStyle, SUBTITLE_STYLE_PRESETS } from '../src/types/subtitle-style.presets.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';
import { VideoPlanService } from '../src/content/video-plan.service.js';
import { createLogger } from '../src/utils/logger.js';
import type { OriginalScript } from '../src/types/script.js';

test('Remotion Subtitle Style Presets & Wiring Test Suite', async (t) => {
  await t.test('1. Preset normalization & resolution', () => {
    assert.equal(resolveSubtitleStyle('beast'), SUBTITLE_STYLE_PRESETS.beast);
    assert.equal(resolveSubtitleStyle('mrbeast'), SUBTITLE_STYLE_PRESETS.beast, 'mrbeast alias maps to beast');
    assert.equal(resolveSubtitleStyle('hormozi'), SUBTITLE_STYLE_PRESETS.hormozi);
    assert.equal(resolveSubtitleStyle('clean'), SUBTITLE_STYLE_PRESETS.clean);
    assert.equal(resolveSubtitleStyle(undefined), SUBTITLE_STYLE_PRESETS.beast, 'defaults to beast');
  });

  await t.test('2. Transform schema validates subtitleStyle and hook overrides', () => {
    for (const style of ['beast', 'hormozi', 'clean'] as const) {
      const parsed = transformRequestSchema.safeParse({
        youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        subtitleStyle: style,
        hookLayout: 'split-proof',
        hookAnimation: 'spring-punch',
        hookTypography: 'bold-caps',
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.subtitleStyle, style);
        assert.equal(parsed.data.hookLayout, 'split-proof');
        assert.equal(parsed.data.hookAnimation, 'spring-punch');
        assert.equal(parsed.data.hookTypography, 'bold-caps');
      }
    }
  });

  await t.test('3. VideoPlanService forwards hookLayout, hookAnimation, and hookTypography to firstScene', async () => {
    const logger = createLogger('test-plan');
    const service = new VideoPlanService({ targetDuration: 60 }, logger);
    const sampleScript: OriginalScript = {
      candidateId: 'cand_1',
      angleId: 'angle_1',
      angleTitle: 'Sample Title',
      language: 'id',
      sections: [
        { type: 'hook', text: 'Hook opener sentence' },
        { type: 'context', text: 'Context body sentence' },
      ],
      originality: { status: 'PASS', notes: [] },
      estimatedDurationSeconds: 15,
    };

    const plan = await service.buildPlan({
      script: sampleScript,
      clipStart: 0,
      clipEnd: 15,
      narrationDurationSeconds: 15,
      visualPreset: 'kinetic-punch',
      hookLayout: 'top-heavy',
      hookAnimation: 'slide-up',
      hookTypography: 'heavy-sans',
    });

    const firstScene = plan.scenes[0];
    assert.ok(firstScene != null);
    assert.equal(firstScene.visualPreset, 'kinetic-punch');
    assert.equal(firstScene.hookLayout, 'top-heavy');
    assert.equal(firstScene.hookAnimation, 'slide-up');
    assert.equal(firstScene.hookTypography, 'heavy-sans');
  });
});
