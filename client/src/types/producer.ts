/**
 * Client-side producer types — mirrors src/types/producer.ts on the server
 * but with NO imports from server-side code.
 * All union literals are kept in sync with client/src/types/index.ts.
 */

import type {
  VisualPresetSelection,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
  OutroPresetId,
} from './index';

// ---------------------------------------------------------------------------
// Action discriminated union
// ---------------------------------------------------------------------------

export type ProducerAction =
  | { type: 'SET_STEP'; step: 1 | 2 | 3 | 4 }
  | { type: 'SET_ASPECT_RATIO'; value: '9:16' | '16:9' | '1:1' }
  | { type: 'SET_GENRE'; value: string }
  | { type: 'SET_OUTPUT_MODE'; mode: 'reel' | 'narration' }
  | { type: 'SET_TEMPLATE_ID'; templateId: string }
  | { type: 'SET_HOOK_TEXT'; text: string }
  | { type: 'SET_HOOK_TAG'; tag: string }
  | { type: 'SET_VISUAL_PRESET'; preset: VisualPresetSelection }
  | { type: 'SET_HOOK_LAYOUT'; layout: CompositionLayout | 'auto' }
  | { type: 'SET_HOOK_ANIMATION'; animation: AnimationPreset | 'auto' }
  | { type: 'SET_HOOK_TYPOGRAPHY'; typography: TypographyVariant | 'auto' }
  | { type: 'SET_HOOK_BADGE_PRESET'; preset: BadgePresetId }
  | { type: 'SET_HOOK_BADGE_COLOR'; color: BadgeColorVariant }
  | { type: 'SET_ENABLE_HOOK_INTRO'; value: boolean }
  | { type: 'SET_ENABLE_BROLL'; value: boolean }
  | {
      type: 'ADD_BROLL_PLACEMENT';
      placement: {
        start: number;
        end: number;
        query: string;
        mood?: string;
      };
    }
  | { type: 'CLEAR_BROLL' }
  | {
      type: 'SET_OUTRO';
      outro: {
        enable?: boolean;
        preset?: OutroPresetId;
        ctaText?: string;
        buttonText?: string;
        duration?: number;
        channelName?: string;
      };
    }
  | { type: 'SET_TTS_VOICE'; voice: string }
  | { type: 'SET_SOURCE_VOLUME'; volume: number }
  | { type: 'SELECT_CLIPS'; indices: number[] }
  | { type: 'TRIM_CLIP'; index: number; start: number; end: number }
  | { type: 'TRIGGER_GENERATE_HOOKS'; refresh?: boolean }
  | { type: 'TRIGGER_GENERATE_BROLL'; force?: boolean }
  | { type: 'TRIGGER_RENDER' }
  | {
      type: 'SET_DYNAMIC_STYLE';
      target: 'hook' | 'subtitle' | 'video' | 'canvas' | 'outro';
      styles: Record<string, string | number>;
    }
  | {
      type: 'CLEAR_DYNAMIC_STYLES';
      target?: 'hook' | 'subtitle' | 'video' | 'canvas' | 'outro' | 'all';
    }
  | {
      type: 'ADD_DYNAMIC_OVERLAY';
      overlay: {
        id?: string;
        start: number;
        end: number;
        type: 'sticker' | 'callout' | 'shape' | 'text' | 'badge' | 'html';
        content: string;
        position?: { x?: string | number; y?: string | number };
        styles?: Record<string, string | number>;
        animation?: 'bounce' | 'pulse' | 'fade' | 'slide' | 'spin' | 'none';
      };
    }
  | { type: 'CLEAR_DYNAMIC_OVERLAYS' }
  | {
      type: 'SET_BACKGROUND_MUSIC';
      trackId?: string | null;
      volume?: number;
      autoDucking?: boolean;
    };

