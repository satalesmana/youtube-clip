/**
 * Visual preset constants for the client UI.
 *
 * This is a client-side mirror of the server registry (src/types/visual-preset.ts).
 * Contains only label, description, and id — no rendering config.
 *
 * Keep in sync with the server registry when adding new presets.
 */
import type { VisualPresetId } from '../types';

export interface ClientVisualPreset {
  id:          VisualPresetId;
  label:       string;
  description: string;
  /** Short animation+highlight summary for the card badge row. */
  metaBadges:  string[];
  /** Static CSS class to simulate the visual style in the picker card preview. */
  previewClass: string;
}

/** All presets in display order. */
export const CLIENT_VISUAL_PRESETS: ClientVisualPreset[] = [
  {
    id:          'kinetic-punch',
    label:       '⚡ Kinetic Punch',
    description: 'Hard-hitting spring entrance with bold uppercase text and neon glow',
    metaBadges:  ['Spring', 'Neon Glow'],
    previewClass:'vp-preview-kinetic',
  },
  {
    id:          'curiosity-stack',
    label:       '🤔 Curiosity Stack',
    description: 'Words cascade in one by one, building anticipation',
    metaBadges:  ['Cascade', 'Neon Glow'],
    previewClass:'vp-preview-curiosity',
  },
  {
    id:          'story-slide',
    label:       '📖 Story Slide',
    description: 'Smooth upward reveal with clean typography and underline accents',
    metaBadges:  ['Slide Up', 'Underline'],
    previewClass:'vp-preview-story',
  },
  {
    id:          'minimal-question',
    label:       '❓ Question',
    description: 'Elegant slide-up with a question-mark decoration',
    metaBadges:  ['Slide Up', 'Decoration'],
    previewClass:'vp-preview-question',
  },
  {
    id:          'bold-impact',
    label:       '🔥 Bold Impact',
    description: 'Full-width scale burst with vivid chip highlights on key words',
    metaBadges:  ['Scale Burst', 'Chip'],
    previewClass:'vp-preview-bold',
  },
  {
    id:          'data-punch',
    label:       '📊 Data Punch',
    description: 'Scale-burst entrance with a number badge that emphasizes your stat',
    metaBadges:  ['Scale Burst', 'Badge'],
    previewClass:'vp-preview-data',
  },
  {
    id:          'opportunity-glow',
    label:       '💡 Opportunity Glow',
    description: 'Warm cascading words with an inviting glow on the key insight',
    metaBadges:  ['Cascade', 'Warm Glow'],
    previewClass:'vp-preview-opportunity',
  },
];

/** Quick lookup by ID. */
export const CLIENT_PRESET_MAP = Object.fromEntries(
  CLIENT_VISUAL_PRESETS.map((p) => [p.id, p])
) as Record<VisualPresetId, ClientVisualPreset>;

/**
 * Lightweight client-side helper to determine AI recommended preset
 * matching the server resolver table.
 */
export function resolvePresetIdFromHook(hookType?: string, angle?: string): VisualPresetId {
  if (hookType === 'question') return 'minimal-question';
  if (hookType === 'data-statistics') return 'data-punch';
  if (hookType === 'story-anecdote' || hookType === 'authority') return 'story-slide';
  if (hookType === 'intriguing-statement') {
    if (angle === 'contrarian' || angle === 'controversial') return 'bold-impact';
    return 'curiosity-stack';
  }
  if (hookType === 'shock-surprise' || hookType === 'direct-address') {
    return 'kinetic-punch';
  }
  if (hookType === 'you-focused' || hookType === 'problem-solution') {
    if (angle === 'opportunity' || angle === 'social-proof') return 'opportunity-glow';
    if (angle === 'curiosity') return 'curiosity-stack';
  }
  if (angle === 'fear' || angle === 'urgency' || angle === 'surprise') return 'kinetic-punch';
  if (angle === 'curiosity' || angle === 'prediction') return 'curiosity-stack';
  if (angle === 'opportunity' || angle === 'social-proof') return 'opportunity-glow';
  if (angle === 'contrarian' || angle === 'controversial') return 'bold-impact';
  if (angle === 'authority') return 'story-slide';
  return 'curiosity-stack';
}

export function resolvePresetLabelFromHook(hookType?: string, angle?: string): string {
  const id = resolvePresetIdFromHook(hookType, angle);
  return CLIENT_PRESET_MAP[id]?.label ?? '⚡ Kinetic Punch';
}

