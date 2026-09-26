// =============================================================================
// audio-catalog.ts
// Kurasi track audio bebas royalti yang di-host di CDN publik (CORS-friendly).
// Sumber: Pixabay Audio (pixabay.com/music) & Internet Archive (archive.org)
// =============================================================================

export type MusicGenre = 'lofi' | 'phonk' | 'cinematic' | 'upbeat' | 'ambient';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: MusicGenre;
  genreLabel: string;
  genreEmoji: string;
  durationSec: number;
  bpm?: number;
  streamUrl: string;    // Direct CDN URL to MP3 - must be CORS-friendly / public
  coverUrl: string;     // Thumbnail/cover image URL
  tags: string[];       // Descriptive tags
  license: string;      // License info
}

export const AUDIO_CATALOG: MusicTrack[] = [
  // --- Lo-Fi Chill & Study ---
  {
    id: 'lofi-chill-01',
    title: 'Café Memories',
    artist: 'Lofi Fruits Music',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 60,
    bpm: 85,
    streamUrl: '/audio/lofi-chill-01.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80',
    tags: ['chill', 'study', 'relax', 'cafe', 'lo-fi', 'indie'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'lofi-chill-02',
    title: 'Rainy Afternoon',
    artist: 'ChilledCow',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 60,
    bpm: 78,
    streamUrl: '/audio/lofi-chill-02.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?auto=format&fit=crop&w=300&q=80',
    tags: ['rain', 'lofi', 'calm', 'chill', 'cozy', 'dreamy'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'lofi-chill-03',
    title: 'Late Night Drive',
    artist: 'Frak',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 60,
    bpm: 92,
    streamUrl: '/audio/lofi-chill-03.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=300&q=80',
    tags: ['night', 'drive', 'chill', 'lofi', 'city', 'ambient'],
    license: 'Royalty-Free Built-in Audio',
  },

  // --- Phonk & High Energy ---
  {
    id: 'phonk-hype-01',
    title: 'Dark Drift',
    artist: 'SoundProducerTV',
    genre: 'phonk',
    genreLabel: 'Phonk & High Energy',
    genreEmoji: '⚡',
    durationSec: 60,
    bpm: 140,
    streamUrl: '/audio/phonk-hype-01.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    tags: ['phonk', 'hype', 'energy', 'viral', 'gaming', 'bass', 'aggressive'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'phonk-hype-02',
    title: 'Sigma Motivation',
    artist: 'Infraction Music',
    genre: 'phonk',
    genreLabel: 'Phonk & High Energy',
    genreEmoji: '⚡',
    durationSec: 60,
    bpm: 138,
    streamUrl: '/audio/phonk-hype-02.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=300&q=80',
    tags: ['motivation', 'sigma', 'gym', 'workout', 'phonk', 'energy'],
    license: 'Royalty-Free Built-in Audio',
  },

  // --- Cinematic & Mystery ---
  {
    id: 'cinematic-01',
    title: 'Mysterious Revelation',
    artist: 'Scott Buckley',
    genre: 'cinematic',
    genreLabel: 'Cinematic & Mystery',
    genreEmoji: '🎬',
    durationSec: 60,
    bpm: 72,
    streamUrl: '/audio/cinematic-01.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1518066000714-58c45f1d0898?auto=format&fit=crop&w=300&q=80',
    tags: ['cinematic', 'mystery', 'suspense', 'drama', 'dark', 'storytelling'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'cinematic-02',
    title: 'Epic Tension Build',
    artist: 'Keys of Moon',
    genre: 'cinematic',
    genreLabel: 'Cinematic & Mystery',
    genreEmoji: '🎬',
    durationSec: 60,
    bpm: 80,
    streamUrl: '/audio/cinematic-02.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=80',
    tags: ['epic', 'tension', 'build', 'cinematic', 'trailer', 'investigation'],
    license: 'Royalty-Free Built-in Audio',
  },

  // --- Upbeat Pop & Tech ---
  {
    id: 'upbeat-tech-01',
    title: 'Innovation Drive',
    artist: 'Punch Deck',
    genre: 'upbeat',
    genreLabel: 'Upbeat Pop & Tech',
    genreEmoji: '🚀',
    durationSec: 60,
    bpm: 128,
    streamUrl: '/audio/upbeat-tech-01.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=300&q=80',
    tags: ['tech', 'innovation', 'upbeat', 'business', 'corporate', 'tutorial', 'modern'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'upbeat-tech-02',
    title: 'Digital Future',
    artist: 'Roman Senyk',
    genre: 'upbeat',
    genreLabel: 'Upbeat Pop & Tech',
    genreEmoji: '🚀',
    durationSec: 60,
    bpm: 124,
    streamUrl: '/audio/upbeat-tech-02.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80',
    tags: ['digital', 'future', 'tech', 'pop', 'upbeat', 'review'],
    license: 'Royalty-Free Built-in Audio',
  },

  // --- Ambient & Acoustic ---
  {
    id: 'ambient-01',
    title: 'Morning Light',
    artist: 'Olexy',
    genre: 'ambient',
    genreLabel: 'Ambient & Acoustic',
    genreEmoji: '🍃',
    durationSec: 60,
    bpm: 65,
    streamUrl: '/audio/ambient-01.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=300&q=80',
    tags: ['ambient', 'acoustic', 'morning', 'vlog', 'nature', 'peaceful'],
    license: 'Royalty-Free Built-in Audio',
  },
  {
    id: 'ambient-02',
    title: 'Quiet Forest',
    artist: 'Naturum',
    genre: 'ambient',
    genreLabel: 'Ambient & Acoustic',
    genreEmoji: '🍃',
    durationSec: 60,
    bpm: 60,
    streamUrl: '/audio/ambient-02.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=300&q=80',
    tags: ['ambient', 'forest', 'nature', 'relax', 'quiet', 'acoustic'],
    license: 'Royalty-Free Built-in Audio',
  },
];

export const MUSIC_GENRES: Array<{
  id: MusicGenre;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    id: 'lofi',
    label: 'Lo-Fi Chill & Study',
    emoji: '☕',
    description: 'Santai, edukatif, podcast, storytelling',
  },
  {
    id: 'phonk',
    label: 'Phonk & High Energy',
    emoji: '⚡',
    description: 'Gaming, motivasi, viral shorts, hype',
  },
  {
    id: 'cinematic',
    label: 'Cinematic & Mystery',
    emoji: '🎬',
    description: 'Drama, investigasi, fakta mengejutkan',
  },
  {
    id: 'upbeat',
    label: 'Upbeat Pop & Tech',
    emoji: '🚀',
    description: 'Bisnis, tutorial, teknologi, modern',
  },
  {
    id: 'ambient',
    label: 'Ambient & Acoustic',
    emoji: '🍃',
    description: 'Vlog, inspiratif, pemandangan, tenang',
  },
];

/** Filter tracks by genre */
export function filterByGenre(genre: MusicGenre): MusicTrack[] {
  return AUDIO_CATALOG.filter((t) => t.genre === genre);
}

/** Full-text search across title, artist and tags */
export function searchTracks(query: string): MusicTrack[] {
  const q = query.toLowerCase();
  return AUDIO_CATALOG.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q)),
  );
}

/** Safely resolve stream URL from track or string, ensuring local audio fallback */
export function resolveAudioStreamUrl(trackOrUrl?: MusicTrack | string | null): string | undefined {
  if (!trackOrUrl) return undefined;
  if (typeof trackOrUrl === 'object') {
    return trackOrUrl.streamUrl;
  }
  const url = trackOrUrl.trim();
  if (url.startsWith('/audio/') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    return url;
  }
  // If an external remote URL is passed, check if it matches a catalog ID or fallback to local
  const matched = AUDIO_CATALOG.find((t) => t.id === url || t.streamUrl === url || url.includes(t.id));
  if (matched) return matched.streamUrl;
  return url;
}

/** Get default background music track */
export function getDefaultMusicTrack(): MusicTrack {
  return AUDIO_CATALOG[0];
}

