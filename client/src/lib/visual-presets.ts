/**
 * Visual preset constants for the client UI.
 *
 * Single source of truth for UI display, metadata chips,
 * and live hook preview rendering.
 */
import type { VisualPresetId } from '../types';

export type PresetFamily = 'energik' | 'cerita' | 'pertanyaan' | 'data';

export interface PresetFamilyInfo {
  id: PresetFamily;
  label: string;
  badgeLabel: string;
  description: string;
  bestFitGuidance: string;
}

export const PRESET_FAMILIES: PresetFamilyInfo[] = [
  {
    id: 'energik',
    label: '⚡ Energik & Kejutan',
    badgeLabel: '⚡ Energik',
    description: 'Gerak cepat & punch tegas untuk klaim berani atau peringatan mendesak',
    bestFitGuidance: 'Cocok untuk hook kejutan, kontrarian, atau peringatan keras',
  },
  {
    id: 'cerita',
    label: '📖 Cerita & Naratif',
    badgeLabel: '📖 Cerita',
    description: 'Transisi halus untuk narasi personal dan edukasi berwibawa',
    bestFitGuidance: 'Cocok untuk hook naratif, pengalaman pribadi, atau otoritas',
  },
  {
    id: 'pertanyaan',
    label: '❓ Pertanyaan & Rasa Ingin Tahu',
    badgeLabel: '❓ Pertanyaan',
    description: 'Membuka knowledge gap yang memancing audiens berhenti scroll',
    bestFitGuidance: 'Cocok untuk hook pertanyaan atau rasa penasaran mendalam',
  },
  {
    id: 'data',
    label: '📊 Data, Angka & Fakta',
    badgeLabel: '📊 Data',
    description: 'Sorotan angka konkret, statistik, dan bukti hasil nyata',
    bestFitGuidance: 'Cocok untuk hook dengan statistik, persentase, atau bukti sosial',
  },
];

export interface ClientVisualPreset {
  id: VisualPresetId;
  label: string;
  description: string;
  family: PresetFamily;
  familyLabel: string;
  bestFor: string;
  metaBadges: string[];
  previewClass: string;
  typography: 'Kinetic' | 'Stacked' | 'Minimal' | 'Bold Caps';
  fontName: string;
  animation: 'Spring Punch' | 'Word Cascade' | 'Slide Up' | 'Scale Burst' | 'Fade';
  highlight: 'Neon Glow' | 'Underline' | 'Background Chip' | 'Brush' | 'Stroke' | 'Box';
  decoration: 'None' | 'Question Mark' | 'Number Badge' | 'Arrow' | 'Scribble' | 'Spark' | 'Burst' | 'Corner Frame';
  layout: 'Centered' | 'Top-Heavy' | 'Split-Proof' | 'Full-Screen Text' | 'Subject-First' | 'Data-Focus' | 'Question-Focus';
  demoHeadline: string;
  demoKeyword: string;
  tag: string;
}

