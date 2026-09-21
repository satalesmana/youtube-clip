import type { BrollAsset } from '../../types/b-roll.js';

export interface CuratedStockItem {
  id: string;
  keywords: string[];
  title: string;
  category: string;
  previewUrl: string;
  downloadUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
}

/**
 * Curated catalog of high-quality, royalty-free vertical (9:16) & cinematic stock MP4 clips.
 * These act as reliable, always-available fallbacks when Pexels API key is not configured
 * or when external search yields zero results.
 */
export const CURATED_STOCK_CATALOG: CuratedStockItem[] = [
  // Technology & Code
  {
    id: 'tech-coding-matrix',
    keywords: ['coding', 'code', 'programming', 'developer', 'software', 'technology', 'tech', 'ai', 'computer', 'screen', 'hacker', 'data'],
    title: 'Futuristic Programming Code Flow',
    category: 'technology',
    previewUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/tech-coding-matrix.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
  {
    id: 'tech-ai-brain',
    keywords: ['ai', 'artificial intelligence', 'neural network', 'future', 'robot', 'algorithm', 'machine learning', 'cyber', 'digital'],
    title: 'AI Digital Neural Network',
    category: 'technology',
    previewUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/tech-ai-brain.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },

  // Finance, Money & Business
  {
    id: 'finance-stock-chart',
    keywords: ['stock market', 'finance', 'investing', 'chart', 'trading', 'crypto', 'bitcoin', 'economy', 'money', 'shares', 'growth', 'loss', 'market', 'dollar', 'cash', 'bills', 'wealth', 'rich', 'profit', 'bank'],
    title: 'Stock Market Candlestick Graph',
    category: 'finance',
    previewUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/finance-stock-chart.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
  {
    id: 'business-handshake-office',
    keywords: ['business', 'meeting', 'office', 'partnership', 'deal', 'corporate', 'success', 'work', 'strategy', 'entrepreneur'],
    title: 'Corporate Meeting & Collaboration',
    category: 'business',
    previewUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/business-handshake-office.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },

  // City, Urban & Lifestyle
  {
    id: 'city-traffic-night',
    keywords: ['city', 'traffic', 'urban', 'night', 'lights', 'street', 'metropolis', 'travel', 'car', 'busy', 'indonesia', 'jakarta', 'motorcycle', 'racing', 'speed', 'fast', 'vehicle', 'drive', 'track', 'road'],
    title: 'Metropolitan Night Traffic Timelapse',
    category: 'urban',
    previewUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/city-traffic-night.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
  {
    id: 'lifestyle-coffee-focus',
    keywords: ['coffee', 'cafe', 'focus', 'morning', 'routine', 'creative', 'laptop', 'reading', 'productivity', 'smartphone', 'phone', 'social media', 'scrolling', 'screen', 'relax'],
    title: 'Productive Work with Coffee',
    category: 'lifestyle',
    previewUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/lifestyle-coffee-focus.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },

  // Nature, Drama & Atmosphere
  {
    id: 'nature-storm-dramatic',
    keywords: ['storm', 'thunder', 'dramatic', 'clouds', 'danger', 'shock', 'warning', 'mystery', 'dark', 'epic', 'sky'],
    title: 'Dramatic Storm Clouds & Lightning',
    category: 'nature',
    previewUrl: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/nature-storm-dramatic.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
  {
    id: 'nature-ocean-peaceful',
    keywords: ['ocean', 'sea', 'water', 'peaceful', 'nature', 'landscape', 'calm', 'horizon', 'summer', 'sunset'],
    title: 'Ocean Waves & Serene Horizon',
    category: 'nature',
    previewUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/nature-ocean-peaceful.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },

  // Crowd, Reaction & Emotion
  {
    id: 'crowd-cheering-stadium',
    keywords: ['crowd', 'cheering', 'audience', 'concert', 'fans', 'stadium', 'applause', 'celebration', 'viral', 'hype', 'sports'],
    title: 'Crowd Cheering in Excitement',
    category: 'emotion',
    previewUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/crowd-cheering-stadium.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
  {
    id: 'fitness-workout-gym',
    keywords: ['gym', 'workout', 'fitness', 'training', 'exercise', 'motivation', 'running', 'strength', 'discipline'],
    title: 'High Intensity Workout & Training',
    category: 'fitness',
    previewUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
    downloadUrl: '/stock-broll/fitness-workout-gym.mp4',
    durationSeconds: 5,
    width: 1080,
    height: 1920,
  },
];

/** Searches the curated stock footage catalog using token scoring. */
export function searchCuratedCatalog(query: string, maxResults = 5): BrollAsset[] {
  const normalizedQuery = query.toLowerCase().trim();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return CURATED_STOCK_CATALOG.slice(0, maxResults).map(toBrollAsset);
  }

  const scored = CURATED_STOCK_CATALOG.map((item) => {
    let score = 0;
    const titleLower = item.title.toLowerCase();

    for (const token of queryTokens) {
      if (item.keywords.some((k) => k.includes(token) || token.includes(k))) {
        score += 3;
      }
      if (titleLower.includes(token)) {
        score += 2;
      }
      if (item.category.includes(token)) {
        score += 2;
      }
    }

    return { item, score };
  });

  // Sort by highest score, fallback with intelligent semantic domain matching
  const topMatches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);

  let finalItems: CuratedStockItem[] = [];

  if (topMatches.length > 0) {
    finalItems = topMatches;
  } else {
    // Intelligent domain fallback for offline/curated stock
    if (/speed|racing|fast|motor|car|vehicle|track|drive|road|commute/i.test(normalizedQuery)) {
      const match = CURATED_STOCK_CATALOG.find((c) => c.id === 'city-traffic-night');
      if (match) finalItems.push(match);
    } else if (/phone|smartphone|social|media|scroll|mobile|screen/i.test(normalizedQuery)) {
      const match = CURATED_STOCK_CATALOG.find((c) => c.id === 'lifestyle-coffee-focus');
      if (match) finalItems.push(match);
    } else if (/money|cash|dollar|bill|rich|cuan|wealth|bank/i.test(normalizedQuery)) {
      const match = CURATED_STOCK_CATALOG.find((c) => c.id === 'finance-stock-chart');
      if (match) finalItems.push(match);
    } else if (/win|victory|celebrat|crowd|cheer|audience|hype|event/i.test(normalizedQuery)) {
      const match = CURATED_STOCK_CATALOG.find((c) => c.id === 'crowd-cheering-stadium');
      if (match) finalItems.push(match);
    } else if (/gym|fitness|workout|exercise|sport|muscle|health|run/i.test(normalizedQuery)) {
      const match = CURATED_STOCK_CATALOG.find((c) => c.id === 'fitness-workout-gym');
      if (match) finalItems.push(match);
    }

    if (finalItems.length === 0) {
      finalItems = CURATED_STOCK_CATALOG;
    }
  }

  return finalItems.slice(0, maxResults).map(toBrollAsset);
}

function toBrollAsset(item: CuratedStockItem): BrollAsset {
  return {
    id: item.id,
    source: 'local',
    previewUrl: item.previewUrl,
    downloadUrl: item.downloadUrl,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
  };
}
