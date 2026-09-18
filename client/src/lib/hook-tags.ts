/**
 * Hook Category Tags & Visual Styling System
 * Based on short-form video retention research (TikTok, Shorts, Reels).
 */

import type { HookIconName } from '../components/studio/HookIcon';
export type { HookIconName } from '../components/studio/HookIcon';

export interface HookTagItem {
  id: string;
  tag: string;
  category: HookTagCategory;
  description: string;
  iconName?: HookIconName;
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
  iconName: HookIconName;
}

export const HOOK_TAG_CATEGORIES: HookTagCategoryInfo[] = [
  { id: 'scroll-stopper', label: 'Scroll Stopper', icon: '👀', iconName: 'eye' },
  { id: 'urgency', label: 'Peringatan', icon: '⚠️', iconName: 'alert-triangle' },
  { id: 'curiosity', label: 'Rahasia & Teka-teki', icon: '💡', iconName: 'lightbulb' },
  { id: 'proof', label: 'Data & Bukti', icon: '📊', iconName: 'trending-up' },
  { id: 'relatable', label: 'POV & Curhat', icon: '🤔', iconName: 'message-circle' },
  { id: 'action', label: 'Solusi Cepat', icon: '🚀', iconName: 'rocket' },
];

export const EMOJI_TO_ICON_MAP: Record<string, HookIconName> = {
  '👀': 'eye',
  '🛑': 'octagon-alert',
  '⏳': 'hourglass',
  '⚠️': 'alert-triangle',
  '🚨': 'siren',
  '💣': 'bomb',
  '💡': 'lightbulb',
  '🤫': 'key',
  '🔒': 'lock',
  '❓': 'help-circle',
  '🔥': 'flame',
  '⚡': 'zap',
  '📊': 'trending-up',
  '📈': 'trending-up',
  '🎯': 'target',
  '🤔': 'message-circle',
  '🚩': 'flag',
  '💔': 'heart-crack',
  '🚀': 'rocket',
  '💎': 'gem',
  '🛠️': 'wrench',
  '🛠': 'wrench',
  '✨': 'sparkles',
  '⭐': 'star',
  '🏆': 'trophy',
  '🧭': 'compass',
  '😲': 'message-circle',
};

/**
 * Parses any tag string, extracting leading emoji or resolving keyword to a Lucide icon.
 * Guarantees backward compatibility with existing legacy emoji tags.
 */
