/**
 * master-canvas-presets.ts — Holistic Canvas Theme Bundles
 *
 * Combines canvas backdrop, video framing/geometry, subtitle typography,
 * hook intro visual presets, and motion physics personality into unified,
 * harmonious aesthetic packages.
 */

import type React from 'react';

export interface MasterCanvasPreset {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  accentColor: string;
  badges: string[];
  /** Styles applied to the root 9:16 Canvas stage */
  canvasStyles: React.CSSProperties;
  /** Styles applied to the center Video layer (framing, radius, filters) */
  videoStyles: React.CSSProperties;
  /** Primary subtitle karaoke preset */
  subtitleTemplateId: 'beast' | 'hormozi' | 'clean';
  subtitleSize: 'sm' | 'md' | 'lg' | 'xl';
  /** Primary hook visual preset (from registry) */
  hookVisualPresetId: string;
  /** Default motion personality for overlays */
  motionPersonality: 'snappy' | 'smooth' | 'editorial' | 'floating';
}

export const MASTER_CANVAS_PRESETS: MasterCanvasPreset[] = [
  {
    id: 'viral-beast',
    label: '⚡ Viral Beast',
    emoji: '🟡',
    tagline: 'High Energy & Retention Pop',
    description: 'Vignette kuning lembut, subtitle punchy tebal dengan stroke hitam, dan motion spring snappy.',
    accentColor: '#FFE600',
    badges: ['MrBeast Style', 'Kinetic Hook', 'Snappy Motion'],
    canvasStyles: {
      backgroundColor: '#0A0E14',
      boxShadow: 'inset 0 0 100px rgba(255, 230, 0, 0.08)',
    },
    videoStyles: {
      filter: 'contrast(1.06) saturate(1.10)',
    },
    subtitleTemplateId: 'beast',
    subtitleSize: 'md',
    hookVisualPresetId: 'kinetic-punch',
    motionPersonality: 'snappy',
  },
  {
    id: 'clean-editorial',
    label: '✨ Clean Editorial',
    emoji: '🧊',
    tagline: 'Modern Tech & Thought Leader',
    description: 'Framing kartu melayang kaca frosted, typography Inter modern, dan gerakan halus berwibawa.',
    accentColor: '#38BDF8',
    badges: ['Glassmorphic', 'Clean Subtitle', 'Smooth Motion'],
    canvasStyles: {
      background: 'radial-gradient(circle at 50% 30%, #1E293B 0%, #0A0F1D 100%)',
    },
    videoStyles: {
      borderRadius: '24px',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.12)',
      filter: 'contrast(1.03)',
    },
    subtitleTemplateId: 'clean',
    subtitleSize: 'md',
    hookVisualPresetId: 'clean-fade',
    motionPersonality: 'editorial',
  },
  {
    id: 'bold-impact',
    label: '🔥 Bold Impact',
    emoji: '🟢',
    tagline: 'High Contrast & Direct Authority',
    description: 'Kotak hijau neon Hormozi, frame kontras tegas, dan hook peringatan skala eksplosif.',
    accentColor: '#10B981',
    badges: ['Hormozi Box', 'Scale Burst', 'Impact Shake'],
    canvasStyles: {
      backgroundColor: '#090D12',
      boxShadow: 'inset 0 0 120px rgba(16, 185, 129, 0.07)',
    },
    videoStyles: {
      filter: 'contrast(1.10) brightness(1.02)',
    },
    subtitleTemplateId: 'hormozi',
    subtitleSize: 'md',
    hookVisualPresetId: 'bold-impact',
    motionPersonality: 'snappy',
  },
  {
    id: 'curiosity-story',
    label: '📖 Curiosity Story',
    emoji: '🌌',
    tagline: 'Narrative & Mystery Atmosphere',
    description: 'Backdrop midnight navy yang imersif, kata mengalir bertahap, memicu rasa ingin tahu.',
    accentColor: '#818CF8',
    badges: ['Story Slide', 'Word Cascade', 'Subtle Breathing'],
    canvasStyles: {
      background: 'radial-gradient(circle at center, #0B192C 0%, #030712 100%)',
      boxShadow: 'inset 0 0 80px rgba(99, 102, 241, 0.08)',
    },
    videoStyles: {
      filter: 'saturate(0.96) contrast(1.04)',
    },
    subtitleTemplateId: 'clean',
    subtitleSize: 'md',
    hookVisualPresetId: 'curiosity-stack',
    motionPersonality: 'smooth',
  },
  {
    id: 'split-focus',
    label: '📱 Split Focus',
    emoji: '📊',
    tagline: 'Evidence & Data Driven',
    description: 'Layout split terarah dengan border pembatas neon cyan dan aksen data kuantitatif.',
    accentColor: '#00F0FF',
    badges: ['Data Punch', 'Neon Divider', 'Floating Pop'],
    canvasStyles: {
      backgroundColor: '#080C14',
      boxShadow: 'inset 0 0 90px rgba(0, 240, 255, 0.08)',
    },
    videoStyles: {
      borderRadius: '16px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
    },
    subtitleTemplateId: 'beast',
    subtitleSize: 'sm',
    hookVisualPresetId: 'data-punch',
    motionPersonality: 'floating',
  },
];

export function findMasterCanvasPreset(id: string): MasterCanvasPreset | undefined {
  return MASTER_CANVAS_PRESETS.find((p) => p.id === id);
}
