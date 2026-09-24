/**
 * Outro Call to Action (CTA) Style Preset System
 *
 * Domain types & Authoritative Presets Registry for high-converting closing cards
 * displayed at the end of vertical shorts (Shorts / Reels / TikTok).
 */

export type OutroPresetId =
  | 'creator-glass'
  | 'viral-neon'
  | 'minimal-clean'
  | 'comment-debate'
  | 'subscribe-bell'
  | 'link-in-bio';

export interface OutroPresetConfig {
  id: OutroPresetId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  badgeLabel: string;
  defaultCtaText: string;
  defaultButtonText: string;
  primaryColor: string;
  accentColor: string;
  gradient: string;
  buttonGradient: string;
  buttonTextColor: string;
  borderStyle: string;
  boxShadow: string;
  vignetteDarkness: number;
}

export const OUTRO_STYLE_PRESETS: Record<OutroPresetId, OutroPresetConfig> = {
  'creator-glass': {
    id: 'creator-glass',
    name: 'Creator Glass',
    tagline: 'Modern Glassmorphic',
    description: 'Frosted glass transparan dengan ring avatar bercahaya dan verified badge. Sangat cocok untuk personal branding kreator.',
    icon: '✨',
    badgeLabel: 'Kreator Pilihan',
    defaultCtaText: 'Suka konten ini? Ikuti untuk update harian!',
    defaultButtonText: '+ IKUTI SEKARANG',
    primaryColor: '#00F2FE',
    accentColor: '#4FACFE',
    gradient: 'linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(79, 172, 254, 0.15) 100%)',
    buttonGradient: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
    buttonTextColor: '#07090E',
    borderStyle: '1.5px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 30px 70px rgba(0,0,0,0.85), 0 0 40px rgba(0, 242, 254, 0.3)',
    vignetteDarkness: 0.82,
  },
  'viral-neon': {
    id: 'viral-neon',
    name: 'Viral Neon Impact',
    tagline: 'Cyberpunk High-Energy',
    description: 'Glow neon cyan-magenta dengan visual kontras tinggi dan efek pulse energik. Sangat pas untuk konten gaming, tech, dan highlight viral.',
    icon: '⚡',
    badgeLabel: 'Trending Viral',
    defaultCtaText: 'Jangan lewatkan momen seru berikutnya! Aktifkan notifikasi sekarang.',
    defaultButtonText: '⚡ IKUTI & AKTIFKAN NOTIFIKASI',
    primaryColor: '#FF007F',
    accentColor: '#00F0FF',
    gradient: 'linear-gradient(135deg, rgba(255, 0, 127, 0.25) 0%, rgba(0, 240, 255, 0.18) 100%)',
    buttonGradient: 'linear-gradient(135deg, #FF007F 0%, #00F0FF 100%)',
    buttonTextColor: '#FFFFFF',
    borderStyle: '2px solid #00F0FF',
    boxShadow: '0 0 45px rgba(255, 0, 127, 0.4), 0 25px 60px rgba(0,0,0,0.9)',
    vignetteDarkness: 0.88,
  },
  'minimal-clean': {
    id: 'minimal-clean',
    name: 'Clean Obsidian',
    tagline: 'Editorial & Refined',
    description: 'Desain minimalis slate gelap dengan border tipis refined dan tipografi bersih. Ideal untuk edukasi, bisnis, finance, dan podcast.',
    icon: '🏛️',
    badgeLabel: 'Insight Harian',
    defaultCtaText: 'Dapatkan rangkuman wawasan mendalam dan perspektif baru setiap hari.',
    defaultButtonText: 'Langganan Sekarang →',
    primaryColor: '#F8FAFC',
    accentColor: '#94A3B8',
    gradient: 'linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
    buttonGradient: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
    buttonTextColor: '#0F172A',
    borderStyle: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.75), 0 0 20px rgba(255,255,255,0.05)',
    vignetteDarkness: 0.78,
  },
  'comment-debate': {
    id: 'comment-debate',
    name: 'Diskusi & Komentar',
    tagline: 'Algorithmic Booster',
    description: 'Mendorong audiens berkomentar dan berdebat secara aktif untuk memaksimalkan retensi dan algoritma rekomendasi media sosial.',
    icon: '💬',
    badgeLabel: 'Diskusi & Komentar',
    defaultCtaText: 'Bagaimana menurutmu? Tulis pendapat atau pengalamanmu di kolom komentar!',
    defaultButtonText: '💬 TULIS KOMENTAR SEKARANG',
    primaryColor: '#FFE500',
    accentColor: '#FF6B00',
    gradient: 'linear-gradient(135deg, rgba(255, 229, 0, 0.22) 0%, rgba(255, 107, 0, 0.18) 100%)',
    buttonGradient: 'linear-gradient(135deg, #FFE500 0%, #FF6B00 100%)',
    buttonTextColor: '#05070B',
    borderStyle: '2px solid rgba(255, 229, 0, 0.5)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(255, 229, 0, 0.35)',
    vignetteDarkness: 0.85,
  },
  'subscribe-bell': {
    id: 'subscribe-bell',
    name: 'YouTube Subscribe & Bell',
    tagline: 'Classic Creator Hub',
    description: 'Khas YouTube Shorts dengan aksen crimson red, ikon lonceng notifikasi, dan seruan subscribe yang jelas untuk loyalitas penonton.',
    icon: '🔔',
    badgeLabel: 'Dukung Channel',
    defaultCtaText: 'Dukung channel ini agar terus berkembang! Klik tombol subscribe sekarang.',
    defaultButtonText: '🔔 SUBSCRIBE SEKARANG',
    primaryColor: '#FF0000',
    accentColor: '#FFD700',
    gradient: 'linear-gradient(135deg, rgba(255, 0, 0, 0.25) 0%, rgba(255, 215, 0, 0.15) 100%)',
    buttonGradient: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
    buttonTextColor: '#FFFFFF',
    borderStyle: '2px solid rgba(255, 0, 0, 0.6)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(255, 0, 0, 0.4)',
    vignetteDarkness: 0.86,
  },
  'link-in-bio': {
    id: 'link-in-bio',
    name: 'Cek Link di Bio',
    tagline: 'Traffic & Conversion CTA',
    description: 'Dioptimalkan untuk mendorong konversi, mengarahkan penonton ke link affiliate, produk digital, formulir, atau episode penuh.',
    icon: '🔗',
    badgeLabel: 'Link Lengkap',
    defaultCtaText: 'Mau akses materi lengkap dan panduan praktisnya? Tonton link lengkapnya di bio!',
    defaultButtonText: '🔗 CEK LINK DI BIO 👇',
    primaryColor: '#10B981',
    accentColor: '#06B6D4',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.18) 100%)',
    buttonGradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
    buttonTextColor: '#021F17',
    borderStyle: '2px solid rgba(16, 185, 129, 0.6)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(16, 185, 129, 0.35)',
    vignetteDarkness: 0.84,
  },
};

export const OUTRO_PRESET_LIST: OutroPresetConfig[] = Object.values(OUTRO_STYLE_PRESETS);

/**
 * Resolves an outro preset config from an ID with fallback to 'creator-glass'.
 */
export function resolveOutroPreset(presetId?: string | null): OutroPresetConfig {
  if (presetId && presetId in OUTRO_STYLE_PRESETS) {
    return OUTRO_STYLE_PRESETS[presetId as OutroPresetId];
  }
  return OUTRO_STYLE_PRESETS['creator-glass'];
}
