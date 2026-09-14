import type {
  HistoryItem,
  ScriptSection,
  SubtitleTemplate,
  TransformRequest,
  TransformResult,
  TrendTopic,
  ViralClip,
  ViralHook,
  ViralityScoreBreakdown,
} from '../types';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const json = await res.json();
      if (json.message || json.error) errMsg = json.message || json.error;
    } catch {
      // Use standard error
    }
    throw new ApiError(res.status, errMsg);
  }
  return res.json() as Promise<T>;
}

/** Retry helper with exponential backoff. Retries only when error message includes 'high traffic'. */
async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.includes('high traffic') && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const api = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      return res.ok;
    } catch {
      return false;
    }
  },

  async fetchTemplates(): Promise<SubtitleTemplate[]> {
    try {
      const res = await fetch('/api/templates');
      const data = await handleResponse<{ templates?: SubtitleTemplate[] }>(res);
      return data.templates || [];
    } catch {
      return [
        { id: 'beast', name: 'MrBeast Style', description: 'Bold uppercase, yellow/cyan words, bounce pop' },
        { id: 'hormozi', name: 'Alex Hormozi', description: 'Impact font, intense highlight boxes, high contrast' },
        { id: 'clean', name: 'Minimal Modern', description: 'Inter font, sleek dark glass backing' },
      ];
    }
  },

  async runResearch(payload: {
    keyword?: string;
    subreddits?: string[];
    providers?: string[];
    maxTrends?: number;
    language?: string;
  }): Promise<{ topics: TrendTopic[]; count: number }> {
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ topics: TrendTopic[]; count?: number }>(res);
    return {
      topics: data.topics || [],
      count: data.count ?? data.topics?.length ?? 0,
    };
  },

  async downloadVideo(url: string): Promise<{
    videoId: string;
    title: string;
    durationSeconds: number;
    videoPath: string;
    thumbnailUrl: string;
    alreadyDownloaded: boolean;
  }> {
    const res = await fetch('/api/video/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return await handleResponse<{
      videoId: string;
      title: string;
      durationSeconds: number;
      videoPath: string;
      thumbnailUrl: string;
      alreadyDownloaded: boolean;
    }>(res);
  },

  /** Fetches or creates the transcript for a video. Pass youtubeUrl so the backend can transcribe if transcript isn't cached. */
  async fetchTranscriptInfo(videoId: string, youtubeUrl?: string, sttProvider?: string): Promise<{
    language: string;
    cached: boolean;
  }> {
    // Schema requires exactly one of: youtubeUrl OR videoId
    const params = youtubeUrl
      ? new URLSearchParams({ youtubeUrl })
      : new URLSearchParams({ videoId });
    if (sttProvider) params.set('sttProvider', sttProvider);

    const fetchFn = async () => {
      const res = await fetch(`/api/transcript?${params.toString()}`);
      const data = await handleResponse<{
        success: boolean;
        videoId: string;
        transcript: { language?: string };
        cached: boolean;
      }>(res);
      return {
        language: data.transcript?.language ?? 'auto',
        cached: data.cached,
      };
    };

    // Retry on high‑traffic errors up to 3 times
    return await retry(fetchFn, 3, 2000);
  },

  async generateClips(payload: {
    url: string;
    language?: string;
    genre?: string;
    maxDurationSec?: number;
    customPrompt?: string;
    sttProvider?: string;
    refresh?: boolean;
  }): Promise<{ clips: ViralClip[]; videoTitle?: string; duration?: number; videoId?: string }> {
    const res = await fetch('/api/clips/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        language: payload.language && payload.language !== 'auto' ? payload.language : undefined,
        genre: payload.genre && payload.genre !== 'auto' ? payload.genre : undefined,
        sttProvider: payload.sttProvider,
        refresh: payload.refresh,
      }),
    });
    const data = await handleResponse<{
      clips?: Array<{
        id: string;
        rank: number;
        start: number;
        end: number;
        durationSeconds?: number;
        duration?: number;
        score: number;
        title: string;
        reason: string;
        hook?: string;
        previewUrl?: string;
        thumbnailUrl?: string;
        virality?: ViralityScoreBreakdown;
      }>;
      videoId?: string;
      videoTitle?: string;
      duration?: number;
    }>(res);

    const clips: ViralClip[] = (data.clips || []).map((c) => ({
      id: c.id,
      start: c.start,
      end: c.end,
      duration: c.durationSeconds ?? c.duration ?? Math.round(c.end - c.start),
      score: c.score,
      reason: c.reason,
      title: c.title,
      hook: c.hook,
      previewUrl: c.previewUrl,
      thumbnailUrl: c.thumbnailUrl || (c.previewUrl ? c.previewUrl.replace(/\.mp4$/, '.jpg') : undefined),
      virality: c.virality,
    }));

    return {
      clips,
      videoId: data.videoId,
      videoTitle: data.videoTitle,
      duration: data.duration,
    };
  },

  async rerenderClipPreviews(payload: {
    url?: string;
    videoId?: string;
  }): Promise<{ clips: ViralClip[] }> {
    const res = await fetch('/api/clips/rerender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        videoId: payload.videoId,
      }),
    });

    const data = await handleResponse<{
      clips?: Array<{
        id: string;
        rank: number;
        start: number;
        end: number;
        durationSeconds?: number;
        duration?: number;
        score: number;
        title: string;
        reason: string;
        hook?: string;
        previewUrl?: string;
        thumbnailUrl?: string;
        virality?: ViralityScoreBreakdown;
      }>;
    }>(res);

    const clips: ViralClip[] = (data.clips || []).map((c) => ({
      id: c.id,
      start: c.start,
      end: c.end,
      duration: c.durationSeconds ?? c.duration ?? Math.round(c.end - c.start),
      score: c.score,
      reason: c.reason,
      title: c.title,
      hook: c.hook,
      previewUrl: c.previewUrl,
      thumbnailUrl: c.thumbnailUrl || (c.previewUrl ? c.previewUrl.replace(/\.mp4$/, '.jpg') : undefined),
      virality: c.virality,
    }));

    return { clips };
  },


  async generateHooks(payload: {
    url: string;
    language?: string;
    genre?: string;
    sttProvider?: string;
    refresh?: boolean;
    candidateId?: number;
    startTime?: number;
  }): Promise<{ hooks: ViralHook[] }> {
    const res = await fetch('/api/hooks/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        language: payload.language && payload.language !== 'auto' ? payload.language : undefined,
        genre: payload.genre && payload.genre !== 'auto' ? payload.genre : undefined,
        sttProvider: payload.sttProvider,
        refresh: payload.refresh,
        candidateId: payload.candidateId,
        startTime: payload.startTime,
      }),
    });
    const data = await handleResponse<{
      hooks?: Array<{
        id?: string;
        rank?: number;
        rankScore?: number;
        style?: string;
        headline?: { text: string; tag?: string; highlightWords?: string[] };
        spokenHook?: { text: string; duration: number };
        score?: { curiosity?: number; final?: number };
        previewUrl?: string;
        thumbnailUrl?: string;
        previewPath?: string;
        finalDurationSeconds?: number;
        accuracy?: { explanation?: string };
        source?: { start: number; end: number; transcript: string };
      }>;
    }>(res);

    const hooks: ViralHook[] = (data.hooks || []).map((h) => ({
      id: h.id,
      rank: h.rank,
      hookText: h.headline?.text || h.spokenHook?.text || '',
      hookType: h.style || 'CURIOSITY',
      score: h.rankScore ?? Math.round(h.score?.final ?? 90),
      explanation: h.accuracy?.explanation,
      previewUrl: h.previewUrl,
      thumbnailUrl: h.thumbnailUrl || (h.previewUrl ? h.previewUrl.replace(/\.mp4(\?.*)?$/, '.jpg$1') : undefined),
      previewPath: h.previewPath,
      finalDurationSeconds: h.finalDurationSeconds,
      tag: h.headline?.tag,
      highlightWords: h.headline?.highlightWords,
      source: h.source,
    }));

    return {
      hooks,
    };
  },

  async draftScript(payload: {
    url?: string;
    videoId?: string;
    language?: string;
    genre?: string;
    customPrompt?: string;
    targetDuration?: number;
    selectedClips?: Array<{ start: number; end: number; title?: string }>;
  }): Promise<{
    script: { language?: string; sections: ScriptSection[] };
    videoId?: string;
  }> {
    const res = await fetch('/api/scripts/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        videoId: payload.videoId,
        language: payload.language && payload.language !== 'auto' ? payload.language : undefined,
        genre: payload.genre && payload.genre !== 'auto' ? payload.genre : undefined,
        customPrompt: payload.customPrompt,
        targetDuration: payload.targetDuration,
        selectedClips: payload.selectedClips,
      }),
    });
    return await handleResponse(res);
  },

  async synthesizeTts(payload: {
    url?: string;
    videoId?: string;
    ttsVoice?: string;
    customScript: { language?: string; sections: ScriptSection[] };
  }): Promise<{ audioUrl?: string; audioPath?: string; durationSeconds?: number }> {
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        videoId: payload.videoId,
        ttsVoice: payload.ttsVoice,
        customScript: payload.customScript,
      }),
    });
    return await handleResponse(res);
  },

  async runTransform(payload: TransformRequest): Promise<TransformResult> {
    const res = await fetch('/api/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: payload.url,
        sttProvider: payload.sttProvider || payload.whisperProvider,
        language: payload.outputLanguage ?? (payload.language && payload.language !== 'auto' ? payload.language : 'auto'),
        genre: payload.genre && payload.genre !== 'auto' ? payload.genre : undefined,
        template: 'commentary',
        subtitleStyle: payload.templateId || 'beast',
        engine: 'remotion',
        audioMode: payload.audioMode,
        outputMode: payload.outputMode,
        customScript: payload.customScript,
        ttsVoice: payload.ttsVoice,
        sourceVolume: payload.sourceVolume,
        selectedClips: payload.selectedClips,
        customHook: payload.customHook,
        hookTitle: payload.hookTitle,
        hookTag: payload.hookTag,
        hookHighlightWords: payload.hookHighlightWords,
        hookPreviewPath: payload.hookPreviewPath,
        sourceRange:
          payload.sourceRange
            ? payload.sourceRange
            : payload.start !== undefined && payload.end !== undefined
            ? { start: payload.start, end: payload.end }
            : undefined,
      }),
    });
    const data = await handleResponse<{
      outputVideo?: string;
      videoUrl?: string;
      video?: string;
      duration?: number;
      title?: string;
      videoId?: string;
      thumbnailUrl?: string;
      transcript?: string;
    }>(res);

    const videoPath = data.videoUrl || data.outputVideo || data.video || '';
    return {
      outputVideo: videoPath,
      videoUrl: videoPath,
      duration: data.duration ?? 60,
      title: data.title || 'TRANSFORMED_REEL_MASTER',
      videoId: data.videoId,
      thumbnailUrl: data.thumbnailUrl,
      transcript: data.transcript,
    };
  },

  async fetchHistory(): Promise<HistoryItem[]> {
    const res = await fetch('/api/history');
    const data = await handleResponse<{ clips?: HistoryItem[] } | HistoryItem[]>(res);
    if (Array.isArray(data)) return data;
    return data.clips || [];
  },

  async generateSocialCaptions(payload: {
    videoId?: string;
    title?: string;
    summary?: string;
  }): Promise<Record<string, string>> {
    const res = await fetch('/api/captions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ captions?: Record<string, string> }>(res);
    return data.captions || {};
  },
};

