/**
 * Viral Hook Text Style System — Authoritative Type Definitions + Registry
 *
 * Separation of concerns:
 *   HookType  — structural/rhetorical FORM of the hook (HOW it opens)
 *   HookAngle — emotional/rhetorical INTENT (WHY it should work)
 *   VisualPreset — pure visual configuration; contains NO semantic meaning
 *
 * Remotion receives only VisualPreset.
 * The resolver maps HookType + HookAngle → VisualPreset.
 */

// ─── Semantic layer (classification) ────────────────────────────────────────

/**
 * Structural / rhetorical form of the hook — describes HOW the hook opens.
 *
 * `direct-address` vs `you-focused`:
 *   - `direct-address` is speaker-centric and assertive: "I need to show you this."
 *     Authority comes from the speaker.
 *   - `you-focused` is audience-centric and empathetic: "For anyone who's ever felt…"
 *     The hook is about the viewer's identity or situation.
 * These map to different default visual presets, so both are retained.
 */
export type HookType =
  | 'direct-address'       // Speaker commands attention: "Stop what you're doing"
  | 'you-focused'          // Viewer's situation/identity: "If you've ever felt..."
  | 'question'             // Literal question posed to the viewer
  | 'intriguing-statement' // Bold, unexpected claim that demands explanation
  | 'shock-surprise'       // Leading with a shocking reveal or moment
  | 'story-anecdote'       // Narrative opening: "This happened to me..."
  | 'problem-solution'     // States the problem, hints at the solution
  | 'data-statistics'      // Leads with a number, stat, or quantified claim
  | 'authority'            // Establishes credibility / expertise first
  | 'visual';              // The visual itself is the hook (reaction, scene)

/**
 * Emotional / rhetorical angle — describes WHY the hook should stop the scroll.
 * Orthogonal to HookType: the same HookType can use many different angles.
 */
export type HookAngle =
  | 'curiosity'      // Create a knowledge gap / intrigue
  | 'fear'           // Loss aversion, risk, danger
  | 'urgency'        // FOMO, time pressure, "before it's too late"
  | 'contrarian'     // Against conventional wisdom
  | 'controversial'  // Divisive opinion likely to trigger debate
  | 'opportunity'    // Gain, advantage, growth, positive outcome
  | 'prediction'     // Future state / what's coming
  | 'authority'      // Trust, credibility, expert backing
  | 'social-proof'   // Validation: others are doing it / thinking it
  | 'surprise';      // Unexpected reveal, pattern interrupt

// ─── Visual layer (presentation) ────────────────────────────────────────────

/** Typography weight/style variant. Maps 1:1 to a Remotion renderer component. */
export type TypographyVariant = 'kinetic' | 'stacked' | 'minimal' | 'bold-caps';

/** Entrance animation preset. */
export type AnimationPreset = 'spring-punch' | 'word-cascade' | 'slide-up' | 'scale-burst';

/** Highlight treatment applied to accent words inside the headline. */
export type HighlightMode = 'neon-glow' | 'underline' | 'background-chip' | 'none';

/** Optional decoration added to the rendered headline. */
export type DecorationKind = 'question-mark' | 'number-badge';

/**
 * Typed union of all valid visual preset IDs.
 * This is the single source of truth for the preset vocabulary.
 *
 * To add a new preset:
 *   1. Add the ID here.
 *   2. Add the entry to VISUAL_PRESET_REGISTRY below.
 *   3. Mirror in compositions/studio/src/visual-preset/registry.ts.
 *   4. Mirror label+description in client/src/lib/visual-presets.ts.
 */
export type VisualPresetId =
  | 'kinetic-punch'    // Hard-impact spring entrance, uppercase, neon glow
  | 'curiosity-stack'  // Staggered per-word cascade, neon glow
  | 'story-slide'      // Smooth block slide-up, mixed case, underline
  | 'minimal-question' // Slide-up block, question-mark decoration
  | 'bold-impact'      // Full-width scale-burst, background chip highlight
  | 'data-punch'       // Scale-burst, number-badge decoration
  | 'opportunity-glow'; // Word cascade, warm accent glow

/**
 * A visual preset: purely visual configuration.
 * Remotion reads this. It does NOT read HookType or HookAngle.
 */
export interface VisualPreset {
  id:          VisualPresetId;
  /** Short UI display name shown to the user, e.g. "⚡ Kinetic Punch". */
  label:       string;
  /** One-line description for the preset picker card. */
  description: string;
  typography:  TypographyVariant;
  animation:   AnimationPreset;
  highlight:   HighlightMode;
  decoration?: DecorationKind;
}

// ─── Resolver input ──────────────────────────────────────────────────────────

/** Input to the visual preset resolver. */
export interface ResolveVisualPresetInput {
  /** Structural form of the hook from AI classification. */
  hookType?:     HookType;
  /** Emotional / rhetorical angle from AI classification. */
  angle?:        HookAngle;
  /** Explicit user selection. When present, always overrides the resolver. */
  manualPreset?: VisualPresetId;
}

