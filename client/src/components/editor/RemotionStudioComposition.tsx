import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from 'remotion';
import { resolveAudioStreamUrl } from '../../lib/audio-catalog';
import { Outro } from '../../../../compositions/studio/src/Outro';
import { HookHeadline } from '../../../../compositions/studio/src/HookHeadline';
import { selectTheme } from '../../../../compositions/studio/src/design';
import type { Theme } from '../../../../compositions/studio/src/design';
import { resolveVisualPreset } from '../../../../compositions/studio/src/visual-preset';
import { computeOrganicTransform } from '../../lib/canvas-motion';

export interface RemotionStudioCompositionProps {
  videoSrc?: string;
  thumbnailUrl?: string;
  durationInSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  // Hook props
  enableHookIntro?: boolean;
  hookText?: string;
  hookTag?: string;
  hookThumbnailUrl?: string;
  hookPreviewVideoSrc?: string;
  visualPreset?: string;
  hookLayout?: string;
  hookAnimation?: string;
  hookTypography?: string;
  hookHighlightWords?: string[];
  hookDurationSec?: number;
  hookStartSec?: number;
  sequenceHookIntro?: boolean;
  badgePreset?: string;
  badgeColor?: string;
  hookBackdrop?: string;
  // Subtitle props
  templateId?: string;
  subtitleText?: string;
  subtitleSize?: 'sm' | 'md' | 'lg' | 'xl';
  subtitleFontSize?: number;
  captions?: Array<{
    start: number;
    end: number;
    text: string;
    highlightWords?: string[];
    wordTimings?: Array<{ word: string; start: number; end: number }>;
  }>;
  isRenderedVideo?: boolean;
  // B-Roll props
  enableBroll?: boolean;
  brollPlacements?: Array<{
    start: number;
    end: number;
    query: string;
    assetUrl?: string;
    posterUrl?: string;
  }>;
  // Outro props
  enableIntroOutro?: boolean;
  outroCtaText?: string;
  outroButtonText?: string;
  outroDuration?: number;
  outroStartSec?: number;
  outroPreset?: string;
  outroLogoUrl?: string;
  channelName?: string;
  // Audio / Music props
  musicSrc?: string;          // CDN URL atau stream URL musik latar
  musicVolume?: number;       // 0–1, default 0.2
  musicStartFromSec?: number; // trim start of music track, default 0
  autoDucking?: boolean;      // musik mengecil saat video ada narasi
  sourceVolume?: number;      // 0–1 volume suara asli, default 1
  narrationAudioUrl?: string; // URL audio narasi AI TTS
  narrationVolume?: number;   // 0–1 volume narasi, default 1
  outputMode?: 'reel' | 'narration';
  videoStartFromSec?: number; // trim start of video element, default 0
  videoStartSec?: number;     // timeline start position in seconds
  videoDurationSec?: number;  // timeline duration in seconds
  videoTrimFrontSec?: number; // seconds trimmed from front of video
  /** Precomputed face-focus path for the selected source range, relative seconds. */
  faceFocusPoints?: Array<{ time: number; x: number; y: number }>;
  faceSourceAspectRatio?: number;
  subtitleStartSec?: number;
  subtitleEndSec?: number;
  // Dynamic CSS Styles & Universal Overlays (Zero-Code Dynamic Extensibility)
  dynamicStyles?: Record<string, React.CSSProperties>;
  dynamicOverlays?: Array<{
    id: string;
    componentId?: string;
    start: number;
    end: number;
    type: 'sticker' | 'callout' | 'shape' | 'text' | 'badge' | 'html';
    content: string;
    position?: { x?: string | number; y?: string | number };
    styles?: React.CSSProperties;
    animation?: 'bounce' | 'pulse' | 'fade' | 'slide' | 'spin' | 'none';
  }>;
}

/**
 * Detects and auto-repairs rich HTML/CSS dynamic overlays.
 *
 * If content is valid HTML (e.g. <div>...</div>) or contains style fragments
 * like 'Segoe UI', Roboto...; width: 280px;"><div... (common LLM truncated CSS output),
 * this repairs it into a valid, self-contained HTML widget for clean broadcast rendering.
 */
