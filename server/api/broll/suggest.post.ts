import { defineEventHandler, readBody, createError } from 'h3';
import { z } from 'zod';
import { join } from 'node:path';
import { container } from '../../../src/container/index.js';
import { extractVideoIdFromUrl } from '../../../src/utils/youtube-id.js';
import { AppError } from '../../../src/utils/errors.js';
import { toHttpError } from '../../../src/utils/http-error.js';
import type { BrollCue } from '../../../src/types/b-roll.js';

const brollSuggestSchema = z.object({
  youtubeUrl: z.string().optional(),
  videoId: z.string().optional(),
  selectedClips: z.array(z.object({
    start: z.number().min(0),
    end: z.number().min(0),
    title: z.string().optional(),
  })).optional(),
  customScript: z.object({
    language: z.string().optional(),
    sections: z.array(z.object({
      type: z.string(),
      text: z.string(),
      spokenText: z.string().optional(),
    })),
  }).optional(),
  outputMode: z.enum(['reel', 'narration']).optional(),
  dialogueText: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = brollSuggestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const { youtubeUrl, selectedClips, customScript, outputMode, dialogueText } = parsed.data;

  let resolvedVideoId = parsed.data.videoId;
  if (!resolvedVideoId && youtubeUrl) {
    resolvedVideoId = extractVideoIdFromUrl(youtubeUrl) ?? undefined;
  }

  const cacheDir = resolvedVideoId
    ? join(container.paths.outputs, resolvedVideoId, 'broll')
    : join(container.paths.outputs, 'temp', 'broll');

  let textToAnalyze = '';
  let startSec = 0;
  let endSec = 30;

  if (customScript?.sections && customScript.sections.length > 0) {
    textToAnalyze = customScript.sections.map((s) => s.spokenText || s.text).join(' ');
    endSec = Math.max(15, Math.round(textToAnalyze.split(/\s+/).length / 2.5));
  } else if (dialogueText?.trim()) {
    textToAnalyze = dialogueText.trim();
  } else if (resolvedVideoId) {
    try {
      const transcript = await container.transcriptService.loadTranscript(resolvedVideoId);
      if (transcript && transcript.segments.length > 0) {
        if (selectedClips && selectedClips.length > 0) {
          const first = selectedClips[0]!;
          const last = selectedClips[selectedClips.length - 1]!;
          startSec = first.start;
          endSec = last.end;

          const matched = transcript.segments.filter((s) =>
            selectedClips.some((clip) => s.start >= clip.start - 1 && s.end <= clip.end + 1),
          );
          textToAnalyze = matched.map((s) => s.text).join(' ');
        } else {
          textToAnalyze = transcript.segments.slice(0, 8).map((s) => s.text).join(' ');
          endSec = Math.min(60, transcript.durationSeconds ?? 30);
        }
      }
    } catch {
      // Non-fatal, fallback to default analysis
    }
  }

  if (!textToAnalyze.trim()) {
    textToAnalyze = 'Diskusi penting mengenai strategi, perkembangan teknologi masa depan, dan tren pasar terkini.';
  }

  // Extract visual cues using BrollService LLM prompt
  let cues: BrollCue[] = await container.brollService.extractCues(textToAnalyze, startSec, endSec);

  // Fallback: If AI cue extraction produced 0 cues, generate intelligent keyword cues from text
  if (cues.length === 0) {
    const duration = Math.max(10, endSec - startSec);
    const cue1Start = Number((startSec + duration * 0.15).toFixed(1));
    const cue1End = Number((cue1Start + Math.min(4, duration * 0.25)).toFixed(1));

    const cue2Start = Number((startSec + duration * 0.55).toFixed(1));
    const cue2End = Number((cue2Start + Math.min(4.5, duration * 0.25)).toFixed(1));

    // Extract prominent keywords
    const lowerText = textToAnalyze.toLowerCase();
    let query1 = 'technology future';
    let query2 = 'city crowd';

    if (/motor|balap|racing|mobil|kendaraan|sirkuit|speed/i.test(lowerText)) {
      query1 = 'motorcycle racer speeding track';
      query2 = 'city traffic night speed';
    } else if (/hp|smartphone|ponsel|handphone|medsos|tiktok|instagram|scroll/i.test(lowerText)) {
      query1 = 'person scrolling smartphone cafe';
      query2 = 'mobile screen social media';
    } else if (/pasar|saham|invest|uang|duit|bisnis|profit|cuan|ekonomi|finansial|dollar|harga/i.test(lowerText)) {
      query1 = 'stock market chart candlestick';
      query2 = 'hand counting US dollar bills';
    } else if (/ai|coding|komputer|robot|tech|hacker|software|data|aplikasi|sistem/i.test(lowerText)) {
      query1 = 'programmer typing code laptop';
      query2 = 'artificial intelligence neural network';
    } else if (/olahraga|fitness|gym|lari|sehat|pertandingan|menang|juara/i.test(lowerText)) {
      query1 = 'stadium crowd cheering excitement';
      query2 = 'athlete workout training gym';
    } else if (/alam|gunung|pantai|laut|hutan|jalan|wisata|travel/i.test(lowerText)) {
      query1 = 'dramatic storm clouds sky';
      query2 = 'ocean waves serene horizon';
    }

    cues = [
      { start: cue1Start, end: cue1End, query: query1, mood: 'focused' },
      { start: cue2Start, end: cue2End, query: query2, mood: 'dynamic' },
    ];
  }

  const placements = await container.brollService.resolvePlacements(cues, cacheDir);

  return {
    success: true,
    count: placements.length,
    placements,
  };
});
