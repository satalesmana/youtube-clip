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
}> = ({
  scene,
  videoSrc,
  theme,
  isFirst,
  isLast,
  sceneDurationFrames,
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
    const punchScale = isSports && isFirst && localFrame < 15
      ? interpolate(localFrame, [0, 12], [1.10, 1], { extrapolateRight: 'clamp' })
      : 1;
    const effectiveScale = kbScale * punchScale;
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
            objectFit="contain"
            muted
            volume={0}
            trimBefore={offset}
            trimAfter={offset + duration}
            style={{
              width: '100%',
              height: '100%',
              scale: effectiveScale,
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
