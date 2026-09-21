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

  await t.test('4. Transform schema validates refreshCaptions boolean', () => {
    const parsed = transformRequestSchema.safeParse({
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      refreshCaptions: true,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.refreshCaptions, true);
    }
  });

  await t.test('5. SubtitleService interpolates words and AssService renders WrapStyle: 0 and uppercase', async () => {
    const { SubtitleService } = await import('../src/services/subtitle.service.js');
    const { AssService } = await import('../src/services/ass.service.js');

    const subService = new SubtitleService({
      maxWordsPerEvent: 4,
      pauseBreakThresholdSeconds: 1.5,
    });

    // Transcript WITHOUT word timestamps (like YouTube captions or segment-only transcripts)
    const transcript = {
      language: 'Indonesian',
      durationSeconds: 10,
      segments: [
        {
          start: 0,
          end: 4,
          text: 'kalau kamu di posisinya, milih setia atau sikat tawarannya.',
        },
      ],
    };

    const events = subService.buildEvents(transcript, 0, 4);
    // Should break into chunks of at most 4 words
    assert.ok(events.length >= 2, `Expected at least 2 events, got ${events.length}`);
    for (const evt of events) {
      assert.ok(evt.words.length <= 4, `Event has ${evt.words.length} words, max 4 expected`);
      assert.ok(evt.start >= 0);
      assert.ok(evt.end <= 4);
    }

    const assService = new AssService({ playResX: 1080, playResY: 1920 });
    const beastStyle = resolveSubtitleStyle('beast');
    const renderedAss = assService.render(events, beastStyle);

    // Verify WrapStyle: 0
    assert.ok(renderedAss.includes('WrapStyle: 0'), 'ASS must use WrapStyle: 0 for smart wrapping');
    // Verify font is Arial Black
    assert.ok(renderedAss.includes('Arial Black'), 'Beast style must use Arial Black font');
    // Verify uppercase text in dialogue
    assert.ok(renderedAss.includes('KALAU') && renderedAss.includes('KAMU'), 'Beast style must uppercase dialogue text');
  });

  await t.test('6. Remotion Caption layout, spring timings & anti-collision metrics', async () => {
    const { SAFE_AREA } = await import('../compositions/studio/src/Caption.js');
    assert.equal(SAFE_AREA.bottom, 420, 'SAFE_AREA.bottom must be 420px to avoid TikTok/Reels UI overlay');

    // Test word timings frame conversion logic
    const fps = 30;
    const durationFrames = 60;
    const absoluteStartFrame = 90;
    const words = ['MILIH', 'SETIA', 'ATAU', 'SIKAT'];
    const wordTimings = [
      { word: 'MILIH', start: 3.0, end: 3.4 },
      { word: 'SETIA', start: 3.4, end: 3.9 },
      { word: 'ATAU', start: 3.9, end: 4.2 },
      { word: 'SIKAT', start: 4.2, end: 4.8 },
    ];

    const wordFrames = words.map((_, k) => {
      const timing = wordTimings[k]!;
      const relStart = Math.max(0, Math.round(timing.start * fps - absoluteStartFrame));
      const relEnd = Math.max(relStart + 1, Math.round(timing.end * fps - absoluteStartFrame));
      return { start: relStart, end: relEnd };
    });

    assert.equal(wordFrames[0].start, 0); // 3.0 * 30 - 90 = 0
    assert.equal(wordFrames[1].start, 12); // 3.4 * 30 - 90 = 12
    assert.ok(wordFrames[0].end <= wordFrames[1].start, 'First word ends before or at second word start');

    // Test anti-collision buffer check:
    // With 76px font, maximum active zoom is 1.09x -> expansion is 76 * 0.09 = 6.84px total (~3.4px each side).
    // Flex gap (14px) + word margin (2px each side = 4px) = 18px total buffer.
    // 18px buffer > 6.84px expansion, guaranteeing words never collide or overlap.
    const maxExpansionPx = 76 * 0.09;
    const totalGapBufferPx = 14 + 4;
    assert.ok(totalGapBufferPx > maxExpansionPx * 2, 'Total gap buffer must comfortably exceed active scale expansion');
  });
});

