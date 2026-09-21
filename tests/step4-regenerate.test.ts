import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Step 4 Remotion Video Regenerate Trigger Suite', async (t) => {
  const root = process.cwd();
  const step4Path = resolve(root, 'client/src/components/studio/step4/Step4Output.tsx');
  const studioViewPath = resolve(root, 'client/src/components/studio/StudioView.tsx');

  const step4Source = readFileSync(step4Path, 'utf-8');
  const studioViewSource = readFileSync(studioViewPath, 'utf-8');

  await t.test('1. Step4Output defines required regenerate and progress props', () => {
    assert.match(step4Source, /runningTransform\?: boolean/, 'Step4OutputProps must declare runningTransform');
    assert.match(step4Source, /progressPct\?: number/, 'Step4OutputProps must declare progressPct');
    assert.match(step4Source, /progressLabel\?: string/, 'Step4OutputProps must declare progressLabel');
    assert.match(step4Source, /onRegenerateVideo\?: \(\) => void/, 'Step4OutputProps must declare onRegenerateVideo');
  });

  await t.test('2. Step4Output renders Remotion regenerate button with testing helper', () => {
    assert.match(step4Source, /Render Ulang Video \(Remotion\)/, 'Must display friendly button text for Remotion re-render');
    assert.match(step4Source, /Sedang Merender Ulang\.\.\./, 'Must display loading state when runningTransform is active');
    assert.match(step4Source, /Mode Pengujian Remotion/, 'Must provide clear guidance for developers testing Remotion render changes');
    assert.match(step4Source, /Caption\.tsx/, 'Helper note must reference Remotion components like Caption.tsx');
  });

  await t.test('3. Step4Output supports instant retry on render failure', () => {
    assert.match(step4Source, /Coba Render Ulang/, 'Must offer immediate retry action inside transformError banner');
  });

  await t.test('4. Step4Output allows navigating back to Step 3', () => {
    assert.match(step4Source, /Ubah Gaya di Langkah 3/, 'Must provide navigation back to Step 3 without repeating whole flow');
    assert.match(step4Source, /setStep\(3\)/, 'Must call setStep(3)');
  });

  await t.test('5. Step4Output re-keys video element for cache-busting', () => {
    assert.match(step4Source, /key=\{videoSrc\}/, 'Video element must use videoSrc key to ensure clean player remount');
  });

  await t.test('6. StudioView forwards transform state and onRegenerateVideo handler to Step4Output', () => {
    assert.match(studioViewSource, /<Step4Output[\s\S]*?runningTransform=\{runningTransform\}/, 'StudioView must pass runningTransform');
    assert.match(studioViewSource, /<Step4Output[\s\S]*?progressPct=\{progressPct\}/, 'StudioView must pass progressPct');
    assert.match(studioViewSource, /<Step4Output[\s\S]*?progressLabel=\{progressLabel\}/, 'StudioView must pass progressLabel');
    assert.match(studioViewSource, /<Step4Output[\s\S]*?onRegenerateVideo=\{[\s\S]*?startTransform\(\)/, 'StudioView must pass onRegenerateVideo invoking startTransform');
  });
});
