/**
 * HookHeadline — Pure dispatcher.
 *
 * Receives a resolved VisualPreset and dispatches to the appropriate renderer.
 * Does NOT know about HookType, HookAngle, or any semantic classification.
 * All rendering logic lives in the individual renderer components.
 *
 * Dispatch table:
 *   typography: 'kinetic'    → KineticRenderer    (spring-punch, neon-glow)
 *   typography: 'stacked'    → WordCascadeRenderer (word-cascade)
 *   typography: 'minimal'    → SlideUpRenderer     (slide-up)
 *   typography: 'bold-caps'  → BoldCapsRenderer    (scale-burst, chip)
 *
 * When visualPreset is absent, falls back to KineticRenderer
 * (identical to pre-Phase-4 behavior — backward compat guaranteed).
 */
import * as React from 'react';
import type { Theme } from './design';
import type { PlanCaption } from './types';
import type { VisualPreset } from './visual-preset/index';
import { KineticRenderer } from './headline-renderers/KineticRenderer';
import { WordCascadeRenderer } from './headline-renderers/WordCascadeRenderer';
import { SlideUpRenderer } from './headline-renderers/SlideUpRenderer';
import { BoldCapsRenderer } from './headline-renderers/BoldCapsRenderer';
import { VISUAL_PRESET_REGISTRY } from './visual-preset/index';

interface HookHeadlineProps {
  text: string;
  theme: Theme;
  tag?: string;
  highlightWords?: string[];
  /** Resolved visual preset. When absent, kinetic-punch is used. */
  visualPreset?: VisualPreset;
  /** Retained for future word-sync captions — not currently used by renderers. */
  wordTimings?: PlanCaption['wordTimings'];
  absoluteStartFrame?: number;
  durationFrames?: number;
}

export const HookHeadline: React.FC<HookHeadlineProps> = ({
  text,
  theme,
  tag,
  highlightWords,
  visualPreset,
}) => {
  // Default to kinetic-punch when no preset is resolved (backward compat).
  const preset: VisualPreset = visualPreset ?? VISUAL_PRESET_REGISTRY['kinetic-punch'];

  const commonProps = { text, theme, tag, highlightWords, visualPreset: preset };

  switch (preset.typography) {
    case 'stacked':
      return <WordCascadeRenderer {...commonProps} />;
    case 'minimal':
      return <SlideUpRenderer {...commonProps} />;
    case 'bold-caps':
      return <BoldCapsRenderer {...commonProps} />;
    case 'kinetic':
    default:
      return <KineticRenderer {...commonProps} />;
  }
};