export function parseHookTag(tag?: string): {
  iconName: HookIconName;
  cleanText: string;
  rawTag: string;
} {
  if (!tag || !tag.trim()) {
    return { iconName: 'sparkles', cleanText: '', rawTag: '' };
  }
  const rawTag = tag.trim();
  const emojiMatch = rawTag.match(/^(\p{Extended_Pictographic}+|\p{Emoji}+)\s*(.*)$/u);
  if (emojiMatch) {
    const emoji = emojiMatch[1];
    const cleanText = emojiMatch[2] || rawTag;
    const mappedIcon = EMOJI_TO_ICON_MAP[emoji];
    if (mappedIcon) {
      return { iconName: mappedIcon, cleanText, rawTag };
    }
    const upper = cleanText.toUpperCase();
    if (upper.includes('VIRAL') || upper.includes('MOMEN')) return { iconName: 'flame', cleanText, rawTag };
    if (upper.includes('KRUSIAL') || upper.includes('KILAT') || upper.includes('FAKTA')) return { iconName: 'zap', cleanText, rawTag };
    if (upper.includes('SALAH') || upper.includes('AWAS') || upper.includes('FATAL')) return { iconName: 'alert-triangle', cleanText, rawTag };
    if (upper.includes('PERINGATAN') || upper.includes('BAHAYA')) return { iconName: 'siren', cleanText, rawTag };
    if (upper.includes('SKIP') || upper.includes('STOP') || upper.includes('LIHAT')) return { iconName: 'eye', cleanText, rawTag };
    if (upper.includes('TIPS') || upper.includes('RAHASIA') || upper.includes('TRIK')) return { iconName: 'lightbulb', cleanText, rawTag };
    if (upper.includes('DATA') || upper.includes('BUKTI') || upper.includes('STATISTIK') || upper.includes('%')) return { iconName: 'trending-up', cleanText, rawTag };
    return { iconName: 'sparkles', cleanText, rawTag };
  }

  const upper = rawTag.toUpperCase();
  if (upper.includes('VIRAL') || upper.includes('MOMEN') || upper.includes('HOT')) return { iconName: 'flame', cleanText: rawTag, rawTag };
  if (upper.includes('KRUSIAL') || upper.includes('KILAT') || upper.includes('FAKTA') || upper.includes('MENARIK')) return { iconName: 'zap', cleanText: rawTag, rawTag };
  if (upper.includes('SALAH') || upper.includes('AWAS') || upper.includes('FATAL') || upper.includes('BAHAYA')) return { iconName: 'alert-triangle', cleanText: rawTag, rawTag };
  if (upper.includes('PERINGATAN') || upper.includes('DARURAT')) return { iconName: 'siren', cleanText: rawTag, rawTag };
  if (upper.includes('SKIP') || upper.includes('STOP') || upper.includes('LIHAT') || upper.includes('TUNGGU')) return { iconName: 'eye', cleanText: rawTag, rawTag };
  if (upper.includes('TIPS') || upper.includes('RAHASIA') || upper.includes('TRIK') || upper.includes('HACK')) return { iconName: 'lightbulb', cleanText: rawTag, rawTag };
  if (upper.includes('DATA') || upper.includes('BUKTI') || upper.includes('STATISTIK') || upper.includes('%')) return { iconName: 'trending-up', cleanText: rawTag, rawTag };
  if (upper.includes('TARGET') || upper.includes('FOKUS')) return { iconName: 'target', cleanText: rawTag, rawTag };
  if (upper.includes('POV') || upper.includes('KATA') || upper.includes('TANYA') || upper.includes('PERNAH')) return { iconName: 'message-circle', cleanText: rawTag, rawTag };
  if (upper.includes('CEPAT') || upper.includes('SOLUSI')) return { iconName: 'rocket', cleanText: rawTag, rawTag };

  return { iconName: 'sparkles', cleanText: rawTag, rawTag };
}

