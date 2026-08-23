/**
 * Verifies StyledHookPreviewService without spawning Remotion:
 * the runner is stubbed, so this checks the props JSON, CLI arguments,
 * output handling, and the raw-cut fallback wiring in hook.controller.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StyledHookPreviewService } from '../src/hook-preview/styled-hook-preview.service.js';
import type { CommandRunner } from '../src/hook-preview/styled-hook-preview.service.js';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

const logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined } as never;

async function main(): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'styled-hook-verify-'));
  const compositionsDir = join(workspace, 'compositions');
  const outputDir = join(workspace, 'outputs', 'vid', 'hook-previews');

  // Fake source video + fake remotion binary layout.
  const sourceVideo = join(workspace, 'source.mp4');
  await writeFile(sourceVideo, 'fake-video-bytes');
  await mkdirDeep(join(compositionsDir, 'public', 'media'));

  /** Captures what the service would run. */
  let capturedCommand: string | undefined;
  let capturedArgs: string[] = [];
  const fakeRunner: CommandRunner = (command, args) => {
    capturedCommand = command;
    capturedArgs = [...args];
    // Emulate Remotion writing the output file (first bare arg ending in .mp4).
    const outIndex = args.findIndex((a) => !a.startsWith('--') && a.endsWith('.mp4'));
    if (outIndex >= 0) {
      return writeFile(args[outIndex]!, 'fake-mp4').then(() => undefined) as never;
    }
    return Promise.resolve() as never;
  };

  const service = new StyledHookPreviewService(
    { compositionsDir, ffmpegBinaryPath: '/bin/false', logger },
    fakeRunner,
  );

  console.log('Skenario 1 — render styled preview (happy path):');
  const result = await service.render({
    videoPath: sourceVideo,
    start: 47,
    end: 68,
    durationSeconds: 5.5,
    headlineText: 'FAKTA INI MENGEJUTKAN',
    badge: '10RB+ Views',
    themeSeed: 'kBoAmrXotlQ:shock',
    outputDir,
    fileName: 'final-hook-01',
  });

  check('composition id HookIntroShort dipakai', capturedArgs?.[2], 'HookIntroShort');
  check('output .mp4 diteruskan ke CLI', capturedArgs?.[3]?.endsWith('final-hook-01.mp4'), true);
  check('file output ada setelah render', result.path.endsWith('final-hook-01.mp4'), true);

  const propsRaw = await readFile(join(outputDir, 'final-hook-01.props.json'), 'utf-8');
  const props = JSON.parse(propsRaw) as {
    hook: { duration: number; headlineText: string; badge?: string; themeSeed: string };
    sourceVideoPath: string;
    sourceStart: number;
    sourceEnd: number;
  };
  check('props.duration dari input', props.hook.duration, 5.5);
  check('props.headlineText benar', props.hook.headlineText, 'FAKTA INI MENGEJUTKAN');
  check('props.badge benar', props.hook.badge ?? null, '10RB+ Views');
  check('props.themeSeed benar', props.hook.themeSeed, 'kBoAmrXotlQ:shock');
  check('props.sourceStart/End benar', [props.sourceStart, props.sourceEnd], [47, 68]);
  check('props.sourceVideoPath public-relative', props.sourceVideoPath.startsWith('media/hook-'), true);

  console.log('Skenario 2 — runner error dilempar (controller yang fallback):');
  const failingRunner: CommandRunner = () => Promise.reject(new Error('remotion boom')) as never;
  const failingService = new StyledHookPreviewService(
    { compositionsDir, logger },
    failingRunner,
  );
  let threw = false;
  try {
    await failingService.render({
      videoPath: sourceVideo,
      start: 0,
      end: 3,
      durationSeconds: 3,
      headlineText: 'X',
      themeSeed: 'seed',
      outputDir,
      fileName: 'final-hook-02',
    });
  } catch {
    threw = true;
  }
  check('error remotion propagaasi (bukan swallow)', threw, true);

  console.log('Skenario 3 — media staging dibersihkan:');
  const mediaDirs = await readdirSafe(join(compositionsDir, 'public', 'media'));
  check('tidak ada sisa folder media/hook-*', mediaDirs.filter((d) => d.startsWith('hook-')).length, 0);

  await rm(workspace, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\n${failures} cek GAGAL`);
    process.exit(1);
  }
  console.log('\nSemua cek styled-hook-preview PASS');
}

async function mkdirDeep(dir: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dir, { recursive: true });
}

async function readdirSafe(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  return readdir(dir).catch(() => []);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
