import React, { useState, useRef } from 'react';
import type { useClipTransform } from '../../hooks/useClipTransform';
import type { ViralClip, ViralHook } from '../../types';
import { StudioStepper } from './StudioStepper';
import { StudioProgressBar } from './StudioProgressBar';
import { Step1SourceConfig } from './step1/Step1SourceConfig';
import { Step2ClipsSelection } from './step2/Step2ClipsSelection';
import { Step3Styling } from './step3/Step3Styling';
import { Step4Output } from './step4/Step4Output';
import { ClipDetailModal } from './modals/ClipDetailModal';
import { HookDetailModal } from './modals/HookDetailModal';

type ClipTransformHook = ReturnType<typeof useClipTransform>;

interface StudioViewProps {
  transform: ClipTransformHook;
  onOpenCaptionModal: (videoId: string, title: string) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  transform,
  onOpenCaptionModal,
}) => {
  const {
    step,
    setStep,
    url,
    setUrl,
    downloadedVideo,
    downloadingVideo,
    downloadError,
    startDownloadVideo,
    resetDownload,
    detectedLanguage,
    detectingLanguage,
    outputLanguage,
    setOutputLanguage,
    genre,
    setGenre,
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
    selectClip,
    generatingClips,
    rerenderingClipPreviews,
    clipsError,
    hooks,
    selectedHookIndex,
    selectHook,
    customHookText,
    setCustomHookText,
    customHookTag,
    setCustomHookTag,
    enableHookIntro,
    setEnableHookIntro,
    generatingHooks,
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
    // multi-select
    selectedClipIndices,
    selectAllClips,
    clearSelectedClips,
  } = transform;

  // Local media & playback state
  const [playingClipIndex, setPlayingClipIndex] = useState<number | null>(null);
  const [playingHookIndex, setPlayingHookIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewModalClip, setPreviewModalClip] = useState<{ clip: ViralClip; idx: number } | null>(null);
  const [previewModalHook, setPreviewModalHook] = useState<{ hook: ViralHook; idx: number } | null>(null);
  const [inlineProgress, setInlineProgress] = useState<{ [idx: number]: number }>({});
  const [inlineHookProgress, setInlineHookProgress] = useState<{ [idx: number]: number }>({});
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeHookVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleTogglePlay = (idx: number) => {
    if (playingClipIndex === idx) {
      if (activeVideoRef.current) {
        activeVideoRef.current.pause();
      }
      setPlayingClipIndex(null);
    } else {
      if (activeHookVideoRef.current) {
        activeHookVideoRef.current.pause();
      }
      setPlayingHookIndex(null);
      setPlayingClipIndex(idx);
    }
  };

  const handleTogglePlayHook = (idx: number) => {
    if (playingHookIndex === idx) {
      if (activeHookVideoRef.current) {
        activeHookVideoRef.current.pause();
      }
      setPlayingHookIndex(null);
    } else {
      if (activeVideoRef.current) {
        activeVideoRef.current.pause();
      }
      setPlayingClipIndex(null);
      setPlayingHookIndex(idx);
    }
  };

  const scrollToHookSection = () => {
    document.getElementById('hook-generator-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTriggerHookCta = (refresh = false) => {
    if (selectedClipIndex === null) return;
    if (hooks.length > 0 && !refresh) {
      scrollToHookSection();
      return;
    }
    startGenerateHooks({ refresh });
    setTimeout(() => {
      scrollToHookSection();
    }, 120);
  };

  const handleReanalyzeClips = () => {
    setPlayingClipIndex(null);
    setInlineProgress({});
    startGenerateClips(undefined, { refresh: true });
  };

  const handleRerenderPreviews = () => {
    setPlayingClipIndex(null);
    setInlineProgress({});
    rerenderClipPreviews();
  };

  const handleRefreshClips = () => {
    setPlayingClipIndex(null);
    setInlineProgress({});
    refreshClips();
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 24px 60px' }}>
      {/* 4-Step Sequencer Stepper */}
      <StudioStepper
        step={step}
        setStep={setStep}
        clipsCount={clips.length}
        selectedClipsCount={selectedClipIndices.length}
      />

      {/* Progress Telemetry */}
      <StudioProgressBar
        show={generatingClips || runningTransform}
        progressPct={progressPct}
        progressLabel={progressLabel}
      />

      {/* STEP 1: Ingest & Konfigurasi */}
      <Step1SourceConfig
        step={step}
        url={url}
        setUrl={setUrl}
        downloadedVideo={downloadedVideo}
        downloadingVideo={downloadingVideo}
        downloadError={downloadError}
        startDownloadVideo={() => startDownloadVideo()}
        resetDownload={resetDownload}
        detectedLanguage={detectedLanguage}
        detectingLanguage={detectingLanguage}
        genre={genre}
        setGenre={setGenre}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        clipsCount={clips.length}
        clipsError={clipsError}
        generatingClips={generatingClips}
        onAnalyzeClips={() => startGenerateClips()}
        onReanalyzeClips={handleReanalyzeClips}
      />

      {/* STEP 2: Retention Matrix & Scoring */}
      <Step2ClipsSelection
        step={step}
        setStep={setStep}
        clips={clips}
        selectedClipIndices={selectedClipIndices}
        selectedClipIndex={selectedClipIndex}
        selectClip={selectClip}
        selectAllClips={selectAllClips}
        clearSelectedClips={clearSelectedClips}
        generatingClips={generatingClips}
        rerenderingClipPreviews={rerenderingClipPreviews}
        progressLabel={progressLabel}
        rerenderClipPreviews={handleRerenderPreviews}
        refreshClips={handleRefreshClips}
        downloadedVideo={downloadedVideo}
        playingClipIndex={playingClipIndex}
        inlineProgress={inlineProgress}
        isMuted={isMuted}
        activeVideoRef={activeVideoRef}
        onTogglePlayClip={handleTogglePlay}
        onToggleMute={() => setIsMuted(!isMuted)}
        onUpdateClipProgress={(idx, pct) => {
          setInlineProgress((prev) => ({ ...prev, [idx]: pct }));
        }}
        onClipPlayError={() => setPlayingClipIndex(null)}
        onOpenClipDetail={(clip, idx) => setPreviewModalClip({ clip, idx })}
        hooks={hooks}
        selectedHookIndex={selectedHookIndex}
        playingHookIndex={playingHookIndex}
        inlineHookProgress={inlineHookProgress}
        generatingHooks={generatingHooks}
        activeHookVideoRef={activeHookVideoRef}
        selectHook={selectHook}
        onTogglePlayHook={handleTogglePlayHook}
        onUpdateHookProgress={(hIdx, pct) => {
          setInlineHookProgress((prev) => ({ ...prev, [hIdx]: pct }));
        }}
        onHookPlayError={() => setPlayingHookIndex(null)}
        onOpenHookDetail={(hook, idx) => setPreviewModalHook({ hook, idx })}
        onTriggerHookCta={handleTriggerHookCta}
        onScrollToHookSection={scrollToHookSection}
      />

      {/* STEP 3: Composer Studio (Subtitles & B-Roll) */}
      <Step3Styling
        step={step}
        setStep={setStep}
        outputMode={outputMode}
        setOutputMode={setOutputMode}
        scriptDraft={scriptDraft}
        isScriptCached={isScriptCached}
        draftingScript={draftingScript}
        scriptError={scriptError}
        outputLanguage={outputLanguage}
        setOutputLanguage={setOutputLanguage}
        ttsVoice={ttsVoice}
        setTtsVoice={setTtsVoice}
        sourceVolume={sourceVolume}
        setSourceVolume={setSourceVolume}
        synthesizingTts={synthesizingTts}
        ttsAudioUrl={ttsAudioUrl}
        startDraftScript={startDraftScript}
        startSynthesizeTts={() => startSynthesizeTts()}
        updateScriptSection={updateScriptSection}
        addScriptSection={addScriptSection}
        removeScriptSection={removeScriptSection}
        enableHookIntro={enableHookIntro}
        setEnableHookIntro={setEnableHookIntro}
        selectedVisualPreset={selectedVisualPreset}
        setSelectedVisualPreset={setSelectedVisualPreset}
        selectedHookLayout={selectedHookLayout}
        setSelectedHookLayout={setSelectedHookLayout}
        selectedHookAnimation={selectedHookAnimation}
        setSelectedHookAnimation={setSelectedHookAnimation}
        selectedHookTypography={selectedHookTypography}
        setSelectedHookTypography={setSelectedHookTypography}
        selectedHookBadgePreset={selectedHookBadgePreset}
        setSelectedHookBadgePreset={setSelectedHookBadgePreset}
        selectedHookBadgeColor={selectedHookBadgeColor}
        setSelectedHookBadgeColor={setSelectedHookBadgeColor}
        runningTransform={runningTransform}
        selectedHookIndex={selectedHookIndex}
        hooks={hooks}
        selectedClipIndices={selectedClipIndices}
        clips={clips}
        downloadedVideo={downloadedVideo}
        customHookText={customHookText}
        setCustomHookText={setCustomHookText}
        customHookTag={customHookTag}
        setCustomHookTag={setCustomHookTag}
        templateId={templateId}
        setTemplateId={setTemplateId}
        enableBroll={enableBroll}
        setEnableBroll={setEnableBroll}
        enableIntroOutro={enableIntroOutro}
        setEnableIntroOutro={setEnableIntroOutro}
        startTransform={() => startTransform()}
      />

      {/* STEP 4: Master Output */}
      <Step4Output
        step={step}
        setStep={setStep}
        transformResult={transformResult}
        transformError={transformError}
        onOpenCaptionModal={onOpenCaptionModal}
      />

      {/* Expanded Video Preview Modal */}
      <ClipDetailModal
        modalData={previewModalClip}
        onClose={() => setPreviewModalClip(null)}
        downloadedVideo={downloadedVideo}
        modalVideoRef={modalVideoRef}
        rerenderingClipPreviews={rerenderingClipPreviews}
        onRerenderClipPreviews={rerenderClipPreviews}
      />

      {/* Expanded Hook Preview Modal */}
      <HookDetailModal
        modalData={previewModalHook}
        onClose={() => setPreviewModalHook(null)}
        downloadedVideo={downloadedVideo}
      />
    </div>
  );
};
