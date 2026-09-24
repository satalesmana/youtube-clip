import type { OutroPresetId } from '../types';

export interface ClientOutroPreset {
  id: OutroPresetId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  badgeLabel: string;
  badgeIcon: string;
  defaultCtaText: string;
  defaultButtonText: string;
  primaryColor: string;
  accentColor: string;
  buttonGradient: string;
  buttonTextColor: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
  quickCtas: string[];
}

export const CLIENT_OUTRO_PRESETS: ClientOutroPreset[] = [
  {
    id: 'creator-glass',
    name: 'Creator Glass',
    tagline: 'Modern Glassmorphic',
    description: 'Frosted glass transparan dengan ring avatar bercahaya dan verified badge. Sangat cocok untuk personal branding kreator.',
    icon: '✨',
    badgeLabel: 'Kreator Pilihan',
    badgeIcon: '✨',
    defaultCtaText: 'Suka konten ini? Ikuti untuk update harian!',
    defaultButtonText: '+ IKUTI SEKARANG',
    primaryColor: '#00F2FE',
    accentColor: '#4FACFE',
    buttonGradient: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
    buttonTextColor: '#07090E',
    cardBg: 'rgba(15, 18, 28, 0.88)',
    cardBorder: '1.5px solid rgba(255, 255, 255, 0.14)',
    glowColor: 'rgba(0, 242, 254, 0.35)',
    quickCtas: [
      'Suka konten ini? Ikuti untuk update harian!',
      'Follow akun ini untuk tips & wawasan terbaru setiap hari!',
      'Jangan lewatkan video menarik berikutnya, ikuti sekarang!',
    ],
  },
  {
    id: 'viral-neon',
    name: 'Viral Neon Impact',
    tagline: 'Cyberpunk High-Energy',
    description: 'Glow neon cyan-magenta dengan visual kontras tinggi dan efek pulse energik. Sangat pas untuk konten gaming, tech, dan highlight viral.',
    icon: '⚡',
    badgeLabel: 'Trending Viral',
    badgeIcon: '⚡',
    defaultCtaText: 'Jangan lewatkan momen seru berikutnya! Aktifkan notifikasi sekarang.',
    defaultButtonText: '⚡ IKUTI & NOTIFIKASI',
    primaryColor: '#FF007F',
    accentColor: '#00F0FF',
    buttonGradient: 'linear-gradient(135deg, #FF007F 0%, #00F0FF 100%)',
    buttonTextColor: '#FFFFFF',
    cardBg: 'rgba(10, 12, 22, 0.92)',
    cardBorder: '2px solid #00F0FF',
    glowColor: 'rgba(255, 0, 127, 0.45)',
    quickCtas: [
      'Jangan lewatkan momen viral berikutnya! Nyalakan lonceng 🔔',
      'Follow & aktifkan notifikasi agar tidak ketinggalan update!',
      'Klip seru lainnya segera hadir. Klik ikuti sekarang juga!',
    ],
  },
  {
    id: 'minimal-clean',
    name: 'Clean Obsidian',
    tagline: 'Editorial & Refined',
    description: 'Desain minimalis slate gelap dengan border tipis refined dan tipografi bersih. Ideal untuk edukasi, bisnis, finance, dan podcast.',
    icon: '🏛️',
    badgeLabel: 'Insight Harian',
    badgeIcon: '✦',
    defaultCtaText: 'Dapatkan rangkuman wawasan mendalam dan perspektif baru setiap hari.',
    defaultButtonText: 'Langganan Sekarang →',
    primaryColor: '#F8FAFC',
    accentColor: '#94A3B8',
    buttonGradient: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
    buttonTextColor: '#0F172A',
    cardBg: 'rgba(15, 23, 42, 0.94)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.2)',
    glowColor: 'rgba(255, 255, 255, 0.08)',
    quickCtas: [
      'Dapatkan rangkuman wawasan mendalam dan perspektif baru.',
      'Langganan untuk analisis mendalam tanpa basa-basi.',
      'Ikuti pemikiran dan strategi praktis lainnya setiap minggu.',
    ],
  },
  {
    id: 'comment-debate',
    name: 'Diskusi & Komentar',
    tagline: 'Algorithmic Booster',
    description: 'Mendorong audiens berkomentar dan berdebat secara aktif untuk memaksimalkan retensi dan algoritma rekomendasi media sosial.',
    icon: '💬',
    badgeLabel: 'Diskusi & Komentar',
    badgeIcon: '💬',
    defaultCtaText: 'Bagaimana menurutmu? Tulis pendapat atau pengalamanmu di kolom komentar!',
    defaultButtonText: '💬 TULIS KOMENTAR SEKARANG',
    primaryColor: '#FFE500',
    accentColor: '#FF6B00',
    buttonGradient: 'linear-gradient(135deg, #FFE500 0%, #FF6B00 100%)',
    buttonTextColor: '#080A0E',
    cardBg: 'rgba(18, 20, 28, 0.92)',
    cardBorder: '1.5px solid rgba(255, 229, 0, 0.45)',
    glowColor: 'rgba(255, 229, 0, 0.35)',
    quickCtas: [
      'Bagaimana menurutmu? Tulis pendapatmu di kolom komentar!',
      'Setuju atau tidak? Yuk diskusi di bawah 👇',
      'Pernah ngalamin hal yang sama? Ceritain di komentar!',
    ],
  },
  {
    id: 'subscribe-bell',
    name: 'YouTube Subscribe & Bell',
    tagline: 'Classic Creator Hub',
    description: 'Khas YouTube Shorts dengan aksen crimson red, ikon lonceng notifikasi, dan seruan subscribe yang jelas untuk loyalitas penonton.',
    icon: '🔔',
    badgeLabel: 'Dukung Channel',
    badgeIcon: '🔔',
    defaultCtaText: 'Dukung channel ini agar terus berkembang! Klik tombol subscribe sekarang.',
    defaultButtonText: '🔔 SUBSCRIBE SEKARANG',
    primaryColor: '#FF0000',
    accentColor: '#FFD700',
    buttonGradient: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
    buttonTextColor: '#FFFFFF',
    cardBg: 'rgba(20, 14, 18, 0.92)',
    cardBorder: '1.5px solid rgba(255, 0, 0, 0.5)',
    glowColor: 'rgba(255, 0, 0, 0.4)',
    quickCtas: [
      'Dukung channel ini agar terus berkembang! Klik tombol subscribe.',
      'Subscribe & nyalakan lonceng untuk episode berikutnya!',
      'Terima kasih sudah menonton! Bantu like & subscribe ya!',
    ],
  },
  {
    id: 'link-in-bio',
    name: 'Cek Link di Bio',
    tagline: 'Traffic & Conversion CTA',
    description: 'Dioptimalkan untuk mendorong konversi, mengarahkan penonton ke link affiliate, produk digital, formulir, atau episode penuh.',
    icon: '🔗',
    badgeLabel: 'Link Lengkap',
    badgeIcon: '🔗',
    defaultCtaText: 'Mau akses materi lengkap dan panduan praktisnya? Tonton link lengkapnya di bio!',
    defaultButtonText: '🔗 CEK LINK DI BIO 👇',
    primaryColor: '#10B981',
    accentColor: '#06B6D4',
    buttonGradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
    buttonTextColor: '#021F17',
    cardBg: 'rgba(12, 24, 22, 0.92)',
    cardBorder: '1.5px solid rgba(16, 185, 129, 0.5)',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    quickCtas: [
      'Mau tonton video versi lengkapnya? Cek link di bio!',
      'Download template & panduan gratisnya lewat link di bio!',
      'Akses kursus & penawaran spesial sekarang di link bio!',
    ],
  },
];

export const CLIENT_OUTRO_PRESET_MAP: Record<OutroPresetId, ClientOutroPreset> =
  CLIENT_OUTRO_PRESETS.reduce(
    (acc, p) => ({ ...acc, [p.id]: p }),
    {} as Record<OutroPresetId, ClientOutroPreset>,
  );

export function resolveClientOutroPreset(id?: string | null): ClientOutroPreset {
  if (id && id in CLIENT_OUTRO_PRESET_MAP) {
    return CLIENT_OUTRO_PRESET_MAP[id as OutroPresetId];
  }
  return CLIENT_OUTRO_PRESET_MAP['creator-glass'];
}
