import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  OUTRO_STYLE_PRESETS,
  OUTRO_PRESET_LIST,
  resolveOutroPreset,
  type OutroPresetId,
} from '../src/types/outro-preset.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';

test('Outro CTA Style Presets Suite', async (t) => {
  const expectedPresetIds: OutroPresetId[] = [
    'creator-glass',
    'viral-neon',
    'minimal-clean',
    'comment-debate',
    'subscribe-bell',
    'link-in-bio',
  ];

  await t.test('1. Domain Registry Integrity: all 6 outro presets exist with complete visual attributes', () => {
    assert.equal(OUTRO_PRESET_LIST.length, 6, 'There must be exactly 6 presets');

    for (const id of expectedPresetIds) {
      const preset = OUTRO_STYLE_PRESETS[id];
      assert.ok(preset, `Preset ${id} must exist in OUTRO_STYLE_PRESETS`);
      assert.equal(preset.id, id);
      assert.ok(preset.name.length > 0, `${id} name must not be empty`);
      assert.ok(preset.tagline.length > 0, `${id} tagline must not be empty`);
      assert.ok(preset.icon.length > 0, `${id} icon must not be empty`);
      assert.ok(preset.badgeLabel.length > 0, `${id} badgeLabel must not be empty`);
      assert.ok(preset.defaultCtaText.length > 0, `${id} defaultCtaText must not be empty`);
      assert.ok(preset.defaultButtonText.length > 0, `${id} defaultButtonText must not be empty`);
      assert.ok(preset.primaryColor.startsWith('#'), `${id} primaryColor must be valid hex`);
      assert.ok(preset.gradient.includes('gradient'), `${id} gradient must contain gradient string`);
      assert.ok(preset.buttonGradient.includes('gradient') || preset.buttonGradient.startsWith('#'), `${id} buttonGradient must be valid`);
      assert.ok(preset.vignetteDarkness >= 0.5 && preset.vignetteDarkness <= 1, `${id} vignetteDarkness must be between 0.5 and 1`);
    }
  });

  await t.test('2. resolveOutroPreset returns matching preset or falls back to creator-glass', () => {
    assert.equal(resolveOutroPreset('viral-neon').id, 'viral-neon');
    assert.equal(resolveOutroPreset('subscribe-bell').id, 'subscribe-bell');
    assert.equal(resolveOutroPreset('non-existent-preset').id, 'creator-glass');
    assert.equal(resolveOutroPreset(undefined).id, 'creator-glass');
    assert.equal(resolveOutroPreset(null).id, 'creator-glass');
  });

  await t.test('3. transformRequestSchema validates outroPreset, ctaText, buttonText, duration, outroChannelName, outroLogoUrl, and enableIntroOutro', () => {
    const baseValid = {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    // Valid payload with complete outro options including channel name & logo
    const parsedValid = transformRequestSchema.safeParse({
      ...baseValid,
      enableIntroOutro: true,
      outroPreset: 'comment-debate',
      outroCtaText: 'Tulis pendapatmu di bawah!',
      outroButtonText: '💬 TULIS KOMENTAR',
      outroDuration: 4,
      outroChannelName: 'Aladin Studio',
      outroLogoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
    assert.ok(parsedValid.success, 'Valid outro fields must parse successfully');
    if (parsedValid.success) {
      assert.equal(parsedValid.data.enableIntroOutro, true);
      assert.equal(parsedValid.data.outroPreset, 'comment-debate');
      assert.equal(parsedValid.data.outroCtaText, 'Tulis pendapatmu di bawah!');
      assert.equal(parsedValid.data.outroButtonText, '💬 TULIS KOMENTAR');
      assert.equal(parsedValid.data.outroDuration, 4);
      assert.equal(parsedValid.data.outroChannelName, 'Aladin Studio');
      assert.ok(parsedValid.data.outroLogoUrl?.startsWith('data:image/'));
    }

    // Disallowed preset ID
    const invalidPreset = transformRequestSchema.safeParse({
      ...baseValid,
      outroPreset: 'unknown-style',
    });
    assert.equal(invalidPreset.success, false, 'Invalid outroPreset must fail schema validation');

    // Invalid duration (< 1 or > 10)
    const invalidDurationLow = transformRequestSchema.safeParse({
      ...baseValid,
      outroDuration: 0,
    });
    assert.equal(invalidDurationLow.success, false, 'outroDuration < 1 must fail validation');

    const invalidDurationHigh = transformRequestSchema.safeParse({
      ...baseValid,
      outroDuration: 15,
    });
    assert.equal(invalidDurationHigh.success, false, 'outroDuration > 10 must fail validation');
  });

  await t.test('4. Remotion AIShort & Outro source components wire outro props correctly', () => {
    const aiShortPath = resolve(process.cwd(), 'compositions/studio/src/AIShort.tsx');
    const outroPath = resolve(process.cwd(), 'compositions/studio/src/Outro.tsx');
    const outroCardShortPath = resolve(process.cwd(), 'compositions/studio/src/OutroCardShort.tsx');

    const aiShortSource = readFileSync(aiShortPath, 'utf-8');
    const outroSource = readFileSync(outroPath, 'utf-8');
    const outroCardSource = readFileSync(outroCardShortPath, 'utf-8');

    // Check AIShort
    assert.match(aiShortSource, /enableIntroOutro/, 'AIShort must accept enableIntroOutro prop');
    assert.match(aiShortSource, /outroPreset/, 'AIShort must accept outroPreset prop');
    assert.match(aiShortSource, /outroChannelName/, 'AIShort must accept outroChannelName prop');
    assert.match(aiShortSource, /isOutroActive/, 'AIShort must compute isOutroActive');
    assert.match(aiShortSource, /preset=\{outroPreset\}/, 'AIShort must pass preset to Outro');
    assert.match(aiShortSource, /channelName=\{outroChannelName \|\| channelName\}/, 'AIShort must forward custom channelName');

    // Check Outro
    assert.match(outroSource, /preset = 'creator-glass'/, 'Outro must have default preset');
    assert.match(outroSource, /viral-neon/, 'Outro must support viral-neon preset');
    assert.match(outroSource, /minimal-clean/, 'Outro must support minimal-clean preset');
    assert.match(outroSource, /comment-debate/, 'Outro must support comment-debate preset');
    assert.match(outroSource, /subscribe-bell/, 'Outro must support subscribe-bell preset');
    assert.match(outroSource, /link-in-bio/, 'Outro must support link-in-bio preset');
    assert.match(outroSource, /resolvedLogoSrc/, 'Outro must resolve logo source');

    // Check OutroCardShort
    assert.match(outroCardSource, /<Outro/, 'OutroCardShort must render Outro component');
  });

  await t.test('5. Frontend OutroCardStylingPanel provides channel name field, logo uploader, and matching preview', () => {
    const panelPath = resolve(process.cwd(), 'client/src/components/studio/step3/OutroCardStylingPanel.tsx');
    const step3Path = resolve(process.cwd(), 'client/src/components/studio/step3/Step3Styling.tsx');
    const presetsPath = resolve(process.cwd(), 'client/src/lib/outro-presets.ts');

    const panelSource = readFileSync(panelPath, 'utf-8');
    const step3Source = readFileSync(step3Path, 'utf-8');
    const presetsSource = readFileSync(presetsPath, 'utf-8');

    assert.match(presetsSource, /CLIENT_OUTRO_PRESETS/, 'Must define CLIENT_OUTRO_PRESETS array');
    assert.match(panelSource, /Nama Channel \/ Handle/, 'OutroCardStylingPanel must have channel name field');
    assert.match(panelSource, /Logo \/ Avatar Channel/, 'OutroCardStylingPanel must have logo/avatar upload section');
    assert.match(panelSource, /FileReader/, 'OutroCardStylingPanel must use FileReader to read logo data URL');
    assert.match(panelSource, /Live Visual Preview \(WYSIWYG\)/, 'OutroCardStylingPanel must have Live Visual Preview');
    assert.match(panelSource, /Pilih Gaya Desain/, 'OutroCardStylingPanel must have preset selector');
    assert.match(step3Source, /<OutroCardStylingPanel/, 'Step3Styling must mount OutroCardStylingPanel');
    assert.match(step3Source, /Kartu Outro CTA/, 'Step3Styling summary must display Kartu Outro CTA');
  });

  await t.test('6. Remotion Engine stages data-URL creator logos and resolves media paths', () => {
    const enginePath = resolve(process.cwd(), 'src/composition/remotion.engine.ts');
    const engineSource = readFileSync(enginePath, 'utf-8');

    assert.match(engineSource, /assets\.creatorLogo/, 'Engine must check assets.creatorLogo');
    assert.match(engineSource, /data:image\//, 'Engine must handle base64 data URLs');
    assert.match(engineSource, /Buffer\.from\(base64Data, 'base64'\)/, 'Engine must write base64 buffer to disk');
    assert.match(engineSource, /creatorLogoUrl/, 'Engine must write creatorLogoUrl to props');
  });

  await t.test('7. WYSIWYG Parity: Outro.tsx locks signature preset colors and Remotion engine forwards outroChannelName', () => {
    const outroPath = resolve(process.cwd(), 'compositions/studio/src/Outro.tsx');
    const enginePath = resolve(process.cwd(), 'src/composition/remotion.engine.ts');
    const hookPath = resolve(process.cwd(), 'client/src/hooks/useClipTransform.ts');

    const outroSource = readFileSync(outroPath, 'utf-8');
    const engineSource = readFileSync(enginePath, 'utf-8');
    const hookSource = readFileSync(hookPath, 'utf-8');

    // Outro.tsx creator-glass must use signature cyan #00F2FE and match preview default CTA
    assert.match(outroSource, /cardBorderTop:\s*'3\.5px solid #00F2FE'/, 'creator-glass must use fixed cyan top border');
    assert.match(outroSource, /#00F2FE 0%,\s*#4FACFE 100%/, 'creator-glass button must use cyan-blue gradient');
    assert.match(outroSource, /defaultCta:\s*'Suka konten ini\? Ikuti untuk update harian!'/, 'creator-glass default CTA must match preview');

    // Remotion Engine must write outroChannelName
    assert.match(engineSource, /outroChannelName:\s*assets\.outroChannelName\s*\|\|\s*assets\.channelName/, 'Engine must forward outroChannelName in props.json');

    // Frontend hook must compute effective outro options
    assert.match(hookSource, /effectiveOutroPreset\s*=\s*resolveClientOutroPreset\(outroPreset\)/, 'Hook must resolve effective outro preset');
    assert.match(hookSource, /effectiveChannelName\s*=/, 'Hook must resolve effective channel name');
  });
});

