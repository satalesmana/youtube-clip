// =============================================================================
// audio-catalog.ts
// Kurasi track audio bebas royalti yang di-host di CDN publik (CORS-friendly).
// Musik di-stream secara langsung online tanpa perlu di-download/disimpan ke lokal.
// Sumber: Jamendo Royalty-Free Music & Creative Commons Audio CDN
// =============================================================================

import scrapedPixabayTracks from './pixabay-scraped-catalog.json';

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
  streamUrl: string;    // Direct CDN URL to MP3 - CORS-friendly & range-requests enabled
  coverUrl: string;     // Thumbnail/cover image URL
  tags: string[];       // Descriptive tags
  license: string;      // License info
  isLiveScraped?: boolean; // Flag if track was scraped live from search
}

const BASE_AUDIO_CATALOG: MusicTrack[] = [
  // --- Lo-Fi Chill & Study ---
  {
    id: 'lofi-chill-01',
    title: 'Way Down (Study Beats)',
    artist: 'Moonwalk',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 60,
    bpm: 85,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885545&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80',
    tags: ['chill', 'study', 'relax', 'cafe', 'lo-fi', 'indie', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'lofi-chill-02',
    title: 'Way Down (Chill Loop)',
    artist: 'Moonwalk',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 60,
    bpm: 78,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885544&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?auto=format&fit=crop&w=300&q=80',
    tags: ['rain', 'lofi', 'calm', 'chill', 'cozy', 'dreamy', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'lofi-chill-03',
    title: 'Way Down (Sunset Vibe)',
    artist: 'Moonwalk',
    genre: 'lofi',
    genreLabel: 'Lo-Fi Chill & Study',
    genreEmoji: '☕',
    durationSec: 45,
    bpm: 90,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885546&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=300&q=80',
    tags: ['night', 'drive', 'chill', 'lofi', 'city', 'ambient', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },

  // --- Phonk & High Energy ---
  {
    id: 'phonk-hype-01',
    title: 'Cadillac Dark Drift',
    artist: 'Dawid Jaworski',
    genre: 'phonk',
    genreLabel: 'Phonk & High Energy',
    genreEmoji: '⚡',
    durationSec: 60,
    bpm: 138,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1884489&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    tags: ['phonk', 'hype', 'energy', 'viral', 'gaming', 'bass', 'aggressive', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'phonk-hype-02',
    title: 'Trick or Treat Hype Bass',
    artist: 'SoundProducerTV',
    genre: 'phonk',
    genreLabel: 'Phonk & High Energy',
    genreEmoji: '⚡',
    durationSec: 60,
    bpm: 140,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885840&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=300&q=80',
    tags: ['motivation', 'sigma', 'gym', 'workout', 'phonk', 'energy', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },

  // --- Cinematic & Mystery ---
  {
    id: 'cinematic-01',
    title: 'Dramatic Movie Soundtrack',
    artist: 'makesound',
    genre: 'cinematic',
    genreLabel: 'Cinematic & Mystery',
    genreEmoji: '🎬',
    durationSec: 60,
    bpm: 75,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1857994&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1518066000714-58c45f1d0898?auto=format&fit=crop&w=300&q=80',
    tags: ['cinematic', 'mystery', 'suspense', 'drama', 'dark', 'storytelling', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'cinematic-02',
    title: 'Inspiring Cinematic Trailer',
    artist: 'Stanislav Barantsov',
    genre: 'cinematic',
    genreLabel: 'Cinematic & Mystery',
    genreEmoji: '🎬',
    durationSec: 60,
    bpm: 80,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1879038&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=80',
    tags: ['epic', 'tension', 'build', 'cinematic', 'trailer', 'investigation', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },

  // --- Upbeat Pop & Tech ---
  {
    id: 'upbeat-tech-01',
    title: 'Black Box Tech Beat',
    artist: 'Totemism',
    genre: 'upbeat',
    genreLabel: 'Upbeat Pop & Tech',
    genreEmoji: '🚀',
    durationSec: 60,
    bpm: 126,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885830&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=300&q=80',
    tags: ['tech', 'innovation', 'upbeat', 'business', 'corporate', 'tutorial', 'modern', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'upbeat-tech-02',
    title: 'Why We Inspire',
    artist: 'Alexey Anisimov',
    genre: 'upbeat',
    genreLabel: 'Upbeat Pop & Tech',
    genreEmoji: '🚀',
    durationSec: 60,
    bpm: 124,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1885850&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80',
    tags: ['digital', 'future', 'tech', 'pop', 'upbeat', 'review', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },

  // --- Ambient & Acoustic ---
  {
    id: 'ambient-01',
    title: 'Fade Away Deep Ambient',
    artist: 'Epikton',
    genre: 'ambient',
    genreLabel: 'Ambient & Acoustic',
    genreEmoji: '🍃',
    durationSec: 60,
    bpm: 65,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1897033&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=300&q=80',
    tags: ['ambient', 'acoustic', 'morning', 'vlog', 'nature', 'peaceful', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
  {
    id: 'ambient-02',
    title: 'Atmospheric Soundscape',
    artist: 'makesound',
    genre: 'ambient',
    genreLabel: 'Ambient & Acoustic',
    genreEmoji: '🍃',
    durationSec: 60,
    bpm: 60,
    streamUrl: 'https://prod-1.storage.jamendo.com/?trackid=1857997&format=mp31&from=app-devportal',
    coverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=300&q=80',
    tags: ['ambient', 'forest', 'nature', 'relax', 'quiet', 'acoustic', 'stream'],
    license: 'Royalty-Free Online Stream (Jamendo / CC)',
  },
];

export const AUDIO_CATALOG: MusicTrack[] = [
  ...((Array.isArray(scrapedPixabayTracks) ? scrapedPixabayTracks : []) as MusicTrack[]),
  ...BASE_AUDIO_CATALOG,
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

/** Safely resolve stream URL from track, string ID, or direct stream URL */
export function resolveAudioStreamUrl(trackOrUrl?: MusicTrack | string | null): string | undefined {
  if (!trackOrUrl) return undefined;
  let rawUrl = '';
  if (typeof trackOrUrl === 'object') {
    rawUrl = trackOrUrl.streamUrl;
  } else {
    rawUrl = trackOrUrl.trim();
  }
  if (!rawUrl) return undefined;

  // If a track ID or streamUrl matches catalog, return the verified stream URL
  const matched = AUDIO_CATALOG.find(
    (t) => t.id === rawUrl || t.streamUrl === rawUrl || rawUrl.includes(t.id),
  );
  const streamUrl = matched ? matched.streamUrl : rawUrl;

  // Pixabay CDN requires Referer: https://pixabay.com/ to prevent 403 hotlink blocks.
  // Route through in-memory streaming proxy without saving to local disk.
  if (streamUrl.includes('cdn.pixabay.com') && !streamUrl.includes('/api/music/stream')) {
    return `/api/music/stream?url=${encodeURIComponent(streamUrl)}`;
  }

  return streamUrl;
}

/** Get default background music track */
export function getDefaultMusicTrack(): MusicTrack {
  return AUDIO_CATALOG[0];
}

