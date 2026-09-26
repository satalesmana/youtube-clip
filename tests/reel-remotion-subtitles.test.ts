import test from 'node:test';
import assert from 'node:assert/strict';
import { ReelRemotionService } from '../src/services/reel-remotion.service.js';
import { SubtitleService } from '../src/services/subtitle.service.js';
import { createLogger } from '../src/utils/logger.js';
import type { TranscriptResult } from '../src/types/transcript.js';

test('Reel Remotion Subtitles Test Suite', async (t) => {
  const logger = createLogger('test-reel-remotion');
  const subtitleService = new SubtitleService({
    maxWordsPerEvent: 4,
    pauseBreakThresholdSeconds: 1.5,
  });

  const mockTranscript: TranscriptResult = {
    language: 'id',
    durationSeconds: 100,
    segments: [
      {
        start: 10.0,
        end: 14.0,
        text: 'Ini adalah momen luar biasa dari pertandingan.',
        words: [
          { word: 'Ini', start: 10.0, end: 10.5 },
          { word: 'adalah', start: 10.5, end: 11.0 },
          { word: 'momen', start: 11.0, end: 11.6 },
          { word: 'luar', start: 11.6, end: 12.2 },
          { word: 'biasa', start: 12.2, end: 12.8 },
          { word: 'dari', start: 12.8, end: 13.3 },
          { word: 'pertandingan', start: 13.3, end: 14.0 },
        ],
      },
      {
        start: 25.0,
        end: 29.0,
        text: 'Gol indah dicetak di menit akhir!',
        words: [
          { word: 'Gol', start: 25.0, end: 25.6 },
          { word: 'indah', start: 25.6, end: 26.2 },
          { word: 'dicetak', start: 26.2, end: 27.0 },
          { word: 'di', start: 27.0, end: 27.5 },
          { word: 'menit', start: 27.5, end: 28.1 },
          { word: 'akhir', start: 28.1, end: 28.9 },
        ],
      },
    ],
  };

  await t.test('1. buildCaptions rebases words and timestamps to 0 for selected range', () => {
    const service = new ReelRemotionService({
      compositionsDir: '/dummy',
      logger,
    });

    // Access private buildCaptions for testing
    const buildCaptions = (service as any).buildCaptions.bind(service);

    // Segment 1: from 10.0 to 14.0
    const captions1 = buildCaptions(mockTranscript, subtitleService, 10.0, 14.0);
    assert.ok(captions1.length >= 1, 'Should produce captions for range [10, 14]');
    
    // First caption must start at 0 (rebased)
    assert.equal(captions1[0].start, 0);
    assert.ok(captions1[0].end <= 4.0);

    // Words inside must also be rebased to 0
    const firstWord = captions1[0].wordTimings?.[0];
    assert.ok(firstWord != null);
    assert.equal(firstWord.word, 'Ini');
    assert.equal(firstWord.start, 0); // 10.0 - 10.0 = 0
    assert.equal(firstWord.end, 0.5); // 10.5 - 10.0 = 0.5

    // Segment 2: from 25.0 to 29.0
    const captions2 = buildCaptions(mockTranscript, subtitleService, 25.0, 29.0);
    assert.ok(captions2.length >= 1, 'Should produce captions for range [25, 29]');
    assert.equal(captions2[0].start, 0); // 25.0 - 25.0 = 0
    assert.equal(captions2[0].wordTimings?.[0]?.word, 'Gol');
    assert.equal(captions2[0].wordTimings?.[0]?.start, 0);
  });

  await t.test('2. Subtitle text exactly follows transcript and ignores words outside range', () => {
    const service = new ReelRemotionService({
      compositionsDir: '/dummy',
      logger,
    });
    const buildCaptions = (service as any).buildCaptions.bind(service);

    // Range between 15.0 and 20.0 (where no words were spoken)
    const emptyCaptions = buildCaptions(mockTranscript, subtitleService, 15.0, 20.0);
    assert.equal(emptyCaptions.length, 0, 'No captions should be generated for silent range');

    // Partial range: only the second half of segment 2 (27.0 to 29.0)
    const partialCaptions = buildCaptions(mockTranscript, subtitleService, 27.0, 29.0);
    assert.ok(partialCaptions.length >= 1);
    const allWords = partialCaptions.flatMap((c: any) => c.wordTimings?.map((w: any) => w.word));
    assert.ok(!allWords.includes('Gol'), 'Should not include words before range start');
    assert.ok(allWords.includes('menit'), 'Should include words inside range');
    assert.ok(allWords.includes('akhir'), 'Should include words inside range');
  });

  await t.test('3. TransformController routes outputMode: "reel" to ReelRemotionService when available', async () => {
    const { TransformController } = await import('../src/controllers/transform.controller.js');

    let composeCalled = false;
    let passedInput: any = null;

    const mockReelRemotionService: any = {
      compose: async (input: any) => {
        composeCalled = true;
        passedInput = input;
        return {
          path: '/dummy/output/reel.mp4',
          durationSeconds: 15,
          sizeBytes: 1024000,
        };
      },
    };

    const mockTranscriptDoc = {
      videoId: 'test_vid',
      language: 'id',
      durationSeconds: 60,
      segments: mockTranscript.segments,
    };

    const deps: any = {
      youtubeService: {},
      transcriptService: {
        loadTranscript: async () => mockTranscriptDoc,
      },
      whisperService: {},
      contentAngleService: {},
      scriptService: {},
      ttsService: {},
      videoPlanService: {},
      storyService: {},
      templateService: {},
      templateRendererService: {},
      assService: {},
      subtitleService,
      outputsDir: '/tmp',
      logger,
      assStyle: {},
      compositionEngine: {},
      reelRemotionService: mockReelRemotionService,
    };

    const controller = new TransformController(deps);

    // Stub loadTranscriptForVideoId
    (controller as any).loadTranscriptForVideoId = async () => mockTranscriptDoc;
    (controller as any).resolveTranscriptAndVideo = async () => ({
      videoId: 'test_vid',
      videoPath: '/tmp/test_vid.mp4',
      transcript: mockTranscriptDoc,
    });
    (controller as any).toMediaUrl = (path: string) => `http://localhost/media/${path}`;

    const result = await controller.transform({
      videoId: 'test_vid',
      outputMode: 'reel',
      selectedClips: [
        { start: 10, end: 14, title: 'Clip 1' },
        { start: 25, end: 29, title: 'Clip 2' },
      ],
      subtitleStyle: 'hormozi',
      generateCaptions: false,
    });

    assert.equal(composeCalled, true, 'ReelRemotionService.compose must be called');
    assert.equal(passedInput.subtitleStyle, 'hormozi');
    assert.equal(passedInput.segments.length, 2);
    assert.equal(passedInput.transcript?.segments.length, 2);
    assert.equal(result.outputMode, 'reel');
    assert.equal((result as any).outputVideo.path, '/dummy/output/reel.mp4');
  });
});
