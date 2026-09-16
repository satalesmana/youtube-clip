import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVisualPreset,
  adaptLegacyHookStyle,
  VISUAL_PRESET_REGISTRY,
  type VisualPresetId,
} from '../src/types/visual-preset.js';

test('Viral Hook Text Style System — Visual Preset Resolver Suite', async (suite) => {
  await suite.test('Registry Integrity: all 12 presets exist and have valid configuration', () => {
    const expectedIds: VisualPresetId[] = [
      'kinetic-punch',
      'curiosity-stack',
      'story-slide',
      'minimal-question',
      'bold-impact',
      'data-punch',
      'opportunity-glow',
      'focus-brush',
      'clean-fade',
      'scribble-quote',
      'action-pointer',
      'burst-stat',
    ];

    for (const id of expectedIds) {
      const preset = VISUAL_PRESET_REGISTRY[id];
      assert.ok(preset, `Preset ${id} must exist in registry`);
      assert.equal(preset.id, id);
      assert.ok(preset.label.length > 0, `Preset ${id} must have a label`);
      assert.ok(preset.description.length > 0, `Preset ${id} must have a description`);
      assert.ok(['kinetic', 'stacked', 'minimal', 'bold-caps'].includes(preset.typography));
      assert.ok(['spring-punch', 'word-cascade', 'slide-up', 'scale-burst', 'fade'].includes(preset.animation));
      assert.ok(['neon-glow', 'underline', 'background-chip', 'brush', 'stroke', 'box', 'none'].includes(preset.highlight));
    }
  });

  await suite.test('Manual Override: user manual selection always wins', () => {
    // Even if hookType is story-anecdote (which normally gives story-slide),
    // manualPreset 'bold-impact' must win:
    const result = resolveVisualPreset({
      hookType: 'story-anecdote',
      angle: 'curiosity',
      manualPreset: 'bold-impact',
    });
    assert.equal(result.id, 'bold-impact');

    const result2 = resolveVisualPreset({
      hookType: 'question',
      manualPreset: 'kinetic-punch',
    });
    assert.equal(result2.id, 'kinetic-punch');
  });

  await suite.test('Pass 1: HookType × Angle mapping table', () => {
    // Question → minimal-question
    assert.equal(
      resolveVisualPreset({ hookType: 'question', angle: 'curiosity' }).id,
      'minimal-question'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'question', angle: 'urgency' }).id,
      'minimal-question'
    );

    // Data-statistics → data-punch
    assert.equal(
      resolveVisualPreset({ hookType: 'data-statistics', angle: 'authority' }).id,
      'data-punch'
    );

    // Story-anecdote & authority → story-slide
    assert.equal(
      resolveVisualPreset({ hookType: 'story-anecdote', angle: 'curiosity' }).id,
      'story-slide'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'authority', angle: 'opportunity' }).id,
      'story-slide'
    );

    // Intriguing-statement combinations
    assert.equal(
      resolveVisualPreset({ hookType: 'intriguing-statement', angle: 'contrarian' }).id,
      'bold-impact'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'intriguing-statement', angle: 'controversial' }).id,
      'bold-impact'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'intriguing-statement', angle: 'curiosity' }).id,
      'curiosity-stack'
    );

    // Shock-surprise combinations
    assert.equal(
      resolveVisualPreset({ hookType: 'shock-surprise', angle: 'fear' }).id,
      'kinetic-punch'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'shock-surprise', angle: 'surprise' }).id,
      'kinetic-punch'
    );

    // You-focused combinations
    assert.equal(
      resolveVisualPreset({ hookType: 'you-focused', angle: 'opportunity' }).id,
      'opportunity-glow'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'you-focused', angle: 'social-proof' }).id,
      'opportunity-glow'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'you-focused', angle: 'curiosity' }).id,
      'curiosity-stack'
    );

    // Problem-solution combinations
    assert.equal(
      resolveVisualPreset({ hookType: 'problem-solution', angle: 'opportunity' }).id,
      'opportunity-glow'
    );
    assert.equal(
      resolveVisualPreset({ hookType: 'problem-solution', angle: 'fear' }).id,
      'kinetic-punch'
    );
  });

  await suite.test('Pass 2: Angle-only fallback when hookType has no match or is omitted', () => {
    assert.equal(resolveVisualPreset({ angle: 'fear' }).id, 'kinetic-punch');
    assert.equal(resolveVisualPreset({ angle: 'urgency' }).id, 'kinetic-punch');
    assert.equal(resolveVisualPreset({ angle: 'surprise' }).id, 'kinetic-punch');
    assert.equal(resolveVisualPreset({ angle: 'curiosity' }).id, 'curiosity-stack');
    assert.equal(resolveVisualPreset({ angle: 'prediction' }).id, 'curiosity-stack');
    assert.equal(resolveVisualPreset({ angle: 'opportunity' }).id, 'opportunity-glow');
    assert.equal(resolveVisualPreset({ angle: 'social-proof' }).id, 'opportunity-glow');
    assert.equal(resolveVisualPreset({ angle: 'contrarian' }).id, 'bold-impact');
    assert.equal(resolveVisualPreset({ angle: 'controversial' }).id, 'bold-impact');
    assert.equal(resolveVisualPreset({ angle: 'authority' }).id, 'story-slide');
  });

  await suite.test('Pass 3: Ultimate visual fallback when empty or unknown', () => {
    assert.equal(resolveVisualPreset({}).id, 'kinetic-punch');
    assert.equal(resolveVisualPreset({ hookType: 'UNKNOWN' as any }).id, 'kinetic-punch');
    assert.equal(
      resolveVisualPreset({ hookType: 'UNKNOWN' as any, angle: 'UNKNOWN' as any }).id,
      'kinetic-punch'
    );
  });

  await suite.test('Legacy Adapter: maps old flat hookStyle strings correctly', () => {
    assert.equal(adaptLegacyHookStyle('shock'), 'kinetic-punch');
    assert.equal(adaptLegacyHookStyle('fear'), 'kinetic-punch');
    assert.equal(adaptLegacyHookStyle('curiosity'), 'curiosity-stack');
    assert.equal(adaptLegacyHookStyle('prediction'), 'curiosity-stack');
    assert.equal(adaptLegacyHookStyle('opportunity'), 'opportunity-glow');
    assert.equal(adaptLegacyHookStyle('story'), 'story-slide');
    assert.equal(adaptLegacyHookStyle('question'), 'minimal-question');
    assert.equal(adaptLegacyHookStyle('controversial'), 'bold-impact');
    assert.equal(adaptLegacyHookStyle('contrarian'), 'bold-impact');
    assert.equal(adaptLegacyHookStyle('statistic'), 'data-punch');

    // Unknown or undefined returns undefined
    assert.equal(adaptLegacyHookStyle(undefined), undefined);
    assert.equal(adaptLegacyHookStyle(''), undefined);
    assert.equal(adaptLegacyHookStyle('invalid_style'), undefined);
  });

  await suite.test('Composition Layout & Animation Override Support in Transform Schema', async () => {
    const { transformRequestSchema } = await import('../src/schemas/transform.schema.js');

    const validLayouts = [
      'centered',
      'top-heavy',
      'split-proof',
      'full-screen-text',
      'subject-first',
      'data-focus',
      'question-focus',
    ];

    const validAnimations = [
      'spring-punch',
      'word-cascade',
      'slide-up',
      'scale-burst',
      'fade',
    ];

    for (const layout of validLayouts) {
      const parsed = transformRequestSchema.safeParse({
        youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        outputMode: 'narration',
        hookLayout: layout,
      });
      assert.ok(parsed.success, `Expected hookLayout "${layout}" to be valid in schema: ${JSON.stringify(parsed)}`);
      assert.equal((parsed as any).data.hookLayout, layout);
    }

    for (const anim of validAnimations) {
      const parsed = transformRequestSchema.safeParse({
        youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        outputMode: 'narration',
        hookAnimation: anim,
      });
      assert.ok(parsed.success, `Expected hookAnimation "${anim}" to be valid in schema: ${JSON.stringify(parsed)}`);
      assert.equal((parsed as any).data.hookAnimation, anim);
    }

    const validTypographies = [
      'kinetic',
      'stacked',
      'minimal',
      'bold-caps',
      'bebas-neue',
      'montserrat',
      'anton',
      'archivo-black',
      'poppins',
      'oswald',
      'barlow-condensed',
    ];

    for (const typo of validTypographies) {
      const parsed = transformRequestSchema.safeParse({
        youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        outputMode: 'narration',
        hookTypography: typo,
      });
      assert.ok(parsed.success, `Expected hookTypography "${typo}" to be valid in schema: ${JSON.stringify(parsed)}`);
      assert.equal((parsed as any).data.hookTypography, typo);
    }

    // Invalid values should fail
    const invalidLayout = transformRequestSchema.safeParse({
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      outputMode: 'narration',
      hookLayout: 'non-existent-layout',
    });
    assert.equal(invalidLayout.success, false);

    const invalidAnim = transformRequestSchema.safeParse({
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      outputMode: 'narration',
      hookAnimation: 'non-existent-animation',
    });
    assert.equal(invalidAnim.success, false);

    const invalidTypo = transformRequestSchema.safeParse({
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      outputMode: 'narration',
      hookTypography: 'non-existent-typography',
    });
    assert.equal(invalidTypo.success, false);
  });

  await suite.test('Font Resolution: all 7 typography variants resolve to valid font families', async () => {
    const { getPresetFont } = await import('../compositions/studio/src/design.js');
    const fonts = [
      'montserrat',
      'anton',
      'bebas-neue',
      'archivo-black',
      'poppins',
      'oswald',
      'barlow-condensed',
    ];
    for (const f of fonts) {
      const family = getPresetFont(undefined, f);
      assert.ok(family && typeof family === 'string', `Expected valid font family for "${f}", got ${family}`);
    }
  });

  await suite.test('Variable Font Outline: Montserrat avoids -webkit-text-stroke raw contour artifacts', async () => {
    const { getTextOutlineStyle } = await import('../compositions/studio/src/headline-renderers/highlightUtil.js');
    const montserratStyle = getTextOutlineStyle('Montserrat', 6, '#000000');
    assert.equal(montserratStyle.WebkitTextStroke, '0px transparent');
    assert.ok(typeof montserratStyle.textShadow === 'string' && montserratStyle.textShadow.length > 0);

    const antonStyle = getTextOutlineStyle('Anton', 6, '#000000');
    assert.equal(antonStyle.WebkitTextStroke, '6px #000000');
  });
});

