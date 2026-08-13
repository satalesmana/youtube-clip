import { AppError } from '../utils/errors.js';
import { videoPlanSchema } from '../schemas/video-plan.schema.js';
import type { Logger } from '../utils/logger.js';
import type { OriginalScript } from '../types/script.js';
import type { VideoPlan, PlanScene, PlanCaption } from '../types/video-plan.js';

export interface VideoPlanServiceOptions {
  /** Target duration in seconds (default 60). */
  targetDuration?: number;
  /** Narration speaking rate (words per minute) used to scale scene lengths. */
  wordsPerMinute?: number;
  /** Seconds of pause inserted between scenes. */
  interScenePauseSeconds?: number;
}

/** Builds a scene plan from an original script + candidate clip timing. */
export interface IVideoPlanService {
  buildPlan(input: VideoPlanBuildInput): Promise<VideoPlan>;
}

/** Everything the planner needs to lay out scenes on a timeline. */
export interface VideoPlanBuildInput {
  script: OriginalScript;
  /** The candidate moment's time range in the source video. */
  clipStart: number;
  clipEnd: number;
  /** Narration audio path (optional, already synthesized). */
  narrationPath?: string;
}

const SECTION_WEIGHTS: Record<string, number> = {
  hook: 0.12,
  context: 0.16,
  source: 0.18,
  commentary: 0.2,
  analysis: 0.2,
  supporting: 0.14,
  conclusion: 0.12,
};

const SECTION_VISUALS: Record<string, string> = {
  hook: 'graphic',
  context: 'speaker',
  source: 'source-clip',
  commentary: 'speaker',
  analysis: 'b-roll',
  supporting: 'b-roll',
  conclusion: 'graphic',
};

/**
 * Deterministic scene planner. Converts a script + candidate timing into a
 * video plan with real scene start/end offsets, source-clip trim ranges, and
 * caption events derived from the narration. No extra LLM call needed — the
 * script already carries the editorial structure.
 */
export class VideoPlanService implements IVideoPlanService {
  constructor(
    private readonly options: VideoPlanServiceOptions,
    private readonly logger: Logger,
  ) {}

  async buildPlan(input: VideoPlanBuildInput): Promise<VideoPlan> {
    const { script, clipStart, clipEnd, narrationPath } = input;
    const targetDuration = this.options.targetDuration ?? 60;

    const narrationSections = script.sections.filter((s) => s.text.trim().length > 0);
    if (narrationSections.length === 0) {
      throw AppError.validation('Script has no narration sections to plan.');
    }

    // Allocate timeline budget per section, weighted, capped to target.
    const weights = narrationSections.map((s) => SECTION_WEIGHTS[s.type] ?? 0.14);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const durations = weights.map((w) =>
      Math.max(2, Math.round((w / weightSum) * targetDuration)),
    );

    // Source scenes should reference real source timestamps: distribute the
    // candidate's range across source-type sections.
    const sourceSections = narrationSections
      .map((s, i) => ({ section: s, index: i }))
      .filter(({ section }) => section.type === 'source');
    const sourceRange = clipEnd - clipStart;

    const scenes: PlanScene[] = [];
    let cursor = 0;
    let sourceCursor = clipStart;
    const sourceCount = sourceSections.length;

    narrationSections.forEach((section, index) => {
      const duration = durations[index]!;
      const start = cursor;
      const end = cursor + duration;

      const scene: PlanScene = {
        type: section.type,
        start,
        end,
        narration: section.text,
        visual: SECTION_VISUALS[section.type] ?? 'speaker',
      };

      if (section.type === 'source' && sourceCount > 0) {
        const slice = sourceRange / sourceCount;
        const srcStart = Math.min(clipEnd - slice, sourceCursor);
        const srcEnd = Math.min(clipEnd, srcStart + slice);
        scene.source = { start: srcStart, end: srcEnd };
        sourceCursor = srcEnd;
      }
      scenes.push(scene);
      cursor = end;
    });

    // Fix the final end to exactly the total planned duration.
    const totalDuration = Math.max(cursor, targetDuration);
    scenes[scenes.length - 1]!.end = totalDuration;

    const captions = this.buildCaptions(scenes);

    const plan: VideoPlan = {
      candidateId: script.candidateId,
      angleId: script.angleId,
      duration: totalDuration,
      scenes,
      captions,
      audio: {
        narration: narrationPath,
        sourceUnderlay: true,
        ducking: false,
      },
    };

    const parsed = videoPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw AppError.internal(`Video plan failed validation: ${parsed.error.message}`);
    }

    this.logger.info(
      { candidateId: script.candidateId, sceneCount: scenes.length, duration: totalDuration },
      'Video plan built',
    );

    return parsed.data;
  }

  /** Groups narration text into short caption events (<= 4 words). */
  private buildCaptions(scenes: PlanScene[]): PlanCaption[] {
    const captions: PlanCaption[] = [];
    for (const scene of scenes) {
      const words = scene.narration.split(/\s+/).filter(Boolean);
      const sceneSpan = Math.max(scene.end - scene.start, 1);
      for (let i = 0; i < words.length; i += 4) {
        const group = words.slice(i, i + 4);
        const groupStart = scene.start + (i / words.length) * sceneSpan;
        const groupEnd = scene.start + (Math.min(i + 4, words.length) / words.length) * sceneSpan;
        captions.push({
          start: Number(groupStart.toFixed(2)),
          end: Number(groupEnd.toFixed(2)),
          text: group.join(' '),
          highlightWords: this.pickHighlightWords(group),
        });
      }
    }
    return captions;
  }

  /** Emphasizes numbers, percentages, and a small keyword set. */
  private pickHighlightWords(words: string[]): string[] {
    const keywordPattern = /\b(\d+([.,]\d+)?%?|ratusan|ribuan|jutaan|pertama|terakhir|terbesar|tercepat|selamat|kagum|luar biasa)\b/i;
    return words.filter((word) => keywordPattern.test(word));
  }
}
