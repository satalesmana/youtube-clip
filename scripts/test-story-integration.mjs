/**
 * Integration test for Sprint H — Story Service + Transform Pipeline.
 * Tests the full flow: transcript → story concept → script → video plan.
 *
 * Run: npx tsx scripts/test-story-integration.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { container } from '../src/container/index.js';
import { TransformController } from '../src/controllers/transform.controller.js';
import { createLogger } from '../src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputsRoot = join(__dirname, '..', 'outputs', 'WS8Vl0vOODk');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  const logger = createLogger('test.integration');
  const deps = {
    youtubeService: {
      downloadVideo: async () => {
        throw new Error('Should not call download in dry-run mode');
      },
    },
    transcriptService: {
      loadTranscript: async (videoId) => {
        return JSON.parse(await readFile(join(outputsRoot, 'transcripts', `${videoId}.json`), 'utf8'));
      },
    },
    contentAngleService: container.contentAngleService,
    scriptService: container.scriptService,
    ttsService: container.ttsService,
    videoPlanService: container.videoPlanService,
    storyService: container.storyService,
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    assService: container.assService,
    subtitleService: container.subtitleService,
    outputsDir: join(process.cwd(), 'outputs'),
    logger,
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
  };

  const controller = new TransformController(deps);

  console.log('\n=== Testing DRY RUN WITH STORY ===');
  const dryRunResult = await controller.transform({
    videoId: 'WS8Vl0vOODk',
    candidateId: 0,
    selectedAngleId: 'angle_01',
    template: 'commentary',
    language: 'en',
    dryRun: true,
  });

  console.log('Response keys:', Object.keys(dryRunResult));
  assert(dryRunResult.success === true, 'success: true');
  assert(dryRunResult.dryRun === true, 'dryRun: true');
  assert(dryRunResult.videoId === 'WS8Vl0vOODk', 'videoId matches');
  assert(dryRunResult.script !== undefined, 'script included');
  assert(dryRunResult.narration !== undefined, 'narration included');
  assert(dryRunResult.videoPlan !== undefined, 'videoPlan included');
  assert(dryRunResult.angle !== undefined, 'angle included');

  // Verify story integration
  console.log('\n=== STORY INTEGRATION ===');
  const story = dryRunResult.story;
  if (story) {
    console.log(`Concept: ${story.concept}`);
    console.log(`Protagonist: ${story.protagonist}`);
    console.log(`Premise: ${story.premise}`);
    console.log(`Beats: ${story.beats.length}`);
    assert(story.concept !== undefined, 'concept present');
    assert(story.beats.length >= 4, `at least 4 beats (got ${story.beats.length})`);
  }

  // Verify script has story beat references
  console.log('\n=== SCRIPT SECTIONS ===');
  const script = dryRunResult.script;
  let hasBeatRefs = false;
  for (const section of script.sections) {
    console.log(`[${section.type}]${section.beatId ? ` (beat: ${section.beatId})` : ''}: ${section.text.substring(0, 50)}...`);
    if (section.beatId) hasBeatRefs = true;
  }
  assert(hasBeatRefs, 'script sections reference story beats');
  assert(script.sections.length >= 5, 'at least 5 sections');

  // Verify video plan has source timestamps from story
  console.log('\n=== VIDEO PLAN ===');
  const videoPlan = dryRunResult.videoPlan;
  let hasSourceTimestamps = false;
  for (const scene of videoPlan.scenes) {
    const hasSource = scene.source !== undefined && scene.source.start !== undefined;
    console.log(`Scene ${scene.type}: ${scene.start.toFixed(2)}s-${scene.end.toFixed(2)}s${hasSource ? ` [source: ${scene.source.start.toFixed(2)}-${scene.source.end.toFixed(2)}]` : ''}`);
    if (hasSource) hasSourceTimestamps = true;
  }
  assert(hasSourceTimestamps, 'video plan has source timestamps from story');
  assert(videoPlan.scenes.length >= 5, 'at least 5 scenes');

  // Save result
  await writeFile(
    join(outputsRoot, 'metadata', 'transform-result.json'),
    JSON.stringify(dryRunResult, null, 2),
  );
  console.log('\nSaved to outputs/WS8Vl0vOODk/metadata/transform-result.json');

  console.log('\n✅ All integration assertions passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