/** All presets in display order — directly displayed without hidden buttons. */
export const CLIENT_VISUAL_PRESETS: ClientVisualPreset[] = [
  {
    id: 'kinetic-punch',
    label: '⚡ Kinetic Punch',
    description: 'Hard-hitting spring entrance with bold uppercase text and neon glow',
    family: 'energik',
    familyLabel: '⚡ Energik',
    bestFor: 'Klaim berani, urgensi, atau kejutan keras',
    metaBadges: ['Spring', 'Neon Glow', 'Centered'],
    previewClass: 'vp-preview-kinetic',
    typography: 'Kinetic',
    fontName: 'Bebas Neue',
    animation: 'Spring Punch',
    highlight: 'Neon Glow',
    decoration: 'None',
    layout: 'Centered',
    demoHeadline: "YOU'RE DOING THIS WRONG!",
    demoKeyword: 'WRONG',
    tag: '👀 JANGAN DI-SKIP',
  },
  {
    id: 'curiosity-stack',
    label: '🤔 Curiosity Stack',
    description: 'Words cascade in one by one, building anticipation',
    family: 'pertanyaan',
    familyLabel: '❓ Pertanyaan',
    bestFor: 'Pancingan rasa penasaran bertahap kata demi kata',
    metaBadges: ['Cascade', 'Neon Glow', 'Subject-First'],
    previewClass: 'vp-preview-curiosity',
    typography: 'Stacked',
    fontName: 'Montserrat',
    animation: 'Word Cascade',
    highlight: 'Neon Glow',
    decoration: 'None',
    layout: 'Subject-First',
    demoHeadline: 'KENAPA VIDEO KAMU SEPI?',
    demoKeyword: 'SEPI',
    tag: '💡 RAHASIA SUKSES',
  },
  {
    id: 'story-slide',
    label: '📖 Story Slide',
    description: 'Smooth upward reveal with clean typography and underline accents',
    family: 'cerita',
    familyLabel: '📖 Cerita',
    bestFor: 'Kisah personal atau alur narasi ("3 tahun lalu...")',
    metaBadges: ['Slide Up', 'Underline', 'Centered'],
    previewClass: 'vp-preview-story',
    typography: 'Minimal',
    fontName: 'Poppins',
    animation: 'Slide Up',
    highlight: 'Underline',
    decoration: 'None',
    layout: 'Centered',
    demoHeadline: '3 TAHUN LALU AKU...',
    demoKeyword: 'LALU',
    tag: '🎯 DETIK KRUSIAL',
  },
  {
    id: 'minimal-question',
    label: '❓ Question Focus',
    description: 'Slide-up reveal centered around a prominent question mark',
    family: 'pertanyaan',
    familyLabel: '❓ Pertanyaan',
    bestFor: 'Pertanyaan langsung yang memicu rasa ingin tahu',
    metaBadges: ['Slide Up', 'Question Mark', 'Question-Focus'],
    previewClass: 'vp-preview-question',
    typography: 'Minimal',
    fontName: 'Inter',
    animation: 'Slide Up',
    highlight: 'Underline',
    decoration: 'Question Mark',
    layout: 'Question-Focus',
    demoHeadline: 'Harus Gimana Sekarang?',
    demoKeyword: 'Harus',
    tag: '❓ TAHUKAH KAMU?',
  },
  {
    id: 'bold-impact',
    label: '🔥 Bold Impact',
    description: 'Full-width scale burst with vivid chip highlights on key words',
    family: 'energik',
    familyLabel: '⚡ Energik',
    bestFor: 'Pernyataan kontrarian atau larangan keras',
    metaBadges: ['Scale Burst', 'Chip', 'Top-Heavy'],
    previewClass: 'vp-preview-bold',
    typography: 'Bold Caps',
    fontName: 'Anton',
    animation: 'Scale Burst',
    highlight: 'Background Chip',
    decoration: 'None',
    layout: 'Top-Heavy',
    demoHeadline: 'STOP POSTING SETIAP HARI!',
    demoKeyword: 'POSTING',
    tag: '⚠️ AWAS SALAH',
  },
  {
    id: 'data-punch',
    label: '📊 Data Punch',
    description: 'Scale-burst entrance with a number badge that emphasizes your stat',
    family: 'data',
    familyLabel: '📊 Data',
    bestFor: 'Statistik, angka persen, atau bukti kuantitatif',
    metaBadges: ['Scale Burst', 'Badge', 'Data-Focus'],
    previewClass: 'vp-preview-data',
    typography: 'Bold Caps',
    fontName: 'Inter',
    animation: 'Scale Burst',
    highlight: 'Background Chip',
    decoration: 'Number Badge',
    layout: 'Data-Focus',
    demoHeadline: '10,284,921 VIEWS HANYA DARI 1 TRIK',
    demoKeyword: '10,284,921',
    tag: '📊 99% ORANG SALAH',
  },
  {
    id: 'opportunity-glow',
    label: '💡 Opportunity Glow',
    description: 'Warm cascading words with an inviting glow on the key insight',
    family: 'data',
    familyLabel: '📊 Data',
    bestFor: 'Peluang baru, tips cepat, atau solusi praktis',
    metaBadges: ['Cascade', 'Warm Glow', 'Centered'],
    previewClass: 'vp-preview-opportunity',
    typography: 'Stacked',
    fontName: 'Plus Jakarta Sans',
    animation: 'Word Cascade',
    highlight: 'Neon Glow',
    decoration: 'None',
    layout: 'Centered',
    demoHeadline: 'JADI CREATOR PROFESIONAL TAHUN INI',
    demoKeyword: 'PROFESIONAL',
    tag: '🚀 1 TRIK CEPAT',
  },
  {
    id: 'focus-brush',
    label: '🖌️ Focus Brush',
    description: 'Vibrant brush stroke highlight with sparkling attention accents',
    family: 'energik',
    familyLabel: '⚡ Energik',
    bestFor: 'Peringatan keras & sorotan kata kunci artistik',
    metaBadges: ['Spring', 'Brush Stroke', 'Spark'],
    previewClass: 'vp-preview-brush',
    typography: 'Kinetic',
    fontName: 'Bebas Neue',
    animation: 'Spring Punch',
    highlight: 'Brush',
    decoration: 'Spark',
    layout: 'Top-Heavy',
    demoHeadline: 'JANGAN SAMPAI SALAH PILIH!',
    demoKeyword: 'SALAH',
    tag: '🚨 PERINGATAN KERAS',
  },
  {
    id: 'clean-fade',
    label: '✨ Clean Fade',
    description: 'Smooth elegant fade entrance with framing corner brackets',
    family: 'cerita',
    familyLabel: '📖 Cerita',
    bestFor: 'Pembukaan elegan, edukasi tenang, atau otoritas',
    metaBadges: ['Fade', 'Box Frame', 'Corner Frame'],
    previewClass: 'vp-preview-fade',
    typography: 'Minimal',
    fontName: 'Inter',
    animation: 'Fade',
    highlight: 'Box',
    decoration: 'Corner Frame',
    layout: 'Centered',
    demoHeadline: 'RAHASIA BESAR DI BALIK VIRALNYA KONTEN',
    demoKeyword: 'RAHASIA',
    tag: '🔒 BUKAN UNTUK SEMUA',
  },
  {
    id: 'scribble-quote',
    label: '✏️ Scribble Accent',
    description: 'Playful hand-drawn scribble with outlined keyword emphasis',
    family: 'pertanyaan',
    familyLabel: '❓ Pertanyaan',
    bestFor: 'Dilema relatable atau pancingan santai',
    metaBadges: ['Cascade', 'Stroke', 'Scribble'],
    previewClass: 'vp-preview-scribble',
    typography: 'Stacked',
    fontName: 'Montserrat',
    animation: 'Word Cascade',
    highlight: 'Stroke',
    decoration: 'Scribble',
    layout: 'Subject-First',
    demoHeadline: 'KAMU MASIH MELAKUKAN INI?',
    demoKeyword: 'MELAKUKAN',
    tag: '🤔 PERNAH GINI GAK?',
  },
  {
    id: 'action-pointer',
    label: '👉 Action Pointer',
    description: 'High-energy scale burst with an action arrow directing focus',
    family: 'data',
    familyLabel: '📊 Data',
    bestFor: 'Pilihan dilema (A vs B) atau ajakan tindakan tegas',
    metaBadges: ['Scale Burst', 'Chip', 'Arrow'],
    previewClass: 'vp-preview-action',
    typography: 'Bold Caps',
    fontName: 'Anton',
    animation: 'Scale Burst',
    highlight: 'Background Chip',
    decoration: 'Arrow',
    layout: 'Split-Proof',
    demoHeadline: 'PILIH SETIA ATAU SIKAT TAWARAN?',
    demoKeyword: 'TAWARAN',
    tag: '🛑 STOP SCROLLING',
  },
  {
    id: 'burst-stat',
    label: '💥 Viral Burst',
    description: 'Dynamic burst rays framing full-screen bold claims',
    family: 'energik',
    familyLabel: '⚡ Energik',
    bestFor: 'Pernyataan viral layar penuh dengan ledakan visual',
    metaBadges: ['Scale Burst', 'Neon Glow', 'Burst Rays'],
    previewClass: 'vp-preview-burst',
    typography: 'Bold Caps',
    fontName: 'Anton',
    animation: 'Scale Burst',
    highlight: 'Neon Glow',
    decoration: 'Burst',
    layout: 'Full-Screen Text',
    demoHeadline: '97% ORANG GAGAL KARENA INI',
    demoKeyword: '97%',
    tag: '⚡ FAKTA MENGEJUTKAN',
  },
];

