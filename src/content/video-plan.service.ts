import { AppError } from '../utils/errors.js';
import { videoPlanSchema } from '../schemas/video-plan.schema.js';
import type { Logger } from '../utils/logger.js';
import type { OriginalScript } from '../types/script.js';
import type { VideoPlan, PlanScene, PlanCaption } from '../types/video-plan.js';
import type { SourceStory } from '../types/story.js';
import type { TTSSectionTiming } from '../providers/tts/tts.types.js';

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
  /** Measured narration length. When present it is the authoritative timeline length. */
  narrationDurationSeconds?: number;
  /** Optional source-grounded story with timestamped beats. */
  story?: SourceStory;
  /** Optional per-section narration timing (real word boundaries) from TTS. */
  ttsSections?: TTSSectionTiming[];
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
 * caption events derived from the narration.
 *
 * When a SourceStory is supplied, beats override the equal-slicing logic:
 * each beat's source timestamps define the visual clip range for that scene,
 * and the beat's purpose/narrative metadata enriches the scene output.
 */
export class VideoPlanService implements IVideoPlanService {
  constructor(
    private readonly options: VideoPlanServiceOptions,
    private readonly logger: Logger,
  ) {}

  async buildPlan(input: VideoPlanBuildInput): Promise<VideoPlan> {
    const { script, clipStart, clipEnd, narrationPath, narrationDurationSeconds, story, ttsSections } = input;
    const configuredTarget = this.options.targetDuration ?? 60;
    // Never make a video longer than its narration: that produces a frozen
    // tail and causes a later audio remux to truncate the video.
    const targetDuration = narrationDurationSeconds && narrationDurationSeconds > 0
      ? narrationDurationSeconds
      : configuredTarget;

    const narrationSections = script.sections.filter((s) => s.text.trim().length > 0);
    if (narrationSections.length === 0) {
      throw AppError.validation('Script has no narration sections to plan.');
    }

    // When TTS exposed real per-section durations (edge-tts word boundaries),
    // use them as the authoritative layout so scenes, captions and the voice
    // stay in sync. Otherwise fall back to the weighted estimate.
    const realDurations =
      ttsSections && ttsSections.length === narrationSections.length
        ? narrationSections.map(
            (_, index) => ttsSections[index]!.durationSeconds,
          )
        : undefined;
    const hasRealDurations =
      realDurations !== undefined &&
      realDurations.every((d) => d > 0) &&
      Math.abs(realDurations.reduce((a, b) => a + b, 0) - targetDuration) < 1;

    let durations: number[];
    if (hasRealDurations) {
      durations = realDurations!;
    } else {
      // Allocate timeline budget per section, weighted, capped to target.
      const weights = narrationSections.map((s) => SECTION_WEIGHTS[s.type] ?? 0.14);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      // Preserve the measured narration length exactly. Rendering a longer
      // sequence than the audio creates dead air (or a later truncation).
      durations = weights.map((w) => (w / weightSum) * targetDuration);
    }

    const scenes: PlanScene[] = [];
    let cursor = 0;
    const sourceRange = clipEnd - clipStart;

    // Build a lookup: script section type → story beat (when story is available)
    const beatByType = new Map<string, NonNullable<SourceStory['beats']>[number]>();
    if (story?.beats) {
      for (const beat of story.beats) {
        if (!beatByType.has(beat.role)) beatByType.set(beat.role, beat);
      }
    }

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

      // Story mode: use beat source timestamps + retention metadata directly
      const beat = story ? beatByType.get(section.type) : undefined;
      if (beat && beat.end > beat.start) {
        scene.source = {
          start: Math.max(clipStart, beat.start),
          end: Math.min(clipEnd, beat.end),
        };
      }
      if (beat) {
        if (beat.engagementScore != null) scene.engagementScore = beat.engagementScore;
        if (beat.retentionRisk) scene.retentionRisk = beat.retentionRisk;
        if (beat.openLoop) scene.openLoop = beat.openLoop;
        if (beat.quotableLine) scene.quotableLine = beat.quotableLine;
      }

      // Fallback: equal-slice the source range
      if (!scene.source && sourceRange > 0) {
        const sourceCount = narrationSections.filter((s) => SECTION_VISUALS[s.type] !== 'graphic').length;
        if (sourceCount > 0) {
          const slice = sourceRange / sourceCount;
          const sourceCursor = clipStart + index * slice;
          const srcStart = Math.min(clipEnd - slice, sourceCursor);
          const srcEnd = Math.min(clipEnd, srcStart + slice);
          scene.source = { start: srcStart, end: srcEnd };
        }
      }

      scenes.push(scene);
      cursor = end;
    });

    // Hook-first: open the video on the strongest cut when the story provides
    // one, so the first frames show the money shot behind the title card. The
    // hook's suggestedLine becomes the on-screen title + quote card.
    const hookMoment = story?.hookMoment;
    const firstScene = scenes[0];
    if (hookMoment && firstScene && hookMoment.end > hookMoment.start) {
      const hStart = Math.max(clipStart, hookMoment.start);
      const hEnd = Math.min(clipEnd, hookMoment.end);
      if (hEnd > hStart) {
        firstScene.source = { start: hStart, end: hEnd };
      }
      if (hookMoment.suggestedLine?.trim() && !firstScene.quotableLine) {
        firstScene.quotableLine = hookMoment.suggestedLine.trim();
      }
    }

    // Fix the final end to exactly the total planned duration.
    const totalDuration = targetDuration;
    scenes[scenes.length - 1]!.end = totalDuration;

    const captions = this.buildCaptions(scenes, ttsSections);

    const plan: VideoPlan = {
      candidateId: script.candidateId,
      angleId: script.angleId,
      duration: totalDuration,
      scenes,
      captions,
      audio: {
        narration: narrationPath,
        sourceUnderlay: true,
        ducking: true,
      },
    };

    const parsed = videoPlanSchema.safeParse(plan);
    if (!parsed.success) {
      throw AppError.internal(`Video plan failed validation: ${parsed.error.message}`);
    }

    this.logger.info(
      { candidateId: script.candidateId, sceneCount: scenes.length, duration: totalDuration, hasStory: !!story },
      'Video plan built',
    );

    return parsed.data;
  }

  /** Groups narration text into short caption events (<= 4 words) and adds a money-line quote card per scene that has one. */
  private buildCaptions(
    scenes: PlanScene[],
    ttsSections?: TTSSectionTiming[],
  ): PlanCaption[] {
    const captions: PlanCaption[] = [];
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      const scene = scenes[sceneIndex]!;
      const quotable = scene.quotableLine?.trim();
      // The hook scene already renders its money line as the kinetic headline,
      // so a separate quote card would just duplicate the same text on screen.
      if (quotable && scene.type !== 'hook') {
        captions.push({
          start: Number(scene.start.toFixed(2)),
          // Cap the quote on-screen time so it never sits static for a whole
          // long scene (retention killer) — it fades out shortly after.
          end: Number(Math.min(scene.end, scene.start + 2.5).toFixed(2)),
          text: quotable,
          type: 'quote',
          highlightWords: quotable.split(/\s+/).filter(Boolean),
        });
      }

      const words = scene.narration.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      // Real word boundaries (edge-tts VTT) when they line up with the spoken
      // text; otherwise fall back to even distribution across the scene.
      const realTimings =
        ttsSections && ttsSections.length === scenes.length
          ? ttsSections[sceneIndex]?.wordTimings ?? []
          : [];
      const hasRealTimings =
        realTimings.length > 0 && realTimings.length === words.length;

      for (let i = 0; i < words.length; i += 4) {
        const group = words.slice(i, i + 4);
        if (hasRealTimings) {
          const groupTimings = realTimings.slice(i, i + 4);
          const first = groupTimings[0]!;
          const last = groupTimings[groupTimings.length - 1]!;
          captions.push({
            start: Number(first.start.toFixed(2)),
            end: Number(Math.max(last.end, first.start + 0.1).toFixed(2)),
            text: group.join(' '),
            highlightWords: this.pickHighlightWords(group),
            wordTimings: groupTimings,
          });
        } else {
          const sceneSpan = Math.max(scene.end - scene.start, 1);
          const groupStart = scene.start + (i / words.length) * sceneSpan;
          const groupEnd = scene.start + (Math.min(i + 4, words.length) / words.length) * sceneSpan;
          captions.push({
            start: Number(groupStart.toFixed(2)),
            end: Number(Math.max(groupEnd, groupStart + 0.1).toFixed(2)),
            text: group.join(' '),
            highlightWords: this.pickHighlightWords(group),
          });
        }
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
