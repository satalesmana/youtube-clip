import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { DownloadedVideo } from '../types';
import type {
  ProducerAction,
  ProducerChatMessage,
  ProducerEditorContext,
  ProducerEditorSnapshot,
  ProducerChatResponse,
} from '../types/producer';
import type { useClipTransform } from './useClipTransform';
import { resolveStockBrollUrl } from '../lib/stock-broll';
import { AUDIO_CATALOG } from '../lib/audio-catalog';
import { validateProducerActions } from '../lib/producer-action-validation';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Return type of useClipTransform — avoids coupling to internal implementation. */
type ClipTransform = ReturnType<typeof useClipTransform>;

/** Max number of undo snapshots kept in memory. */
const MAX_UNDO = 10;

/** Auto-clear delay for applied badges (ms). */
const BADGE_CLEAR_DELAY = 4000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useAiProducer
 *
 * Manages the AI Producer chat session and state synchronisation with the
 * clip-transform editor.  Each outgoing message includes a full context
 * snapshot so the AI always has up-to-date information about the editor.
 * Actions returned by the AI are executed immediately against `transform`.
 * Before executing actions a snapshot of the current transform state is
 * pushed onto `undoStack` so the user can roll back with `undo()`.
 *
 * @param transform  The return value of `useClipTransform`.
 * @param downloadedVideo  The currently-loaded video, or null.
 */
