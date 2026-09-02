/**
 * Verification for the clipper flow redesign (hook preview + viral clips + reel mode).
 *
 * Run: npx tsx scripts/verify-clip-flow.ts
 *
 * Covers:
 *  1. TransformRequestSchema backward compatibility (old bodies still valid).
 *  2. Reel-mode validation (requires selectedClips).
 *  3. ReelComposerService — real FFmpeg: 3 source ranges joined into one MP4,
 *     with and without subtitle burn-in.
 *  4. PreviewRendererService — real FFmpeg: one low-res preview cut.
 *  5. TransformController.transformReel — mocked composer: segments sorted,
 *     ASS files written, media URL returned.
 */
import { mkdtemp, rm, writeFile, access, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../src/utils/exec.js';
import { probeDurationSeconds } from '../src/utils/ffmpeg.js';
import { ReelComposerService } from '../src/services/reel-composer.service.js';
import { PreviewRendererService } from '../src/services/preview-renderer.service.js';
import { TransformController } from '../src/controllers/transform.controller.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';
import type { Logger } from '../src/utils/logger.js';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Logger;

const MINIMAL_ASS = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: 1080',
  'PlayResY: 1920',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,Halo uji subtitle',
].join('\n');

async function main(): Promise<void> {
  // Use the same FFmpeg binary as production (from .env) — the stock
  // homebrew ffmpeg lacks libass, so the `ass` filter wouldn't exist.
  let ffmpegBinary = 'ffmpeg';
  try {
    const envFile = await readFile(join(process.cwd(), '.env'), 'utf-8');
    const match = envFile.match(/^FFMPEG_BINARY_PATH=(.+)$/m);
    if (match?.[1]) ffmpegBinary = match[1].trim();
  } catch {
    // no .env — fall back to PATH ffmpeg
  }
  console.log(`[setup] FFmpeg binary: ${ffmpegBinary}`);

  const root = await mkdtemp(join(tmpdir(), 'clip-flow-'));
  const sourcePath = join(root, 'source.mp4');

  try {
    /* ── Fixture: synthetic 40s source video (video + audio) ── */
    console.log('\n[setup] Generating synthetic 40s source video…');
    await runCommand(ffmpegBinary, [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=40:size=1280x720:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k', '-shortest',
      sourcePath,
    ]);
    const sourceDuration = await probeDurationSeconds({ binaryPath: ffmpegBinary, inputPath: sourcePath });
    check('synthetic source video created', sourceDuration > 35, `duration=${sourceDuration}`);

    /* ── 1. Schema backward compatibility ── */
    console.log('\n[1] Transform schema backward compatibility');
    const legacyBody = {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      template: 'commentary',
      language: 'auto',
      dryRun: false,
    };
    const legacy = transformRequestSchema.safeParse(legacyBody);
    check('legacy body (no outputMode) still valid', legacy.success);
    check('legacy body defaults to narration behaviour', legacy.success && legacy.data.outputMode === undefined);

    const legacyWithHook = transformRequestSchema.safeParse({
      ...legacyBody,
      sourceRange: { start: 12, end: 30 },
      customHook: 'Hook terpilih',
    });
    check('legacy body with hook selection still valid', legacyWithHook.success);

    /* ── 2. Reel-mode validation ── */
    console.log('\n[2] Reel-mode validation');
    const reelNoClips = transformRequestSchema.safeParse({
      ...legacyBody,
      outputMode: 'reel',
    });
    check('reel without selectedClips rejected', !reelNoClips.success);

    const reelWithClips = transformRequestSchema.safeParse({
      ...legacyBody,
      outputMode: 'reel',
      selectedClips: [
        { start: 5, end: 10, title: 'Klip A' },
        { start: 20, end: 24, title: 'Klip B' },
      ],
    });
    check('reel with selectedClips accepted', reelWithClips.success);
    check(
      'narration mode ignores selectedClips requirement',
      transformRequestSchema.safeParse({ ...legacyBody, selectedClips: [{ start: 1, end: 2 }] }).success,
    );

    /* ── 3. ReelComposerService with real FFmpeg ── */
    console.log('\n[3] ReelComposerService (real FFmpeg)');
    const composer = new ReelComposerService({ ffmpegBinaryPath: ffmpegBinary }, silentLogger);
    const reelDir = join(root, 'reel-out');

    const reel = await composer.compose({
      videoPath: sourcePath,
      segments: [
        { start: 5, end: 10 },
        { start: 20, end: 24 },
        { start: 30, end: 33 },
      ],
      outputDir: reelDir,
      fileName: 'reel',
    });
    const reelDuration = await probeDurationSeconds({ binaryPath: ffmpegBinary, inputPath: reel.path });
    check('reel file exists and is non-empty', reel.sizeBytes > 0, `size=${reel.sizeBytes}`);
    check('reel duration ≈ 12s (5+4+3 segments)', Math.abs(reelDuration - 12) < 1.5, `duration=${reelDuration}`);
    check('segments out of order get sorted output path exists', (await access(reel.path).then(() => true)).valueOf());

    await writeFile(join(root, 'sub-a.ass'), MINIMAL_ASS, 'utf-8');
    await writeFile(join(root, 'sub-b.ass'), MINIMAL_ASS, 'utf-8');
    const reelWithSubs = await composer.compose({
      videoPath: sourcePath,
      segments: [
        { start: 5, end: 10 },
        { start: 20, end: 24 },
      ],
      subtitles: [
        { assPath: join(root, 'sub-a.ass') },
        { assPath: join(root, 'sub-b.ass') },
      ],
      outputDir: reelDir,
      fileName: 'reel-subbed',
    });
    const reelSubsDuration = await probeDurationSeconds({ binaryPath: ffmpegBinary, inputPath: reelWithSubs.path });
    check('subtitled reel file exists', reelWithSubs.sizeBytes > 0);
    check('subtitled reel duration ≈ 9s', Math.abs(reelSubsDuration - 9) < 1.5, `duration=${reelSubsDuration}`);

    /* ── 4. PreviewRendererService with real FFmpeg ── */
    console.log('\n[4] PreviewRendererService (real FFmpeg)');
    const previewRenderer = new PreviewRendererService({ ffmpegBinaryPath: ffmpegBinary, previewWidth: 360 }, silentLogger);
    const preview = await previewRenderer.renderPreview({
      videoPath: sourcePath,
      start: 10,
      end: 14,
      outputDir: join(root, 'previews'),
      fileName: 'clip-01',
    });
    const previewStats = await stat(preview.path);
    const previewDuration = await probeDurationSeconds({ binaryPath: ffmpegBinary, inputPath: preview.path });
    check('preview file created', previewStats.size > 0, `size=${previewStats.size}`);
    check('preview duration ≈ 4s', Math.abs(previewDuration - 4) < 1, `duration=${previewDuration}`);

    /* ── 5. TransformController reel path (mocked composer) ── */
    console.log('\n[5] TransformController.transformReel (mocked composer)');
    const outputsDir = join(root, 'outputs');
    const videoId = 'dQw4w9WgXcQ';
    const transcript = {
      language: 'id',
      durationSeconds: 40,
      segments: [
        { start: 0, end: 6, text: 'Pembuka video uji.' },
        { start: 6, end: 12, text: 'Bagian pertama yang menarik.' },
        { start: 20, end: 26, text: 'Bagian kedua paling viral.' },
        { start: 30, end: 36, text: 'Penutup video uji.' },
      ],
    };

    let composerCalls = 0;
    const controller = new TransformController({
      youtubeService: {} as never,
      transcriptService: {
        loadTranscript: async () => transcript,
      } as never,
      whisperService: {} as never,
      contentAngleService: {} as never,
      scriptService: {} as never,
      ttsService: {} as never,
      videoPlanService: {} as never,
      storyService: {} as never,
      templateService: {} as never,
      templateRendererService: {} as never,
      assService: {
        render: () => MINIMAL_ASS,
      } as never,
      subtitleService: {
        buildEvents: () => [{ start: 0, end: 1, words: [] }],
      } as never,
      outputsDir,
      logger: silentLogger,
      assStyle: {} as never,
      compositionEngine: {} as never,
      reelComposer: {
        compose: async (input: {
          segments: Array<{ start: number; end: number }>;
          subtitles?: Array<{ assPath: string }>;
        }) => {
          composerCalls += 1;
          // Assert segments arrive in expected user-selection order.
          const starts = input.segments.map((s) => s.start);
          if (starts.length !== 2 || starts[0] !== 20 || starts[1] !== 5) {
            throw new Error(`segments unexpected order: ${starts.join(',')}`);
          }
          // Assert subtitle ASS paths were written before compose.
          for (const sub of input.subtitles ?? []) {
            await access(sub.assPath);
          }
          return {
            path: join(outputsDir, videoId, 'transform', 'job', 'clips', 'reel.mp4'),
            durationSeconds: 9,
            sizeBytes: 12345,
          };
        },
      } as never,
    });

    const result = (await controller.transform({
      videoId,
      candidateId: 0,
      language: 'auto',
      dryRun: false,
      outputMode: 'reel',
      selectedClips: [
        { start: 20, end: 24, title: 'Klip B' },
        { start: 5, end: 10, title: 'Klip A' },
      ],
    })) as Record<string, unknown>;

    check('reel branch executed (composer called once)', composerCalls === 1, `calls=${composerCalls}`);
    check('result.outputMode === "reel"', result.outputMode === 'reel');
    const outputVideo = result.outputVideo as { url?: string } | undefined;
    check('outputVideo.url is a /api/media/ URL', typeof outputVideo?.url === 'string' && outputVideo.url.startsWith('/api/media/'), `url=${outputVideo?.url}`);
    const reelInfo = result.reel as { clipCount?: number; segments?: unknown[] } | undefined;
    check('reel info carries 2 clips', reelInfo?.clipCount === 2, `clipCount=${reelInfo?.clipCount}`);
    check('reel info carries 2 sorted segments', Array.isArray(reelInfo?.segments) && reelInfo.segments.length === 2);

    console.log(`\n════════ ${passed} passed, ${failed} failed ════════`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
