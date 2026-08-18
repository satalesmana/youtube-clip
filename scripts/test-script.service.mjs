/**
 * Smoke test for Sprint B — Script Engine.
 * Uses the real container wiring, the real transcript, and the angle result
 * persisted by test-angle.service.mjs (metadata/angles.json).
 *
 * Run: npx tsx scripts/test-script.service.mjs
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
  const [transcript, clips, angles] = await Promise.all([
    readFile(resolve(outputsRoot, 'transcripts', 'QyW1rOk-qqI.json'), 'utf8').then(JSON.parse),
    readFile(resolve(outputsRoot, 'metadata', 'clips.json'), 'utf8').then(JSON.parse),
    readFile(resolve(outputsRoot, 'metadata', 'angles.json'), 'utf8').then(JSON.parse),
  ]);

  const candidate = Array.isArray(clips) ? clips[0] : clips.clips?.[0];
  const selected = angles.angles.find((a) => a.id === angles.selectedAngleId) ?? angles.angles[0];
  const segments = transcript.segments.filter((s) => s.text?.trim());
  const { start, end } = candidate;

  const momentSegments = segments.filter((s) => s.start >= start && s.end <= end);

  console.log(`candidate: ${candidate.title} (${start}s - ${end}s)`);
  console.log(`angle: [${selected.id}] ${selected.title} (${selected.angleType})`);
  console.log(`momentSegments: ${momentSegments.length}`);

  const script = await container.scriptService.generateScript({
    candidateId: `candidate_${candidate.id}`,
    angleId: selected.id,
    angleTitle: selected.title,
    angleHook: selected.hook,
    angleReason: selected.reason,
    angleType: selected.angleType,
    momentSegments,
    candidateTitle: candidate.title,
    candidateHook: candidate.hook,
    sourceTitle: 'Veda Ega Pratama MotoGP Silverstone 2025',
    sourceChannel: 'MotoGP Indonesia',
    sourceLanguage: 'id',
    targetLanguage: 'id',
  });

  console.log('\n=== SCRIPT ===');
  for (const section of script.sections) {
    console.log(`\n[${section.type}]`);
    console.log(section.text);
    if (section.sourceQuote) console.log(`  (quote: "${section.sourceQuote}")`);
  }
  console.log(`\nlanguage: ${script.language}`);
  console.log(`estimatedDurationSeconds: ${script.estimatedDurationSeconds}`);
  console.log(`originality: ${script.originality.status} — ${script.originality.notes.join('; ')}`);

  // Assertions
  const types = script.sections.map((s) => s.type);
  assert(types.includes('hook') && types.includes('conclusion'), 'has hook and conclusion');
  assert(
    ['commentary', 'analysis'].every((t) => types.includes(t)),
    'has commentary and analysis',
  );
  assert(script.estimatedDurationSeconds >= 15, `duration >= 15s (got ${script.estimatedDurationSeconds})`);
  assert(script.originality.status === 'PASS' || script.originality.status === 'WARNING', 'originality PASS/WARNING');
  assert(script.sections.every((s) => s.text.trim().length > 0), 'every section has text');

  // Persist for inspection.
  const { writeFile } = await import('node:fs/promises');
  await writeFile(
    resolve(outputsRoot, 'metadata', 'script.json'),
    JSON.stringify(script, null, 2),
  );
  console.log('\nSaved to outputs/QyW1rOk-qqI/metadata/script.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
