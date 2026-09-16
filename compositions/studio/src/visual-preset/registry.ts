/**
 * Visual Preset Registry — Remotion Studio mirror.
 *
 * This file mirrors src/types/visual-preset.ts (server authoritative).
 * All preset IDs and visual config values MUST stay in sync with the server.
 * The server is the source of truth for types; this file owns the rendering.
 *
 * Do NOT import from the server workspace here (different module systems).
 */

// ─── Types (mirrored from src/types/visual-preset.ts) ───────────────────────

export type VisualPresetId =
  | 'kinetic-punch'
  | 'curiosity-stack'
  | 'story-slide'
  | 'minimal-question'
  | 'bold-impact'
  | 'data-punch'
  | 'opportunity-glow'
  | 'focus-brush'
  | 'clean-fade'
  | 'scribble-quote'
  | 'action-pointer'
  | 'burst-stat';

export type TypographyVariant =
  | 'kinetic'
  | 'stacked'
  | 'minimal'
  | 'bold-caps'
  | 'bebas-neue'
  | 'montserrat'
  | 'anton'
  | 'archivo-black'
  | 'poppins'
  | 'oswald'
  | 'barlow-condensed';
export type AnimationPreset   = 'spring-punch' | 'word-cascade' | 'slide-up' | 'scale-burst' | 'fade';
export type HighlightMode     = 'neon-glow' | 'underline' | 'background-chip' | 'brush' | 'stroke' | 'box' | 'none';
export type DecorationKind    =
  | 'question-mark'
  | 'number-badge'
  | 'arrow'
  | 'scribble'
  | 'spark'
  | 'burst'
  | 'corner-frame'
  | 'question-doodle';

export type CompositionLayout =
  | 'centered'
  | 'top-heavy'
  | 'split-proof'
  | 'full-screen-text'
  | 'subject-first'
  | 'data-focus'
  | 'question-focus';

/** Visual-only configuration — the only thing Remotion needs to know. */
export interface VisualPreset {
  id:          VisualPresetId;
  label:       string;
  description: string;
  typography:  TypographyVariant;
  animation:   AnimationPreset;
  highlight:   HighlightMode;
  decoration?: DecorationKind;
  layout?:     CompositionLayout;
}