export interface DynamicOverlayItem {
  id: string;
  start: number;
  end: number;
  type: 'sticker' | 'callout' | 'shape' | 'text' | 'badge' | 'html';
  content: string;
  position?: { x?: string | number; y?: string | number };
  styles?: Record<string, string | number>;
  animation?: 'bounce' | 'pulse' | 'fade' | 'slide' | 'spin' | 'none';
}

// ---------------------------------------------------------------------------
// Editor context snapshot (sent to AI on every request)
// ---------------------------------------------------------------------------

export interface ProducerEditorContext {
  video?: {
    videoId?: string;
    title?: string;
    channelTitle?: string;
    duration?: number;
  };
  step: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  genre: string;
  outputMode: 'reel' | 'narration';
  templateId: string;
  hook: {
    selectedHookIndex: number | null;
    currentHookText?: string;
    customHookText?: string;
    customHookTag?: string;
    visualPreset?: string;
    layout?: string;
    animation?: string;
    typography?: string;
    badgePreset?: string;
    badgeColor?: string;
    enableHookIntro: boolean;
  };
  clips: {
    count: number;
    selectedIndices: number[];
    list?: Array<{
      index: number;
      start: number;
      end: number;
      duration: number;
      score: number;
      title: string;
      hook?: string;
    }>;
  };
  broll: {
    enableBroll: boolean;
    count: number;
    placements?: Array<{
      start: number;
      end: number;
      query: string;
      mood?: string;
      source?: string;
    }>;
  };
  outro: {
    enableIntroOutro: boolean;
    preset: string;
    ctaText: string;
    buttonText: string;
    duration: number;
    channelName: string;
  };
  audio: {
    ttsVoice?: string;
    sourceVolume: number;
    backgroundMusic?: {
      trackId?: string | null;
      volume?: number;
      autoDucking?: boolean;
    };
  };
  dynamicStyles?: Record<string, Record<string, string | number>>;
  dynamicOverlays?: DynamicOverlayItem[];
}

// ---------------------------------------------------------------------------
// Chat types
// ---------------------------------------------------------------------------

export interface ProducerChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProducerChatRequest {
  messages: ProducerChatMessage[];
  currentContext: ProducerEditorContext;
}

export interface ProducerEditorSnapshot {
  step: number;
  genre: string;
  outputMode: 'reel' | 'narration';
  aspectRatio: '9:16' | '16:9' | '1:1';
  enableBroll: boolean;
  brollPlacements: import('../types').BrollPlacementItem[];
  enableIntroOutro: boolean;
  outroPreset: OutroPresetId;
  outroCtaText: string;
  outroButtonText: string;
  outroDuration: number;
  outroChannelName: string;
  outroLogoUrl: string | null;
  templateId: string;
  subtitleSize: import('../types').SubtitleSize;
  selectedMusicTrack: import('../lib/audio-catalog').MusicTrack | null;
  musicVolume: number;
  autoDucking: boolean;
  dynamicStyles: Record<string, Record<string, string | number>>;
  dynamicOverlays: DynamicOverlayItem[];
  selectedClipIndices: number[];
  clips: import('../types').ViralClip[];
  ttsVoice: string;
  sourceVolume: number;
  selectedHookIndex: number | null;
  customHookText: string;
  customHookTag: string;
  enableHookIntro: boolean;
  selectedVisualPreset: VisualPresetSelection;
  selectedHookLayout: CompositionLayout | 'auto';
  selectedHookAnimation: AnimationPreset | 'auto';
  selectedHookTypography: TypographyVariant | 'auto';
  selectedHookBadgePreset: BadgePresetId;
  selectedHookBadgeColor: BadgeColorVariant;
}

export interface ProducerChatResponse {
  success: boolean;
  reply: string;
  actions: ProducerAction[];
  appliedBadges?: string[];
  suggestedQuestions?: string[];
  actionResults?: Array<{ actionType: string; status: 'applied' | 'rejected'; message?: string }>;
  fallback?: boolean;
}