function parseOrRepairHtmlOverlay(content?: string): string | null {
  if (!content || typeof content !== 'string') return null;
  let trimmed = content.trim();

  // Strip dangerous script tags
  trimmed = trimmed.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Case 1: Clean outer HTML element
  if (/^<[a-z0-9_-]+[\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  // Case 2: Contains HTML tags and has style prefix followed by ">" (e.g. truncated outer tag)
  if (trimmed.includes('">') && /<(div|span|p|table|tr|td|h[1-6]|ul|li|section|svg)/i.test(trimmed)) {
    const splitIdx = trimmed.indexOf('">');
    let leadingStyle = trimmed.slice(0, splitIdx).trim();
    const restHtml = trimmed.slice(splitIdx + 2).trim();

    // Check if leadingStyle starts with font name without 'font-family:'
    const firstRule = leadingStyle.split(';')[0] || '';
    if (!firstRule.includes(':') || /^['"]/.test(firstRule.trim())) {
      leadingStyle = 'font-family: ' + leadingStyle;
    }

    // Add visual fallback card styles if background not in style
    if (!leadingStyle.includes('background')) {
      leadingStyle += '; background: rgba(10, 15, 29, 0.92); border: 1.5px solid rgba(0, 240, 255, 0.4); border-radius: 14px; padding: 14px; backdrop-filter: blur(14px); box-shadow: 0 12px 36px rgba(0,0,0,0.85);';
    }

    return '<div style="' + leadingStyle + '">' + restHtml + (restHtml.endsWith('</div>') ? '' : '</div>');
  }

  // Case 3: Contains general HTML tags anywhere inside
  if (/<(div|span|p|table|tr|td|h[1-6]|ul|li|section|svg)[^>]*>[\s\S]*<\/\1>/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function getFocusObjectPosition(
  focusX: number,
  focusY: number,
  scaledSourceAspect: number,
  targetAspect: number,
  enabled: boolean,
): string {
  if (!enabled) return '50% 50%';
  if (scaledSourceAspect > targetAspect) {
    const overflow = scaledSourceAspect / targetAspect - 1;
    const x = Math.max(0, Math.min(1, (focusX * (overflow + 1) - 0.5) / overflow));
    return `${x * 100}% 50%`;
  }
  const overflow = targetAspect / scaledSourceAspect - 1;
  const y = overflow > 0.001
    ? Math.max(0, Math.min(1, (focusY * (overflow + 1) - 0.5) / overflow))
    : 0.5;
  return `50% ${y * 100}%`;
}

export const RemotionStudioComposition: React.FC<RemotionStudioCompositionProps> = ({
  videoSrc,
  thumbnailUrl,
  aspectRatio = '9:16',
  enableHookIntro = true,
  hookText = 'Trik Rahasia Meningkatkan View 10x Lipat!',
  hookTag = '🔥 JANGAN DI-SKIP',
  hookThumbnailUrl,
  hookPreviewVideoSrc,
  visualPreset = 'kinetic-punch',
  hookLayout = 'auto',
  hookAnimation = 'auto',
  hookTypography = 'kinetic',
  hookHighlightWords = [],
  hookDurationSec: hookDurationProp = 3.5,
  hookStartSec = 0,
  sequenceHookIntro = false,
  badgePreset = 'neon-outline',
  badgeColor = 'cyan',
  hookBackdrop = 'cinematic-banner',
  templateId = 'beast',
  subtitleText,
  subtitleSize = 'md',
  subtitleFontSize,
  captions = [],
  isRenderedVideo = false,
  enableBroll = true,
  brollPlacements = [],
  enableIntroOutro = true,
  outroCtaText = 'Suka video ini? Follow untuk update tips harian!',
  outroButtonText = 'Follow',
  outroDuration = 3,
  outroStartSec: outroStartProp,
  outroPreset = 'creator-glass',
  outroLogoUrl,
  channelName = '@kreator',
  // Audio / Music props
  musicSrc,
  musicVolume = 0.25,
  musicStartFromSec = 0,
  autoDucking = true,
  sourceVolume = 1,
  narrationAudioUrl,
  narrationVolume = 1,
  outputMode = 'reel',
  videoStartFromSec = 0,
  videoStartSec,
  videoDurationSec,
  videoTrimFrontSec = 0,
  faceFocusPoints = [],
  faceSourceAspectRatio = 16 / 9,
  subtitleStartSec,
  subtitleEndSec,
  // Dynamic CSS & Universal Overlays
  dynamicStyles = {},
  dynamicOverlays = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: compositionDurationFrames } = useVideoConfig();
  const currentTimeSec = frame / fps;
  const hookStartTimeSec = hookStartSec;
  const hookEndTimeSec = hookStartTimeSec + hookDurationProp;
  const contentTimeSec = sequenceHookIntro
    ? Math.max(0, currentTimeSec - hookDurationProp)
    : enableHookIntro && !isRenderedVideo
      ? currentTimeSec >= hookEndTimeSec
        ? currentTimeSec - hookDurationProp
        : Math.min(currentTimeSec, hookStartTimeSec)
      : currentTimeSec;

  const defaultVideoStartSec = sequenceHookIntro ? hookDurationProp : 0;
  const effectiveVideoStartSec = videoStartSec !== undefined ? videoStartSec : defaultVideoStartSec;

  const totalDurationSec = (compositionDurationFrames || 900) / fps;
  const hookDurationSec = hookDurationProp;
  const hookStartFrame = Math.round(hookStartSec * fps);
  const hookDurationFrames = Math.round(hookDurationSec * fps);
  const hookEndFrame = hookStartFrame + hookDurationFrames;
  const isHookActive = enableHookIntro && !isRenderedVideo && frame >= hookStartFrame && frame < hookEndFrame;

  const effectiveTrimFrontSec = videoTrimFrontSec ?? 0;
  const videoDuration = videoDurationSec !== undefined ? videoDurationSec : Math.max(0.5, totalDurationSec - effectiveVideoStartSec);

  const hookEndSec = hookStartSec + hookDurationSec;
  const hookSplitsVideo = enableHookIntro && !isRenderedVideo && hookEndSec > effectiveVideoStartSec;
  const videoBeforeHookDurationSec = hookSplitsVideo
    ? Math.max(0, Math.min(videoDuration, hookStartSec - effectiveVideoStartSec))
    : videoDuration;
  const videoTimelineSegments = [
    ...(videoBeforeHookDurationSec > 0
      ? [{ timelineStartSec: effectiveVideoStartSec, sourceOffsetSec: 0, durationSec: videoBeforeHookDurationSec }]
      : []),
    ...(videoDuration - videoBeforeHookDurationSec > 0
      ? [{
          timelineStartSec: hookSplitsVideo ? hookEndSec : effectiveVideoStartSec,
          sourceOffsetSec: videoBeforeHookDurationSec,
          durationSec: videoDuration - videoBeforeHookDurationSec,
        }]
      : []),
  ];

  // Is the main video clip actively visible/playing at currentTimeSec?
  const activeVideoTimelineSegment = videoTimelineSegments.find((segment) =>
    currentTimeSec >= segment.timelineStartSec && currentTimeSec <= segment.timelineStartSec + segment.durationSec + 0.05,
  );
  const isVideoPlaying = !isHookActive && Boolean(activeVideoTimelineSegment);

  // Speech timing in the video media taking into account front trimming and timeline placement
  const videoElapsedSec = activeVideoTimelineSegment
    ? activeVideoTimelineSegment.sourceOffsetSec + Math.max(0, currentTimeSec - activeVideoTimelineSegment.timelineStartSec)
    : 0;
  const currentClipSpeechSec = effectiveTrimFrontSec + videoElapsedSec;

  // Subtitle timing bounds check (relative to timeline currentTimeSec)
  const isWithinSubtitleRange =
    (subtitleStartSec === undefined || currentTimeSec >= subtitleStartSec - 0.02) &&
    (subtitleEndSec === undefined || currentTimeSec <= subtitleEndSec + 0.05);

  // Subtitle synchronization:
  // In reel mode, video audio speech is precisely tracked by currentClipSpeechSec.
  // In narration mode, TTS audio starts relative to subtitle start position.
  const activeSubtitleSpeechTimeSec = outputMode === 'narration'
    ? Math.max(0, currentTimeSec - (subtitleStartSec ?? 0))
    : currentClipSpeechSec;

  const baseHookPreset = resolveVisualPreset({ manualPreset: visualPreset as any });
  const hookPreset = {
    ...baseHookPreset,
    ...(hookLayout && hookLayout !== 'auto' ? { layout: hookLayout as any } : {}),
    ...(hookAnimation && hookAnimation !== 'auto' ? { animation: hookAnimation as any } : {}),
    ...(hookTypography && hookTypography !== 'auto' ? { typography: hookTypography as any } : {}),
  };
  const hookTheme = selectTheme('editor-hook', visualPreset);

  const targetAspect = aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '1:1' ? 1 : 9 / 16;
  let focusX = 0.5;
  let focusY = 0.5;
  if (faceFocusPoints.length > 0) {
    const faceTimeSec = currentClipSpeechSec;
    const nextIndex = faceFocusPoints.findIndex((point) => point.time >= faceTimeSec);
    const left = nextIndex <= 0 ? faceFocusPoints[0]! : faceFocusPoints[nextIndex - 1]!;
    const right = nextIndex < 0 ? faceFocusPoints[faceFocusPoints.length - 1]! : faceFocusPoints[nextIndex]!;
    const progress = Math.max(0, Math.min(1, (faceTimeSec - left.time) / Math.max(0.001, right.time - left.time)));
    focusX = left.x + (right.x - left.x) * progress;
    focusY = left.y + (right.y - left.y) * progress;
  }

  // ---------------------------------------------------------------------------
  // 2. Outro Card (Last N seconds)
  // ---------------------------------------------------------------------------
  const outroStartSec = Math.max(0, outroStartProp ?? (totalDurationSec - outroDuration));
  const outroStartFrame = Math.round(outroStartSec * fps);
  const isOutroActive = enableIntroOutro && frame >= outroStartFrame;
  const outroDurationFrames = Math.max(
    1,
    Math.min(
      Math.round(outroDuration * fps),
      (compositionDurationFrames || 900) - outroStartFrame,
    ),
  );
  const outroTheme: Theme = {
    id: 'live-preview-outro',
    accent: '#38BDF8',
    accent2: '#A78BFA',
    cardBg: 'rgba(15, 23, 42, 0.9)',
    cardText: '#FFFFFF',
    cardStroke: 'rgba(255,255,255,0.2)',
    stroke: '#000000',
    fill: '#FFFFFF',
    gradient: ['#0F172A', '#1E293B'],
    surface: '#0A0E1A',
  };

  // ---------------------------------------------------------------------------
  // 3. Subtitles (Real Voice-Synced Transcript or Fallback Simulation)
  // ---------------------------------------------------------------------------
  const isSpeechSourceActive = outputMode === 'narration'
    ? Boolean(narrationAudioUrl)
    : isVideoPlaying;

  const hasRealCaptions = Boolean(captions && captions.length > 0);
  const activeCaption = hasRealCaptions && isWithinSubtitleRange && isSpeechSourceActive
    ? captions.find((c, idx) => {
        const nextCaption = captions[idx + 1];
        const maxCaptionEnd = nextCaption ? Math.min(nextCaption.start, c.end + 0.25) : c.end + 0.25;
        return activeSubtitleSpeechTimeSec >= c.start && activeSubtitleSpeechTimeSec <= maxCaptionEnd;
      })
    : undefined;


  // ---------------------------------------------------------------------------
  // Background Music Volume & Auto-Ducking
  // ---------------------------------------------------------------------------
  const baseMusicVol = Math.max(0, Math.min(1, musicVolume ?? 0.25));
  // Detect speech presence
  const isSpeechActive = outputMode === 'reel' && isHookActive
    ? false
    : outputMode === 'narration'
      ? Boolean(narrationAudioUrl || activeCaption)
      : (hasRealCaptions ? Boolean(activeCaption) : (!isOutroActive && isVideoPlaying && isWithinSubtitleRange));

  // When auto-ducking is enabled and someone speaks, duck music to 35% of set volume.
  // During speech pauses or hook/outro, music volume returns to 100%.
  const effectiveMusicVolume = autoDucking
    ? (isSpeechActive ? baseMusicVol * 0.35 : baseMusicVol)
    : baseMusicVol;

  const resolvedMusicSrc = resolveAudioStreamUrl(musicSrc);

  // Active when hook has faded or if hook is disabled.
  // Dual-presence strategy: Subtitle displays when speech source is actively playing and within user subtitle bounds.
  // When real captions are present, subtitles remain synchronized with speech even during outro CTA so viewers
  // (especially silent viewers) never lose concluding remarks or spoken CTAs.
  const showSubtitles =
    !isRenderedVideo &&
    !isHookActive &&
    isWithinSubtitleRange &&
    isSpeechSourceActive &&
    (hasRealCaptions ? Boolean(activeCaption) : !isOutroActive);

  // Default demo subtitle sentences if no custom text provided
  const sampleWords = (
    subtitleText ||
    'Kalian harus tahu strategi rahasia ini sekarang juga karena ini bisa melipatgandakan retensi penonton!'
  )
    .split(/\s+/)
    .filter(Boolean);

  // Cycling words every 0.35s (fallback only)
  const wordCycleIndex = Math.floor((activeSubtitleSpeechTimeSec * 2.8) % Math.max(1, sampleWords.length));
  const fallbackActiveWord = sampleWords[wordCycleIndex] || sampleWords[0] || 'Viral!';

  // Real word resolution
  const realWords = activeCaption
    ? activeCaption.wordTimings?.map((w) => w.word) || activeCaption.text.split(/\s+/).filter(Boolean)
    : [];

  const realActiveWordIdx = activeCaption?.wordTimings
    ? activeCaption.wordTimings.findIndex((w) => activeSubtitleSpeechTimeSec >= w.start && activeSubtitleSpeechTimeSec <= w.end)
    : -1;

  const currentSpokenIdx = realActiveWordIdx !== -1
    ? realActiveWordIdx
    : (activeCaption?.wordTimings
        ? activeCaption.wordTimings.filter((w) => activeSubtitleSpeechTimeSec >= w.start).length - 1
        : 0);

  // Subtitle styling based on templateId
  const isBeast = templateId === 'beast' || templateId === 'mrbeast';
  const isHormozi = templateId === 'hormozi';

  // Balanced font sizing for subtitles across presets:
  // sm: 38px, md: 48px (default), lg: 58px, xl: 68px
  const baseFontSize =
    subtitleFontSize && subtitleFontSize > 0
      ? subtitleFontSize
      : subtitleSize === 'sm'
      ? 38
      : subtitleSize === 'lg'
      ? 58
      : subtitleSize === 'xl'
      ? 68
      : 48;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0E14',
        fontFamily: 'sans-serif',
        color: '#FFFFFF',
        overflow: 'hidden',
        ...dynamicStyles.canvas,
      }}
    >
      {/* -------------------------------------------------------------------- */}
      {/* LAYER 1: Ambient Blurred Background (fills 9:16 vertical canvas)     */}
      {/* -------------------------------------------------------------------- */}
      {sequenceHookIntro && isHookActive && hookPreviewVideoSrc ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Video
            src={hookPreviewVideoSrc}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(48px) brightness(0.65)', transform: 'scale(1.2)' }}
            muted
            loop
          />
        </AbsoluteFill>
      ) : sequenceHookIntro && isHookActive && (hookThumbnailUrl || thumbnailUrl) ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${hookThumbnailUrl || thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(48px) brightness(0.65)',
            transform: 'scale(1.2)',
          }}
        />
      ) : !sequenceHookIntro && isHookActive && hookThumbnailUrl ? (
        <AbsoluteFill style={{ backgroundImage: `url(${hookThumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(48px) brightness(0.65)', transform: 'scale(1.2)' }} />
      ) : videoSrc ? (
        videoTimelineSegments.map((segment, index) => (
          <Sequence key={`ambient-video-${index}`} from={Math.round(segment.timelineStartSec * fps)} durationInFrames={Math.max(1, Math.round(segment.durationSec * fps))}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
              <Video
                src={videoSrc}
                startFrom={Math.round(((videoStartFromSec ?? 0) + segment.sourceOffsetSec) * fps)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(48px) brightness(0.65)', transform: 'scale(1.2)' }}
                muted
              />
            </AbsoluteFill>
          </Sequence>
        ))
      ) : thumbnailUrl ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(48px) brightness(0.65)',
            transform: 'scale(1.2)',
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at center, #1B262C 0%, #0A0E14 100%)',
          }}
        />
      )}
      {isHookActive && <AbsoluteFill style={{ zIndex: 2, background: 'linear-gradient(180deg, rgba(0,0,0,.7) 0%, transparent 35%, transparent 65%, rgba(0,0,0,.85) 100%)' }} />}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 2: Crisp Center Main Video                                    */}
      {/* -------------------------------------------------------------------- */}
      {sequenceHookIntro && isHookActive && hookPreviewVideoSrc ? (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Video
            src={hookPreviewVideoSrc}
            style={{ width: '100%', height: '100%', objectFit: faceFocusPoints.length > 0 ? 'cover' : 'contain', objectPosition: getFocusObjectPosition(focusX, focusY, faceSourceAspectRatio * 1.08, targetAspect, faceFocusPoints.length > 0), scale: faceFocusPoints.length > 0 ? 1.08 : 1, ...dynamicStyles.video }}
            muted
            loop
          />
        </AbsoluteFill>
      ) : videoSrc ? (
        videoTimelineSegments.map((segment, index) => (
          <Sequence key={`main-video-${index}`} from={Math.round(segment.timelineStartSec * fps)} durationInFrames={Math.max(1, Math.round(segment.durationSec * fps))}>
            <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Video
                src={videoSrc}
                startFrom={Math.round(((videoStartFromSec ?? 0) + segment.sourceOffsetSec) * fps)}
                volume={sourceVolume ?? 1}
                style={{ width: '100%', height: '100%', objectFit: faceFocusPoints.length > 0 ? 'cover' : 'contain', objectPosition: getFocusObjectPosition(focusX, focusY, faceSourceAspectRatio * 1.08, targetAspect, faceFocusPoints.length > 0), scale: faceFocusPoints.length > 0 ? 1.08 : 1, ...dynamicStyles.video }}
              />
            </AbsoluteFill>
          </Sequence>
        ))
      ) : thumbnailUrl && !isHookActive ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={thumbnailUrl}
            alt="Video Preview"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain',
              ...dynamicStyles.video,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 3: Active B-Roll Overlay (Picture in Picture / Cutaway)        */}
      {/* -------------------------------------------------------------------- */}
      {enableBroll &&
        brollPlacements?.map((broll, bIdx) => {
          const timelineOffset = enableHookIntro && !isRenderedVideo && broll.start >= hookStartSec
            ? hookDurationSec
            : 0;
          const startFrame = Math.round((broll.start + timelineOffset) * fps);
          const endFrame = Math.round((broll.end + timelineOffset) * fps);
          const durFrames = Math.max(1, endFrame - startFrame);

          return (
            <Sequence
              key={`broll-layer-${bIdx}-${broll.start}`}
              from={startFrame}
              durationInFrames={durFrames}
            >
              <AbsoluteFill style={{ zIndex: 25, overflow: 'hidden' }}>
                {/* Underlay Poster (keeps screen lively while video element buffers) */}
                {broll.posterUrl && (
                  <AbsoluteFill style={{ overflow: 'hidden', zIndex: 1 }}>
                    <Img
                      src={broll.posterUrl}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </AbsoluteFill>
                )}

                {broll.assetUrl ? (
                  <AbsoluteFill style={{ zIndex: 2 }}>
                    {/* Blurred background for 9:16 filling */}
                    <AbsoluteFill style={{ overflow: 'hidden' }}>
                      <Video
                        src={broll.assetUrl}
                        muted
                        playsInline
                        crossOrigin="anonymous"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: 'blur(24px) brightness(0.65)',
                          transform: 'scale(1.15)',
                        }}
                      />
                    </AbsoluteFill>
                    {/* Foreground video */}
                    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Video
                        src={broll.assetUrl}
                        muted
                        playsInline
                        crossOrigin="anonymous"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </AbsoluteFill>
                  </AbsoluteFill>
                ) : (
                  <AbsoluteFill
                    style={{
                      zIndex: 2,
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎬</div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: '#38BDF8',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                      }}
                    >
                      B-Roll Visual Cutaway
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#FFFFFF', maxWidth: '80%' }}>
                      "{broll.query}"
                    </div>
                  </AbsoluteFill>
                )}
              </AbsoluteFill>
            </Sequence>
          );
        })}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 4: Hook Intro Headline & Badge (0s - 3.5s)                     */}
      {/* -------------------------------------------------------------------- */}
      {isHookActive && (
        <Sequence from={hookStartFrame} durationInFrames={hookDurationFrames}>
          <AbsoluteFill
            style={{
              zIndex: 40,
              pointerEvents: 'none',
              ...dynamicStyles.hook,
            }}
          >
            <HookHeadline
              text={hookText}
              tag={hookTag}
              theme={hookTheme}
              badgePresetId={badgePreset as any}
              badgeColor={badgeColor as any}
              backdrop={(hookBackdrop as any) ?? 'cinematic-banner'}
              highlightWords={hookHighlightWords}
              visualPreset={hookPreset}
              durationFrames={hookDurationFrames}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 5: Animated Karaoke Subtitles                                  */}
      {/* -------------------------------------------------------------------- */}
      {showSubtitles && (
        <div
          style={{
            position: 'absolute',
            bottom: '240px',
            left: '40px',
            right: '40px',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            ...dynamicStyles.subtitle,
            zIndex: 60,
          }}
        >
          {hasRealCaptions && activeCaption ? (
            isBeast ? (
              // MrBeast: Bold Uppercase with bright Yellow pop word & stroke
              <div
                style={{
                  textAlign: 'center',
                  display: 'inline-flex',
                  alignItems: 'flex-end',
                  columnGap: '12px',
                  rowGap: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.55)',
                  padding: '16px 28px',
                  borderRadius: '24px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}
              >
                {realWords.map((word, k) => {
                  const isCurrent = k === currentSpokenIdx;
                  const isPast = k < currentSpokenIdx;
                  const isHighlight =
                    activeCaption.highlightWords?.some(
                      (hw) => hw.toLowerCase() === word.toLowerCase(),
                    ) || /\d/.test(word);

                  const color = isCurrent
                    ? isHighlight
                      ? '#00E5FF'
                      : '#FFE600'
                    : isPast
                    ? '#FFFFFF'
                    : 'rgba(255, 255, 255, 0.65)';
                  const shadowGlow = isCurrent
                    ? isHighlight
                      ? '0 0 24px rgba(0,229,255,0.9), '
                      : '0 0 24px rgba(255,230,0,0.9), '
                    : '';
                  const outline =
                    '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 6px 16px rgba(0,0,0,0.9)';
                  // Gunakan fontSize langsung (bukan scale) agar tidak collapse gap
                  const wordFontSize = isCurrent ? Math.round(baseFontSize * 1.08) : baseFontSize;

                  return (
                    <span
                      key={k}
                      style={{
                        fontFamily: "'Archivo Black', 'Impact', sans-serif",
                        fontSize: `${wordFontSize}px`,
                        lineHeight: 1.2,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        color,
                        textShadow: `${shadowGlow}${outline}`,
                        display: 'inline-block',
                        transition: 'font-size 0.08s ease, color 0.08s ease',
                        margin: '0 4px',
                        paddingBottom: isCurrent ? '2px' : '0',
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            ) : isHormozi ? (
              // Alex Hormozi: High-contrast impact box highlight
              <div
                style={{
                  textAlign: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  columnGap: '16px',
                  rowGap: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.6)',
                  padding: '12px 24px',
                  borderRadius: '16px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {realWords.map((word, k) => {
                  const isCurrent = k === currentSpokenIdx;
                  const isPast = k < currentSpokenIdx;
                  let bg = 'transparent';
                  let color = 'rgba(255, 255, 255, 0.65)';
                  let border = 'none';

                  if (isCurrent) {
                    bg = '#10B981';
                    color = '#000000';
                  } else if (isPast) {
                    bg = '#000000';
                    color = '#FFFFFF';
                    border = '2px solid #334155';
                  }

                  // Gunakan fontSize langsung agar spacing konsisten
                  const wordFontSize = isCurrent
                    ? Math.round(baseFontSize * 0.99)
                    : Math.round(baseFontSize * 0.94);

                  return (
                    <span
                      key={k}
                      style={{
                        fontFamily: "'Anton', 'Impact', sans-serif",
                        background: bg,
                        color,
                        border,
                        padding: isCurrent ? '7px 15px' : '6px 14px',
                        borderRadius: '10px',
                        fontSize: `${wordFontSize}px`,
                        lineHeight: 1.2,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        boxShadow: isCurrent ? '0 8px 24px rgba(16,185,129,0.5)' : 'none',
                        display: 'inline-block',
                        transition: 'font-size 0.08s ease, background 0.08s ease',
                        margin: '0 4px',
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            ) : (
              // Clean Minimal: Frosted dark glass
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '16px 32px',
                  borderRadius: '18px',
                  backdropFilter: 'blur(12px)',
                  textAlign: 'center',
                  maxWidth: '850px',
                  display: 'inline-flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  columnGap: '10px',
                  rowGap: '8px',
                }}
              >
                {realWords.map((word, k) => {
                  const isCurrent = k === currentSpokenIdx;
                  const isPast = k < currentSpokenIdx;
                  const color = isCurrent ? '#38BDF8' : isPast ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)';
                  // fontSize langsung untuk menghindari gap rapat akibat scale
                  const wordFontSize = isCurrent
                    ? Math.round(baseFontSize * 0.92)
                    : Math.round(baseFontSize * 0.88);

                  return (
                    <span
                      key={k}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: `${wordFontSize}px`,
                        lineHeight: 1.3,
                        fontWeight: isCurrent ? 800 : 600,
                        color,
                        margin: '0 3px',
                        display: 'inline-block',
                        textShadow: isCurrent ? '0 0 16px rgba(56,189,248,0.7)' : 'none',
                        transition: 'font-size 0.08s ease, color 0.08s ease',
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            )
          ) : isBeast ? (
            // Fallback simulation: MrBeast
            <div
              style={{
                textAlign: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.45)',
                padding: '16px 28px',
                borderRadius: '20px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span
                style={{
                  fontFamily: "'Archivo Black', 'Impact', sans-serif",
                  fontSize: `${baseFontSize}px`,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#FFE600',
                  textShadow:
                    '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 6px 16px rgba(0,0,0,0.8)',
                  transform: 'translateY(-4px) scale(1.06)',
                  display: 'inline-block',
                }}
              >
                {fallbackActiveWord}
              </span>
              <span
                style={{
                  fontFamily: "'Archivo Black', 'Impact', sans-serif",
                  fontSize: `${Math.round(baseFontSize * 0.88)}px`,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  textShadow:
                    '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                }}
              >
                {sampleWords[(wordCycleIndex + 1) % sampleWords.length] || ''}
              </span>
            </div>
          ) : isHormozi ? (
            // Fallback simulation: Alex Hormozi
            <div
              style={{
                textAlign: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'Anton', 'Impact', sans-serif",
                  background: '#10B981',
                  color: '#000000',
                  padding: '8px 20px',
                  borderRadius: '12px',
                  fontSize: `${Math.round(baseFontSize * 0.94)}px`,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.5)',
                  transform: 'translateY(-4px) scale(1.04)',
                }}
              >
                {fallbackActiveWord}
              </div>
              <div
                style={{
                  fontFamily: "'Anton', 'Impact', sans-serif",
                  background: '#000000',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  fontSize: `${Math.round(baseFontSize * 0.88)}px`,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  border: '2px solid #334155',
                }}
              >
                {sampleWords[(wordCycleIndex + 1) % sampleWords.length] || ''}
              </div>
            </div>
          ) : (
            // Fallback simulation: Clean Minimal
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '16px 32px',
                borderRadius: '18px',
                backdropFilter: 'blur(12px)',
                textAlign: 'center',
                maxWidth: '850px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: `${Math.round(baseFontSize * 0.88)}px`,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.5px',
                }}
              >
                <span style={{ color: '#38BDF8' }}>{fallbackActiveWord}</span>{' '}
                {sampleWords.slice(wordCycleIndex + 1, wordCycleIndex + 4).join(' ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 6: Outro Call to Action Card (Last N seconds)                  */}
      {/* -------------------------------------------------------------------- */}
      {enableIntroOutro && (
        <Sequence from={outroStartFrame} durationInFrames={outroDurationFrames}>
          <AbsoluteFill style={{ zIndex: 50, ...dynamicStyles.outro }}>
            <Outro
              theme={outroTheme}
              channelName={channelName}
              durationFrames={outroDurationFrames}
              logoSrc={outroLogoUrl}
              preset={outroPreset}
              ctaText={outroCtaText}
              buttonText={outroButtonText}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 7: Universal Dynamic Overlays (Stickers, Shapes, Callouts)     */}
      {/* -------------------------------------------------------------------- */}
      {dynamicOverlays && dynamicOverlays.length > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 45 }}>
          {dynamicOverlays.map((ov) => {
            if (isHookActive) return null;
            if (contentTimeSec < ov.start || contentTimeSec > ov.end) return null;
            const posX = ov.position?.x ?? '50%';
            const posY = ov.position?.y ?? (ov.componentId === 'lower-third' ? '74%' : ov.componentId === 'cta-banner' ? '68%' : '42%');
            const organicMotion = computeOrganicTransform({
              frame,
              fps,
              startSec: ov.start,
              endSec: ov.end,
              currentTimeSec: contentTimeSec,
              animation: ov.animation,
              personality: (ov as any).personality || 'snappy',
            });

            // Detect and repair HTML or truncated CSS snippets into valid broadcast cards
            const htmlContent = parseOrRepairHtmlOverlay(ov.content);
            const isHtml = ov.type === 'html' || Boolean(htmlContent);

            return (
              <div
                key={ov.id}
                style={{
                  position: 'absolute',
                  left: typeof posX === 'number' ? `${posX}px` : posX,
                  top: typeof posY === 'number' ? `${posY}px` : posY,
                  transform: organicMotion.transform,
                  opacity: organicMotion.opacity,
                  filter: organicMotion.filter,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'auto',
                  ...ov.styles,
                }}
              >
                {ov.componentId === 'stat-card' ? (
                  <div style={{ minWidth: 210, padding: '16px 24px', borderRadius: 18, textAlign: 'center', color: '#fff', background: 'linear-gradient(135deg, rgba(15,23,42,.96), rgba(30,41,59,.92))', border: '1px solid rgba(56,189,248,.8)', boxShadow: '0 12px 36px rgba(0,0,0,.4)' }}>
                    <div style={{ fontSize: 34, lineHeight: 1.1, fontWeight: 900, color: '#67e8f9' }}>{ov.content.split('\n')[0]}</div>
                    {ov.content.includes('\n') && <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{ov.content.split('\n').slice(1).join(' ')}</div>}
                  </div>
                ) : ov.componentId === 'quote-card' ? (
                  <div style={{ maxWidth: 680, padding: '18px 24px', borderLeft: '5px solid #facc15', borderRadius: 12, color: '#fff', background: 'rgba(15,23,42,.9)', fontSize: 24, lineHeight: 1.25, fontWeight: 800, boxShadow: '0 10px 32px rgba(0,0,0,.4)' }}>“{ov.content}”</div>
                ) : ov.componentId === 'lower-third' ? (
                  <div style={{ padding: '10px 18px', borderRadius: 8, color: '#fff', background: 'linear-gradient(90deg, rgba(2,132,199,.96), rgba(15,23,42,.9))', borderLeft: '4px solid #67e8f9', fontSize: 20, fontWeight: 800 }}>{ov.content}</div>
                ) : ov.componentId === 'cta-banner' ? (
                  <div style={{ padding: '14px 24px', borderRadius: 999, color: '#111827', background: '#fde047', fontSize: 22, fontWeight: 900, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>{ov.content}</div>
                ) : ov.componentId === 'checklist' ? (
                  <div style={{ display: 'grid', gap: 8, padding: '16px 20px', borderRadius: 14, color: '#fff', background: 'rgba(15,23,42,.92)', border: '1px solid rgba(148,163,184,.55)', fontSize: 18, fontWeight: 700 }}>{ov.content.split('\n').slice(0, 3).map((line, index) => <div key={index}>✓ {line}</div>)}</div>
                ) : isHtml ? (
                  <div
                    style={{
                      display: 'inline-block',
                      maxWidth: '92vw',
                      boxSizing: 'border-box',
                      pointerEvents: 'auto',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: htmlContent || ov.content,
                    }}
                  />
                ) : ov.type === 'badge' ? (
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.85)',
                      border: '2px solid #00F0FF',
                      borderRadius: '12px',
                      padding: '8px 16px',
                      color: '#00F0FF',
                      fontWeight: 800,
                      fontSize: '20px',
                      boxShadow: '0 0 16px rgba(0,240,255,0.4)',
                    }}
                  >
                    {ov.content}
                  </div>
                ) : ov.type === 'callout' ? (
                  <div
                    style={{
                      background: (ov.styles as any)?.background || '#FFE500',
                      color: (ov.styles as any)?.color || '#000000',
                      borderRadius: '16px',
                      padding: '12px 20px',
                      fontWeight: 900,
                      fontSize: '22px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    }}
                  >
                    {ov.content}
                  </div>
                ) : (
                  <span style={{ fontSize: '48px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))' }}>
                    {ov.content}
                  </span>
                )}
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      {/* Channel Handle Watermark in bottom corner */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '48px',
          fontSize: '20px',
          fontWeight: 700,
          color: 'rgba(255, 255, 255, 0.7)',
          letterSpacing: '0.5px',
          textShadow: '0 2px 6px rgba(0,0,0,0.8)',
          zIndex: 20,
        }}
      >
        {channelName}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 7: Background Music Audio Track                                 */}
      {/* -------------------------------------------------------------------- */}
      {resolvedMusicSrc && !isRenderedVideo && (
        <Audio
          src={resolvedMusicSrc}
          volume={effectiveMusicVolume}
          startFrom={Math.round((musicStartFromSec ?? 0) * fps)}
          loop
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* LAYER 8: AI Narration Voice Track (New Narration Mode)                */}
      {/* -------------------------------------------------------------------- */}
      {outputMode === 'narration' && narrationAudioUrl && !isRenderedVideo && (
        <Audio
          src={narrationAudioUrl}
          volume={narrationVolume ?? 1}
        />
      )}
    </AbsoluteFill>
  );
};
