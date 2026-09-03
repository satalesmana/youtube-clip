import { loadFont } from '@remotion/google-fonts/BreeSerif';
import { loadFont as loadHookFont } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as loadAntonFont } from '@remotion/google-fonts/Anton';

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
    accent: '#FACC15',
    accent2: '#F59E0B',
    cardBg: 'rgba(15, 23, 42, 0.88)',
    cardText: '#FFFFFF',
    cardStroke: '#FACC15',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#0F172A', '#1E293B'],
    surface: '#0A0E1A',
  },
  {
    id: 'emerald',
    accent: '#10B981',
    accent2: '#06B6D4',
    cardBg: 'rgba(6, 78, 59, 0.88)',
    cardText: '#FFFFFF',
    cardStroke: '#10B981',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#064E3B', '#0F172A'],
    surface: '#051E18',
  },
  {
    id: 'violet',
    accent: '#A78BFA',
    accent2: '#F472B6',
    cardBg: 'rgba(30, 27, 75, 0.88)',
    cardText: '#FFFFFF',
    cardStroke: '#A78BFA',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#1E1B4B', '#312E81'],
    surface: '#0E0A1E',
  },
  {
    id: 'sunset',
    accent: '#FB7185',
    accent2: '#FBBF24',
    cardBg: 'rgba(76, 5, 25, 0.88)',
    cardText: '#FFFFFF',
    cardStroke: '#FB7185',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#4C0519', '#1E1B4B'],
    surface: '#18040C',
  },
  {
    id: 'ocean',
    accent: '#38BDF8',
    accent2: '#818CF8',
    cardBg: 'rgba(12, 74, 110, 0.88)',
    cardText: '#FFFFFF',
    cardStroke: '#38BDF8',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#0C4A6E', '#0F172A'],
    surface: '#041626',
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

/**
 * Official Sports theme:
 * Electric Neon Yellow accent, Crimson Red highlight, deep stadium dark surface.
 */
export const SPORTS_THEME: Theme = {
  id: 'sports',
  accent: '#FFE600',
  accent2: '#FF2A2A',
  cardBg: 'rgba(7, 10, 20, 0.92)',
  cardText: '#FFFFFF',
  cardStroke: '#FFE600',
  stroke: '#000000',
  fill: '#FFFFFF',
  gradient: ['#070A14', '#151C2E'],
  surface: '#070A14',
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

/**
 * Aggressive condensed sans-serif for sports — high-energy, authoritative,
 * and standard across modern sports broadcast graphics & viral shorts.
 */
export const SPORTS_FONT = loadAntonFont('normal', {
  subsets: ['latin'],
}).fontFamily;
