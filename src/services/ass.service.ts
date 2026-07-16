import type { AssStyleConfig, SubtitleEvent, SubtitleWord } from '../types/subtitle.js';

export interface AssServiceOptions {
  playResX: number;
  playResY: number;
}

/** Serializes subtitle events into an ASS (Advanced SubStation Alpha) file. */
export interface IAssService {
  render(events: SubtitleEvent[], style: AssStyleConfig): string;
}

const POP_DURATION_MS = 120;
const FADE_IN_MS = 200;
const SLIDE_DISTANCE_PX = 60;
const SLIDE_DURATION_MS = 200;

function formatAssTime(seconds: number): string {
  const centis = Math.max(0, Math.round(seconds * 100));
  const totalSeconds = Math.floor(centis / 100);
  const cs = centis % 100;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Converts a `#RRGGBB` web color into ASS's `&H00BBGGRR&` format. */
function hexToAssColor(hex: string): string {
  const clean = hex.replace('#', '').padEnd(6, '0');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text.replace(/[{}]/g, '').replace(/\n/g, ' ');
}

/** Splits an event's words into at most 2 display lines (≤4 words total per event). */
function splitIntoLines(words: SubtitleWord[]): SubtitleWord[][] {
  if (words.length <= 2) return [words];
  const firstLineCount = Math.ceil(words.length / 2);
  return [words.slice(0, firstLineCount), words.slice(firstLineCount)];
}

export class AssService implements IAssService {
  constructor(private readonly options: AssServiceOptions) {}

  render(events: SubtitleEvent[], style: AssStyleConfig): string {
    return [this.buildHeader(), this.buildStyles(style), this.buildEvents(events, style)].join('\n\n');
  }

  private buildHeader(): string {
    return [
      '[Script Info]',
      'ScriptType: v4.00+',
      'WrapStyle: 2',
      'ScaledBorderAndShadow: yes',
      `PlayResX: ${this.options.playResX}`,
      `PlayResY: ${this.options.playResY}`,
    ].join('\n');
  }

  private buildStyles(style: AssStyleConfig): string {
    // Alignment 2 = bottom-center. MarginV pushes the baseline up from the
    // bottom edge so the caption lands at `verticalPositionFraction` down
    // the frame (e.g. 0.75 => captions sit at ~75% height, i.e. 25% margin
    // from the bottom).
    const marginV = Math.round(this.options.playResY * (1 - style.verticalPositionFraction));
    const marginLR = Math.round(this.options.playResX * 0.08);

    // NOTE: ASS "PrimaryColour" is the karaoke fill-in (already-spoken) color;
    // "SecondaryColour" is the base (not-yet-spoken) color underneath it.
    const styleLine = [
      'Default',
      style.fontName,
      style.fontSize,
      hexToAssColor(style.highlightColorHex),
      hexToAssColor(style.baseColorHex),
      hexToAssColor(style.outlineColorHex),
      hexToAssColor(style.shadowColorHex),
      -1, // Bold
      0, // Italic
      0, // Underline
      0, // StrikeOut
      100, // ScaleX
      100, // ScaleY
      0, // Spacing
      0, // Angle
      1, // BorderStyle (outline + drop shadow)
      style.outlineWidth,
      style.shadowDepth,
      2, // Alignment: bottom-center
      marginLR,
      marginLR,
      marginV,
      1, // Encoding
    ].join(',');

    return [
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: ${styleLine}`,
    ].join('\n');
  }

  private buildEvents(events: SubtitleEvent[], style: AssStyleConfig): string {
    const lines = events.map((event) => this.buildDialogueLine(event, style));

    return [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ...lines,
    ].join('\n');
  }

  private buildDialogueLine(event: SubtitleEvent, style: AssStyleConfig): string {
    const text = this.buildEventText(event, style);
    return `Dialogue: 0,${formatAssTime(event.start)},${formatAssTime(event.end)},Default,,0,0,0,,${text}`;
  }

  private buildEventText(event: SubtitleEvent, style: AssStyleConfig): string {
    const lines = splitIntoLines(event.words);
    const lineText = lines.map((line) => this.buildWordRun(line, event, style)).join('\\N');

    if (style.animationStyle === 'fade') {
      return `{\\fad(${FADE_IN_MS},0)}${lineText}`;
    }

    if (style.animationStyle === 'slide') {
      const marginV = Math.round(this.options.playResY * (1 - style.verticalPositionFraction));
      const anchorX = Math.round(this.options.playResX / 2);
      const anchorY = this.options.playResY - marginV;
      return `{\\an2\\move(${anchorX},${anchorY + SLIDE_DISTANCE_PX},${anchorX},${anchorY},0,${SLIDE_DURATION_MS})}${lineText}`;
    }

    return lineText;
  }

  /** Builds one display line's worth of words, with karaoke timing and keyword/pop styling. */
  private buildWordRun(words: SubtitleWord[], event: SubtitleEvent, style: AssStyleConfig): string {
    if (style.animationStyle === 'none') {
      return words
        .map((word) => {
          const color = word.isKeyword ? style.keywordColorHex : style.baseColorHex;
          const scale = word.isKeyword ? '\\fscx115\\fscy115' : '';
          return `{\\1c${hexToAssColor(color)}${scale}}${escapeAssText(word.text)}`;
        })
        .join(' ');
    }

    let out = '';
    let cursor = 0;

    for (const word of words) {
      const gapSeconds = Math.max(0, word.start - event.start - cursor);
      if (gapSeconds > 0.02) {
        out += `{\\k${Math.round(gapSeconds * 100)}}`;
      }

      const wordDuration = Math.max(0.01, word.end - word.start);
      const color = word.isKeyword ? style.keywordColorHex : style.highlightColorHex;
      const keywordScale = word.isKeyword ? '\\fscx115\\fscy115\\b1' : '';

      let popTags = '';
      if (style.animationStyle === 'pop') {
        const t1 = Math.round((word.start - event.start) * 1000);
        const popMs = Math.min(POP_DURATION_MS, Math.round(wordDuration * 1000 * 0.4));
        popTags = `\\t(${t1},${t1 + popMs},\\fscx130\\fscy130)\\t(${t1 + popMs},${t1 + popMs * 2},\\fscx100\\fscy100)`;
      }

      out += `{\\1c${hexToAssColor(color)}${keywordScale}${popTags}\\k${Math.round(wordDuration * 100)}}${escapeAssText(word.text)} `;
      cursor = word.end - event.start;
    }

    return out.trimEnd();
  }
}
