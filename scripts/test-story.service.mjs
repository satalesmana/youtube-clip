/**
 * Smoke test for Sprint H — Story Service (auto concept detection).
 * Uses real transcript data from WS8Vl0vOODk.
 *
 * Run: npx tsx scripts/test-story.service.mjs
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { container } from '../src/container/index.js';

const outputsRoot = resolve(process.cwd(), 'outputs', 'WS8Vl0vOODk');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const transcript = JSON.parse(
    await readFile(resolve(outputsRoot, 'transcripts', 'WS8Vl0vOODk.json'), 'utf8'),
  );

  const segments = transcript.segments.filter((s) => s.text?.trim());
  console.log(`Transcript segments: ${segments.length}`);
  console.log(`Language: ${transcript.language}`);
  console.log(`Source URL: ${transcript.sourceUrl}`);

  if (segments.length === 0) {
    console.error('FAIL: No segments in transcript');
    process.exit(1);
  }

  console.log('\n=== Testing Story Service ===');
  const story = await container.storyService.buildStory(segments);

  console.log(`\n✓ Concept: ${story.concept}`);
  console.log(`✓ Protagonist: ${story.protagonist}`);
  console.log(`✓ Premise: ${story.premise}`);
  console.log(`✓ Beats: ${story.beats.length}`);

  console.log('\n=== BEATS DETAIL ===');
  for (const beat of story.beats) {
    console.log(`\n[${beat.id}] ${beat.type} (${beat.start.toFixed(2)}s - ${beat.end.toFixed(2)}s)`);
    console.log(`  Purpose: ${beat.purpose}`);
    console.log(`  Evidence: ${beat.evidence.map((e) => `"${e.substring(0, 50)}${e.length > 50 ? '...' : ''}"`).join(', ')}`);
    if (beat.kondisiAwal) console.log(`  Kondisi Awal: ${beat.kondisiAwal}`);
    if (beat.konflik) console.log(`  Konflik: ${beat.konflik}`);
    if (beat.titikBalik) console.log(`  Titik Balik: ${beat.titikBalik}`);
    if (beat.hasil) console.log(`  Hasil: ${beat.hasil}`);
  }

  // Assertions
  assert(typeof story.concept === 'string', 'concept is a string');
  assert(
    ['character-journey', 'comeback', 'turning-point', 'claim-consequence', 'discovery-explainer'].includes(story.concept),
    `concept is valid: ${story.concept}`,
  );
  assert(typeof story.protagonist === 'string' && story.protagonist.length > 0, 'protagonist is non-empty');
  assert(typeof story.premise === 'string' && story.premise.length > 0, 'premise is non-empty');
  assert(story.beats.length >= 4, `at least 4 beats (got ${story.beats.length})`);
  assert(story.beats.length <= 7, `at most 7 beats (got ${story.beats.length})`);

  // Validate chronological order and no overlap
  let prevEnd = -1;
  for (const beat of story.beats) {
    assert(beat.end > beat.start, `beat ${beat.id} has end > start`);
    assert(beat.start >= prevEnd, `beat ${beat.id} is chronologically ordered`);
    prevEnd = beat.end;
    assert(Array.isArray(beat.evidence) && beat.evidence.length >= 1, `beat ${beat.id} has evidence`);
  }

  // Validate narrative fields are strings when present
  for (const beat of story.beats) {
    if (beat.kondisiAwal !== undefined) assert(typeof beat.kondisiAwal === 'string', `beat ${beat.id}.kondisiAwal is string`);
    if (beat.konflik !== undefined) assert(typeof beat.konflik === 'string', `beat ${beat.id}.konflik is string`);
    if (beat.titikBalik !== undefined) assert(typeof beat.titikBalik === 'string', `beat ${beat.id}.titikBalik is string`);
    if (beat.hasil !== undefined) assert(typeof beat.hasil === 'string', `beat ${beat.id}.hasil is string`);
  }

  console.log('\n✅ All story service assertions passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
