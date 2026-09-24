/**
 * Domain entities for Intro & Outro Cards (Clean Architecture - Layer 1).
 */

import type { OutroPresetId } from './outro-preset.js';

/** Configuration for an intro hook card. */
export interface IntroCardConfig {
  headlineText: string;
  badge?: string;
  durationSeconds: number;
  themeSeed?: string;
}

/** Configuration for an outro call-to-action (CTA) card. */
export interface OutroCardConfig {
  channelName?: string;
  ctaText: string;
  handle?: string;
  creatorLogoUrl?: string;
  durationSeconds: number;
  presetId?: OutroPresetId;
  buttonText?: string;
}

