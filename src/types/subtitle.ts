/** A single word within a subtitle event, timed relative to the clip's own start (0-based). */
export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
  isKeyword: boolean;
}

/**
 * One on-screen caption "event" (what the karaoke-style renderer shows at
 * once) — up to 4 words, wrapped across at most 2 lines.
 */
export interface SubtitleEvent {
  start: number;
  end: number;
  words: SubtitleWord[];
}

export type CaptionAnimationStyle = 'none' | 'karaoke' | 'pop' | 'fade' | 'slide';

export interface AssStyleConfig {
  fontName: string;
  fontSize: number;
  /** Base (not-yet-spoken) text color. */
  baseColorHex: string;
  /** Karaoke fill-in color for the currently-spoken word. */
  highlightColorHex: string;
  /** Extra accent color applied to detected keywords (numbers, money, names, ...). */
  keywordColorHex: string;
  outlineColorHex: string;
  shadowColorHex: string;
  outlineWidth: number;
  shadowDepth: number;
  verticalPositionFraction: number;
  animationStyle: CaptionAnimationStyle;
}
