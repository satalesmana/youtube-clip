import type { ContentGenre } from './genre.js';

/**
 * Audio output mode for the rendered video.
 *
 * - `strip_original` — (default) Remove all source audio and replace with TTS
 *                       narration. Standard pipeline behaviour for podcast,
 *                       tutorial, commentary.
 *
 * - `keep_original`  — Preserve the source audio track (crowd noise, music,
 *                       SFX, announcer). TTS synthesis is skipped entirely;
 *                       the LLM script is generated solely for subtitles /
 *                       captions. Ideal for match-highlight and gaming montages
 *                       where the atmosphere is part of the story.
 *
 * - `voice_over`     — Mix TTS narration on top of the source audio. The
 *                       source audio volume is attenuated (default −12 dB /
 *                       0.3 linear) so the narration remains intelligible.
 *                       Use for sports recap or highlight clips that need
 *                       a presenter voice alongside the crowd sound.
 */
export type AudioMode = 'strip_original' | 'keep_original' | 'voice_over';

/**
 * Per-genre audio mode defaults.
 * Applied only when the caller does NOT explicitly pass `audioMode`.
 */
const DEFAULT_AUDIO_MODE_BY_GENRE: Partial<Record<ContentGenre, AudioMode>> = {
  'match-highlight': 'keep_original',
};

/**
 * Resolves the effective audio mode from the caller-supplied value and the
 * optional genre hint.
 *
 * Priority:
 *  1. Explicitly requested `audioMode` (caller always wins).
 *  2. Genre default (e.g. `match-highlight` → `keep_original`).
 *  3. Global default: `strip_original`.
 */
export function resolveAudioMode(
  requested?: AudioMode,
  genre?: ContentGenre,
): AudioMode {
  if (requested) return requested;
  if (genre && DEFAULT_AUDIO_MODE_BY_GENRE[genre]) {
    return DEFAULT_AUDIO_MODE_BY_GENRE[genre]!;
  }
  return 'strip_original';
}
