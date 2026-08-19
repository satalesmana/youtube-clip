import { basename, extname, join } from 'node:path';
import { runCommand } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import type { IWhisperService } from './whisper.service.js';
import type { TTSWordTiming } from '../providers/tts/tts.types.js';

/** Aligns a synthesized narration audio to its known script text. */
export interface IWordTimingService {
  align(audioPath: string, expectedText: string, tempDir: string): Promise<TTSWordTiming[]>;
}

interface AlignedWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Produces per-word boundaries for synthesized narration by re-transcribing
 * the audio with Whisper. Used by TTS providers that do not expose native
 * word timings (e.g. OpenAI `tts-1`). The known script text is aligned to the
 * Whisper transcript via LCS, so the resulting timings always map 1:1 onto
 * the words we actually display. Never throws — alignment failures degrade to
 * `[]` so the pipeline falls back to estimated caption timing.
 */
export class WordTimingService implements IWordTimingService {
  constructor(
    private readonly whisper: IWhisperService,
    private readonly logger: Logger,
  ) {}

  async align(
    audioPath: string,
    expectedText: string,
    tempDir: string,
  ): Promise<TTSWordTiming[]> {
    try {
      // Normalize to 16kHz mono WAV first — whisper.cpp requires WAV input
      // and the resample keeps alignment consistent across all whisper backends.
      const wavPath = join(tempDir, `${basename(audioPath, extname(audioPath))}.wav`);
      await runCommand('ffmpeg', ['-y', '-i', audioPath, '-ar', '16000', '-ac', '1', wavPath], {
        logger: this.logger,
      });
      const transcript = await this.whisper.transcribe(wavPath, { temp: tempDir });
      const aligned: AlignedWord[] = transcript.segments.flatMap((segment) =>
        (segment.words ?? []).map((word) => ({
          word: word.word,
          start: word.start,
          end: word.end,
        })),
      );
      if (aligned.length === 0) {
        this.logger.warn({ audioPath }, 'Whisper returned no word timings for narration');
        return [];
      }

      const expected = expectedText.split(/\s+/).filter(Boolean);
      const timings = alignByLcs(expected, aligned);

      // Refuse to build timings when too little of the known text was matched
      // (e.g. Whisper heard something very different) — let the planner fall
      // back to estimated caption timing instead of desynced words.
      const coverage =
        expected.length > 0
          ? timings.filter((_, i) => matchesAt(expected, aligned, i, timings)).length /
            expected.length
          : 0;
      if (coverage < 0.7) {
        this.logger.warn(
          { audioPath, coverage },
          'Word alignment coverage too low; falling back to estimated caption timing',
        );
        return [];
      }

      return expected.map((word, i) => ({
        word,
        start: round2(timings[i]!.start),
        end: round2(timings[i]!.end),
      }));
    } catch (error) {
      this.logger.warn({ err: error, audioPath }, 'Word timing alignment failed');
      return [];
    }
  }
}

function round2(value: number): number {
  return Number(value.toFixed(3));
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9%]/gi, '');
}

/**
 * True when the expected word at `index` maps to the aligned word used for its
 * timing (used only for a coverage estimate — not for building the output).
 */
function matchesAt(
  expected: string[],
  aligned: AlignedWord[],
  index: number,
  timings: { start: number; end: number }[],
): boolean {
  const target = normalizeWord(expected[index] ?? '');
  if (!target) return true;
  return aligned.some(
    (word) =>
      word.start === timings[index]!.start && normalizeWord(word.word) === target,
  );
}

/**
 * Longest-common-subsequence alignment of the known spoken text against the
 * Whisper transcript, producing one `{start,end}` per expected word. Expected
 * words that Whisper skipped (insertions) get the timing of the nearest
 * surrounding matched words, keeping the output monotonic.
 */
function alignByLcs(
  expected: string[],
  aligned: AlignedWord[],
): { start: number; end: number }[] {
  const n = expected.length;
  const m = aligned.length;
  const e = expected.map(normalizeWord);
  const a = aligned.map((word) => normalizeWord(word.word));

  if (n === m) {
    return expected.map((_, i) => ({ start: aligned[i]!.start, end: aligned[i]!.end }));
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      dp[i]![j] =
        e[i - 1] === a[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const matchFor: number[] = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (e[i - 1] === a[j - 1]) {
      matchFor[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  const result: { start: number; end: number }[] = new Array(n).fill({
    start: 0,
    end: 0,
  });
  let lastMatched = -1;
  for (let k = 0; k < n; k += 1) {
    const matched = matchFor[k];
    if (matched !== undefined && matched !== -1) {
      result[k] = { start: aligned[matched]!.start, end: aligned[matched]!.end };
      lastMatched = k;
      continue;
    }
    let next = -1;
    for (let t = k + 1; t < n; t += 1) {
      const candidate = matchFor[t];
      if (candidate !== undefined && candidate !== -1) {
        next = t;
        break;
      }
    }
    const prevEnd = lastMatched !== -1 ? result[lastMatched]!.end : null;
    const nextStart = next !== -1 ? result[next]!.start : null;
    const start = prevEnd ?? nextStart ?? 0;
    const end = Math.max(start, nextStart ?? start);
    result[k] = { start, end };
    if (nextStart === null && lastMatched === -1) lastMatched = k;
  }
  return result;
}