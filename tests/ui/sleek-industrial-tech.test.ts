import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('Modern Creator Suite UI Architecture Verification', async (t) => {
  const root = process.cwd();

  await t.test('Task 1: Comfortable Dark Mode & Design Tokens', () => {
    const cssPath = resolve(root, 'client/src/styles/index.css');
    assert.ok(existsSync(cssPath), 'client/src/styles/index.css must exist');

    const css = readFileSync(cssPath, 'utf-8');
    assert.match(css, /#1B262C/, 'Deep Slate Navy (#1B262C) must be used in palette');
    assert.match(css, /--border-dim:\s*#0F4C75/, 'Border dim must be Deep Ocean Blue (#0F4C75)');
    assert.match(css, /--accent:\s*#3282B8/, 'Primary accent must be Steel Sky Blue (#3282B8)');
    assert.match(css, /--ice:\s*#BBE1FA/, 'Ice Blue accent must be #BBE1FA');
    assert.match(css, /--radius-lg:\s*14px/, 'Card radius must be 14px for comfort');
    assert.match(css, /Inter/, 'Primary font must be Inter');
  });

  await t.test('Task 2: Welcoming Home View & Human Copywriting', () => {
    const homeViewPath = resolve(root, 'client/src/components/home/HomeView.tsx');
    assert.ok(existsSync(homeViewPath), 'HomeView.tsx must exist');

    const homeView = readFileSync(homeViewPath, 'utf-8');
    assert.match(homeView, /Ubah Video Panjang Jadi Shorts Viral dalam 60 Detik/, 'Hero title must be natural and welcoming');
    assert.match(homeView, /Potong Jadi Shorts/, 'CTA must have friendly copywriting');
    assert.match(homeView, /asymmetric-grid/, 'Asymmetric grid class must be used');
    assert.doesNotMatch(homeView, /\[ POTONG VIDEO/, 'Harsh bracket syntax must be removed from CTA');
  });

  await t.test('Task 3: Professional Thumbnail Previews & Mockups', () => {
    const homeView = readFileSync(resolve(root, 'client/src/components/home/HomeView.tsx'), 'utf-8');
    assert.match(homeView, /mockup-viewfinder/, 'Viewfinder 9:16 mockup must exist');
    assert.match(homeView, /mockup-waveform/, 'Audio waveform amplitude mockup must exist');
    assert.match(homeView, /mockup-timeline/, 'Multi-track timeline mockup must exist');

    const historyView = readFileSync(resolve(root, 'client/src/components/history/HistoryView.tsx'), 'utf-8');
    assert.match(historyView, /Daftar Proyek &amp; Arsip Video/, 'HistoryView must have welcoming title');
  });

  await t.test('Task 4: Ergonomic Stepper & Studio Workflow', () => {
    const studioView = readFileSync(resolve(root, 'client/src/components/studio/StudioView.tsx'), 'utf-8');
    assert.match(studioView, /wizard-stepper/, 'Wizard stepper must exist');
    assert.match(studioView, /1\. Masukkan Video/i, 'Step 1 friendly title');
    assert.match(studioView, /Unduh &amp; Siapkan Video/, 'Download button must exist in Step 1');
    assert.match(studioView, /config-locked-container/, 'Locked configuration container must exist');
    assert.match(studioView, /2\. Rekomendasi Klip/i, 'Step 2 friendly title');
    assert.match(studioView, /3\. Desain Subtitle/i, 'Step 3 friendly title');
    assert.match(studioView, /4\. Video Berhasil Dirender/i, 'Step 4 friendly title');
    assert.doesNotMatch(studioView, /\[01 INGEST\]/, 'Harsh terminal brackets must be removed');
  });

  await t.test('Task 5: Clean Navigation & Topbar Indicators', () => {
    const topbar = readFileSync(resolve(root, 'client/src/components/layout/Topbar.tsx'), 'utf-8');
    assert.match(topbar, /Sistem Siap/, 'Friendly system online status must exist');
    assert.match(topbar, /topbar-breadcrumb/, 'Clean topbar breadcrumb must exist');

    const sidebar = readFileSync(resolve(root, 'client/src/components/layout/Sidebar.tsx'), 'utf-8');
    assert.match(sidebar, /Viral Clip/, 'Brand name must be Viral Clip Studio');
    assert.doesNotMatch(sidebar, /\/\/ STUDIO PIPELINE/, 'Terminal slashes must be removed');
  });

  await t.test('Backend Nitro Integration Endpoints', async () => {
    assert.ok(existsSync(resolve(root, 'server/api/health.get.ts')), 'Health endpoint file must exist');
    assert.ok(existsSync(resolve(root, 'server/api/video/download.post.ts')), 'Video download endpoint must exist');
    assert.ok(existsSync(resolve(root, 'server/api/clips/recommend.post.ts')), 'Clips recommend endpoint must exist');
    assert.ok(existsSync(resolve(root, 'server/api/clips/rerender.post.ts')), 'Clips rerender endpoint must exist');
    assert.ok(existsSync(resolve(root, 'server/api/hooks/generate.post.ts')), 'Hooks generate endpoint must exist');
    assert.ok(existsSync(resolve(root, 'server/api/captions/generate.post.ts')), 'Captions generate endpoint must exist');
  });

  await t.test('Task 6: Whisper STT Provider Integration & Wiring', async () => {
    const hook = readFileSync(resolve(root, 'client/src/hooks/useClipTransform.ts'), 'utf-8');
    assert.match(hook, /useState\('openai'\)/, 'whisperProvider must default to openai');
    assert.match(hook, /sttProvider:\s*whisperProvider/, 'sttProvider must be passed in useClipTransform');

    const api = readFileSync(resolve(root, 'client/src/services/api.ts'), 'utf-8');
    assert.match(api, /sttProvider:\s*payload\.sttProvider/, 'generateClips must send sttProvider in payload');
    assert.match(api, /sttProvider:\s*payload\.sttProvider\s*\|\|\s*payload\.whisperProvider/, 'runTransform must send sttProvider in payload');
  });

  await t.test('Task 7: OpusClip Style Viral Clip Card Architecture', async () => {
    const studioView = readFileSync(resolve(root, 'client/src/components/studio/StudioView.tsx'), 'utf-8');
    assert.match(studioView, /opus-clips-grid/, 'StudioView must render opus-clips-grid');
    assert.match(studioView, /opus-clip-card/, 'StudioView must render opus-clip-card');
    assert.match(studioView, /opus-clip-sticker/, 'StudioView must render central subtitle sticker');
    assert.match(studioView, /opus-clip-score-number/, 'StudioView must render big score number');
    assert.match(studioView, /opus-clip-time-badge/, 'StudioView must render duration badge');

    const css = readFileSync(resolve(root, 'client/src/styles/index.css'), 'utf-8');
    assert.match(css, /\.opus-clips-grid/, 'CSS must define .opus-clips-grid');
    assert.match(css, /\.opus-clip-sticker/, 'CSS must define .opus-clip-sticker');
    assert.match(css, /#A3E635/, 'CSS must use vibrant lime green (#A3E635) for viral score');
  });

  await t.test('Task 8: Restored Content Genre & AI Narration Mode Architecture', async () => {
    const studioView = readFileSync(resolve(root, 'client/src/components/studio/StudioView.tsx'), 'utf-8');
    assert.match(studioView, /Genre Konten \(Panduan AI\)/, 'StudioView must contain Genre Konten in Step 1B');
    assert.match(studioView, /output-mode-grid/, 'StudioView must contain output-mode-grid in Step 3');
    assert.match(studioView, /script-editor-container/, 'StudioView must contain script-editor-container when narration mode is active');
    assert.match(studioView, /tts-controls-panel/, 'StudioView must contain tts-controls-panel for voiceover configuration');

    const hook = readFileSync(resolve(root, 'client/src/hooks/useClipTransform.ts'), 'utf-8');
    assert.match(hook, /genre,\s*setGenre/, 'useClipTransform must manage genre state');
    assert.match(hook, /outputMode,\s*setOutputMode/, 'useClipTransform must manage outputMode state');
    assert.match(hook, /startDraftScript/, 'useClipTransform must expose startDraftScript');
    assert.match(hook, /startSynthesizeTts/, 'useClipTransform must expose startSynthesizeTts');

    const api = readFileSync(resolve(root, 'client/src/services/api.ts'), 'utf-8');
    assert.match(api, /draftScript\s*\(/, 'api.ts must define draftScript');
    assert.match(api, /synthesizeTts\s*\(/, 'api.ts must define synthesizeTts');

    const css = readFileSync(resolve(root, 'client/src/styles/index.css'), 'utf-8');
    assert.match(css, /\.output-mode-grid/, 'CSS must define .output-mode-grid');
    assert.match(css, /\.script-editor-container/, 'CSS must define .script-editor-container');
    assert.match(css, /\.tts-controls-panel/, 'CSS must define .tts-controls-panel');
  });
});

