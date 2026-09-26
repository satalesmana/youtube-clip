/**
 * Curated stock B-roll asset catalog mappings for instant zero-latency playback
 * in both client preview and production video compositions.
 */

export interface StockBrollEntry {
  id: string;
  query: string;
  url: string;
  tags: string[];
}

export const STOCK_BROLL_CATALOG: StockBrollEntry[] = [
  {
    id: 'tech-ai-brain',
    query: 'AI Neural Network Artificial Intelligence',
    url: '/stock-broll/tech-ai-brain.mp4',
    tags: ['ai', 'tech', 'neural', 'brain', 'robot', 'future', 'data', 'intelligence', 'teknologi'],
  },
  {
    id: 'tech-coding-matrix',
    query: 'Programmer Code Matrix Screen',
    url: '/stock-broll/tech-coding-matrix.mp4',
    tags: ['code', 'coding', 'programmer', 'matrix', 'software', 'hacker', 'komputer', 'developer'],
  },
  {
    id: 'finance-stock-chart',
    query: 'Stock Market Finance Candlestick Chart',
    url: '/stock-broll/finance-stock-chart.mp4',
    tags: ['finance', 'stock', 'saham', 'market', 'chart', 'uang', 'duit', 'cuan', 'investasi', 'bisnis', 'crypto'],
  },
  {
    id: 'city-traffic-night',
    query: 'City Traffic Night Lights Speed',
    url: '/stock-broll/city-traffic-night.mp4',
    tags: ['city', 'traffic', 'night', 'car', 'mobil', 'jalan', 'kota', 'malam', 'speed', 'kendaraan', 'urban'],
  },
  {
    id: 'crowd-cheering-stadium',
    query: 'Stadium Crowd Cheering Excitement',
    url: '/stock-broll/crowd-cheering-stadium.mp4',
    tags: ['stadium', 'crowd', 'cheering', 'penonton', 'konser', 'viral', 'ramai', 'sorak', 'juara', 'event'],
  },
  {
    id: 'business-handshake-office',
    query: 'Business Handshake Corporate Deal',
    url: '/stock-broll/business-handshake-office.mp4',
    tags: ['business', 'handshake', 'office', 'kantor', 'deal', 'kerja', 'meeting', 'kerjasama', 'korporat'],
  },
  {
    id: 'fitness-workout-gym',
    query: 'Athlete Workout Gym Training',
    url: '/stock-broll/fitness-workout-gym.mp4',
    tags: ['fitness', 'gym', 'workout', 'olahraga', 'athlete', 'training', 'sehat', 'otot', 'lari'],
  },
  {
    id: 'lifestyle-coffee-focus',
    query: 'Lifestyle Coffee Workspace Study',
    url: '/stock-broll/lifestyle-coffee-focus.mp4',
    tags: ['coffee', 'kopi', 'lifestyle', 'focus', 'work', 'study', 'belajar', 'santai', 'cafe', 'pagi'],
  },
  {
    id: 'nature-storm-dramatic',
    query: 'Dramatic Storm Clouds Thunder Lightning',
    url: '/stock-broll/nature-storm-dramatic.mp4',
    tags: ['storm', 'clouds', 'dramatic', 'badai', 'awan', 'langit', 'petir', 'hujan', 'bahaya', 'gelap'],
  },
  {
    id: 'nature-ocean-peaceful',
    query: 'Peaceful Ocean Waves Horizon',
    url: '/stock-broll/nature-ocean-peaceful.mp4',
    tags: ['ocean', 'sea', 'waves', 'laut', 'pantai', 'ombak', 'nature', 'air', 'tenang', 'alam', 'horizon'],
  },
];

/**
 * Returns a fast matching local stock video URL for a given query keyword.
 */
export function resolveStockBrollUrl(query?: string | null): string {
  if (!query) return STOCK_BROLL_CATALOG[3]!.url; // default city traffic
  const q = query.toLowerCase();

  for (const entry of STOCK_BROLL_CATALOG) {
    if (entry.tags.some((tag) => q.includes(tag))) {
      return entry.url;
    }
  }

  // Fallback to city traffic if no specific keyword matched
  return STOCK_BROLL_CATALOG[3]!.url;
}

/**
 * Resolves both a guaranteed playable video MP4 URL and an optional poster image URL
 * from any B-roll placement / asset object.
 *
 * Prevents black screens caused by passing image JPG thumbnails to Remotion <Video />.
 */
export function resolveBrollMediaAsset(b: any): { videoUrl: string; posterUrl: string } {
  const query = (b as any).query ?? (b as any).cue?.query ?? '';
  const fallbackVideoUrl = resolveStockBrollUrl(query);

  const rawDownload = (b as any).asset?.downloadUrl;
  const rawPreview = (b as any).asset?.previewUrl;
  const rawLocalPath = (b as any).asset?.localFilePath;
  const rawAssetUrl = (b as any).assetUrl;
  const assetId = (b as any).asset?.id;
  const assetSource = (b as any).asset?.source;

  const isImageRegex = /\.(jpg|jpeg|png|webp)($|\?)/i;

  let posterUrl = '';
  if (rawPreview && typeof rawPreview === 'string') {
    posterUrl = rawPreview;
  } else if (rawAssetUrl && typeof rawAssetUrl === 'string' && isImageRegex.test(rawAssetUrl)) {
    posterUrl = rawAssetUrl;
  }

  let videoUrl = '';

  // 1. If downloadUrl is present and is a video
  if (rawDownload && typeof rawDownload === 'string') {
    if (rawDownload.startsWith('/stock-broll/')) {
      videoUrl = rawDownload;
    } else if (assetSource === 'local' || rawDownload.includes('commondatastorage.googleapis.com')) {
      videoUrl = `/stock-broll/${assetId || 'city-traffic-night'}.mp4`;
    } else if (!isImageRegex.test(rawDownload) && (rawDownload.startsWith('http://') || rawDownload.startsWith('https://') || rawDownload.startsWith('/'))) {
      videoUrl = rawDownload;
    }
  }

  // 2. If rawAssetUrl is explicitly provided and is not an image file
  if (!videoUrl && rawAssetUrl && typeof rawAssetUrl === 'string') {
    if (!isImageRegex.test(rawAssetUrl)) {
      videoUrl = rawAssetUrl;
    }
  }

  // 3. If localFilePath exists
  if (!videoUrl && rawLocalPath && typeof rawLocalPath === 'string') {
    if (rawLocalPath.startsWith('/api/media/')) {
      videoUrl = rawLocalPath;
    } else if (rawLocalPath.startsWith('/stock-broll/')) {
      videoUrl = rawLocalPath;
    } else if (rawLocalPath.includes('/outputs/')) {
      const idx = rawLocalPath.indexOf('/outputs/');
      const rel = rawLocalPath.slice(idx + '/outputs/'.length);
      videoUrl = `/api/media/${rel.split('/').map(encodeURIComponent).join('/')}`;
    }
  }

  // 4. If assetId matches local stock broll catalog
  if (!videoUrl && assetId && STOCK_BROLL_CATALOG.some((e) => e.id === assetId)) {
    videoUrl = `/stock-broll/${assetId}.mp4`;
  }

  // 5. Ultimate fallback: match keyword to curated stock video
  if (!videoUrl) {
    videoUrl = fallbackVideoUrl;
  }

  return { videoUrl, posterUrl };
}

