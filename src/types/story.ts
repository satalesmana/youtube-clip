import type { ScriptSectionType } from './script.js';

/**
 * Story concepts auto-detected from source video signals.
 *
 * Mapping from source signals to concept:
 * - character-journey : one person, problem → effort → result (comeback/transformasi)
 * - comeback          : started behind/failing, overcame adversity, achieved outcome
 * - turning-point     : strong statement/confession that changes perspective
 * - claim-consequence : conflict between parties — claim → response → consequence
 * - discovery-explainer : unusual fact/explanation that counters common understanding
 */
export type StoryConcept =
  | 'character-journey'
  | 'comeback'
  | 'turning-point'
  | 'claim-consequence'
  | 'discovery-explainer';

/**
 * Narrative role of a story beat — independent from script section types.
 * These describe the beat's function in the story arc, not how it appears in the script.
 */
export type StoryBeatRole =
  | 'setup'          // introduces situation/context
  | 'tension'        // presents conflict/problem
  | 'turningPoint'   // pivotal moment or key evidence
  | 'resolution'     // outcome/result
  | 'reflection'     // commentary/analysis
  | 'conclusion';    // closing takeaway

/**
 * A single story beat — a time-bounded chunk of the source video with narrative metadata.
 * Each beat carries both the source timestamp (for visual clipping) and narrative structure.
 */
export interface StoryBeat {
  id: string;
  /** Narrative role this beat plays in the story arc. */
  role: StoryBeatRole;
  /** What this beat achieves in the story arc (e.g. "introduces the problem"). */
  purpose: string;
  /** Start time in the source video (seconds). */
  start: number;
  /** End time in the source video (seconds). */
  end: number;
  /** Direct verbatim excerpts from the transcript within this beat's range. */
  evidence: string[];
  /** Optional: the state of affairs before this beat's events (e.g. "start dari posisi belakang"). */
  kondisiAwal?: string;
  /** Optional: the conflict, tension, or obstacle introduced in this beat. */
  konflik?: string;
  /** Optional: the pivotal moment or turning point (if this beat contains one). */
  titikBalik?: string;
  /** Optional: the result or outcome established by this beat. */
  hasil?: string;
}

/**
 * The complete source-grounded story — concept + beats derived from transcript analysis.
 */
export interface SourceStory {
  /** Auto-detected story concept matching the source signals. */
  concept: StoryConcept;
  /** The main subject/protagonist of the story (name or description from transcript). */
  protagonist: string;
  /** One-sentence premise: what the story is about. */
  premise: string;
  /**
   * Chronological beats with source timestamps and narrative metadata.
   * 4-7 beats covering: setup → tension → turning point → outcome.
   */
  beats: StoryBeat[];
}

/**
 * Maps a story beat role to the closest script section type.
 * Used when connecting story beats to script sections.
 */
export function mapBeatRoleToSectionType(role: StoryBeatRole): ScriptSectionType {
  const mapping: Record<StoryBeatRole, ScriptSectionType> = {
    setup: 'context',
    tension: 'source',
    turningPoint: 'source',
    resolution: 'commentary',
    reflection: 'analysis',
    conclusion: 'conclusion',
  };
  return mapping[role];
}
