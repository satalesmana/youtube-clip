/**
 * Smoke test for Sprint C — TTS Service.
 * Synthesizes the script persisted by test-script.service.mjs (metadata/script.json).
 *
 * Run: npx tsx scripts/test-tts.service.mjs
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { container } from '../src/container/index.js';

const outputsRoot = resolve(process.cwd(), 'outputs', 'QyW1rOk-qqI');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const script = JSON.parse(
    await readFile(resolve(outputsRoot, 'metadata', 'script.json'), 'utf8'),
  );

  console.log(`script: ${script.angleTitle}`);
  console.log(`sections: ${script.sections.length}`);

  const result = await container.ttsService.synthesizeScript(script, outputsRoot);

  console.log('\n=== TTS RESULT ===');
  console.log(`provider: ${result.provider}`);
  console.log(`output: ${result.outputPath}`);
  console.log(`durationSeconds: ${result.durationSeconds.toFixed(2)}`);
  console.log(`expected (estimate): ${script.estimatedDurationSeconds}s`);

  assert(result.outputPath.endsWith('narration.mp3'), 'combined narration.mp3 produced');
  assert(result.durationSeconds > 0, `duration > 0 (got ${result.durationSeconds})`);

  // Verify per-section files exist too.
  const { access } = await import('node:fs/promises');
  const sectionTypes = script.sections.map((s) => s.type);
  for (const type of sectionTypes) {
    const safeName = type.replace(/[^a-z0-9]+/gi, '-');
    await access(resolve(outputsRoot, 'voice', `narration-${safeName}.mp3`)).then(
      () => console.log(`ok: voice/narration-${safeName}.mp3 exists`),
      () => assert(false, `missing voice/narration-${safeName}.mp3`),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
