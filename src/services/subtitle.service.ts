import { clamp } from '../utils/timestamp.js';
import type { TranscriptResult } from '../types/transcript.js';
import type { SubtitleEvent } from '../types/subtitle.js';

export interface SubtitleServiceOptions {
  maxWordsPerEvent: number;
  pauseBreakThresholdSeconds: number;
}

/**
 * Builds on-screen caption events directly from Whisper's word-level
 * timestamps — never from LLM output — rebased to be relative to a clip's
 * own start (0-based), so the resulting ASS file's timings match the
 * trimmed output video rather than the original source.
 */
export interface ISubtitleService {
  buildEvents(transcript: TranscriptResult, clipStart: number, clipEnd: number): SubtitleEvent[];
}

interface FlatWord {
  text: string;
  start: number;
  end: number;
  segmentIndex: number;
}

const EMOTIONAL_WORDS = new Set([
  'amazing', 'incredible', 'shocking', 'unbelievable', 'terrifying', 'devastating',
  'heartbreaking', 'inspiring', 'furious', 'love', 'hate', 'fear', 'afraid', 'excited',
  'thrilled', 'stunned', 'shocked', 'crazy', 'insane', 'brutal', 'epic', 'legendary',
  'nightmare', 'dream', 'worst', 'best',
]);

const ACTION_VERBS = new Set([
  'run', 'build', 'create', 'destroy', 'win', 'lose', 'fight', 'escape', 'attack',
  'defend', 'launch', 'crash', 'explode', 'discover', 'reveal', 'expose', 'steal',
  'save', 'kill', 'survive', 'quit', 'started', 'built', 'sold', 'made',
]);

/** Flags numbers, money, percentages, emotionally-charged words, action verbs, and probable names. */
function isKeywordCandidate(word: string, isEventInitial: boolean): boolean {
  const clean = word.replace(/[^\w%$.,-]/g, '');
  if (!clean) return false;

  if (/\d/.test(clean)) return true;
  if (/[$€£]/.test(clean)) return true;
  if (/%/.test(clean)) return true;
  if (/^(dollars?|percent|million|billion|thousand)$/i.test(clean)) return true;

  const lower = clean.toLowerCase();
  if (EMOTIONAL_WORDS.has(lower) || ACTION_VERBS.has(lower)) return true;

  // Naive proper-noun heuristic: capitalized and not the event's first word.
  if (!isEventInitial && /^[A-Z][a-z]+$/.test(clean)) return true;

  return false;
}

export class SubtitleService implements ISubtitleService {
  constructor(private readonly options: SubtitleServiceOptions) {}

  buildEvents(transcript: TranscriptResult, clipStart: number, clipEnd: number): SubtitleEvent[] {
    const clipDuration = Math.max(0, clipEnd - clipStart);
    const words = this.flattenWords(transcript).filter(
      (word) => word.start < clipEnd && word.end > clipStart,
    );

    const events: SubtitleEvent[] = [];
    let current: FlatWord[] = [];

    const flush = (): void => {
      if (current.length === 0) return;

      const first = current[0] as FlatWord;
      const last = current[current.length - 1] as FlatWord;

      events.push({
        start: clamp(first.start - clipStart, 0, clipDuration),
        end: clamp(last.end - clipStart, 0, clipDuration),
        words: current.map((word, i) => ({
          text: word.text,
          start: clamp(word.start - clipStart, 0, clipDuration),
          end: clamp(word.end - clipStart, 0, clipDuration),
          isKeyword: isKeywordCandidate(word.text, i === 0),
        })),
      });

      current = [];
    };

    for (const word of words) {
      const previous = current.at(-1);
      const gapFromPrevious = previous ? word.start - previous.end : 0;
      const crossesSentence = previous !== undefined && word.segmentIndex !== previous.segmentIndex;

      if (
        current.length >= this.options.maxWordsPerEvent ||
        gapFromPrevious > this.options.pauseBreakThresholdSeconds ||
        crossesSentence
      ) {
        flush();
      }

      current.push(word);
    }
    flush();

    return events;
  }

  private flattenWords(transcript: TranscriptResult): FlatWord[] {
    const flat: FlatWord[] = [];

    transcript.segments.forEach((segment, segmentIndex) => {
      if (segment.words && segment.words.length > 0) {
        for (const word of segment.words) {
          flat.push({ text: word.word, start: word.start, end: word.end, segmentIndex });
        }
      } else {
        flat.push({ text: segment.text, start: segment.start, end: segment.end, segmentIndex });
      }
    });

    return flat;
  }
}
