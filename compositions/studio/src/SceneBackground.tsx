import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Video } from '@remotion/media';
import * as React from 'react';
import { kenBurnsScale } from './animation';
import { toAssetUrl } from './assetUrl';
import type { Theme } from './design';
import type { PlanScene } from './types';

/**
 * Full-bleed background for one scene.
 * - `graphic` scenes render a themed title card (template intro style). When
 *   the scene carries a `source` range (e.g. the story's hook moment) the
 *   trimmed clip plays behind the card, dimmed, so the opening shows the
 *   money shot behind the title.
 * - Other scenes render the source video with Ken Burns zoom and blur
 *   enter/exit transitions, synced to the scene's trim window.
 */
export const SceneBackground: React.FC<{
  scene: PlanScene;
  videoSrc: string;
  theme: Theme;
  isFirst: boolean;
  isLast: boolean;
  sceneDurationFrames: number;
  sourceUnderlay?: boolean;
  sourceAudioVolume?: number;
}> = ({
  scene,
  videoSrc,
  theme,
  isFirst,
  isLast,
  sceneDurationFrames,
  sourceUnderlay = false,
  sourceAudioVolume = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /**
   * Renders continuous video without freezing.
   * Plays forward smoothly throughout the scene's entire duration.
   */
  const renderVideo = (
    localFrame: number,
    offset: number,
    duration: number,
  ) => {
    const isSports = theme.id === 'sports';
    const kbScale = kenBurnsScale(localFrame, duration);
    const timeSeconds = localFrame / fps;
    const focusPoints = scene.focusPoints ?? [];
    let focusX = 0.5;
    let focusY = 0.5;
    if (focusPoints.length > 0) {
      const rightIndex = focusPoints.findIndex((point) => point.time >= timeSeconds);
      const left = rightIndex <= 0 ? focusPoints[0]! : focusPoints[rightIndex - 1]!;
      const right = rightIndex < 0 ? focusPoints[focusPoints.length - 1]! : focusPoints[rightIndex]!;
      const span = Math.max(0.001, right.time - left.time);
      const mix = Math.max(0, Math.min(1, (timeSeconds - left.time) / span));
      focusX = left.x + (right.x - left.x) * mix;
      focusY = left.y + (right.y - left.y) * mix;
    }
    const punchScale = isSports && isFirst && localFrame < 15
      ? interpolate(localFrame, [0, 12], [1.10, 1], { extrapolateRight: 'clamp' })
      : 1;
    const effectiveScale = kbScale * punchScale * (focusPoints.length > 0 ? 1.08 : 1);
    // For the standard 16:9 source into 9:16 canvas, map the normalized
    // subject position to CSS object-position while keeping the image covered.
    const horizontalOverflow = 16 / 9 / (9 / 16) - 1;
    const objectPositionX = focusPoints.length > 0
      ? Math.max(0, Math.min(1, (focusX * (horizontalOverflow + 1) - 0.5) / horizontalOverflow))
      : 0.5;
    const assetUrl = toAssetUrl(videoSrc);

    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {/* Layer 1: Ambient blurred background to fill 9:16 frame */}
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Video
            src={assetUrl}
            objectFit="cover"
            muted
            volume={0}
            trimBefore={offset}
            trimAfter={offset + duration}
            style={{
              width: '100%',
              height: '100%',
              filter: isSports
                ? 'blur(34px) brightness(0.42)'
                : 'blur(28px) brightness(0.65)',
              WebkitFilter: isSports
                ? 'blur(34px) brightness(0.42)'
                : 'blur(28px) brightness(0.65)',
              transform: 'scale(1.20)',
            }}
          />
        </AbsoluteFill>

        {/* Layer 2: Sharp foreground video */}
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Video
            src={assetUrl}
            objectFit={focusPoints.length > 0 ? 'cover' : 'contain'}
            muted={!sourceUnderlay}
            volume={sourceUnderlay ? sourceAudioVolume : 0}
            trimBefore={offset}
            trimAfter={offset + duration}
            style={{
              width: '100%',
              height: '100%',
              scale: effectiveScale,
              objectPosition: `${objectPositionX * 100}% ${focusY * 100}%`,
              boxShadow: isSports
                ? '0 16px 50px rgba(0, 0, 0, 0.9), 0 0 2px rgba(255, 230, 0, 0.25)'
                : '0 10px 40px rgba(0, 0, 0, 0.6)',
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  };

  /** Plays source clip continuously for the scene without freezing. */
  const renderSourceClip = (trimBefore: number) => {
    return renderVideo(frame, trimBefore, sceneDurationFrames);
  };

  if (!videoSrc) {
    return <AbsoluteFill style={{ backgroundColor: theme.surface }} />;
  }

  if (scene.source) {
    const trimBefore = Math.max(0, Math.round(scene.source.start * fps));
    return <AbsoluteFill>{renderSourceClip(trimBefore)}</AbsoluteFill>;
  }

  return (
    <AbsoluteFill>{renderVideo(frame, 0, sceneDurationFrames)}</AbsoluteFill>
  );
};
