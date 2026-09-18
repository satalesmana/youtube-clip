import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type {
  DownloadedVideo,
  ScriptSection,
  TransformResult,
  ViralClip,
  ViralHook,
  VisualPresetSelection,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
} from '../types';
import { resolvePresetIdFromHook } from '../lib/visual-presets';

export function useClipTransform() {
  const [step, setStep] = useState<number>(1);

  // Source & Settings
  const [url, setUrl] = useState('');
  const [downloadedVideo, setDownloadedVideo] = useState<DownloadedVideo | null>(null);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [language, setLanguage] = useState('auto');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [detectingLanguage, setDetectingLanguage] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<'id' | 'en'>('id');
  const [genre, setGenre] = useState('auto');
  const [outputMode, setOutputMode] = useState<'reel' | 'narration'>('reel');
  // targetDuration removed: clip boundaries are determined automatically by
  // ClipRefinementService which snaps to the nearest complete sentence/segment.
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [enableBroll, setEnableBroll] = useState(true);
  const [enableIntroOutro, setEnableIntroOutro] = useState(true);
  const [templateId, setTemplateId] = useState('beast');
  const [whisperProvider, setWhisperProvider] = useState('openai');
  const [customPrompt, setCustomPrompt] = useState('');

  // AI Script Drafting & TTS Narration
  const [scriptDraft, setScriptDraft] = useState<{ language?: string; sections: ScriptSection[] } | null>(null);
  const [isScriptCached, setIsScriptCached] = useState<boolean>(false);
  const [draftingScript, setDraftingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState('id-ID-ArdiNeural');
  const [sourceVolume, setSourceVolume] = useState(25);
  const [synthesizingTts, setSynthesizingTts] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const audioMode: 'keep_original' | 'strip_original' | 'voice_over' =
    outputMode === 'reel' ? 'keep_original' : sourceVolume > 0 ? 'voice_over' : 'strip_original';

  // Auto-load saved script draft from disk cache when video is selected
  useEffect(() => {
    const vid = downloadedVideo?.videoId;
    if (!vid || scriptDraft !== null) return;

    api.getSavedScript(vid).then((res) => {
      if (res.cached && res.script && res.script.sections?.length) {
        const normalizedSections = res.script.sections.map((s) => ({
          ...s,
          spokenText: s.spokenText?.trim() ? s.spokenText : s.text,
        }));
        setScriptDraft({ ...res.script, sections: normalizedSections });
        setIsScriptCached(true);
      }
    }).catch(() => {
      // Non-fatal if no cache exists
    });
  }, [downloadedVideo?.videoId, scriptDraft]);

  // Clips Analysis
  const [clips, setClips] = useState<ViralClip[]>([]);
  /**
   * Ordered array of selected clip indices (insertion order = user click order).
   * This determines the final concatenation order in the output video.
   */
  const [selectedClipIndices, setSelectedClipIndices] = useState<number[]>([]);
  // Derived: first selected index (or null) — kept for backward compat with
  // hook generation which only needs a single reference clip.
  const selectedClipIndex = selectedClipIndices.length > 0 ? selectedClipIndices[0]! : null;
  const [generatingClips, setGeneratingClips] = useState(false);
  const [clipsError, setClipsError] = useState<string | null>(null);

  // Hook Suggestions & Step 3 Styling
  const [hooks, setHooks] = useState<ViralHook[]>([]);
  const [selectedHookIndex, setSelectedHookIndex] = useState<number | null>(null);
  const [customHookText, setCustomHookText] = useState<string>('');
  const [customHookTag, setCustomHookTag] = useState<string>('👀 JANGAN DI-SKIP');
  const [enableHookIntro, setEnableHookIntro] = useState<boolean>(true);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  /**
   * Visual preset selected by the user in Step 3.
   * 'auto' = let the server resolver decide (AI hookType + angle).
   * Any VisualPresetId = explicit user choice, always overrides auto.
   */
  const [selectedVisualPreset, setSelectedVisualPreset] = useState<VisualPresetSelection>('auto');
  /**
   * Composition layout override:
   * 'auto' = use preset default layout.
   * Any CompositionLayout = explicit user override.
   */
  const [selectedHookLayout, setSelectedHookLayout] = useState<CompositionLayout | 'auto'>('auto');
  /**
   * Animation preset override:
   * 'auto' = use preset default animation.
   * Any AnimationPreset = explicit user override.
   */
  const [selectedHookAnimation, setSelectedHookAnimation] = useState<AnimationPreset | 'auto'>('auto');
  /**
   * Typography variant override:
   * 'auto' = use preset default typography.
   * Any TypographyVariant = explicit user override.
   */
  const [selectedHookTypography, setSelectedHookTypography] = useState<TypographyVariant | 'auto'>('auto');
  /**
   * Badge pill design preset:
   * 'neon-outline' | 'solid-impact' | 'highlight-chip' | 'editorial-label'
   */
  const [selectedHookBadgePreset, setSelectedHookBadgePreset] = useState<BadgePresetId>('neon-outline');
  /**
   * Badge pill color variant:
   * 'cyan' | 'magenta' | 'red' | 'yellow' | 'green' | 'purple' | 'gold' | 'auto'
   */
  const [selectedHookBadgeColor, setSelectedHookBadgeColor] = useState<BadgeColorVariant>('auto');

  // Full Transform
  const [runningTransform, setRunningTransform] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

  const startDownloadVideo = useCallback(async (customUrl?: string) => {
    const targetUrl = (customUrl ?? url).trim();
    if (!targetUrl) throw new Error('Masukkan URL YouTube terlebih dahulu');

    if (customUrl) setUrl(customUrl);
    setDownloadingVideo(true);
    setDownloadError(null);
    setDetectedLanguage(null);
    setProgressPct(25);
    setProgressLabel('Mengunduh & menyiapkan video YouTube…');

    try {
      const res = await api.downloadVideo(targetUrl);
      setDownloadedVideo(res);

      // Auto-detect transcript language after download
      setDetectingLanguage(true);
      setProgressLabel('Mendeteksi bahasa audio video…');
      try {
        const info = await api.fetchTranscriptInfo(res.videoId, targetUrl, 'openai');
        setDetectedLanguage(info.language);
      } catch {
        // Non-fatal: detection failed, user can still proceed
        setDetectedLanguage('auto');
      } finally {
        setDetectingLanguage(false);
      }

      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh video.';
      setDownloadError(msg);
      throw err;
    } finally {
      setDownloadingVideo(false);
      setProgressPct(0);
      setProgressLabel('');
    }
  }, [url]);

  const resetDownload = useCallback(() => {
    setDownloadedVideo(null);
    setDownloadError(null);
    setDetectedLanguage(null);
    setDetectingLanguage(false);
    setClips([]);
    setSelectedClipIndices([]);
  }, []);


  const [rerenderingClipPreviews, setRerenderingClipPreviews] = useState(false);

  const startGenerateClips = useCallback(async (customUrl?: string, options?: { refresh?: boolean }) => {
    const targetUrl = (customUrl ?? url).trim();
    if (!targetUrl) throw new Error('Masukkan URL YouTube terlebih dahulu');

    if (customUrl) setUrl(customUrl);
    setGeneratingClips(true);
    setClipsError(null);
    setProgressPct(20);
    setProgressLabel(options?.refresh ? 'Menganalisis ulang highlight & merender preview…' : 'Menganalisis highlight video & virality score…');

    try {
      const res = await api.generateClips({
        url: targetUrl,
        language: detectedLanguage || language,
        genre: genre !== 'auto' ? genre : undefined,
        // Use generous cap — ClipRefinementService will trim to the last
        // complete sentence boundary, so clips never cut mid-narration.
        maxDurationSec: 90,
        customPrompt: customPrompt.trim() || undefined,
        sttProvider: whisperProvider,
        refresh: options?.refresh,
      });

      setClips(res.clips);
      if (res.clips.length > 0) {
        setSelectedClipIndices([0]); // auto-select first clip
        setStep(2); // Advance to review highlights
      }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mendeteksi klip.';
      setClipsError(msg);
      throw err;
    } finally {
      setGeneratingClips(false);
      setProgressPct(0);
      setProgressLabel('');
    }
  }, [url, language, detectedLanguage, genre, customPrompt, whisperProvider]);

  /** Re-runs the full LLM analysis pipeline (refresh: true bypasses the
   * saved cache) and replaces the current clips with the new results. */
  const refreshClips = useCallback(async () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setGeneratingClips(true);
    setClipsError(null);
    setProgressPct(15);
    setProgressLabel('Menganalisis ulang video & merender preview klip baru…');

    try {
      const res = await api.generateClips({
        url: targetUrl,
        language: detectedLanguage || language,
        genre: genre !== 'auto' ? genre : undefined,
        maxDurationSec: 90,
        customPrompt: customPrompt.trim() || undefined,
        sttProvider: whisperProvider,
        refresh: true, // bypass saved cache, re-run LLM pipeline
      });

      setClips(res.clips);
      setSelectedClipIndices(res.clips.length > 0 ? [0] : []);
      setHooks([]);
      setSelectedHookIndex(null);
      setScriptDraft(null);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal generate ulang klip.';
      setClipsError(msg);
      throw err;
    } finally {
      setGeneratingClips(false);
      setProgressPct(0);
      setProgressLabel('');
    }
  }, [url, language, detectedLanguage, genre, customPrompt, whisperProvider]);

  /** Re-renders preview 9:16 videos and thumbnails for existing clips without re-running LLM. */
  const rerenderClipPreviews = useCallback(async () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setRerenderingClipPreviews(true);
    setClipsError(null);
    setProgressPct(30);
    setProgressLabel('Merender ulang preview video 9:16 dari awal…');

    try {
      const res = await api.rerenderClipPreviews({
        url: targetUrl,
        videoId: downloadedVideo?.videoId,
      });

      if (res.clips && res.clips.length > 0) {
        setClips(res.clips);
      }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal merender ulang preview klip.';
      setClipsError(msg);
      throw err;
    } finally {
      setRerenderingClipPreviews(false);
      setProgressPct(0);
      setProgressLabel('');
    }
  }, [url, downloadedVideo]);


  const startGenerateHooks = useCallback(async (options?: { refresh?: boolean }) => {
    const targetUrl = url.trim();
    if (!targetUrl) throw new Error('Masukkan URL video');

    const selectedClip = selectedClipIndex !== null ? clips[selectedClipIndex] : undefined;
    if (selectedClipIndex === null || !selectedClip) {
      throw new Error('Pilih salah satu rekomendasi klip terlebih dahulu');
    }

    setGeneratingHooks(true);
    try {
      const res = await api.generateHooks({
        url: targetUrl,
        language,
        genre: genre !== 'auto' ? genre : undefined,
        sttProvider: whisperProvider,
        refresh: options?.refresh,
        candidateId: selectedClipIndex !== null ? selectedClipIndex : 0,
        startTime: selectedClip?.start,
      });
      setHooks(res.hooks);
      return res.hooks;
    } catch (err) {
      throw err;
    } finally {
      setGeneratingHooks(false);
    }
  }, [url, language, genre, whisperProvider, selectedClipIndex, clips]);

  const selectHook = useCallback((idx: number | null) => {
    setSelectedHookIndex(idx);
    if (idx !== null && hooks[idx]) {
      setCustomHookText(hooks[idx].hookText);
      if (hooks[idx].tag) setCustomHookTag(hooks[idx].tag!);
    } else {
      setCustomHookText('');
    }
  }, [hooks]);

  const startDraftScript = useCallback(async (options?: { refresh?: boolean }) => {
    const targetUrl = url.trim();
    if (!targetUrl) throw new Error('Masukkan URL YouTube terlebih dahulu');

    const selectedClips = selectedClipIndices.length > 0
      ? selectedClipIndices
          .map((i) => clips[i])
          .filter((c): c is ViralClip => Boolean(c))
          .map((c) => ({ start: c.start, end: c.end, title: c.title }))
      : undefined;

    setDraftingScript(true);
    setScriptError(null);
    try {
      const res = await api.draftScript({
        url: targetUrl,
        videoId: downloadedVideo?.videoId,
        language: outputLanguage || language,
        genre: genre !== 'auto' ? genre : undefined,
        customPrompt: customPrompt.trim() || undefined,
        // No targetDuration: backend derives it from the actual clip length
        // so the script fits the natural narration boundary exactly.
        selectedClips,
        refresh: options?.refresh,
      });
      if (res.script) {
        const normalizedSections = res.script.sections?.map((s) => ({
          ...s,
          spokenText: s.spokenText?.trim() ? s.spokenText : s.text,
        })) ?? [];
        setScriptDraft({ ...res.script, sections: normalizedSections });
        setIsScriptCached(Boolean(res.cached));
      }
      return res.script;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat draf naskah AI.';
      setScriptError(msg);
      throw err;
    } finally {
      setDraftingScript(false);
    }
  }, [url, downloadedVideo, outputLanguage, language, genre, customPrompt, selectedClipIndices, clips]);

  const startSynthesizeTts = useCallback(async () => {
    if (!scriptDraft || !scriptDraft.sections || scriptDraft.sections.length === 0) {
      throw new Error('Belum ada naskah untuk disintesis. Buat draf naskah AI terlebih dahulu.');
    }
    setSynthesizingTts(true);
    try {
      const res = await api.synthesizeTts({
        url: url.trim() || undefined,
        videoId: downloadedVideo?.videoId,
        ttsVoice,
        customScript: scriptDraft,
      });
      const resolvedAudioUrl = res.audioUrl || res.narration?.url;
      if (resolvedAudioUrl) {
        setTtsAudioUrl(resolvedAudioUrl);
      }
      return res;
    } catch (err) {
      throw err;
    } finally {
      setSynthesizingTts(false);
    }
  }, [url, downloadedVideo, ttsVoice, scriptDraft]);

  const updateScriptSection = useCallback((idx: number, updates: Partial<ScriptSection> | string) => {
    setScriptDraft((prev) => {
      if (!prev) return prev;
      const newSections = [...prev.sections];
      const patch = typeof updates === 'string' ? { text: updates } : updates;
      newSections[idx] = { ...newSections[idx], ...patch };
      return { ...prev, sections: newSections };
    });
  }, []);

  const addScriptSection = useCallback(() => {
    setScriptDraft((prev) => {
      const newSection: ScriptSection = {
        type: 'commentary',
        text: 'Tambahkan narasi penjelas baru di sini...',
        spokenText: 'Tambahkan narasi penjelas baru di sini...',
      };
      if (!prev) {
        return { language: 'id', sections: [newSection] };
      }
      return { ...prev, sections: [...prev.sections, newSection] };
    });
  }, []);

  const removeScriptSection = useCallback((idx: number) => {
    setScriptDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: prev.sections.filter((_, i) => i !== idx) };
    });
  }, []);

  /**
   * Toggles a clip in/out of the selection.
   * - First click on an unselected clip: appends its index to the end of
   *   selectedClipIndices (preserving user-click order).
   * - Second click on an already-selected clip: removes it from the array.
   * This lets the user define the concatenation order explicitly.
   */
  const selectClip = useCallback((idx: number) => {
    setSelectedClipIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      }
      return [...prev, idx];
    });
  }, []);

  const selectAllClips = useCallback(() => {
    setSelectedClipIndices(clips.map((_, i) => i));
  }, [clips]);

  const clearSelectedClips = useCallback(() => {
    setSelectedClipIndices([]);
  }, []);

  const startTransform = useCallback(async () => {
    const targetUrl = url.trim();
    if (!targetUrl) throw new Error('Masukkan URL video');

    setRunningTransform(true);
    setTransformError(null);
    setProgressPct(10);
    setProgressLabel('Memulai pipeline transformasi…');

    // Build selectedClips in user-click order.
    // Both reel and narration mode receive the full list; backend resolves
    // multi-clip concatenation for reel, and derives duration/context for narration.
    const selectedClipsPayload = selectedClipIndices
      .map((idx) => clips[idx])
      .filter((c): c is ViralClip => Boolean(c))
      .map((c) => ({ start: c.start, end: c.end, title: c.title }));

    // For narration mode with multiple clips: send all as selectedClips[] so
    // the backend can derive the total duration and build a multi-segment script.
    // For reel mode: backend concatenates them in order.
    const selectedClipsToSend = selectedClipsPayload.length > 0 ? selectedClipsPayload : undefined;

    // Use first selected clip for legacy start/end fields (single-clip compat).
    const primaryClip = selectedClipIndices.length > 0 ? clips[selectedClipIndices[0]!] : undefined;

    const selectedHook = selectedHookIndex !== null ? hooks[selectedHookIndex] : undefined;
    const effectiveHookText = enableHookIntro
      ? (customHookText.trim() || selectedHook?.hookText || undefined)
      : undefined;
    const effectiveHookTag = enableHookIntro
      ? (customHookTag.trim() || selectedHook?.tag || undefined)
      : undefined;

    try {
      setProgressPct(35);
      setProgressLabel('Memproses audio STT & deteksi B-roll…');

      const res = await api.runTransform({
        url: targetUrl,
        language,
        templateId,
        audioMode,
        aspectRatio,
        enableBroll,
        enableIntroOutro,
        whisperProvider,
        sttProvider: whisperProvider,
        customPrompt: customPrompt.trim() || undefined,
        clipIndex: selectedClipIndex ?? undefined,
        start: primaryClip?.start,
        end: primaryClip?.end,
        outputMode,
        genre: genre !== 'auto' ? genre : undefined,
        customScript: outputMode === 'narration' && scriptDraft ? scriptDraft : undefined,
        ttsVoice: outputMode === 'narration' ? ttsVoice : undefined,
        sourceVolume: outputMode === 'narration' ? sourceVolume : undefined,
        outputLanguage: outputMode === 'narration' ? outputLanguage : undefined,
        customHook: effectiveHookText,
        hookTitle: effectiveHookText,
        hookTag: effectiveHookTag,
        hookHighlightWords: selectedHook?.highlightWords,
        hookPreviewPath: selectedHook?.previewPath,
        sourceRange: selectedHook?.source ? { start: selectedHook.source.start, end: selectedHook.source.end } : undefined,
        selectedClips: selectedClipsToSend,
        // Visual preset: pass selected visual preset, or resolve from hook if 'auto'
        visualPreset: enableHookIntro
          ? selectedVisualPreset !== 'auto'
            ? selectedVisualPreset
            : selectedHook
            ? resolvePresetIdFromHook(selectedHook.hookType, (selectedHook as any)?.angle ?? (selectedHook as any)?.hookAngle)
            : 'kinetic-punch'
          : undefined,
        hookLayout: enableHookIntro && selectedHookLayout !== 'auto' ? selectedHookLayout : undefined,
        hookAnimation: enableHookIntro && selectedHookAnimation !== 'auto' ? selectedHookAnimation : undefined,
        hookTypography: enableHookIntro && selectedHookTypography !== 'auto' ? selectedHookTypography : undefined,
        hookBadgePreset: enableHookIntro ? selectedHookBadgePreset : undefined,
        hookBadgeColor: enableHookIntro && selectedHookBadgeColor !== 'auto' ? selectedHookBadgeColor : undefined,
      });

      setProgressPct(100);
      setProgressLabel('Rendering selesai!');
      setTransformResult(res);
      setStep(4); // Advance to preview/result
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transformasi gagal.';
      setTransformError(msg);
      throw err;
    } finally {
      setRunningTransform(false);
    }
  }, [
    url,
    language,
    outputLanguage,
    genre,
    outputMode,
    scriptDraft,
    ttsVoice,
    sourceVolume,
    templateId,
    audioMode,
    aspectRatio,
    enableBroll,
    enableIntroOutro,
    whisperProvider,
    customPrompt,
    selectedClipIndices,
    selectedClipIndex,
    clips,
    hooks,
    selectedHookIndex,
    customHookText,
    customHookTag,
    enableHookIntro,
    selectedVisualPreset,
    selectedHookLayout,
    selectedHookAnimation,
    selectedHookTypography,
  ]);

  return {
    step,
    setStep,
    url,
    setUrl,
    downloadedVideo,
    downloadingVideo,
    downloadError,
    startDownloadVideo,
    resetDownload,
    language,
    setLanguage,
    detectedLanguage,
    detectingLanguage,
    outputLanguage,
    setOutputLanguage,
    genre,
    setGenre,
    audioMode,
    outputMode,
    setOutputMode,
    aspectRatio,
    setAspectRatio,
    enableBroll,
    setEnableBroll,
    enableIntroOutro,
    setEnableIntroOutro,
    templateId,
    setTemplateId,
    whisperProvider,
    setWhisperProvider,
    customPrompt,
    setCustomPrompt,
    // Script & TTS
    scriptDraft,
    isScriptCached,
    draftingScript,
    scriptError,
    ttsVoice,
    setTtsVoice,
    sourceVolume,
    setSourceVolume,
    synthesizingTts,
    ttsAudioUrl,
    startDraftScript,
    startSynthesizeTts,
    updateScriptSection,
    addScriptSection,
    removeScriptSection,
    // Clips & Hooks
    clips,
    selectedClipIndex,
    selectedClipIndices,
    selectClip,
    selectAllClips,
    clearSelectedClips,
    generatingClips,
    rerenderingClipPreviews,
    clipsError,
    hooks,
    selectedHookIndex,
    setSelectedHookIndex,
    selectHook,
    customHookText,
    setCustomHookText,
    customHookTag,
    setCustomHookTag,
    enableHookIntro,
    setEnableHookIntro,
    generatingHooks,
    // Visual preset selection
    selectedVisualPreset,
    setSelectedVisualPreset,
    selectedHookLayout,
    setSelectedHookLayout,
    selectedHookAnimation,
    setSelectedHookAnimation,
    selectedHookTypography,
    setSelectedHookTypography,
    selectedHookBadgePreset,
    setSelectedHookBadgePreset,
    selectedHookBadgeColor,
    setSelectedHookBadgeColor,
    startGenerateClips,
    refreshClips,
    rerenderClipPreviews,
    startGenerateHooks,
    runningTransform,
    progressPct,
    progressLabel,
    transformResult,
    transformError,
    startTransform,
  };
}
