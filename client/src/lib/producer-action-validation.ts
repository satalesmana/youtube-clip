import type { ProducerAction } from '../types/producer';
import { AUDIO_CATALOG } from './audio-catalog';
import { CLIENT_OUTRO_PRESET_MAP } from './outro-presets';
import { CLIENT_PRESET_MAP } from './visual-presets';

const layouts = new Set(['auto', 'centered', 'top-heavy', 'split-proof', 'full-screen-text', 'subject-first']);
const animations = new Set(['auto', 'spring-punch', 'word-cascade', 'slide-up', 'scale-burst', 'fade']);
const typography = new Set(['auto', 'kinetic', 'montserrat', 'bebas-neue', 'outfit', 'poppins']);
const badgePresets = new Set(['neon-outline', 'solid-impact', 'highlight-chip', 'editorial-label', 'price-tag', 'speech-bubble', 'burst-stamp', 'diagonal-slash']);
const badgeColors = new Set(['auto', 'cyan', 'magenta', 'red', 'yellow', 'green', 'purple', 'gold']);
const genres = new Set(['auto', 'podcast', 'sports', 'match-highlight', 'gaming', 'tutorial', 'commentary', 'entertainment']);
const cssKeys = new Set(['color', 'background', 'backgroundColor', 'opacity', 'transform', 'filter', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'border', 'borderRadius', 'padding', 'margin', 'top', 'left', 'right', 'bottom', 'width', 'height', 'zIndex', 'textShadow', 'boxShadow']);
const plainText = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isFiniteNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export function validateProducerActions(
  input: unknown,
  context: { clipCount: number; durationSec?: number },
): { actions: ProducerAction[]; rejected: number } {
  if (!Array.isArray(input)) return { actions: [], rejected: 0 };
  const actions: ProducerAction[] = [];
  let rejected = 0;
  for (const raw of input.slice(0, 20)) {
    const a = raw as Record<string, any>;
    let valid = false;
    switch (a?.type) {
      case 'SET_STEP': valid = [1, 2, 3, 4].includes(a.step); break;
      case 'SET_ASPECT_RATIO': valid = ['9:16', '16:9', '1:1'].includes(a.value); break;
      case 'SET_GENRE': valid = genres.has(a.value); break;
      case 'SET_OUTPUT_MODE': valid = ['reel', 'narration'].includes(a.mode); break;
      case 'SET_TEMPLATE_ID': valid = ['beast', 'hormozi', 'clean'].includes(a.templateId); break;
      case 'SET_HOOK_TEXT': valid = plainText(a.text, 180); break;
      case 'SET_HOOK_TAG': valid = typeof a.tag === 'string' && a.tag.length <= 80; break;
      case 'SET_VISUAL_PRESET': valid = a.preset === 'auto' || a.preset in CLIENT_PRESET_MAP; break;
      case 'SET_HOOK_LAYOUT': valid = layouts.has(a.layout); break;
      case 'SET_HOOK_ANIMATION': valid = animations.has(a.animation); break;
      case 'SET_HOOK_TYPOGRAPHY': valid = typography.has(a.typography); break;
      case 'SET_HOOK_BADGE_PRESET': valid = badgePresets.has(a.preset); break;
      case 'SET_HOOK_BADGE_COLOR': valid = badgeColors.has(a.color); break;
      case 'SET_ENABLE_HOOK_INTRO': case 'SET_ENABLE_BROLL': valid = typeof a.value === 'boolean'; break;
      case 'ADD_BROLL_PLACEMENT': {
        const p = a.placement;
        valid = !!p && isFiniteNumber(p.start) && isFiniteNumber(p.end) && p.start >= 0 && p.end > p.start &&
          (context.durationSec === undefined || p.end <= context.durationSec) && plainText(p.query, 120) && (p.mood === undefined || plainText(p.mood, 60));
        break;
      }
      case 'CLEAR_BROLL': case 'CLEAR_DYNAMIC_OVERLAYS': case 'TRIGGER_RENDER': valid = true; break;
      case 'CLEAR_DYNAMIC_STYLES': valid = a.target === undefined || ['hook', 'subtitle', 'video', 'canvas', 'outro', 'all'].includes(a.target); break;
      case 'TRIGGER_GENERATE_HOOKS': case 'TRIGGER_GENERATE_BROLL': valid = a.refresh === undefined && a.force === undefined || typeof a.refresh === 'boolean' && a.force === undefined || typeof a.force === 'boolean' && a.refresh === undefined; break;
      case 'SET_OUTRO': {
        const o = a.outro;
        valid = !!o && (o.enable === undefined || typeof o.enable === 'boolean') &&
          (o.preset === undefined || o.preset in CLIENT_OUTRO_PRESET_MAP) &&
          (o.ctaText === undefined || typeof o.ctaText === 'string' && o.ctaText.length <= 240) &&
          (o.buttonText === undefined || typeof o.buttonText === 'string' && o.buttonText.length <= 80) &&
          (o.duration === undefined || isFiniteNumber(o.duration) && o.duration >= 1 && o.duration <= 15) &&
          (o.channelName === undefined || typeof o.channelName === 'string' && o.channelName.length <= 80);
        break;
      }
      case 'SET_TTS_VOICE': valid = plainText(a.voice, 80); break;
      case 'SET_SOURCE_VOLUME': valid = isFiniteNumber(a.volume) && a.volume >= 0 && a.volume <= 100; break;
      case 'SELECT_CLIPS': valid = Array.isArray(a.indices) && a.indices.length <= context.clipCount && a.indices.every((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < context.clipCount); break;
      case 'SET_DYNAMIC_STYLE': {
        valid = ['hook', 'subtitle', 'video', 'canvas', 'outro'].includes(a.target) && !!a.styles && typeof a.styles === 'object' && !Array.isArray(a.styles) &&
          Object.entries(a.styles).length > 0 && Object.entries(a.styles).length <= 12 && Object.entries(a.styles).every(([k,v]) => cssKeys.has(k) && (typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' && v.length <= 160 && !/url\s*\(|expression\s*\(|javascript:/i.test(v)));
        break;
      }
      case 'ADD_DYNAMIC_OVERLAY': {
        const o = a.overlay;
        valid = !!o && isFiniteNumber(o.start) && isFiniteNumber(o.end) && o.start >= 0 && o.end > o.start &&
          (context.durationSec === undefined || o.end <= context.durationSec) &&
          ['sticker','callout','shape','text','badge','html'].includes(o.type) && plainText(o.content, 5000) &&
          (o.animation === undefined || ['bounce','pulse','fade','slide','spin','none'].includes(o.animation)) &&
          (o.position === undefined || typeof o.position === 'object' && Object.values(o.position).every((v: unknown) => typeof v === 'string' && v.length <= 40 || isFiniteNumber(v) && (v as number) >= 0 && (v as number) <= 100));
        break;
      }
      case 'SET_BACKGROUND_MUSIC': {
        valid = (a.trackId === undefined || a.trackId === null || AUDIO_CATALOG.some((t) => t.id === a.trackId)) &&
          (a.volume === undefined || isFiniteNumber(a.volume) && a.volume >= 0 && a.volume <= 100) &&
          (a.autoDucking === undefined || typeof a.autoDucking === 'boolean');
        break;
      }
      default: valid = false;
    }
    if (valid) actions.push(a as ProducerAction); else rejected++;
  }
  return { actions, rejected: rejected + Math.max(0, input.length - 20) };
}