export interface ResolveVisualPresetInput {
  hookType?:     string; // Using string here so old hookStyle values work without importing HookType
  angle?:        string;
  manualPreset?: VisualPresetId;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const VISUAL_PRESET_REGISTRY: Record<VisualPresetId, VisualPreset> = {
  'kinetic-punch': {
    id:          'kinetic-punch',
    label:       '⚡ Kinetic Punch',
    description: 'Hard-hitting spring entrance with bold uppercase text and neon glow',
    typography:  'kinetic',
    animation:   'spring-punch',
    highlight:   'neon-glow',
    layout:      'centered',
  },
  'curiosity-stack': {
    id:          'curiosity-stack',
    label:       '🤔 Curiosity Stack',
    description: 'Words cascade in one by one, building anticipation',
    typography:  'stacked',
    animation:   'word-cascade',
    highlight:   'neon-glow',
    layout:      'subject-first',
  },
  'story-slide': {
    id:          'story-slide',
    label:       '📖 Story Slide',
    description: 'Smooth upward reveal with clean typography and underline accents',
    typography:  'minimal',
    animation:   'slide-up',
    highlight:   'underline',
    layout:      'centered',
  },
  'minimal-question': {
    id:          'minimal-question',
    label:       '❓ Question',
    description: 'Elegant slide-up with a question-mark decoration that draws attention',
    typography:  'minimal',
    animation:   'slide-up',
    highlight:   'underline',
    decoration:  'question-mark',
    layout:      'question-focus',
  },
  'bold-impact': {
    id:          'bold-impact',
    label:       '🔥 Bold Impact',
    description: 'Full-width scale burst with vivid chip highlights on key words',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'background-chip',
    layout:      'top-heavy',
  },
  'data-punch': {
    id:          'data-punch',
    label:       '📊 Data Punch',
    description: 'Scale-burst entrance with a number badge that emphasizes your stat',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'background-chip',
    decoration:  'number-badge',
    layout:      'data-focus',
  },
  'opportunity-glow': {
    id:          'opportunity-glow',
    label:       '💡 Opportunity Glow',
    description: 'Warm cascading words with an inviting glow on the key insight',
    typography:  'stacked',
    animation:   'word-cascade',
    highlight:   'neon-glow',
    layout:      'centered',
  },
  'focus-brush': {
    id:          'focus-brush',
    label:       '🖌️ Focus Brush',
    description: 'Vibrant brush stroke highlight with sparkling attention accents',
    typography:  'kinetic',
    animation:   'spring-punch',
    highlight:   'brush',
    decoration:  'spark',
    layout:      'top-heavy',
  },
  'clean-fade': {
    id:          'clean-fade',
    label:       '✨ Clean Fade',
    description: 'Smooth elegant fade entrance with framing corner brackets',
    typography:  'minimal',
    animation:   'fade',
    highlight:   'box',
    decoration:  'corner-frame',
    layout:      'centered',
  },
  'scribble-quote': {
    id:          'scribble-quote',
    label:       '✏️ Scribble Accent',
    description: 'Playful hand-drawn scribble with outlined keyword emphasis',
    typography:  'stacked',
    animation:   'word-cascade',
    highlight:   'stroke',
    decoration:  'scribble',
    layout:      'subject-first',
  },
  'action-pointer': {
    id:          'action-pointer',
    label:       '👉 Action Pointer',
    description: 'High-energy scale burst with an action arrow directing focus',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'background-chip',
    decoration:  'arrow',
    layout:      'split-proof',
  },
  'burst-stat': {
    id:          'burst-stat',
    label:       '💥 Viral Burst',
    description: 'Dynamic burst rays framing full-screen bold claims',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'neon-glow',
    decoration:  'burst',
    layout:      'full-screen-text',
  },
};

// ─── Resolver ────────────────────────────────────────────────────────────────

const HOOKTYPE_DECISIVE: Partial<Record<string, VisualPresetId>> = {
  'question':        'minimal-question',
  'data-statistics': 'data-punch',
  'story-anecdote':  'story-slide',
  'authority':       'story-slide',
};

const ANGLE_FALLBACK: Partial<Record<string, VisualPresetId>> = {
  fear:           'kinetic-punch',
  urgency:        'kinetic-punch',
  surprise:       'kinetic-punch',
  curiosity:      'curiosity-stack',
  prediction:     'curiosity-stack',
  opportunity:    'opportunity-glow',
  'social-proof': 'opportunity-glow',
  contrarian:     'bold-impact',
  controversial:  'bold-impact',
  authority:      'story-slide',
};

const SPECIFIC_RULES: Partial<Record<string, VisualPresetId>> = {
  'question:curiosity':             'minimal-question',
  'question:fear':                  'minimal-question',
  'question:urgency':               'minimal-question',
  'question:contrarian':            'minimal-question',
  'question:controversial':         'minimal-question',
  'question:opportunity':           'minimal-question',
  'question:prediction':            'minimal-question',
  'question:authority':             'minimal-question',
  'question:social-proof':          'minimal-question',
  'question:surprise':              'minimal-question',
  'data-statistics:curiosity':      'data-punch',
  'data-statistics:fear':           'data-punch',
  'data-statistics:urgency':        'data-punch',
  'data-statistics:contrarian':     'data-punch',
  'data-statistics:controversial':  'data-punch',
  'data-statistics:opportunity':    'data-punch',
  'data-statistics:prediction':     'data-punch',
  'data-statistics:authority':      'data-punch',
  'data-statistics:social-proof':   'data-punch',
  'data-statistics:surprise':       'data-punch',
  'story-anecdote:curiosity':       'story-slide',
  'story-anecdote:fear':            'story-slide',
  'story-anecdote:urgency':         'story-slide',
  'story-anecdote:contrarian':      'story-slide',
  'story-anecdote:controversial':   'story-slide',
  'story-anecdote:opportunity':     'story-slide',
  'story-anecdote:prediction':      'story-slide',
  'story-anecdote:authority':       'story-slide',
  'story-anecdote:social-proof':    'story-slide',
  'story-anecdote:surprise':        'story-slide',
  'authority:curiosity':            'story-slide',
  'authority:fear':                 'story-slide',
  'authority:urgency':              'story-slide',
  'authority:contrarian':           'story-slide',
  'authority:controversial':        'story-slide',
  'authority:opportunity':          'story-slide',
  'authority:prediction':           'story-slide',
  'authority:authority':            'story-slide',
  'authority:social-proof':         'story-slide',
  'authority:surprise':             'story-slide',
  'intriguing-statement:contrarian':    'bold-impact',
  'intriguing-statement:controversial': 'bold-impact',
  'intriguing-statement:curiosity':     'curiosity-stack',
  'intriguing-statement:prediction':    'curiosity-stack',
  'intriguing-statement:surprise':      'kinetic-punch',
  'intriguing-statement:fear':          'kinetic-punch',
  'intriguing-statement:urgency':       'kinetic-punch',
  'shock-surprise:fear':                'kinetic-punch',
  'shock-surprise:urgency':             'kinetic-punch',
  'shock-surprise:surprise':            'kinetic-punch',
  'direct-address:fear':                'kinetic-punch',
  'direct-address:urgency':             'kinetic-punch',
  'direct-address:surprise':            'kinetic-punch',
  'you-focused:opportunity':            'opportunity-glow',
  'you-focused:social-proof':           'opportunity-glow',
  'you-focused:curiosity':              'curiosity-stack',
  'problem-solution:opportunity':       'opportunity-glow',
  'problem-solution:fear':              'kinetic-punch',
  'problem-solution:urgency':           'kinetic-punch',
  'visual:surprise':                    'kinetic-punch',
  'visual:curiosity':                   'curiosity-stack',
};

const DEFAULT_PRESET_ID: VisualPresetId = 'kinetic-punch';

/**
 * Resolves the visual preset for a hook intro.
 * Priority: manualPreset > hookType×angle > hookType-alone > angle-only > default.
 */
export function resolveVisualPreset(input: ResolveVisualPresetInput): VisualPreset {
  const { hookType, angle, manualPreset } = input;

  if (manualPreset && VISUAL_PRESET_REGISTRY[manualPreset]) {
    return VISUAL_PRESET_REGISTRY[manualPreset];
  }

  if (hookType && angle) {
    const key = `${hookType}:${angle}`;
    const match = SPECIFIC_RULES[key];
    if (match) return VISUAL_PRESET_REGISTRY[match];
  }

  if (hookType && HOOKTYPE_DECISIVE[hookType]) {
    return VISUAL_PRESET_REGISTRY[HOOKTYPE_DECISIVE[hookType]!];
  }

  if (angle && ANGLE_FALLBACK[angle]) {
    return VISUAL_PRESET_REGISTRY[ANGLE_FALLBACK[angle]!];
  }

  return VISUAL_PRESET_REGISTRY[DEFAULT_PRESET_ID];
}

// ─── Backward compatibility adapter ─────────────────────────────────────────

const LEGACY_HOOK_STYLE_MAP: Partial<Record<string, VisualPresetId>> = {
  shock:         'kinetic-punch',
  fear:          'kinetic-punch',
  curiosity:     'curiosity-stack',
  prediction:    'curiosity-stack',
  opportunity:   'opportunity-glow',
  story:         'story-slide',
  question:      'minimal-question',
  controversial: 'bold-impact',
  contrarian:    'bold-impact',
  statistic:     'data-punch',
};

/**
 * Adapter: converts a legacy hookStyle string to a VisualPresetId.
 * @deprecated Use visualPresetId from props instead.
 */
export function adaptLegacyHookStyle(legacy?: string): VisualPresetId | undefined {
  if (!legacy) return undefined;
  return LEGACY_HOOK_STYLE_MAP[legacy];
}
