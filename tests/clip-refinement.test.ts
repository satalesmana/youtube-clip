import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClipRefinementService } from '../src/services/clip-refinement.service.js';
import type { TranscriptResult } from '../src/types/transcript.js';

describe('ClipRefinementService — Natural Sentence Snapping & Audio Completeness', () => {
  const service = new ClipRefinementService({
    minDurationSeconds: 15,
    maxDurationSeconds: 60,
  });

  const sampleTranscript: TranscriptResult = {
    language: 'id',
    durationSeconds: 120,
    segments: [
      { start: 0, end: 5.2, text: 'Halo selamat datang di channel ini.' },
      { start: 5.8, end: 12.0, text: 'Hari ini kita akan mengupas tuntas sesuatu yang sangat rahasia.' },
      { start: 12.6, end: 20.4, text: 'Banyak orang tidak menyadari fakta ini sebelumnya.' },
      { start: 21.0, end: 32.5, text: 'Inilah momen paling mengejutkan sepanjang sejarah.' },
      { start: 33.0, end: 42.8, text: 'Semua penonton terdiam melihat apa yang terjadi di depan mata.' },
      { start: 43.5, end: 52.0, text: 'Dan kesimpulannya, kita harus selalu bersiap untuk segala kemungkinan.' },
      { start: 53.0, end: 60.0, text: 'Jangan lupa untuk like dan subscribe video ini sampai jumpa.' },
    ],
  };

  it('snaps imprecise start and end timestamps to whole sentences', () => {
    // LLM suggests 5.0 -> 33.0
    // Sentence 2 starts at 5.8s, Sentence 4 ends at 32.5s
    const refined = service.refine({ start: 5.5, end: 32.8 }, sampleTranscript);

    // Start should be cushioned before 5.8, but after 5.2 (previous sentence)
    assert.ok(refined.start >= 5.2, `Start ${refined.start} should not bleed into segment ending at 5.2`);
    assert.ok(refined.start <= 5.8, `Start ${refined.start} should start before or at speech start 5.8`);

    // End should complete segment at 32.5 without bleeding into segment at 33.0
    assert.ok(refined.end >= 32.5, `End ${refined.end} should allow sentence to finish at 32.5`);
    assert.ok(refined.end < 33.0, `End ${refined.end} should cut off before next sentence begins at 33.0`);
  });

  it('never chops words mid-sentence when LLM cuts off prematurely', () => {
    // LLM says clip ends at 30.0, but sentence 4 runs until 32.5
    const refined = service.refine({ start: 6.0, end: 30.0 }, sampleTranscript);

    // Sentence 4 must be allowed to complete at 32.5
    assert.ok(refined.end >= 32.5, `End ${refined.end} must complete the sentence at 32.5 instead of cutting at 30.0`);
    assert.ok(refined.end < 33.0, `End ${refined.end} must not reach next sentence at 33.0`);
  });

  it('enforces min duration by including adjacent sentences', () => {
    // Short request of 5 seconds (12.6 -> 18.0)
    const refined = service.refine({ start: 12.6, end: 18.0 }, sampleTranscript);
    const duration = refined.end - refined.start;
    assert.ok(duration >= 15, `Duration ${duration} must satisfy minDuration 15s`);
  });

  it('enforces max duration in whole-sentence increments without clipping words', () => {
    // Request spanning 0 to 60 (duration 60s)
    const refined = service.refine({ start: 0, end: 60 }, sampleTranscript);
    const duration = refined.end - refined.start;
    assert.ok(duration <= 60, `Duration ${duration} must satisfy maxDuration 60s`);
  });

  it('handles empty transcript gracefully', () => {
    const emptyTranscript: TranscriptResult = {
      language: 'id',
      durationSeconds: 100,
      segments: [],
    };
    const refined = service.refine({ start: 10, end: 40 }, emptyTranscript);
    assert.equal(refined.start, 10);
    assert.equal(refined.end, 40);
  });
});
