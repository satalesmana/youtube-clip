import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, Img, Video, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { HookHeadline } from '../../../../compositions/studio/src/HookHeadline';
import { resolveVisualPreset } from '../../../../compositions/studio/src/visual-preset';
import { selectTheme } from '../../../../compositions/studio/src/design';
import type { ClientVisualPreset } from '../../lib/visual-presets';
import { CLIENT_PRESET_MAP } from '../../lib/visual-presets';
import type {
  VisualPresetSelection,
  VisualPresetId,
  CompositionLayout,
  AnimationPreset,
  TypographyVariant,
  BadgePresetId,
  BadgeColorVariant,
} from '../../types';

interface HookPresetLivePreviewProps {
  selectedPreset: VisualPresetSelection;
  overrideLayout?: CompositionLayout | 'auto';
  overrideAnimation?: AnimationPreset | 'auto';
  overrideTypography?: TypographyVariant | 'auto';
  selectedBadgePreset?: BadgePresetId;
  selectedBadgeColor?: BadgeColorVariant;
  customText?: string;
  customTag?: string;
  highlightWords?: string[];
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  durationSeconds?: number;
  aiRecommendationId?: VisualPresetId;
}

interface HookPreviewCompositionProps {
  presetId: VisualPresetId;
  layout: CompositionLayout;
  animation: AnimationPreset;
  typography: TypographyVariant;
  text: string;
  tag: string;
  highlightWords: string[];
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  badgePreset: BadgePresetId;
  badgeColor: BadgeColorVariant;
  durationInFrames: number;
}

