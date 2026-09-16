/**
 * Hook Category Tags & Visual Styling System
 * Based on short-form video retention research (TikTok, Shorts, Reels).
 */

export interface HookTagItem {
  id: string;
  tag: string;
  category: HookTagCategory;
  description: string;
}

export type HookTagCategory =
  | 'scroll-stopper'
  | 'urgency'
  | 'curiosity'
  | 'proof'
  | 'relatable'
  | 'action';

export interface HookTagCategoryInfo {
  id: HookTagCategory;
  label: string;
  icon: string;
}

export const HOOK_TAG_CATEGORIES: HookTagCategoryInfo[] = [
  { id: 'scroll-stopper', label: 'Scroll Stopper', icon: '👀' },
  { id: 'urgency', label: 'Peringatan', icon: '⚠️' },
  { id: 'curiosity', label: 'Rahasia & Teka-teki', icon: '💡' },
  { id: 'proof', label: 'Data & Bukti', icon: '📊' },
  { id: 'relatable', label: 'POV & Curhat', icon: '🤔' },
  { id: 'action', label: 'Solusi Cepat', icon: '🚀' },
];

export const RESEARCH_HOOK_TAGS: HookTagItem[] = [
  // Scroll Stopper
  { id: 'jangan-di-skip', tag: '👀 JANGAN DI-SKIP', category: 'scroll-stopper', description: 'Pattern interrupt terkuat untuk menghentikan refleks scrolling penonton' },
  { id: 'stop-scrolling', tag: '🛑 STOP SCROLLING', category: 'scroll-stopper', description: 'Perintah tegas langsung yang menarik perhatian mata seketika' },
  { id: 'tunggu-sebentar', tag: '⏳ TUNGGU SEBENTAR', category: 'scroll-stopper', description: 'Permintaan jeda singkat yang memicu rasa ingin tahu' },

  // Urgency & Warning
  { id: 'awas-salah', tag: '⚠️ AWAS SALAH', category: 'urgency', description: 'Memicu loss aversion: ketakutan melakukan kesalahan umum' },
  { id: 'peringatan-keras', tag: '🚨 PERINGATAN KERAS', category: 'urgency', description: 'Sensasi bahaya tinggi yang memaksa penonton menyimak' },
  { id: 'kesalahan-fatal', tag: '💣 KESALAHAN FATAL', category: 'urgency', description: 'Menyorot risiko besar yang ingin dihindari semua orang' },

  // Curiosity & Secrets
  { id: 'rahasia-sukses', tag: '💡 RAHASIA SUKSES', category: 'curiosity', description: 'Janji insight eksklusif yang belum diketahui orang banyak' },
  { id: 'jarang-orang-tahu', tag: '🤫 JARANG ORANG TAHU', category: 'curiosity', description: 'Membuka information gap tentang fakta/trik rahasia' },
  { id: 'bukan-untuk-semua', tag: '🔒 BUKAN UNTUK SEMUA', category: 'curiosity', description: 'Eksklusivitas tinggi yang memicu ego penonton' },
  { id: 'tahukah-kamu', tag: '❓ TAHUKAH KAMU?', category: 'curiosity', description: 'Pertanyaan pembuka klasik untuk memancing rasa ingin tahu' },

  // Proof & Viral Data
  { id: 'momen-viral', tag: '🔥 MOMEN VIRAL', category: 'proof', description: 'Social proof bahwa momen ini telah divalidasi ribuan orang' },
  { id: 'fakta-mengejutkan', tag: '⚡ FAKTA MENGEJUTKAN', category: 'proof', description: 'Klaim tak terduga yang mendobrak asumsi umum' },
  { id: '99-persen-salah', tag: '📊 99% ORANG SALAH', category: 'proof', description: 'Statistik kontra-intuitif yang menguji keyakinan penonton' },
  { id: 'detik-krusial', tag: '🎯 DETIK KRUSIAL', category: 'proof', description: 'Pemberitahuan titik balik penting dalam cerita' },

  // Relatability & POV
  { id: 'pernah-gini-gak', tag: '🤔 PERNAH GINI GAK?', category: 'relatable', description: 'Pertanyaan empati yang membuat penonton merasa relate' },
  { id: 'red-flag-besar', tag: '🚩 RED FLAG BESAR', category: 'relatable', description: 'Peringatan sosial/hubungan yang sangat populer di Gen-Z' },
  { id: 'realita-nyesek', tag: '💔 REALITA NYESEK', category: 'relatable', description: 'Sentuhan emosional tentang kenyataan yang sering dialami' },

  // Actionable Hack
  { id: '1-trik-cepat', tag: '🚀 1 TRIK CEPAT', category: 'action', description: 'Janji solusi instan tanpa buang-buang waktu' },
  { id: 'life-hack-mahal', tag: '💎 LIFE HACK MAHAL', category: 'action', description: 'Kiat bernilai tinggi yang bisa langsung dipraktekkan' },
  { id: 'cara-tercepat', tag: '🛠️ CARA TERCEPAT', category: 'action', description: 'Framework atau metode paling efisien untuk hasil nyata' },
];

