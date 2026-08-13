import { join } from 'node:path';
import { container } from '../src/container/index.js';
import { createCompositionEngine } from '../src/composition/engine.factory.js';

const outputsRoot = join(process.cwd(), 'outputs', 'QyW1rOk-qqI');
const compositionsRoot = join(process.cwd(), 'compositions', 'studio');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${message}`);
  }
}

async function main() {
  // Test 1: FFmpeg template engine
  console.log('\n=== Test 1: FFmpeg Template Engine ===');
  const ffmpegEngine = createCompositionEngine({
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    outputsDir: outputsRoot,
    compositionsDir: compositionsRoot,
    engine: 'ffmpeg-template',
  });
  assert(ffmpegEngine.kind === 'ffmpeg-template', 'FFmpeg engine created');
  console.log('Engine kind:', ffmpegEngine.kind);

  // Test 2: Remotion engine
  console.log('\n=== Test 2: Remotion Engine ===');
  const remotionEngine = createCompositionEngine({
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    outputsDir: outputsRoot,
    compositionsDir: compositionsRoot,
    engine: 'remotion',
  });
  assert(remotionEngine.kind === 'remotion', 'Remotion engine created');
  console.log('Engine kind:', remotionEngine.kind);

  console.log('\n=== Sprint G Test Complete ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
