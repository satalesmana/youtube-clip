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
  /**
   * User-selected viral clips for dynamic multi-clip scene allocation.
   * When provided (N >= 1), scenes are distributed proportionally across these clips.
   */
  selectedClips?: Array<{ start: number; end: number; title?: string }>;
  /** Narration audio path (optional, already synthesized). */
  narrationPath?: string;
  /** Measured narration length. When present it is the authoritative timeline length. */
  narrationDurationSeconds?: number;
  /** Optional source-grounded story with timestamped beats. */
  story?: SourceStory;
  /** Optional per-section narration timing (real word boundaries) from TTS. */
  ttsSections?: TTSSectionTiming[];
  /**
   * Hook text explicitly chosen by the user (from the hook recommendation).
   * When set it becomes the on-screen hook headline, overriding the story's
   * auto-detected hook moment line. Optional: absent when no hook was chosen.
   */
  customHook?: string;
  /**
   * Exact on-screen hook headline title chosen by the user (from hook recommendation headline.text).
   * When set, it is the authoritative on-screen headline title for the hook scene.
   */
  hookTitle?: string;
  /** Pattern-interrupt category pill tag (e.g. "🔥 MOMEN VIRAL"). */
  hookTag?: string;
  /** Words in the hook headline rendered in accent color. */
  hookHighlightWords?: string[];
  /** Visual preset id for the hook intro. */
  visualPreset?: string;
  /** Badge pill preset id: 'neon-outline' | 'solid-impact' | 'highlight-chip' | 'editorial-label' */
  hookBadgePresetId?: 'neon-outline' | 'solid-impact' | 'highlight-chip' | 'editorial-label';
  /** Badge pill color variant: 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto' */
  hookBadgeColor?: string;
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
    const {
      script,
      clipStart,
      clipEnd,
      selectedClips: rawSelectedClips,
      narrationPath,
      narrationDurationSeconds,
      story,
      ttsSections,
      customHook,
      hookTitle,
      hookTag,
      hookHighlightWords,
      visualPreset,
      hookBadgePresetId,
      hookBadgeColor,
    } = input;
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

    // Resolve usable clip ranges (either from selectedClips or fallback clipStart..clipEnd)
    const validSelectedClips = (rawSelectedClips ?? []).filter((c) => c.end > c.start);
    const effectiveClips = validSelectedClips.length > 0
      ? validSelectedClips
      : clipEnd > clipStart
      ? [{ start: clipStart, end: clipEnd }]
      : [];

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

    // Build a lookup: script section type → story beat (when story is available)
    const beatByType = new Map<string, NonNullable<SourceStory['beats']>[number]>();
    if (story?.beats) {
      for (const beat of story.beats) {
        if (!beatByType.has(beat.role)) beatByType.set(beat.role, beat);
      }
    }

    // Pre-calculate which scenes will display source/background video for dynamic clip bucket distribution
    const sourceScenesIndices = narrationSections
      .map((s, idx) => (SECTION_VISUALS[s.type] !== 'graphic' ? idx : -1))
      .filter((idx) => idx !== -1);
    const totalSourceScenes = sourceScenesIndices.length;

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

      // Story mode metadata (engagement, retentionRisk, openLoop, quotableLine)
      const beat = story ? beatByType.get(section.type) : undefined;
      if (beat) {
        if (beat.engagementScore != null) scene.engagementScore = beat.engagementScore;
        if (beat.retentionRisk) scene.retentionRisk = beat.retentionRisk;
        if (beat.openLoop) scene.openLoop = beat.openLoop;
        if (beat.quotableLine) scene.quotableLine = beat.quotableLine;
      }

      // Visual source assignment:
      // 1. If explicit selected clips are provided (validSelectedClips), prioritize multi-clip distribution
      // 2. Otherwise if story beats are available, use beat source timestamps
      // 3. Otherwise fall back to effectiveClips slicing
      if (validSelectedClips.length > 0) {
        const sourceOrder = sourceScenesIndices.indexOf(index);
        if (sourceOrder !== -1 && totalSourceScenes > 0) {
          const clipIdx = Math.min(
            effectiveClips.length - 1,
            Math.floor((sourceOrder / totalSourceScenes) * effectiveClips.length),
          );
          const targetClip = effectiveClips[clipIdx]!;

          const scenesForClip = sourceScenesIndices.filter(
            (sIdx) => Math.min(
              effectiveClips.length - 1,
              Math.floor((sourceScenesIndices.indexOf(sIdx) / totalSourceScenes) * effectiveClips.length),
            ) === clipIdx,
          );
          const orderInClip = scenesForClip.indexOf(index);
          const clipCount = Math.max(1, scenesForClip.length);

          const clipSpan = targetClip.end - targetClip.start;
          const slice = clipSpan / clipCount;
          const srcStart = targetClip.start + orderInClip * slice;
          const srcEnd = Math.min(targetClip.end, srcStart + slice);

          scene.source = { start: srcStart, end: srcEnd };
        }
      } else if (beat && beat.end > beat.start) {
        scene.source = {
          start: beat.start,
          end: beat.end,
        };
      } else if (effectiveClips.length > 0) {
        const sourceOrder = sourceScenesIndices.indexOf(index);
        if (sourceOrder !== -1 && totalSourceScenes > 0) {
          const targetClip = effectiveClips[0]!;
          const clipSpan = targetClip.end - targetClip.start;
          const slice = clipSpan / totalSourceScenes;
          const srcStart = targetClip.start + sourceOrder * slice;
          const srcEnd = Math.min(targetClip.end, srcStart + slice);
          scene.source = { start: srcStart, end: srcEnd };
        }
      }

      scenes.push(scene);
      cursor = end;
    });

    // Hook-first: open the video on the strongest cut. A user-selected hook
    // wins: its headline title becomes the on-screen headline and its source range is
    // used as the hook scene's footage backdrop. Without a selection, keep existing behaviour.
    const selectedTitle = hookTitle?.trim();
    const selectedHook = customHook?.trim();
    const hookMoment = (selectedTitle || selectedHook) ? undefined : story?.hookMoment;
    const firstScene = scenes[0];
    if (firstScene) {
      if (firstScene.type === 'hook' || selectedTitle || selectedHook || visualPreset) {
        firstScene.type = 'hook';
        if (selectedTitle) {
          firstScene.quotableLine = selectedTitle;
          firstScene.hookTitle = selectedTitle;
        } else if (selectedHook) {
          firstScene.quotableLine = selectedHook;
          firstScene.hookTitle = selectedHook;
        }
        if (hookTag?.trim()) {
          firstScene.hookTag = hookTag.trim();
        }
        if (hookHighlightWords && hookHighlightWords.length > 0) {
          firstScene.highlightWords = hookHighlightWords;
        }
        if (visualPreset) {
          firstScene.visualPreset = visualPreset;
        }
        if (hookBadgePresetId) {
          firstScene.hookBadgePresetId = hookBadgePresetId;
        }
        if (hookBadgeColor) {
          firstScene.hookBadgeColor = hookBadgeColor;
        }
        if (!firstScene.source && clipEnd > clipStart) {
          firstScene.source = {
            start: clipStart,
            end: Math.min(clipEnd, clipStart + (firstScene.end - firstScene.start)),
          };
        }
      }
    }
    if (hookMoment && firstScene && hookMoment.end > hookMoment.start) {
      const hStart = Math.max(clipStart, hookMoment.start);
      const hEnd = Math.min(clipEnd, hookMoment.end);
      if (hEnd > hStart) {
        firstScene.source = { start: hStart, end: hEnd };
      }
      if (hookMoment.suggestedLine?.trim() && !firstScene.quotableLine) {
        firstScene.quotableLine = hookMoment.suggestedLine.trim();
        firstScene.hookTitle = hookMoment.suggestedLine.trim();
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

  /** Groups narration text into short caption events (<= 4 words) with frame-accurate word timings from TTS. */
  private buildCaptions(
    scenes: PlanScene[],
    ttsSections?: TTSSectionTiming[],
  ): PlanCaption[] {
    const captions: PlanCaption[] = [];
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      const scene = scenes[sceneIndex]!;
      // The hook scene already renders its money line as the kinetic HookHeadline/quote card,
      // so subtitles and quote cards are omitted to avoid double-text clutter on screen.
      if (scene.type === 'hook') {
        continue;
      }

      const words = scene.narration.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      // Real word boundaries from TTS (VTT / Whisper alignment)
      const rawTimings =
        ttsSections && ttsSections.length === scenes.length
          ? ttsSections[sceneIndex]?.wordTimings ?? []
          : [];

      if (rawTimings.length > 0) {
        const chunkSize = 4;
        for (let i = 0; i < words.length; i += chunkSize) {
          const group = words.slice(i, i + chunkSize);
          const startIdx = Math.min(rawTimings.length - 1, Math.floor((i / words.length) * rawTimings.length));
          const endIdx = Math.min(rawTimings.length - 1, Math.floor(((i + group.length) / words.length) * rawTimings.length) - 1);
          const first = rawTimings[startIdx]!;
          const last = rawTimings[Math.max(startIdx, endIdx)]!;
          const chunkTimings = rawTimings.slice(startIdx, Math.max(startIdx + 1, endIdx + 1));

          // Align wordTimings to match display words 1-to-1 so karaoke highlighting
          // in Remotion stays in sync even when spoken words differ in count.
          const alignedTimings: Array<{ word: string; start: number; end: number }> = group.map((word, k) => {
            const tStartIdx = Math.min(chunkTimings.length - 1, Math.floor((k / group.length) * chunkTimings.length));
            const tEndIdx = Math.min(chunkTimings.length - 1, Math.floor(((k + 1) / group.length) * chunkTimings.length) - 1);
            const wFirst = chunkTimings[tStartIdx]!;
            const wLast = chunkTimings[Math.max(tStartIdx, tEndIdx)]!;
            return {
              word,
              start: Number(wFirst.start.toFixed(3)),
              end: Number(Math.max(wLast.end, wFirst.start + 0.05).toFixed(3)),
            };
          });

          captions.push({
            start: Number(first.start.toFixed(2)),
            end: Number(Math.max(last.end, first.start + 0.1).toFixed(2)),
            text: group.join(' '),
            highlightWords: this.pickHighlightWords(group),
            wordTimings: alignedTimings,
          });
        }
      } else {
        const chunkSize = 4;
        for (let i = 0; i < words.length; i += chunkSize) {
          const group = words.slice(i, i + chunkSize);
          const sceneSpan = Math.max(scene.end - scene.start, 1);
          const groupStart = scene.start + (i / words.length) * sceneSpan;
          const groupEnd = scene.start + (Math.min(i + chunkSize, words.length) / words.length) * sceneSpan;
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