/** Fast lookup array of strings for simple picker lists. */
export const DEFAULT_TAG_OPTIONS: string[] = RESEARCH_HOOK_TAGS.map((item) => item.tag);

export interface TagVisualConfig {
  borderColor: string;
  textColor: string;
  glowColor: string;
  bgColor: string;
}

/**
 * Resolves optimal pill badge colors based on tag semantics or fallback accent.
 * Guarantees visual harmony matching the user reference style:
 * Capsule pill with dark background, crisp glowing border, and matching text color.
 */
export function resolveTagVisual(tag?: string, fallbackAccent = '#38BDF8'): TagVisualConfig {
  if (!tag) {
    return {
      borderColor: fallbackAccent,
      textColor: fallbackAccent,
      glowColor: `${fallbackAccent}40`,
      bgColor: 'rgba(8, 14, 26, 0.92)',
    };
  }

  const upper = tag.toUpperCase();

  // 1. Warning & Danger (Red / Amber)
  if (
    upper.includes('⚠️') ||
    upper.includes('🚨') ||
    upper.includes('💣') ||
    upper.includes('AWAS') ||
    upper.includes('PERINGATAN') ||
    upper.includes('SALAH') ||
    upper.includes('BAHAYA') ||
    upper.includes('FATAL')
  ) {
    return {
      borderColor: '#FF3B30',
      textColor: '#FF4D4D',
      glowColor: 'rgba(255, 59, 48, 0.45)',
      bgColor: 'rgba(26, 8, 8, 0.94)',
    };
  }

  // 2. High-Impact Scroll Stopper (Electric Cyan - Exact User Reference Style)
  if (
    upper.includes('👀') ||
    upper.includes('JANGAN DI-SKIP') ||
    upper.includes('STOP') ||
    upper.includes('TUNGGU')
  ) {
    return {
      borderColor: '#00F0FF',
      textColor: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.45)',
      bgColor: 'rgba(6, 16, 26, 0.94)',
    };
  }

  // 3. Fire / Viral (Coral Flame)
  if (upper.includes('🔥') || upper.includes('VIRAL') || upper.includes('MOMEN')) {
    return {
      borderColor: '#FF5722',
      textColor: '#FF7043',
      glowColor: 'rgba(255, 87, 34, 0.45)',
      bgColor: 'rgba(28, 10, 6, 0.94)',
    };
  }

  // 4. Gold / Secrets / Hacks (Golden Amber)
  if (
    upper.includes('💡') ||
    upper.includes('🤫') ||
    upper.includes('💎') ||
    upper.includes('RAHASIA') ||
    upper.includes('TRIK') ||
    upper.includes('HACK') ||
    upper.includes('SUKSES')
  ) {
    return {
      borderColor: '#FBBF24',
      textColor: '#FDE047',
      glowColor: 'rgba(251, 191, 36, 0.45)',
      bgColor: 'rgba(28, 20, 6, 0.94)',
    };
  }

  // 5. Data & Statistics (Mint Emerald)
  if (
    upper.includes('📊') ||
    upper.includes('📈') ||
    upper.includes('99%') ||
    upper.includes('STATISTIK') ||
    upper.includes('BUKTI') ||
    upper.includes('DATA')
  ) {
    return {
      borderColor: '#10B981',
      textColor: '#34D399',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      bgColor: 'rgba(6, 26, 18, 0.94)',
    };
  }

  // 6. Relatability & Social (Violet / Purple)
  if (
    upper.includes('🤔') ||
    upper.includes('🚩') ||
    upper.includes('💔') ||
    upper.includes('POV') ||
    upper.includes('REALITA') ||
    upper.includes('RED FLAG')
  ) {
    return {
      borderColor: '#A855F7',
      textColor: '#C084FC',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      bgColor: 'rgba(20, 8, 30, 0.94)',
    };
  }

  // 7. Lightning / Action / Focus (Sky Blue)
  if (
    upper.includes('⚡') ||
    upper.includes('🎯') ||
    upper.includes('🚀') ||
    upper.includes('🛠️') ||
    upper.includes('KRUSIAL')
  ) {
    return {
      borderColor: '#38BDF8',
      textColor: '#38BDF8',
      glowColor: 'rgba(56, 189, 248, 0.45)',
      bgColor: 'rgba(8, 16, 28, 0.94)',
    };
  }

  // Default fallback using theme accent
  return {
    borderColor: fallbackAccent,
    textColor: fallbackAccent,
    glowColor: `${fallbackAccent}40`,
    bgColor: 'rgba(8, 14, 26, 0.92)',
  };
}