// ─── Backward compatibility ──────────────────────────────────────────────────

/**
 * The original flat HookStyle type used by the LLM pipeline.
 * Retained as an alias so existing callers compile without changes.
 *
 * @deprecated Use HookType + HookAngle instead.
 */
export type LegacyHookStyle =
  | 'curiosity'
  | 'controversial'
  | 'question'
  | 'shock'
  | 'contrarian'
  | 'prediction'
  | 'story'
  | 'statistic'
  | 'fear'
  | 'opportunity';

// ─── Visual Preset Registry ──────────────────────────────────────────────────

/**
 * Single source of truth for all visual presets.
 * Remotion and the client UI mirror this registry.
 */
export const VISUAL_PRESET_REGISTRY: Record<VisualPresetId, VisualPreset> = {
  'kinetic-punch': {
    id:          'kinetic-punch',
    label:       '⚡ Kinetic Punch',
    description: 'Hard-hitting spring entrance with bold uppercase text and neon glow',
    typography:  'kinetic',
    animation:   'spring-punch',
    highlight:   'neon-glow',
  },
  'curiosity-stack': {
    id:          'curiosity-stack',
    label:       '🤔 Curiosity Stack',
    description: 'Words cascade in one by one, building anticipation',
    typography:  'stacked',
    animation:   'word-cascade',
    highlight:   'neon-glow',
  },
  'story-slide': {
    id:          'story-slide',
    label:       '📖 Story Slide',
    description: 'Smooth upward reveal with clean typography and underline accents',
    typography:  'minimal',
    animation:   'slide-up',
    highlight:   'underline',
  },
  'minimal-question': {
    id:          'minimal-question',
    label:       '❓ Question',
    description: 'Elegant slide-up with a question-mark decoration that draws attention',
    typography:  'minimal',
    animation:   'slide-up',
    highlight:   'underline',
    decoration:  'question-mark',
  },
  'bold-impact': {
    id:          'bold-impact',
    label:       '🔥 Bold Impact',
    description: 'Full-width scale burst with vivid chip highlights on key words',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'background-chip',
  },
  'data-punch': {
    id:          'data-punch',
    label:       '📊 Data Punch',
    description: 'Scale-burst entrance with a number badge that emphasizes your stat',
    typography:  'bold-caps',
    animation:   'scale-burst',
    highlight:   'background-chip',
    decoration:  'number-badge',
  },
  'opportunity-glow': {
    id:          'opportunity-glow',
    label:       '💡 Opportunity Glow',
    description: 'Warm cascading words with an inviting glow on the key insight',
    typography:  'stacked',
    animation:   'word-cascade',
    highlight:   'neon-glow',
  },
};

/** Ordered list of presets for the UI picker (most commonly useful first). */
export const VISUAL_PRESET_ORDER: VisualPresetId[] = [
  'kinetic-punch',
  'curiosity-stack',
  'story-slide',
  'minimal-question',
  'bold-impact',
  'data-punch',
  'opportunity-glow',
];

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Pass-1 lookup: specific HookType × HookAngle combinations.
 * Key format: `${hookType}:${angle}`.
 */
const SPECIFIC_RULES: Partial<Record<string, VisualPresetId>> = {
  // question → minimal-question regardless of angle
  'question:curiosity':     'minimal-question',
  'question:fear':          'minimal-question',
  'question:urgency':       'minimal-question',
  'question:contrarian':    'minimal-question',
  'question:controversial': 'minimal-question',
  'question:opportunity':   'minimal-question',
  'question:prediction':    'minimal-question',
  'question:authority':     'minimal-question',
  'question:social-proof':  'minimal-question',
  'question:surprise':      'minimal-question',

  // data-statistics → data-punch regardless of angle
  'data-statistics:curiosity':     'data-punch',
  'data-statistics:fear':          'data-punch',
  'data-statistics:urgency':       'data-punch',
  'data-statistics:contrarian':    'data-punch',
  'data-statistics:controversial': 'data-punch',
  'data-statistics:opportunity':   'data-punch',
  'data-statistics:prediction':    'data-punch',
  'data-statistics:authority':     'data-punch',
  'data-statistics:social-proof':  'data-punch',
  'data-statistics:surprise':      'data-punch',

  // story-anecdote → story-slide regardless of angle
  'story-anecdote:curiosity':     'story-slide',
  'story-anecdote:fear':          'story-slide',
  'story-anecdote:urgency':       'story-slide',
  'story-anecdote:contrarian':    'story-slide',
  'story-anecdote:controversial': 'story-slide',
  'story-anecdote:opportunity':   'story-slide',
  'story-anecdote:prediction':    'story-slide',
  'story-anecdote:authority':     'story-slide',
  'story-anecdote:social-proof':  'story-slide',
  'story-anecdote:surprise':      'story-slide',

  // authority → story-slide regardless of angle
  'authority:curiosity':     'story-slide',
  'authority:fear':          'story-slide',
  'authority:urgency':       'story-slide',
  'authority:contrarian':    'story-slide',
  'authority:controversial': 'story-slide',
  'authority:opportunity':   'story-slide',
  'authority:prediction':    'story-slide',
  'authority:authority':     'story-slide',
  'authority:social-proof':  'story-slide',
  'authority:surprise':      'story-slide',

  // intriguing-statement — varies by angle
  'intriguing-statement:contrarian':    'bold-impact',
  'intriguing-statement:controversial': 'bold-impact',
  'intriguing-statement:curiosity':     'curiosity-stack',
  'intriguing-statement:prediction':    'curiosity-stack',
  'intriguing-statement:surprise':      'kinetic-punch',
  'intriguing-statement:fear':          'kinetic-punch',
  'intriguing-statement:urgency':       'kinetic-punch',

  // shock-surprise
  'shock-surprise:fear':     'kinetic-punch',
  'shock-surprise:urgency':  'kinetic-punch',
  'shock-surprise:surprise': 'kinetic-punch',

  // direct-address
  'direct-address:fear':     'kinetic-punch',
  'direct-address:urgency':  'kinetic-punch',
  'direct-address:surprise': 'kinetic-punch',

  // you-focused
  'you-focused:opportunity':  'opportunity-glow',
  'you-focused:social-proof': 'opportunity-glow',
  'you-focused:curiosity':    'curiosity-stack',

  // problem-solution
  'problem-solution:opportunity': 'opportunity-glow',
  'problem-solution:fear':        'kinetic-punch',
  'problem-solution:urgency':     'kinetic-punch',

  // visual
  'visual:surprise':  'kinetic-punch',
  'visual:curiosity': 'curiosity-stack',
};

