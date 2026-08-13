/**
 * Smoke test for Sprint A — Content Angle Generator.
 * Uses the real container wiring and a real transcript that already exists
 * under outputs/QyW1rOk-qqI/ (MotoGP Indonesia video).
 *
 * Run: node scripts/test-angle.service.mjs
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
  const [transcript, clips] = await Promise.all([
    readFile(resolve(outputsRoot, 'transcripts', 'QyW1rOk-qqI.json'), 'utf8').then(JSON.parse),
    readFile(resolve(outputsRoot, 'metadata', 'clips.json'), 'utf8').then(JSON.parse),
  ]);

  const candidate = Array.isArray(clips) ? clips[0] : clips.clips?.[0]; // clip #1: "Bos Honda Sampai Menggendong Veda Ega Pratama"
  const segments = transcript.segments.filter((s) => s.text?.trim());
  const { start, end } = candidate;

  // Moment = the candidate's own range; context = ~60s before + ~30s after.
  const momentSegments = segments.filter((s) => s.start >= start && s.end <= end);
  const contextSegments = segments.filter(
    (s) => (s.start >= start - 60 && s.end < start) || (s.start > end && s.start <= end + 30),
  );

  console.log(`candidate: ${candidate.title} (${start}s - ${end}s)`);
  console.log(`momentSegments: ${momentSegments.length}, contextSegments: ${contextSegments.length}`);

  const result = await container.contentAngleService.generateAngles({
    candidateId: `candidate_${candidate.id}`,
    momentSegments,
    contextSegments,
    candidateTitle: candidate.title,
    candidateHook: candidate.hook,
    candidateReason: candidate.reason,
    clipStart: start,
    clipEnd: end,
    sourceTitle: 'Veda Ega Pratama MotoGP Silverstone 2025',
    sourceChannel: 'MotoGP Indonesia',
    sourceLanguage: 'id',
  });

  console.log('\n=== ANGLES ===');
  for (const angle of result.angles) {
    console.log(
      `[${angle.id}] (${angle.angleType}, score ${angle.score}) ${angle.title}\n  hook: ${angle.hook}\n  reason: ${angle.reason}`,
    );
  }
  console.log(`\nselectedAngleId: ${result.selectedAngleId}`);

  assert(result.angles.length >= 3, `at least 3 angles (got ${result.angles.length})`);
  assert(
    result.angles.some((a) => a.id === result.selectedAngleId),
    'selectedAngleId exists in angles',
  );
  assert(
    result.angles.every((a) => a.hook.length > 0 && a.title.length > 0 && a.reason.length > 0),
    'every angle has hook/title/reason',
  );

  // Persist for inspection.
  const { writeFile } = await import('node:fs/promises');
  await writeFile(
    resolve(outputsRoot, 'metadata', 'angles.json'),
    JSON.stringify(result, null, 2),
  );
  console.log('\nSaved to outputs/QyW1rOk-qqI/metadata/angles.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
