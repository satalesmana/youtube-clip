import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { searchCuratedCatalog, CURATED_STOCK_CATALOG } from '../src/providers/broll/stock-catalog.js';
import { CuratedStockBrollProvider, SmartBrollProvider } from '../src/providers/broll/broll.provider.js';
import { BrollService } from '../src/services/b-roll.service.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';
import type { IAiProvider } from '../src/providers/ai.provider.js';
import type { Logger } from '../src/utils/logger.js';

const mockLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => mockLogger,
} as unknown as Logger;

const mockAiProvider: IAiProvider = {
  chat: async () => '{"cues": [{"start": 2, "end": 6, "query": "technology computer code", "mood": "focused"}]}',
} as unknown as IAiProvider;

test('B-Roll Pipeline & Visual UI Suite', async (t) => {
  const root = process.cwd();

  await t.test('1. Curated Stock Catalog provides royalty-free clips across themes', () => {
    assert.ok(CURATED_STOCK_CATALOG.length >= 6, 'Must provide diverse stock catalog clips');
    for (const item of CURATED_STOCK_CATALOG) {
      assert.ok(item.id, 'Each stock item must have an id');
      assert.ok(item.downloadUrl.endsWith('.mp4'), 'Each stock item must be an MP4 video');
      assert.ok(item.previewUrl, 'Each stock item must have a preview image');
      assert.ok(item.durationSeconds > 0, 'Each stock item must have durationSeconds > 0');
    }

    const techResults = searchCuratedCatalog('tech software developer coding', 4);
    assert.ok(techResults.length > 0, 'Must match tech keywords');
    assert.match(techResults[0].id, /tech|office/, 'Primary match should be tech or office related');

    const financeResults = searchCuratedCatalog('investing stock market bitcoin chart', 4);
    assert.ok(financeResults.length > 0, 'Must match finance keywords');
    assert.match(financeResults[0].id, /finance|tech/, 'Primary match should be finance related');
  });

  await t.test('2. CuratedStockBrollProvider and SmartBrollProvider resolve footage gracefully', async () => {
    const curatedProvider = new CuratedStockBrollProvider();
    const assets = await curatedProvider.searchFootage('robot artificial intelligence', { maxResults: 3 });
    assert.ok(assets.length > 0, 'CuratedStockBrollProvider must return assets');
    assert.equal(assets[0].source, 'local', 'Curated stock provider sources should be marked local or curated');

    // SmartBrollProvider without Pexels API key must automatically use curated catalog
    const smartProvider = new SmartBrollProvider({ logger: mockLogger });
    const smartAssets = await smartProvider.searchFootage('city skyline modern', { maxResults: 2 });
    assert.ok(smartAssets.length > 0, 'SmartBrollProvider must fall back to curated stock');
  });

  await t.test('3. BrollService extracts cues and resolves placements with candidates', async () => {
    const smartProvider = new SmartBrollProvider({ logger: mockLogger });
    const brollService = new BrollService(mockAiProvider, smartProvider, { model: 'gpt-4o-mini' }, mockLogger);

    const cues = await brollService.extractCues('Kecerdasan buatan sekarang mengubah dunia pemrograman', 0, 15);
    assert.equal(cues.length, 1, 'Should extract 1 cue from mock AI');
    assert.equal(cues[0].query, 'technology computer code');

    const placements = await brollService.resolvePlacements(cues, resolve(root, 'temp/test-broll'));
    assert.equal(placements.length, 1, 'Should resolve placement for the cue');
    assert.ok(placements[0].asset, 'Placement must contain resolved asset');
    assert.ok(placements[0].candidates && placements[0].candidates.length > 0, 'Placement must include alternative candidate assets');
  });

  await t.test('4. TransformRequestSchema validates brollPlacements array', () => {
    const validPayload = {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      enableBroll: true,
      brollPlacements: [
        {
          cue: { start: 2.5, end: 6.0, query: 'bitcoin chart' },
          asset: {
            id: 'broll-finance-1',
            source: 'pexels' as const,
            downloadUrl: 'https://example.com/broll.mp4',
            previewUrl: 'https://example.com/thumb.jpg',
            durationSeconds: 5,
          },
          enabled: true,
        },
      ],
    };

    const parsed = transformRequestSchema.safeParse(validPayload);
    assert.ok(parsed.success, 'Valid brollPlacements must pass schema validation');
    if (parsed.success) {
      assert.equal(parsed.data.brollPlacements?.length, 1);
      assert.equal(parsed.data.brollPlacements?.[0].asset.id, 'broll-finance-1');
    }
  });

  await t.test('5. Frontend BrollInspectorPanel exists and provides full interactive controls', () => {
    const panelPath = resolve(root, 'client/src/components/studio/step3/BrollInspectorPanel.tsx');
    assert.ok(existsSync(panelPath), 'BrollInspectorPanel.tsx must exist');

    const source = readFileSync(panelPath, 'utf-8');
    assert.match(source, /Visual B-Roll Cutaway Inspector/, 'Must render clear inspector title');
    assert.match(source, /onTogglePlacement/, 'Must support toggling placements on and off');
    assert.match(source, /onOpenReplace/, 'Must support opening replace footage modal');
    assert.match(source, /api\.searchBrollFootage/, 'Must support searching stock footage via API');
    assert.match(source, /setShowAddModal/, 'Must support manual B-roll addition');
    assert.match(source, /setPreviewAsset/, 'Must support full video preview modal');
  });

  await t.test('6. Step3Styling mounts BrollInspectorPanel and updates render summary', () => {
    const step3Path = resolve(root, 'client/src/components/studio/step3/Step3Styling.tsx');
    const source = readFileSync(step3Path, 'utf-8');

    assert.match(source, /<BrollInspectorPanel/, 'Step3Styling must render BrollInspectorPanel');
    assert.match(source, /Footage B-Roll/, 'Summary card must include Footage B-Roll item');
    assert.match(source, /Klip Aktif/, 'Summary card must show active clips count');
  });

  await t.test('7. Remotion AIShort composition layers B-roll sequence below subtitles and hook badge', () => {
    const aiShortPath = resolve(root, 'compositions/studio/src/AIShort.tsx');
    const source = readFileSync(aiShortPath, 'utf-8');

    assert.match(source, /plan\.brolls\?\.map/, 'AIShort must iterate over plan.brolls');
    assert.match(source, /<Video[\s\S]*?src=\{assetSrc\}/, 'AIShort must render B-roll Video');
    assert.match(source, /<Caption[\s\S]*?caption=\{caption\}/, 'Captions must be rendered');

    // Verify ordering: B-rolls rendered BEFORE captions
    const brollIdx = source.indexOf('plan.brolls');
    const captionIdx = source.indexOf('<Caption');
    assert.ok(brollIdx !== -1 && captionIdx !== -1, 'Both brolls and Caption must be present');
    assert.ok(brollIdx < captionIdx, 'B-roll cutaway layer must be rendered below captions so subtitles stay on top');
  });
});