/**
 * Sentinel keys used to detect "hookType alone is decisive" (Pass 1b).
 * These are hookTypes where any angle still resolves to the same preset.
 */
const HOOKTYPE_DECISIVE: Partial<Record<HookType, VisualPresetId>> = {
  'question':        'minimal-question',
  'data-statistics': 'data-punch',
  'story-anecdote':  'story-slide',
  'authority':       'story-slide',
};

/**
 * Pass-2 fallback: angle-only rules when no specific hookType × angle match exists.
 */
const ANGLE_FALLBACK: Partial<Record<HookAngle, VisualPresetId>> = {
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

/** Ultimate visual fallback — used when no rule matches. Not a semantic assertion. */
const DEFAULT_PRESET_ID: VisualPresetId = 'kinetic-punch';

/**
 * Resolves the visual preset to use for a hook intro.
 *
 * Priority order:
 *   1. `manualPreset` — user selection always wins.
 *   2. Specific `hookType × angle` rule (SPECIFIC_RULES).
 *   3. `hookType` alone is decisive (HOOKTYPE_DECISIVE).
 *   4. `angle`-only fallback (ANGLE_FALLBACK).
 *   5. Ultimate visual fallback: `kinetic-punch`.
 *
 * Pure function — deterministic, no side effects, fully testable.
 */
export function resolveVisualPreset(input: ResolveVisualPresetInput): VisualPreset {
  const { hookType, angle, manualPreset } = input;

  // Pass 0: Manual override always wins.
  if (manualPreset && VISUAL_PRESET_REGISTRY[manualPreset]) {
    return VISUAL_PRESET_REGISTRY[manualPreset];
  }

  // Pass 1: Specific hookType × angle rule.
  if (hookType && angle) {
    const key = `${hookType}:${angle}`;
    const match = SPECIFIC_RULES[key];
    if (match) return VISUAL_PRESET_REGISTRY[match];
  }

  // Pass 1b: HookType alone is decisive (some types map to same preset regardless of angle).
  if (hookType && HOOKTYPE_DECISIVE[hookType]) {
    return VISUAL_PRESET_REGISTRY[HOOKTYPE_DECISIVE[hookType]!];
  }

  // Pass 2: Angle-only fallback.
  if (angle && ANGLE_FALLBACK[angle]) {
    return VISUAL_PRESET_REGISTRY[ANGLE_FALLBACK[angle]!];
  }

  // Pass 3: Ultimate visual fallback.
  return VISUAL_PRESET_REGISTRY[DEFAULT_PRESET_ID];
}

// ─── Backward compatibility adapter ─────────────────────────────────────────

/**
 * Maps old LegacyHookStyle string values to VisualPresetId.
 * Used only by the compatibility adapter — never spread to new code.
 */
const LEGACY_HOOK_STYLE_MAP: Record<LegacyHookStyle, VisualPresetId> = {
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
 * Returns `undefined` when the value is absent or unrecognized.
 *
 * Use this ONLY in compatibility shims (e.g., HookIntroShort for old props).
 * Do NOT use this in new code paths.
 *
 * @deprecated Will be removed once all callers use visualPresetId.
 */
export function adaptLegacyHookStyle(legacy?: string): VisualPresetId | undefined {
  if (!legacy) return undefined;
  return LEGACY_HOOK_STYLE_MAP[legacy as LegacyHookStyle];
}