export const RESEARCH_HOOK_TAGS: HookTagItem[] = [
  // Scroll Stopper
  { id: 'jangan-di-skip', tag: '👀 JANGAN DI-SKIP', category: 'scroll-stopper', iconName: 'eye', description: 'Pattern interrupt terkuat untuk menghentikan refleks scrolling penonton' },
  { id: 'stop-scrolling', tag: '🛑 STOP SCROLLING', category: 'scroll-stopper', iconName: 'octagon-alert', description: 'Perintah tegas langsung yang menarik perhatian mata seketika' },
  { id: 'tunggu-sebentar', tag: '⏳ TUNGGU SEBENTAR', category: 'scroll-stopper', iconName: 'hourglass', description: 'Permintaan jeda singkat yang memicu rasa ingin tahu' },

  // Urgency & Warning
  { id: 'awas-salah', tag: '⚠️ AWAS SALAH', category: 'urgency', iconName: 'alert-triangle', description: 'Memicu loss aversion: ketakutan melakukan kesalahan umum' },
  { id: 'peringatan-keras', tag: '🚨 PERINGATAN KERAS', category: 'urgency', iconName: 'siren', description: 'Sensasi bahaya tinggi yang memaksa penonton menyimak' },
  { id: 'kesalahan-fatal', tag: '💣 KESALAHAN FATAL', category: 'urgency', iconName: 'bomb', description: 'Menyorot risiko besar yang ingin dihindari semua orang' },

  // Curiosity & Secrets
  { id: 'rahasia-sukses', tag: '💡 RAHASIA SUKSES', category: 'curiosity', iconName: 'lightbulb', description: 'Janji insight eksklusif yang belum diketahui orang banyak' },
  { id: 'jarang-orang-tahu', tag: '🤫 JARANG ORANG TAHU', category: 'curiosity', iconName: 'key', description: 'Membuka information gap tentang fakta/trik rahasia' },
  { id: 'bukan-untuk-semua', tag: '🔒 BUKAN UNTUK SEMUA', category: 'curiosity', iconName: 'lock', description: 'Eksklusivitas tinggi yang memicu ego penonton' },
  { id: 'tahukah-kamu', tag: '❓ TAHUKAH KAMU?', category: 'curiosity', iconName: 'help-circle', description: 'Pertanyaan pembuka klasik untuk memancing rasa ingin tahu' },

  // Proof & Viral Data
  { id: 'momen-viral', tag: '🔥 MOMEN VIRAL', category: 'proof', iconName: 'flame', description: 'Social proof bahwa momen ini telah divalidasi ribuan orang' },
  { id: 'fakta-mengejutkan', tag: '⚡ FAKTA MENGEJUTKAN', category: 'proof', iconName: 'zap', description: 'Klaim tak terduga yang mendobrak asumsi umum' },
  { id: '99-persen-salah', tag: '📊 99% ORANG SALAH', category: 'proof', iconName: 'trending-up', description: 'Statistik kontra-intuitif yang menguji keyakinan penonton' },
  { id: 'detik-krusial', tag: '🎯 DETIK KRUSIAL', category: 'proof', iconName: 'target', description: 'Pemberitahuan titik balik penting dalam cerita' },

  // Relatability & POV
  { id: 'pernah-gini-gak', tag: '🤔 PERNAH GINI GAK?', category: 'relatable', iconName: 'message-circle', description: 'Pertanyaan empati yang membuat penonton merasa relate' },
  { id: 'red-flag-besar', tag: '🚩 RED FLAG BESAR', category: 'relatable', iconName: 'flag', description: 'Peringatan sosial/hubungan yang sangat populer di Gen-Z' },
  { id: 'realita-nyesek', tag: '💔 REALITA NYESEK', category: 'relatable', iconName: 'heart-crack', description: 'Sentuhan emosional tentang kenyataan yang sering dialami' },

  // Actionable Hack
  { id: '1-trik-cepat', tag: '🚀 1 TRIK CEPAT', category: 'action', iconName: 'rocket', description: 'Janji solusi instan tanpa buang-buang waktu' },
  { id: 'life-hack-mahal', tag: '💎 LIFE HACK MAHAL', category: 'action', iconName: 'gem', description: 'Kiat bernilai tinggi yang bisa langsung dipraktekkan' },
  { id: 'cara-tercepat', tag: '🛠️ CARA TERCEPAT', category: 'action', iconName: 'wrench', description: 'Framework atau metode paling efisien untuk hasil nyata' },
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

// ─── 4 Presets Badge Design System ──────────────────────────────────────────

import type { BadgePresetId, BadgeColorVariant } from '../types';

export interface BadgePresetItem {
  id: BadgePresetId;
  label: string;
  category: 'Attention' | 'Urgency' | 'Emphasis' | 'Context';
  description: string;
  bestFor: string[];
  colorOptions: Array<{ id: BadgeColorVariant; label: string; hex: string }>;
  defaultColor: BadgeColorVariant;
  defaultTag: string;
  iconName: HookIconName;
}

export const BADGE_PRESETS: BadgePresetItem[] = [
  {
    id: 'neon-outline',
    label: 'Neon Outline',
    category: 'Attention',
    description: 'Memberikan kesan modern dan futuristik dengan border neon yang menyala. Cocok untuk menarik perhatian di awal video.',
    bestFor: ['Attention', 'Curiosity', 'Question'],
    colorOptions: [
      { id: 'cyan', label: 'Cyan', hex: '#00F0FF' },
      { id: 'magenta', label: 'Magenta', hex: '#EC4899' },
      { id: 'green', label: 'Green', hex: '#22C55E' },
    ],
    defaultColor: 'cyan',
    defaultTag: '👀 JANGAN DI-SKIP',
    iconName: 'eye',
  },
  {
    id: 'solid-impact',
    label: 'Solid Impact',
    category: 'Urgency',
    description: 'Tampil lebih tegas dengan background solid berwarna kontras. Sangat efektif untuk pesan urgent atau provokatif.',
    bestFor: ['Shock', 'Urgency', 'Warning'],
    colorOptions: [
      { id: 'red', label: 'Red', hex: '#FF1744' },
      { id: 'yellow', label: 'Yellow', hex: '#FACC15' },
      { id: 'green', label: 'Green', hex: '#22C55E' },
    ],
    defaultColor: 'red',
    defaultTag: '⚠️ JANGAN SALAH PILIH',
    iconName: 'alert-triangle',
  },
  {
    id: 'highlight-chip',
    label: 'Highlight Chip',
    category: 'Emphasis',
    description: 'Menyoroti kata kunci penting dalam headline. Membuat pesan utama lebih cepat terbaca dan mudah diingat.',
    bestFor: ['Contrarian', 'Controversial', 'Data'],
    colorOptions: [
      { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
      { id: 'yellow', label: 'Yellow', hex: '#FACC15' },
      { id: 'green', label: 'Green', hex: '#10B981' },
    ],
    defaultColor: 'purple',
    defaultTag: '⚡ MENARIK',
    iconName: 'zap',
  },
  {
    id: 'editorial-label',
    label: 'Editorial Label',
    category: 'Context',
    description: 'Memberikan konteks tambahan tanpa mengganggu headline utama. Terlihat clean, profesional, dan tetap menarik.',
    bestFor: ['Story', 'Tip', 'Insight', 'Authority'],
    colorOptions: [
      { id: 'gold', label: 'Gold', hex: '#FACC15' },
      { id: 'cyan', label: 'Cyan', hex: '#38BDF8' },
      { id: 'green', label: 'Green', hex: '#10B981' },
    ],
    defaultColor: 'gold',
    defaultTag: '💡 1 TIPS PENTING',
    iconName: 'lightbulb',
  },
  {
    id: 'price-tag',
    label: 'Price Tag',
    category: 'Emphasis',
    description: 'Bentuk label tiket dengan sudut miring berlubang di sisi samping. Memberikan kesan promo, tips rahasia, atau eksklusif.',
    bestFor: ['Tip', 'Rahasia', 'Exclusive', 'Hacks'],
    colorOptions: [
      { id: 'gold', label: 'Gold', hex: '#FACC15' },
      { id: 'cyan', label: 'Cyan', hex: '#00F0FF' },
      { id: 'green', label: 'Green', hex: '#10B981' },
    ],
    defaultColor: 'gold',
    defaultTag: '💡 TIPS RAHASIA',
    iconName: 'key',
  },
  {
    id: 'speech-bubble',
    label: 'Speech Bubble',
    category: 'Context',
    description: 'Bentuk balon ucapan dengan ekor percakapan. Sangat kuat untuk hook opini, kutipan viral, atau POV.',
    bestFor: ['Quote', 'POV', 'Testimoni', 'Kata Orang'],
    colorOptions: [
      { id: 'cyan', label: 'Cyan', hex: '#00F0FF' },
      { id: 'magenta', label: 'Magenta', hex: '#EC4899' },
      { id: 'gold', label: 'Gold', hex: '#FACC15' },
    ],
    defaultColor: 'cyan',
    defaultTag: '😲 KATA MEREKA',
    iconName: 'message-circle',
  },
  {
    id: 'burst-stamp',
    label: 'Burst Stamp',
    category: 'Attention',
    description: 'Bentuk ledakan bintang (starburst) dinamis. Efek heboh, heboh diskon, viralitas, atau pengumuman breaking news.',
    bestFor: ['Viral', 'Hot', 'Breaking', 'Shock'],
    colorOptions: [
      { id: 'red', label: 'Red', hex: '#FF1744' },
      { id: 'yellow', label: 'Yellow', hex: '#FACC15' },
      { id: 'green', label: 'Green', hex: '#22C55E' },
    ],
    defaultColor: 'red',
    defaultTag: '🔥 VIRAL BANGET',
    iconName: 'flame',
  },
  {
    id: 'diagonal-slash',
    label: 'Diagonal Slash',
    category: 'Urgency',
    description: 'Bentuk jajaran genjang bergaris miring agresif dengan aksen kecepatan. Terasa dinamis, sporty, dan serba cepat.',
    bestFor: ['Sport', 'Speed', 'Impact', 'Urgency'],
    colorOptions: [
      { id: 'cyan', label: 'Cyan', hex: '#00F0FF' },
      { id: 'red', label: 'Red', hex: '#FF1744' },
      { id: 'yellow', label: 'Yellow', hex: '#FACC15' },
    ],
    defaultColor: 'cyan',
    defaultTag: '⚡ KILAT CEPAT',
    iconName: 'zap',
  },
];

export interface BadgeComputedStyle {
  presetId: BadgePresetId;
  bgColor: string;
  borderColor: string;
  textColor: string;
  borderRadius: number;
  boxShadow: string;
  letterSpacing: string;
  fontWeight: number;
  borderWidth: number;
}

export function resolveBadgeStyle(
  presetId: BadgePresetId = 'neon-outline',
  colorVariant: BadgeColorVariant = 'auto',
  tag?: string,
  fallbackAccent = '#38BDF8'
): BadgeComputedStyle {
  // 1. Neon Outline
  if (presetId === 'neon-outline') {
    let accentHex = '#00F0FF';
    if (colorVariant === 'magenta') accentHex = '#EC4899';
    else if (colorVariant === 'green') accentHex = '#22C55E';
    else if (colorVariant === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    }

    return {
      presetId,
      bgColor: 'rgba(8, 14, 26, 0.94)',
      borderColor: accentHex,
      textColor: accentHex,
      borderRadius: 9999,
      borderWidth: 1.5,
      boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 12px ${accentHex}50`,
      letterSpacing: '0.6px',
      fontWeight: 800,
    };
  }

  // 2. Solid Impact
  if (presetId === 'solid-impact') {
    let bgHex = '#FF1744';
    let textHex = '#FFFFFF';
    if (colorVariant === 'yellow') {
      bgHex = '#FACC15';
      textHex = '#000000';
    } else if (colorVariant === 'green') {
      bgHex = '#22C55E';
      textHex = '#FFFFFF';
    } else if (colorVariant === 'auto') {
      const v = resolveTagVisual(tag, fallbackAccent);
      bgHex = v.borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15') ? '#000000' : '#FFFFFF';
    }

    return {
      presetId,
      bgColor: bgHex,
      borderColor: 'transparent',
      textColor: textHex,
      borderRadius: 12,
      borderWidth: 0,
      boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
      letterSpacing: '0.5px',
      fontWeight: 900,
    };
  }

  // 3. Highlight Chip
  if (presetId === 'highlight-chip') {
    let accentHex = '#8B5CF6';
    let bgTint = 'rgba(139, 92, 246, 0.2)';
    if (colorVariant === 'yellow') {
      accentHex = '#FACC15';
      bgTint = 'rgba(250, 204, 21, 0.2)';
    } else if (colorVariant === 'green') {
      accentHex = '#10B981';
      bgTint = 'rgba(16, 185, 129, 0.2)';
    } else if (colorVariant === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      bgTint = `${accentHex}25`;
    }

    return {
      presetId,
      bgColor: bgTint,
      borderColor: accentHex,
      textColor: accentHex,
      borderRadius: 10,
      borderWidth: 1.5,
      boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 10px ${accentHex}40`,
      letterSpacing: '0.8px',
      fontWeight: 800,
    };
  }

  // 4. Editorial Label
  if (presetId === 'editorial-label') {
    let accentHex = '#FACC15';
    if (colorVariant === 'cyan') accentHex = '#38BDF8';
    else if (colorVariant === 'green') accentHex = '#10B981';
    else if (colorVariant === 'auto') {
      accentHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    }

    return {
      presetId: 'editorial-label',
      bgColor: 'rgba(255, 255, 255, 0.08)',
      borderColor: `${accentHex}D0`,
      textColor: accentHex,
      borderRadius: 9999,
      borderWidth: 1.2,
      boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
      letterSpacing: '1.5px',
      fontWeight: 700,
    };
  }

  // 5. Price Tag
  if (presetId === 'price-tag') {
    let bgHex = '#FACC15';
    let textHex = '#000000';
    if (colorVariant === 'cyan') {
      bgHex = '#00F0FF';
      textHex = '#000000';
    } else if (colorVariant === 'green') {
      bgHex = '#10B981';
      textHex = '#FFFFFF';
    } else if (colorVariant === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    return {
      presetId,
      bgColor: bgHex,
      borderColor: 'transparent',
      textColor: textHex,
      borderRadius: 8,
      borderWidth: 0,
      boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 14px ${bgHex}70`,
      letterSpacing: '0.8px',
      fontWeight: 900,
    };
  }

  // 6. Speech Bubble
  if (presetId === 'speech-bubble') {
    let bgHex = '#00F0FF';
    let textHex = '#000000';
    if (colorVariant === 'magenta') {
      bgHex = '#EC4899';
      textHex = '#FFFFFF';
    } else if (colorVariant === 'gold') {
      bgHex = '#FACC15';
      textHex = '#000000';
    } else if (colorVariant === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    return {
      presetId,
      bgColor: bgHex,
      borderColor: 'transparent',
      textColor: textHex,
      borderRadius: 14,
      borderWidth: 0,
      boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 14px ${bgHex}70`,
      letterSpacing: '0.6px',
      fontWeight: 800,
    };
  }

  // 7. Burst Stamp
  if (presetId === 'burst-stamp') {
    let bgHex = '#FF1744';
    let textHex = '#FFFFFF';
    if (colorVariant === 'yellow') {
      bgHex = '#FACC15';
      textHex = '#000000';
    } else if (colorVariant === 'green') {
      bgHex = '#22C55E';
      textHex = '#FFFFFF';
    } else if (colorVariant === 'auto') {
      bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
      textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
    }

    return {
      presetId,
      bgColor: bgHex,
      borderColor: 'transparent',
      textColor: textHex,
      borderRadius: 6,
      borderWidth: 0,
      boxShadow: `0 4px 20px rgba(0,0,0,0.7), 0 0 16px ${bgHex}80`,
      letterSpacing: '0.7px',
      fontWeight: 900,
    };
  }

  // 8. Diagonal Slash (default fallback)
  let bgHex = '#00F0FF';
  let textHex = '#000000';
  if (colorVariant === 'red') {
    bgHex = '#FF1744';
    textHex = '#FFFFFF';
  } else if (colorVariant === 'yellow') {
    bgHex = '#FACC15';
    textHex = '#000000';
  } else if (colorVariant === 'auto') {
    bgHex = resolveTagVisual(tag, fallbackAccent).borderColor;
    textHex = (bgHex === '#FBBF24' || bgHex === '#FACC15' || bgHex === '#00F0FF') ? '#000000' : '#FFFFFF';
  }

  return {
    presetId: 'diagonal-slash',
    bgColor: bgHex,
    borderColor: 'transparent',
    textColor: textHex,
    borderRadius: 4,
    borderWidth: 0,
    boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 14px ${bgHex}60`,
    letterSpacing: '1px',
    fontWeight: 900,
  };
}

