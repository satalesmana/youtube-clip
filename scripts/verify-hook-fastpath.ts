/**
 * Isolated verification: HookController.resolveTranscript must NOT call
 * youtubeService.downloadVideo when the video + transcript already exist in
 * the per-video workspace. The fake youtubeService throws if called.
 */
import { join } from 'node:path';
import { HookController } from '../src/controllers/hook.controller.js';
import type { IYoutubeService } from '../src/services/youtube.service.js';
import type { ITranscriptService } from '../src/services/transcript.service.js';
import type { IWhisperService } from '../src/services/whisper.service.js';

const rootDir = process.cwd();
const outputsDir = join(rootDir, 'outputs');
const VIDEO_ID = 'kBoAmrXotlQ';

let downloadCalls = 0;
const youtubeService: IYoutubeService = {
  async downloadVideo() {
    downloadCalls += 1;
    throw new Error('downloadVideo MUST NOT be called when video+transcript already exist');
  },
};

const transcriptService = {
  async loadTranscript(videoId: string) {
    // Mirrors the shared-dir lookup; falls back to workspace file below.
    const { readFile } = await import('node:fs/promises');
    try {
      const raw = await readFile(join(outputsDir, videoId, 'transcripts', `${videoId}.json`), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
} as unknown as ITranscriptService;

const whisperService = {} as IWhisperService;

const controller = new HookController({
  youtubeService,
  transcriptService,
  whisperService,
  contentAngleService: {} as never,
  storyService: {} as never,
  hookService: {} as never,
  outputsDir,
  logger: { info() {}, warn() {}, error() {}, debug() {} } as never,
});

// @ts-expect-error — private method access for verification purposes
const result = await controller.resolveTranscript({
  youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
});

console.log('videoId           :', result.videoId);
console.log('segments          :', result.transcript.segments?.length ?? 'n/a');
console.log('job.root          :', result.job.root);
console.log('downloads dir     :', result.job.downloads);
console.log('downloadVideo calls:', downloadCalls);

if (downloadCalls !== 0) {
  console.error('FAIL: downloadVideo was called');
  process.exit(1);
}
if (!result.transcript.segments?.length) {
  console.error('FAIL: transcript missing');
  process.exit(1);
}
console.log('\nPASS: existing video + transcript reused, zero downloads.');
