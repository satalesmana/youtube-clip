import type {
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
} from './visual-preset.js';
import type { OutroPresetId } from './outro-preset.js';

export type ProducerAction =
  | { type: 'SET_STEP'; step: 1 | 2 | 3 | 4 }
  | { type: 'SET_ASPECT_RATIO'; value: '9:16' | '16:9' | '1:1' }
  | { type: 'SET_GENRE'; value: string }
  | { type: 'SET_OUTPUT_MODE'; mode: 'reel' | 'narration' }
  | { type: 'SET_TEMPLATE_ID'; templateId: string }
  | { type: 'SET_HOOK_TEXT'; text: string }
  | { type: 'SET_HOOK_TAG'; tag: string }
  | { type: 'SET_VISUAL_PRESET'; preset: VisualPresetId | 'auto' }
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
  | { type: 'TRIGGER_RENDER' };

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
  };
}

export interface ProducerChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProducerChatRequest {
  messages: ProducerChatMessage[];
  currentContext: ProducerEditorContext;
}

export interface ProducerChatResponse {
  reply: string;
  actions: ProducerAction[];
  appliedBadges?: string[];
  suggestedQuestions?: string[];
}
