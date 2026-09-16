import { AbsoluteFill, Sequence, Freeze, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { Video } from '@remotion/media';
import * as React from 'react';
import { Badge } from './Badge';
import { HookHeadline } from './HookHeadline';
import { ProgressBar } from './ProgressBar';
import { kenBurnsScale } from './animation';
import { toAssetUrl } from './assetUrl';
import { selectTheme } from './design';
import type { Theme } from './design';
import { toFrame } from './timing';
import type { HookIntroProps } from './types';
import { resolveVisualPreset, adaptLegacyHookStyle } from './visual-preset/index';

const BADGE_SECONDS = 2;

/**
 * Modern Viral Hook Intro Short.
 * - Smart Ambient Blur: Background video covers 9:16 blurred, foreground video contained sharp in center.
 * - Dynamic Pattern Interrupt: Smooth initial smash zoom on entry.
 * - Title Card Card & Tag: High-converting headline container.
 */
export const HookIntroShort: React.FC<HookIntroProps> = ({
  hook,
  sourceVideoPath,
  sourceStart,
  sourceEnd,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const theme: Theme = selectTheme(hook.themeSeed, 'hook-intro');
  const durationFrames = Math.max(1, toFrame(hook.duration, fps));
  const badgeFrames = Math.max(1, Math.round(BADGE_SECONDS * fps));

  // Resolve the visual preset:
  //   1. visualPresetId from server (Phase 3) wins
  //   2. Falls back to kinetic-punch (visual default, no semantic assertion)
  const baseVisualPreset = resolveVisualPreset({
    manualPreset: (hook.visualPresetId as any) ?? adaptLegacyHookStyle((hook as any).hookStyle),
  });

  const visualPreset = {
    ...baseVisualPreset,
    ...(hook.layout ? { layout: hook.layout as any } : {}),
    ...((hook as any).animation ? { animation: (hook as any).animation as any } : {}),
    ...((hook as any).typography ? { typography: (hook as any).typography as any } : {}),
  };

  const layout = ((hook as any).layout ?? visualPreset.layout ?? 'centered') as string;

  const trimBefore = Math.max(0, toFrame(sourceStart, fps));
  const trimAfter = Math.max(trimBefore + 1, toFrame(sourceEnd, fps));
  const clipLen = trimAfter - trimBefore;

  // Punch-in zoom on opening 0.5s for pattern interrupt
  const punchSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.9 },
  });
  const zoomScale = interpolate(punchSpring, [0, 1], [1.12, 1]);

  const hasVideo = Boolean(sourceVideoPath && sourceVideoPath.trim());

  // Layout-based foreground adjustments
  const isTopHeavy = layout === 'top-heavy';
  const isFullScreenText = layout === 'full-screen-text';
  const isSubjectFirst = layout === 'subject-first';
  const isDataFocus = layout === 'data-focus';

  const fgVideoTranslateY = isTopHeavy ? 130 : 0;
  const fgVideoScale = isSubjectFirst ? 1.08 : isFullScreenText ? 0.94 : 1.0;
  const fgVideoOpacity = isFullScreenText ? 0.65 : 1.0;

  /** Ambient background video (fills the 9:16 vertical canvas with heavy blur). */
  const renderAmbientBg = (_localFrame: number) =>
    hasVideo ? (
      <Video
        src={toAssetUrl(sourceVideoPath)}
        objectFit="cover"
        muted
        volume={0}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        style={{
          width: '100%',
          height: '100%',
          transform: 'scale(1.25)',
          filter: isFullScreenText
            ? 'blur(36px) brightness(0.35)'
            : 'blur(32px) brightness(0.6)',
          WebkitFilter: isFullScreenText
            ? 'blur(36px) brightness(0.35)'
            : 'blur(32px) brightness(0.6)',
        }}
      />
    ) : (
      <AbsoluteFill style={{ backgroundColor: '#0f172a' }} />
    );

  /** Foreground main video (sharp, framed according to composition layout). */
  const renderMainVideo = (localFrame: number) =>
    hasVideo ? (
      <Video
        src={toAssetUrl(sourceVideoPath)}
        objectFit="contain"
        muted
        volume={0}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        style={{
          width: '100%',
          height: '100%',
          opacity: fgVideoOpacity,
          transform: `translateY(${fgVideoTranslateY}px) scale(${kenBurnsScale(localFrame, durationFrames) * zoomScale * fgVideoScale})`,
          filter: isDataFocus
            ? `drop-shadow(0 20px 40px rgba(0,0,0,0.85)) drop-shadow(0 0 30px ${theme.accent}40)`
            : 'drop-shadow(0 20px 40px rgba(0,0,0,0.85))',
        }}
      />
    ) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      {/* Layer 1: Ambient Blurred Background */}
      <Sequence from={0} durationInFrames={clipLen}>
        {renderAmbientBg(frame)}
      </Sequence>
      <Sequence from={clipLen}>
        <Freeze frame={clipLen - 1}>{renderAmbientBg(clipLen - 1)}</Freeze>
      </Sequence>

      {/* Layer 2: Subtle theme gradient overlay with soft top vignette */}
      <AbsoluteFill
        style={{
          background: isDataFocus
            ? `radial-gradient(circle at 50% 30%, ${theme.accent}30, transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 24%, transparent 42%, rgba(0,0,0,0.92) 100%)`
            : `radial-gradient(circle at 50% 20%, ${theme.gradient[0]}40, transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 22%, transparent 38%, transparent 65%, rgba(0,0,0,0.88) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Layer 3: Foreground Sharp Video */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Sequence from={0} durationInFrames={clipLen}>
          {renderMainVideo(frame)}
        </Sequence>
        <Sequence from={clipLen}>
          <Freeze frame={clipLen - 1}>{renderMainVideo(clipLen - 1)}</Freeze>
        </Sequence>
      </AbsoluteFill>

      {/* Layer 4: Modern Hook Title Card */}
      <HookHeadline
        text={hook.headlineText}
        tag={hook.tag}
        theme={theme}
        highlightWords={hook.highlightWords}
        visualPreset={visualPreset}
        absoluteStartFrame={0}
        durationFrames={durationFrames}
      />

      {hook.badge ? (
        <Sequence from={0} durationInFrames={badgeFrames}>
          <Badge text={hook.badge} theme={theme} durationFrames={badgeFrames} />
        </Sequence>
      ) : null}

      <ProgressBar
        theme={theme}
        channelName={hook.channelName}
        durationFrames={durationFrames}
      />
    </AbsoluteFill>
  );
};