export function useAiProducer(
  transform: ClipTransform,
  downloadedVideo: DownloadedVideo | null,
) {
  // ---- Chat history -------------------------------------------------------
  const [messages, setMessages] = useState<ProducerChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- AI-suggested state -------------------------------------------------
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [remocnCandidates, setRemocnCandidates] = useState<NonNullable<ProducerChatResponse['remocnCandidates']>>([]);
  const [appliedBadges, setAppliedBadges] = useState<string[]>([]);
  const badgeClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Undo stack ---------------------------------------------------------
  // Each entry is an opaque snapshot of the editor context at a point in time.
  // We store them as ProducerEditorContext objects and replay them through
  // their individual setters on undo.
  const [undoStack, setUndoStack] = useState<ProducerEditorSnapshot[]>([]);
  const videoIdRef = useRef(downloadedVideo?.videoId);

  useEffect(() => {
    if (videoIdRef.current === downloadedVideo?.videoId) return;
    videoIdRef.current = downloadedVideo?.videoId;
    setMessages([]);
    setError(null);
    setSuggestedQuestions([]);
    setAppliedBadges([]);
    setUndoStack([]);
    setIsFallback(false);
    if (badgeClearTimer.current) clearTimeout(badgeClearTimer.current);
  }, [downloadedVideo?.videoId]);

  // =========================================================================
  // buildContext — snapshot the current editor state for the AI
  // =========================================================================

  const buildContext = useCallback((): ProducerEditorContext => {
    return {
      video: downloadedVideo
        ? {
            videoId: downloadedVideo.videoId,
            title: downloadedVideo.title,
            channelTitle: downloadedVideo.channelTitle,
            duration: downloadedVideo.durationSeconds,
          }
        : undefined,
      step: transform.step,
      aspectRatio: transform.aspectRatio,
      genre: transform.genre,
      outputMode: transform.outputMode,
      templateId: transform.templateId,
      hook: {
        selectedHookIndex: transform.selectedHookIndex,
        currentHookText:
          transform.selectedHookIndex !== null
            ? transform.hooks[transform.selectedHookIndex]?.hookText
            : undefined,
        customHookText: transform.customHookText,
        customHookTag: transform.customHookTag,
        visualPreset:
          transform.selectedVisualPreset !== 'auto'
            ? transform.selectedVisualPreset
            : undefined,
        layout:
          transform.selectedHookLayout !== 'auto'
            ? transform.selectedHookLayout
            : undefined,
        animation:
          transform.selectedHookAnimation !== 'auto'
            ? transform.selectedHookAnimation
            : undefined,
        typography:
          transform.selectedHookTypography !== 'auto'
            ? transform.selectedHookTypography
            : undefined,
        badgePreset: transform.selectedHookBadgePreset,
        badgeColor: transform.selectedHookBadgeColor,
        enableHookIntro: transform.enableHookIntro,
      },
      clips: {
        count: transform.clips.length,
        selectedIndices: transform.selectedClipIndices,
        list: transform.clips.slice(0, 10).map((c, i) => ({
          index: i,
          start: c.start,
          end: c.end,
          duration: c.duration,
          score: c.score,
          title: c.title,
          hook: c.hook,
        })),
      },
      broll: {
        enableBroll: transform.enableBroll,
        count: transform.brollPlacements.length,
        placements: transform.brollPlacements.slice(0, 5).map((p) => ({
          start: (p as any).start ?? (p as any).startSec ?? p.cue?.start ?? 0,
          end: (p as any).end ?? (p as any).endSec ?? p.cue?.end ?? 0,
          query: (p as any).query ?? p.cue?.query ?? '',
          mood: (p as any).mood ?? p.cue?.mood,
          source: p.asset?.source,
        })),
      },
      outro: {
        enableIntroOutro: transform.enableIntroOutro,
        preset: transform.outroPreset,
        ctaText: transform.outroCtaText,
        buttonText: transform.outroButtonText,
        duration: transform.outroDuration,
        channelName: transform.outroChannelName,
      },
      audio: {
        ttsVoice: transform.ttsVoice || undefined,
        sourceVolume: transform.sourceVolume,
        backgroundMusic: {
          trackId: transform.selectedMusicTrack?.id ?? null,
          volume: transform.musicVolume,
          autoDucking: transform.autoDucking,
        },
      },
      dynamicStyles: transform.dynamicStyles,
      dynamicOverlays: transform.dynamicOverlays,
    };
  }, [transform, downloadedVideo]);

  const captureSnapshot = useCallback((): ProducerEditorSnapshot => ({
    step: transform.step,
    genre: transform.genre,
    outputMode: transform.outputMode,
    aspectRatio: transform.aspectRatio,
    enableBroll: transform.enableBroll,
    brollPlacements: structuredClone(transform.brollPlacements),
    enableIntroOutro: transform.enableIntroOutro,
    outroPreset: transform.outroPreset,
    outroCtaText: transform.outroCtaText,
    outroButtonText: transform.outroButtonText,
    outroDuration: transform.outroDuration,
    outroChannelName: transform.outroChannelName,
    outroLogoUrl: transform.outroLogoUrl,
    templateId: transform.templateId,
    subtitleSize: transform.subtitleSize,
    selectedMusicTrack: transform.selectedMusicTrack ? { ...transform.selectedMusicTrack } : null,
    musicVolume: transform.musicVolume,
    autoDucking: transform.autoDucking,
    dynamicStyles: structuredClone(transform.dynamicStyles),
    dynamicOverlays: structuredClone(transform.dynamicOverlays),
    selectedClipIndices: [...transform.selectedClipIndices],
    clips: structuredClone(transform.clips),
    ttsVoice: transform.ttsVoice,
    sourceVolume: transform.sourceVolume,
    selectedHookIndex: transform.selectedHookIndex,
    customHookText: transform.customHookText,
    customHookTag: transform.customHookTag,
    enableHookIntro: transform.enableHookIntro,
    selectedVisualPreset: transform.selectedVisualPreset,
    selectedHookLayout: transform.selectedHookLayout,
    selectedHookAnimation: transform.selectedHookAnimation,
    selectedHookTypography: transform.selectedHookTypography,
    selectedHookBadgePreset: transform.selectedHookBadgePreset,
    selectedHookBadgeColor: transform.selectedHookBadgeColor,
  }), [transform]);

  // =========================================================================
  // executeActions — apply a list of ProducerActions to the transform state
  // =========================================================================

  const executeActions = useCallback(
    (actions: ProducerAction[]): void => {
      for (const a of actions) {
        switch (a.type) {
          case 'SET_TEMPLATE_ID':
            transform.setTemplateId(a.templateId);
            break;

          case 'SET_GENRE':
            transform.setGenre(a.value);
            break;

          case 'SET_ASPECT_RATIO':
            transform.setAspectRatio(a.value);
            break;

          case 'SET_OUTPUT_MODE':
            transform.setOutputMode(a.mode);
            break;

          case 'SET_HOOK_TEXT':
            transform.setCustomHookText(a.text);
            break;

          case 'SET_HOOK_TAG':
            transform.setCustomHookTag(a.tag);
            break;

          case 'SET_VISUAL_PRESET':
            transform.setSelectedVisualPreset(a.preset as any);
            break;

          case 'SET_HOOK_LAYOUT':
            transform.setSelectedHookLayout(a.layout as any);
            break;

          case 'SET_HOOK_ANIMATION':
            transform.setSelectedHookAnimation(a.animation as any);
            break;

          case 'SET_HOOK_TYPOGRAPHY':
            transform.setSelectedHookTypography(a.typography as any);
            break;

          case 'SET_HOOK_BADGE_PRESET':
            transform.setSelectedHookBadgePreset(a.preset as any);
            break;

          case 'SET_HOOK_BADGE_COLOR':
            transform.setSelectedHookBadgeColor(a.color as any);
            break;

          case 'SET_ENABLE_HOOK_INTRO':
            transform.setEnableHookIntro(a.value);
            break;

          case 'SET_ENABLE_BROLL':
            transform.setEnableBroll(a.value);
            break;

          case 'ADD_BROLL_PLACEMENT': {
            transform.setEnableBroll(true);
            const start = a.placement.start ?? 0;
            const end = a.placement.end ?? (start + 3);
            const query = a.placement.query || 'B-Roll Footage';
            const mood = a.placement.mood || 'cinematic';
            const brollId = `broll-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const instantStockUrl = resolveStockBrollUrl(query);
            const newItem: any = {
              id: brollId,
              start,
              end,
              startSec: start,
              endSec: end,
              query,
              mood,
              cue: {
                id: `cue-${Date.now()}`,
                start,
                end,
                query,
                mood,
              },
              asset: {
                id: `asset-${Date.now()}`,
                source: 'local',
                previewUrl: instantStockUrl,
                downloadUrl: instantStockUrl,
                localFilePath: instantStockUrl,
                durationSeconds: Math.max(1, end - start),
              },
              enabled: true,
            };
            transform.addBrollPlacement(newItem);

            // Enrich asset video footage in the background from stock providers
            api
              .searchBrollFootage(query, { minDuration: Math.max(1, end - start), maxResults: 4 })
              .then((res) => {
                if (res.assets && res.assets.length > 0) {
                  const topAsset = res.assets[0];
                  transform.setBrollPlacements((prev) =>
                    prev.map((item) =>
                      item.id === brollId
                        ? {
                            ...item,
                            asset: topAsset,
                            candidates: res.assets,
                          }
                        : item,
                    ),
                  );
                }
              })
              .catch((err) => {
                console.warn('[useAiProducer] Failed to fetch footage for B-roll placement:', err);
              });
            break;
          }

          case 'CLEAR_BROLL':
            transform.setBrollPlacements([]);
            break;

          case 'SET_OUTRO':
            if (a.outro.enable !== undefined) {
              transform.setEnableIntroOutro(a.outro.enable);
            }
            if (a.outro.preset !== undefined) {
              transform.setOutroPreset(a.outro.preset);
            }
            if (a.outro.ctaText !== undefined) {
              transform.setOutroCtaText(a.outro.ctaText);
            }
            if (a.outro.buttonText !== undefined) {
              transform.setOutroButtonText(a.outro.buttonText);
            }
            if (a.outro.duration !== undefined) {
              transform.setOutroDuration(a.outro.duration);
            }
            if (a.outro.channelName !== undefined) {
              transform.setOutroChannelName(a.outro.channelName);
            }
            break;

          case 'SET_TTS_VOICE':
            transform.setTtsVoice(a.voice);
            break;

          case 'SET_SOURCE_VOLUME':
            transform.setSourceVolume(a.volume);
            break;

          case 'SELECT_CLIPS':
            transform.setSelectedClipIndices([...new Set(a.indices)]);
            break;

          case 'TRIGGER_GENERATE_HOOKS':
            transform.startGenerateHooks({ refresh: a.refresh });
            break;

          case 'TRIGGER_GENERATE_BROLL':
            transform.fetchBrollSuggestions({ force: a.force });
            break;

          case 'TRIGGER_RENDER':
            transform.startTransform();
            break;

          case 'SET_STEP':
            transform.setStep(a.step);
            break;

          case 'SET_DYNAMIC_STYLE':
            transform.updateDynamicStyle(a.target, a.styles);
            break;

          case 'CLEAR_DYNAMIC_STYLES':
            transform.clearDynamicStyles(a.target);
            break;

          case 'ADD_DYNAMIC_OVERLAY':
            transform.addDynamicOverlay(a.overlay as any);
            break;

          case 'CLEAR_DYNAMIC_OVERLAYS':
            transform.clearDynamicOverlays();
            break;

          case 'SET_BACKGROUND_MUSIC':
            if (a.trackId !== undefined) {
              if (a.trackId === null) {
                transform.setSelectedMusicTrack(null);
              } else {
                const track = AUDIO_CATALOG.find((t) => t.id === a.trackId);
                if (track) transform.setSelectedMusicTrack(track);
              }
            }
            if (a.volume !== undefined) {
              transform.setMusicVolume(Math.max(0, Math.min(100, a.volume)));
            }
            if (a.autoDucking !== undefined) {
              transform.setAutoDucking(a.autoDucking);
            }
            break;

          // Unhandled action types are silently ignored to be forward-compatible.
          default:
            break;
        }
      }
  },
    [transform],
  );

  // =========================================================================
  // sendMessage
  // =========================================================================

  const sendMessage = useCallback(
    async (userMessage: string): Promise<void> => {
      const trimmed = userMessage.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setIsFallback(false);

      // Build the new conversation history (append user turn)
      const userTurn: ProducerChatMessage = { role: 'user', content: trimmed };
      const nextMessages: ProducerChatMessage[] = [...messages, userTurn];
      setMessages(nextMessages);
      setIsLoading(true);

      // Snapshot current state for undo BEFORE applying actions
      const snapshot = captureSnapshot();
      const currentContext = buildContext();

      try {
        const response = await api.chatWithAiProducer({
          messages: nextMessages.length > 10 ? nextMessages.slice(-10) : nextMessages,
          currentContext,
        });
        setIsFallback(Boolean(response.fallback));
        setRemocnCandidates(response.remocnCandidates ?? []);

        const validated = validateProducerActions(response.actions, {
          clipCount: transform.clips.length,
          durationSec: downloadedVideo?.durationSeconds,
        });
        const renderExplicit = /\b(render|ekspor|export|buat video final|proses video sekarang)\b/i.test(trimmed) && !trimmed.includes('?');
        const destructiveClearExplicit = /\b(hapus|bersihkan|kosongkan|clear|remove|hapuskan)\b/i.test(trimmed);
        const safeActions = validated.actions.filter((action) => {
          if (action.type === 'TRIGGER_RENDER') return renderExplicit;
          if (action.type === 'CLEAR_BROLL') return destructiveClearExplicit && /b[- ]?roll|broll/i.test(trimmed);
          if (action.type === 'CLEAR_DYNAMIC_OVERLAYS') return destructiveClearExplicit && /overlay|stiker|callout/i.test(trimmed);
          if (action.type === 'CLEAR_DYNAMIC_STYLES') return destructiveClearExplicit && /style|gaya|efek|css/i.test(trimmed);
          return true;
        });
        const intentRejected = validated.actions.length - safeActions.length;

        // Append assistant reply to history
        const assistantTurn: ProducerChatMessage = {
          role: 'assistant',
          content: response.reply,
        };
        setMessages((prev) => [...prev, assistantTurn]);

        // Update suggested questions
        setSuggestedQuestions(response.suggestedQuestions ?? []);

        // Handle badges
        if (safeActions.length > 0) {
          // Push undo snapshot before mutating state
          setUndoStack((prev) => {
            const next = [...prev, snapshot];
            return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next;
          });

          setAppliedBadges(response.appliedBadges?.length ? response.appliedBadges : safeActions.map((a) => a.type.replaceAll('_', ' ')));

          // Auto-clear badges after delay
          if (badgeClearTimer.current) clearTimeout(badgeClearTimer.current);
          badgeClearTimer.current = setTimeout(() => {
            setAppliedBadges([]);
          }, BADGE_CLEAR_DELAY);

          // Execute the returned actions
          executeActions(safeActions);
        }
        if (validated.rejected + intentRejected > 0) {
          setError(`${validated.rejected + intentRejected} aksi AI tidak diterapkan karena instruksi atau nilainya tidak valid.`);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'AI Producer tidak bisa dihubungi.';
        setError(msg);
        // Roll back the optimistic user message so the UI can retry
        setMessages(messages);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, buildContext, executeActions, captureSnapshot, transform.clips.length, downloadedVideo?.durationSeconds],
  );

  // =========================================================================
  // undo — restore the last snapshot
  // =========================================================================

  const undo = useCallback((): void => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1]!;
      const next = prev.slice(0, prev.length - 1);

      // Replay the snapshot back into the transform setters
      transform.setStep(snapshot.step as any);
      transform.setGenre(snapshot.genre);
      transform.setAspectRatio(snapshot.aspectRatio);
      transform.setOutputMode(snapshot.outputMode);
      transform.setTemplateId(snapshot.templateId);
      transform.setSubtitleSize(snapshot.subtitleSize);
      transform.setBrollPlacements(structuredClone(snapshot.brollPlacements));
      transform.setCustomHookText(snapshot.customHookText);
      transform.setCustomHookTag(snapshot.customHookTag);
      transform.setEnableHookIntro(snapshot.enableHookIntro);
      transform.setSelectedHookIndex(snapshot.selectedHookIndex);
      transform.setSelectedVisualPreset(snapshot.selectedVisualPreset);
      transform.setSelectedHookLayout(snapshot.selectedHookLayout);
      transform.setSelectedHookAnimation(snapshot.selectedHookAnimation);
      transform.setSelectedHookTypography(snapshot.selectedHookTypography);
      transform.setSelectedHookBadgePreset(snapshot.selectedHookBadgePreset);
      transform.setSelectedHookBadgeColor(snapshot.selectedHookBadgeColor);
      transform.setEnableBroll(snapshot.enableBroll);
      transform.setEnableIntroOutro(snapshot.enableIntroOutro);
      transform.setOutroPreset(snapshot.outroPreset);
      transform.setOutroCtaText(snapshot.outroCtaText);
      transform.setOutroButtonText(snapshot.outroButtonText);
      transform.setOutroDuration(snapshot.outroDuration);
      transform.setOutroChannelName(snapshot.outroChannelName);
      transform.setOutroLogoUrl(snapshot.outroLogoUrl);
      transform.setSelectedMusicTrack(snapshot.selectedMusicTrack ? { ...snapshot.selectedMusicTrack } : null);
      transform.setMusicVolume(snapshot.musicVolume);
      transform.setAutoDucking(snapshot.autoDucking);
      transform.setTtsVoice(snapshot.ttsVoice);
      transform.setSourceVolume(snapshot.sourceVolume);
      transform.setDynamicStyles(structuredClone(snapshot.dynamicStyles));
      transform.setDynamicOverlays(structuredClone(snapshot.dynamicOverlays));
      transform.setSelectedClipIndices([...snapshot.selectedClipIndices]);
      transform.setClips(structuredClone(snapshot.clips));

      return next;
    });
  }, [transform]);

  // =========================================================================
  // clearMessages
  // =========================================================================

  const clearMessages = useCallback((): void => {
    setMessages([]);
    setError(null);
    setIsFallback(false);
    setSuggestedQuestions([]);
    setRemocnCandidates([]);
    setAppliedBadges([]);
    setUndoStack([]);
    if (badgeClearTimer.current) {
      clearTimeout(badgeClearTimer.current);
      badgeClearTimer.current = null;
    }
  }, []);

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    // State
    messages,
    isLoading,
    isFallback,
    error,
    suggestedQuestions,
    remocnCandidates,
    appliedBadges,
    undoStack,
    // Actions
    sendMessage,
    undo,
    clearMessages,
    buildContext,
  };
}