const HookPreviewComposition: React.FC<HookPreviewCompositionProps> = ({
  presetId,
  layout,
  animation,
  typography,
  text,
  tag,
  highlightWords,
  thumbnailUrl,
  previewVideoUrl,
  badgePreset,
  badgeColor,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const basePreset = resolveVisualPreset({ manualPreset: presetId });
  const visualPreset = { ...basePreset, layout, animation, typography };
  const theme = selectTheme('hook-preview', presetId);

  // Pattern interrupt punch zoom on entry (matches HookIntroShort)
  const punchSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.9 },
  });
  const zoomScale = interpolate(punchSpring, [0, 1], [1.12, 1]);

  const isTopHeavy = layout === 'top-heavy';
  const isFullScreenText = layout === 'full-screen-text';
  const isSubjectFirst = layout === 'subject-first';
  const isDataFocus = layout === 'data-focus';

  const fgVideoTranslateY = isTopHeavy ? Math.round(height * 0.068) : 0;
  const fgVideoScale = isSubjectFirst ? 1.08 : isFullScreenText ? 0.94 : 1.0;
  const fgVideoOpacity = isFullScreenText ? 0.65 : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', overflow: 'hidden' }}>
      {/* Layer 1: Ambient Blurred Background */}
      {previewVideoUrl ? (
        <Video
          src={previewVideoUrl}
          muted
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.25)',
            filter: isFullScreenText ? 'blur(28px) brightness(0.35)' : 'blur(24px) brightness(0.6)',
          }}
        />
      ) : thumbnailUrl ? (
        <Img
          src={thumbnailUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.25)',
            filter: isFullScreenText ? 'blur(28px) brightness(0.35)' : 'blur(24px) brightness(0.6)',
          }}
        />
      ) : (
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090d16 80%, #030508 100%)' }} />
      )}

      {/* Layer 2: Subtle theme gradient overlay with soft top vignette */}
      <AbsoluteFill
        style={{
          background: isDataFocus
            ? `radial-gradient(circle at 50% 30%, ${theme.accent}30, transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 24%, transparent 42%, rgba(0,0,0,0.92) 100%)`
            : `radial-gradient(circle at 50% 20%, ${theme.gradient[0]}40, transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 22%, transparent 38%, transparent 65%, rgba(0,0,0,0.88) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Layer 3: Foreground Sharp Video / Image */}
      {(previewVideoUrl || thumbnailUrl) && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
          {previewVideoUrl ? (
            <Video
              src={previewVideoUrl}
              muted
              loop
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: fgVideoOpacity,
                transform: `translateY(${fgVideoTranslateY}px) scale(${zoomScale * fgVideoScale})`,
                filter: isDataFocus
                  ? `drop-shadow(0 15px 30px rgba(0,0,0,0.85)) drop-shadow(0 0 20px ${theme.accent}40)`
                  : 'drop-shadow(0 15px 30px rgba(0,0,0,0.85))',
              }}
            />
          ) : (
            <Img
              src={thumbnailUrl!}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: fgVideoOpacity,
                transform: `translateY(${fgVideoTranslateY}px) scale(${zoomScale * fgVideoScale})`,
                filter: isDataFocus
                  ? `drop-shadow(0 15px 30px rgba(0,0,0,0.85)) drop-shadow(0 0 20px ${theme.accent}40)`
                  : 'drop-shadow(0 15px 30px rgba(0,0,0,0.85))',
              }}
            />
          )}
        </AbsoluteFill>
      )}

      {/* Layer 4: Hook Headline */}
      <HookHeadline
        text={text}
        tag={tag}
        theme={theme}
        highlightWords={highlightWords}
        visualPreset={visualPreset}
        badgePresetId={badgePreset}
        badgeColor={badgeColor}
        durationFrames={durationInFrames}
      />

      {/* Layer 5: Accent brand bar line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};

export const HookPresetLivePreview: React.FC<HookPresetLivePreviewProps> = ({
  selectedPreset,
  overrideLayout = 'auto',
  overrideAnimation = 'auto',
  overrideTypography = 'auto',
  selectedBadgePreset = 'neon-outline',
  selectedBadgeColor = 'auto',
  customText,
  customTag,
  highlightWords = [],
  thumbnailUrl,
  previewVideoUrl,
  durationSeconds = 3.5,
  aiRecommendationId = 'kinetic-punch',
}) => {
  const activePresetId: VisualPresetId = selectedPreset === 'auto' ? aiRecommendationId : selectedPreset;
  const preset: ClientVisualPreset = CLIENT_PRESET_MAP[activePresetId] || CLIENT_PRESET_MAP['kinetic-punch'];
  const [showSafeZone, setShowSafeZone] = useState(false);

  const layout = overrideLayout !== 'auto'
    ? overrideLayout
    : preset.layout.toLowerCase().replace(/\s+/g, '-') as CompositionLayout;
  const animation = overrideAnimation !== 'auto'
    ? overrideAnimation
    : preset.animation.toLowerCase().replace(/\s+/g, '-') as AnimationPreset;
  const typography = overrideTypography !== 'auto'
    ? overrideTypography
    : preset.typography.toLowerCase().replace(/\s+/g, '-') as TypographyVariant;
  const durationInFrames = Math.max(45, Math.round(durationSeconds * 30));

  const inputProps = useMemo<HookPreviewCompositionProps>(() => ({
    presetId: activePresetId,
    layout,
    animation,
    typography,
    text: customText?.trim() || preset.demoHeadline,
    tag: customTag?.trim() || preset.tag,
    highlightWords: highlightWords.length ? highlightWords : [preset.demoKeyword],
    thumbnailUrl,
    previewVideoUrl,
    badgePreset: selectedBadgePreset,
    badgeColor: selectedBadgeColor,
    durationInFrames,
  }), [
    activePresetId,
    layout,
    animation,
    typography,
    customText,
    preset.demoHeadline,
    customTag,
    preset.tag,
    highlightWords,
    preset.demoKeyword,
    thumbnailUrl,
    previewVideoUrl,
    selectedBadgePreset,
    selectedBadgeColor,
    durationInFrames,
  ]);

  return (
    <div className="hpl-container">
      <div className="hpl-header">
        <div className="hpl-title-row">
          <span className="hpl-title">📱 Live Preview (9:16)</span>
        </div>
        <div className="hpl-controls">
          <button
            type="button"
            className={`hpl-toggle-btn ${showSafeZone ? 'active' : ''}`}
            onClick={() => setShowSafeZone((visible) => !visible)}
            title="Toggle panduan Safe Zone TikTok/Reels"
          >
            📐 Safe Zone
          </button>
        </div>
      </div>

      <div className="hpl-body">
        <div className="hpl-phone-frame">
          <div className="hpl-screen">
            <Player
              component={HookPreviewComposition as unknown as React.FC<Record<string, unknown>>}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={30}
              compositionWidth={360}
              compositionHeight={640}
              loop
              autoPlay
              controls={false}
              style={{ width: '100%', height: '100%' }}
              moveToBeginningWhenEnded
            />
            {showSafeZone && (
              <div className="hpl-safe-zone-overlay">
                <div className="hpl-sz-top"><span>Hindari UI Atas (Header/Search)</span></div>
                <div className="hpl-sz-center">
                  <div className="hpl-sz-safe-label">✓ Area Aman Hook (9:16)</div>
                  <div className="hpl-sz-rail-indicator">Area Aksi Kanan</div>
                </div>
                <div className="hpl-sz-bottom"><span>Hindari UI Bawah (Keterangan/Sound)</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hpl-compact-specs">
        <div className="hpl-spec-tag"><span className="spec-k">Preset:</span><span className="spec-v">{preset.label}</span></div>
        <div className="hpl-spec-tag"><span className="spec-k">Tipografi:</span><span className="spec-v">{typography}</span></div>
        <div className="hpl-spec-tag"><span className="spec-k">Layout:</span><span className="spec-v">{layout}</span></div>
        <div className="hpl-spec-tag"><span className="spec-k">Motion:</span><span className="spec-v">{animation}</span></div>
      </div>
    </div>
  );
};