/** Quick lookup by ID. */
export const CLIENT_PRESET_MAP = Object.fromEntries(
  CLIENT_VISUAL_PRESETS.map((p) => [p.id, p])
) as Record<VisualPresetId, ClientVisualPreset>;

/**
 * Lightweight client-side helper to determine AI recommended preset
 * matching the server resolver table.
 */
export function resolvePresetIdFromHook(hookType?: string, angle?: string): VisualPresetId {
  if (hookType === 'question') return 'minimal-question';
  if (hookType === 'data-statistics') return 'data-punch';
  if (hookType === 'story-anecdote' || hookType === 'authority') return 'story-slide';
  if (hookType === 'intriguing-statement') {
    if (angle === 'contrarian' || angle === 'controversial') return 'bold-impact';
    return 'curiosity-stack';
  }
  if (hookType === 'shock-surprise' || hookType === 'direct-address') {
    return 'kinetic-punch';
  }
  if (hookType === 'you-focused' || hookType === 'problem-solution') {
    if (angle === 'opportunity' || angle === 'social-proof') return 'opportunity-glow';
    if (angle === 'curiosity') return 'curiosity-stack';
  }
  if (angle === 'fear' || angle === 'urgency' || angle === 'surprise') return 'kinetic-punch';
  if (angle === 'curiosity' || angle === 'prediction') return 'curiosity-stack';
  if (angle === 'opportunity' || angle === 'social-proof') return 'opportunity-glow';
  if (angle === 'contrarian' || angle === 'controversial') return 'bold-impact';
  if (angle === 'authority') return 'story-slide';
  return 'kinetic-punch';
}

export function resolvePresetLabelFromHook(hookType?: string, angle?: string): string {
  const id = resolvePresetIdFromHook(hookType, angle);
  return CLIENT_PRESET_MAP[id]?.label ?? '⚡ Kinetic Punch';
}

export function resolveFamilyFromHook(hookType?: string, angle?: string): PresetFamily {
  const presetId = resolvePresetIdFromHook(hookType, angle);
  return CLIENT_PRESET_MAP[presetId]?.family ?? 'energik';
}
