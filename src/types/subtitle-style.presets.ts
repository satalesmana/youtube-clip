import type { AssStyleConfig } from './subtitle.js';

export type SubtitleStyleId = 'beast' | 'hormozi' | 'clean';

/**
 * Subtitle caption style presets — each maps a user-facing style name to a
 * full `AssStyleConfig`. Used by the transform controller to override the
 * environment-default `assStyle` with the user's chosen preset.
 *
 * beast   — Bold pop karaoke, yellow+cyan highlights. MrBeast / viral style.
 * hormozi — Impact font, white text on opaque black box. High contrast, clean.
 * clean   — Minimal elegant fade. Soft white, subtle shadow, no loud colors.
 */
export const SUBTITLE_STYLE_PRESETS: Record<SubtitleStyleId, AssStyleConfig> = {
  beast: {
    fontName: 'Arial Black',
    fontSize: 70,
    baseColorHex: '#FFFFFF',
    highlightColorHex: '#FFE500',
    keywordColorHex: '#00E5FF',
    outlineColorHex: '#000000',
    shadowColorHex: '#000000',
    outlineWidth: 5,
    shadowDepth: 3,
    verticalPositionFraction: 0.78,
    animationStyle: 'pop',
    uppercase: true,
  },

  hormozi: {
    fontName: 'Impact',
    fontSize: 66,
    baseColorHex: '#FFFFFF',
    highlightColorHex: '#FFFFFF',
    keywordColorHex: '#FFE500',
    outlineColorHex: '#000000',
    shadowColorHex: '#000000',
    outlineWidth: 3,
    shadowDepth: 0,
    verticalPositionFraction: 0.78,
    animationStyle: 'none',
    useOpaqueBox: true,
    boxPaddingPx: 14,
    uppercase: true,
  },

  clean: {
    fontName: 'Inter',
    fontSize: 54,
    baseColorHex: '#F0F0F0',
    highlightColorHex: '#FFFFFF',
    keywordColorHex: '#A3E635',
    outlineColorHex: '#000000',
    shadowColorHex: '#1A1A1A',
    outlineWidth: 2,
    shadowDepth: 3,
    verticalPositionFraction: 0.80,
    animationStyle: 'fade',
    uppercase: false,
  },
};

/** Returns the preset for the given style id, falling back to 'beast'. */
export function resolveSubtitleStyle(styleId?: string | null): AssStyleConfig {
  const normalized = styleId === 'mrbeast' ? 'beast' : styleId;
  if (normalized && normalized in SUBTITLE_STYLE_PRESETS) {
    return SUBTITLE_STYLE_PRESETS[normalized as SubtitleStyleId];
  }
  return SUBTITLE_STYLE_PRESETS.beast;
}
