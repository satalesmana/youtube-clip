export interface ViralityScoreBreakdown {
  overall: number;
  hookStrength: number;
  engagementFlow: number;
  trendRelevance: number;
  standaloneValue: number;
  reasons: string[];
}

export interface ViralClip {
  id?: string;
  start: number;
  end: number;
  duration: number;
  score: number;
  reason: string;
  title: string;
  hook?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  virality?: ViralityScoreBreakdown;
  selected?: boolean;
}

export interface ViralHook {
  id?: string;
  rank?: number;
  hookText: string;
  hookType: string;
  score: number;
  explanation?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  previewPath?: string;
  finalDurationSeconds?: number;
  tag?: string;
  highlightWords?: string[];
  source?: { start: number; end: number; transcript: string };
}

export interface SampleVideo {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  views?: number;
  duration?: number;
}

export interface TrendTopic {
  topic: string;
  score: number;
  sources: string[];
  summary: string;
  suggestedSearch?: string;
  sampleVideos?: SampleVideo[];
}

export interface HistoryItem {
  id?: string;
  title: string;
  video?: string;
  outputVideo?: string;
  videoUrl?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  estDuration?: number;
  createdAt?: string;
  timestamp?: string;
  videoId?: string;
}

export interface SubtitleTemplate {
  id: string;
  name: string;
  description: string;
  previewText?: string;
  style?: Record<string, unknown>;
}

export interface ScriptSection {
  type: 'hook' | 'context' | 'source' | 'commentary' | 'analysis' | 'supporting' | 'conclusion';
  text: string;
  spokenText?: string;
}

export interface TransformRequest {
  url: string;
  language?: string;
  genre?: string;
  templateId?: string;
  audioMode?: 'keep' | 'speech' | 'music' | 'keep_original' | 'strip_original' | 'voice_over';
  targetDuration?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  enableBroll?: boolean;
  enableIntroOutro?: boolean;
  whisperProvider?: string;
  sttProvider?: string;
  customPrompt?: string;
  clipIndex?: number;
  start?: number;
  end?: number;
  outputMode?: 'reel' | 'narration';
  selectedClips?: Array<{ start: number; end: number; title?: string }>;
  customScript?: {
    language?: string;
    sections: ScriptSection[];
  };
  ttsVoice?: string;
  sourceVolume?: number;
  /** Language for the output narration (used in narration mode). Separate from source transcript language. */
  outputLanguage?: 'id' | 'en';
  customHook?: string;
  hookTitle?: string;
  hookTag?: string;
  hookHighlightWords?: string[];
  hookPreviewPath?: string;
  sourceRange?: { start: number; end: number };
}

export interface TransformProgress {
  stage: string;
  pct: number;
  message: string;
}

export interface TransformResult {
  outputVideo: string;
  videoUrl: string;
  duration: number;
  title: string;
  thumbnailUrl?: string;
  transcript?: string;
  videoId?: string;
}

export interface DownloadedVideo {
  videoId: string;
  title: string;
  durationSeconds: number;
  videoPath: string;
  thumbnailUrl: string;
  alreadyDownloaded: boolean;
}
