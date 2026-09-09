import type { AngleType } from './angle.js';
import type { StoryConcept } from './story.js';
import type { HookStyle } from '../hooks/hook.types.js';

/**
 * Content genre for a source video.
 *
 * Supplying a genre conditions every LLM stage of the pipeline — angle
 * generation, story concept detection, script pacing, and hook style
 * prioritisation — so the output feels native to the genre rather than
 * generically editorial.
 *
 * Genre is always optional: when absent the pipeline behaves exactly as it
 * did before this feature was added.
 */
export type ContentGenre =
  | 'podcast'          // Long-form interview, talk show, conversation
  | 'sports'           // Live sports, highlights, match recap
  | 'gaming'           // Gameplay, esports, game review / commentary
  | 'tutorial'         // How-to, education, step-by-step walkthrough
  | 'commentary'       // Opinion, analysis, news commentary / explainer
  | 'entertainment'    // Comedy, lifestyle, vlog, reaction
  | 'match-highlight'; // Match highlight reel: goals, dramatic moments, critical plays

/**
 * Narrative pacing for a genre: how fast beats should escalate and how much
 * room analytical sections get.
 *
 * - `fast`       — minimal setup, rapid escalation, very tight beat count (4).
 *                  Drop `reflection` / `analysis` sections; every second counts.
 * - `moderate`   — standard short-form arc; analysis is welcome but concise.
 * - `reflective` — slower build; deeper `analysis` + `supporting` sections
 *                  are expected and add value.
 */
export type NarrativePacing = 'fast' | 'moderate' | 'reflective';

/**
 * A genre preset: the LLM-facing guidance injected into every pipeline stage
 * when the caller supplies a genre. All lists are ordered by preference
 * (first = most strongly preferred).
 */
export interface GenrePreset {
  /** Human-readable label used in log messages. */
  label: string;

  /**
   * Angle types most likely to produce high-retention content for this genre.
   * The first 3 are presented to the LLM as strongly preferred.
   */
  preferredAngleTypes: AngleType[];

  /**
   * Story concepts most likely to be found in and appropriate for this genre.
   * The LLM is biased toward these when multiple concepts fit.
   */
  preferredStoryConcepts: StoryConcept[];

  /**
   * Hook styles that typically stop scrolling for this genre's audience.
   * Injected into the hook generation prompt as the preferred style set.
   */
  hookStyleHints: HookStyle[];

  /** Pacing directive for script generation and beat count. */
  narrativePacing: NarrativePacing;

  /**
   * One-sentence tone description appended to LLM system prompts.
   * Should describe the expected voice, energy level, and audience expectation.
   */
  toneDescription: string;

  /**
   * Preferred beat count range for the story service.
   * Tighter / faster genres use fewer beats; reflective genres allow more.
   */
  beatCountRange: { min: number; max: number };
}

/**
 * Preset definitions for each supported genre.
 * These are the LLM "biases" — the model can override any of them when the
 * transcript genuinely calls for a different treatment.
 */
