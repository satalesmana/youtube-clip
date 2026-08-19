import { loadFont } from '@remotion/google-fonts/BreeSerif';
import { loadFont as loadHookFont } from '@remotion/google-fonts/ArchivoBlack';

export type Theme = {
  id: string;
  accent: string;
  accent2: string;
  cardBg: string;
  cardText: string;
  cardStroke: string;
  stroke: string;
  fill: string;
  gradient: [string, string];
  surface: string;
};

/**
 * Deterministic palettes. The palette index is derived from the video's
 * candidate + angle so every angle gets a distinct look, but re-rendering the
 * same video always produces the same theme.
 */
export const PALETTES: Theme[] = [
  {
    id: 'classic',
    accent: '#FFE135',
    accent2: '#FFB800',
    cardBg: '#FFE135',
    cardText: '#0A0A0A',
    cardStroke: '#0A0A0A',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#FFE135', '#FFB800'],
    surface: '#0D0D12',
  },
  {
    id: 'neon',
    accent: '#39FF14',
    accent2: '#00E5FF',
    cardBg: '#0A0A0A',
    cardText: '#39FF14',
    cardStroke: '#39FF14',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#0A0A0A', '#123B12'],
    surface: '#050A05',
  },
  {
    id: 'violet',
    accent: '#A78BFA',
    accent2: '#F472B6',
    cardBg: '#1E1B4B',
    cardText: '#FFFFFF',
    cardStroke: '#A78BFA',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#1E1B4B', '#4C1D95'],
    surface: '#0E0A1E',
  },
  {
    id: 'sunset',
    accent: '#FF6B6B',
    accent2: '#FFD93D',
    cardBg: '#2D1B69',
    cardText: '#FFD93D',
    cardStroke: '#FF6B6B',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#2D1B69', '#FF6B6B'],
    surface: '#14081F',
  },
  {
    id: 'ocean',
    accent: '#00E5FF',
    accent2: '#7C3AED',
    cardBg: '#0B2A3B',
    cardText: '#00E5FF',
    cardStroke: '#7C3AED',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#0B2A3B', '#06284A'],
    surface: '#040F1A',
  },
];

export const GOLD_THEME: Theme = {
  id: 'gold',
  accent: '#D4AF37',
  accent2: '#F5D76E',
  cardBg: '#0A0A0A',
  cardText: '#F5D76E',
  cardStroke: '#D4AF37',
  stroke: '#000000',
  fill: '#FFFFFF',
  gradient: ['#0A0A0A', '#3A2E0F'],
  surface: '#0A0A0A',
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const selectTheme = (candidateId: string, angleId: string): Theme => {
  const seed = `${candidateId}:${angleId}`;
  return PALETTES[hashString(seed) % PALETTES.length];
};

/** Display font shared across all compositions (signature of the template). */
export const FONT = loadFont('normal', {
  subsets: ['latin'],
}).fontFamily;

/**
 * Heavy sans-serif for hook headlines — the 2026 kinetic-typography trend:
 * big, center-aligned, high-contrast sans for the opening claim.
 */
export const HOOK_FONT = loadHookFont('normal', {
  subsets: ['latin'],
}).fontFamily;