export const GENRE_PRESETS: Record<ContentGenre, GenrePreset> = {
  podcast: {
    label: 'Podcast / Interview',
    preferredAngleTypes: [
      'what-you-missed',
      'commentary',
      'analysis',
      'fact-check',
      'storytelling',
    ],
    preferredStoryConcepts: [
      'turning-point',
      'claim-consequence',
      'character-journey',
      'discovery-explainer',
      'comeback',
    ],
    hookStyleHints: ['curiosity', 'contrarian', 'question', 'story'],
    narrativePacing: 'reflective',
    toneDescription:
      'Conversational, insight-driven, and genuine — the viewer wants the "aha" moment the guest revealed, not a clip of someone talking.',
    beatCountRange: { min: 5, max: 7 },
  },

  sports: {
    label: 'Sports / Highlights',
    preferredAngleTypes: [
      'storytelling',
      'commentary',
      'what-you-missed',
      'analysis',
      'comparison',
    ],
    preferredStoryConcepts: [
      'comeback',
      'turning-point',
      'character-journey',
      'claim-consequence',
      'discovery-explainer',
    ],
    hookStyleHints: ['shock', 'story', 'statistic', 'fear'],
    narrativePacing: 'fast',
    toneDescription:
      'High-energy, visceral, and immediate — the viewer wants to feel the stakes and relive the decisive moment, not a lengthy breakdown.',
    beatCountRange: { min: 4, max: 5 },
  },

  gaming: {
    label: 'Gaming / Esports',
    preferredAngleTypes: [
      'commentary',
      'analysis',
      'what-you-missed',
      'comparison',
      'storytelling',
    ],
    preferredStoryConcepts: [
      'comeback',
      'turning-point',
      'character-journey',
      'claim-consequence',
      'discovery-explainer',
    ],
    hookStyleHints: ['shock', 'statistic', 'contrarian', 'curiosity'],
    narrativePacing: 'fast',
    toneDescription:
      'Fast-paced, hype-driven, and community-aware — lead with the clutch play or surprise outcome; the audience already knows the game context.',
    beatCountRange: { min: 4, max: 5 },
  },

  tutorial: {
    label: 'Tutorial / Education',
    preferredAngleTypes: [
      'education',
      'explainer',
      'analysis',
      'what-you-missed',
      'comparison',
    ],
    preferredStoryConcepts: [
      'discovery-explainer',
      'character-journey',
      'claim-consequence',
      'turning-point',
      'comeback',
    ],
    hookStyleHints: ['question', 'curiosity', 'contrarian', 'opportunity'],
    narrativePacing: 'moderate',
    toneDescription:
      'Clear, structured, and value-first — the viewer is here to learn one thing; give them the insight and the "why" it matters.',
    beatCountRange: { min: 4, max: 6 },
  },

  commentary: {
    label: 'Commentary / News Analysis',
    preferredAngleTypes: [
      'news-explanation',
      'fact-check',
      'analysis',
      'what-you-missed',
      'commentary',
    ],
    preferredStoryConcepts: [
      'claim-consequence',
      'turning-point',
      'discovery-explainer',
      'character-journey',
      'comeback',
    ],
    hookStyleHints: ['controversial', 'contrarian', 'curiosity', 'prediction'],
    narrativePacing: 'moderate',
    toneDescription:
      'Authoritative, clear, and opinionated — the viewer wants to know what actually happened and why the mainstream framing missed it.',
    beatCountRange: { min: 4, max: 6 },
  },

  entertainment: {
    label: 'Entertainment / Lifestyle',
    preferredAngleTypes: [
      'storytelling',
      'commentary',
      'what-you-missed',
      'comparison',
      'analysis',
    ],
    preferredStoryConcepts: [
      'character-journey',
      'turning-point',
      'comeback',
      'claim-consequence',
      'discovery-explainer',
    ],
    hookStyleHints: ['story', 'shock', 'question', 'curiosity'],
    narrativePacing: 'moderate',
    toneDescription:
      'Relatable, fun, and emotionally engaging — the viewer wants to be entertained and surprised; personality beats polish every time.',
    beatCountRange: { min: 4, max: 6 },
  },

  'match-highlight': {
    label: 'Match Highlight',
    preferredAngleTypes: [
      'storytelling',
      'what-you-missed',
      'commentary',
      'comparison',
      'analysis',
    ],
    preferredStoryConcepts: [
      'turning-point',
      'comeback',
      'claim-consequence',
      'character-journey',
      'discovery-explainer',
    ],
    hookStyleHints: ['shock', 'story', 'statistic', 'fear'],
    narrativePacing: 'fast',
    toneDescription:
      'Visceral, stadium-atmosphere — narrate only what the visuals cannot show: the scoreline, the minute, the player name, the tactical context. Crowd noise and silence are part of the story. Every word must earn its place on screen.',
    beatCountRange: { min: 3, max: 4 },
  },
};

/**
 * Returns the preset for the given genre, or undefined when the genre is absent.
 * Safe to call with `undefined` — returns `undefined` so callers can gate on it.
 */
export function getGenrePreset(genre?: ContentGenre): GenrePreset | undefined {
  return genre ? GENRE_PRESETS[genre] : undefined;
}
