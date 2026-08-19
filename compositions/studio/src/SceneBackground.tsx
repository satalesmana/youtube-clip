import {
  AbsoluteFill,
  Easing,
  Freeze,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Video } from '@remotion/media';
import * as React from 'react';
import { calculateBlur, kenBurnsScale } from './animation';
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

  const renderVideo = (
    localFrame: number,
    offset: number,
    duration: number,
    trimAfterOverride?: number,
  ) => {
    const blur = calculateBlur({
      localFrame,
      sceneDurationFrames: duration,
      fps,
      blurIn: !isFirst,
      blurOut: !isLast,
    });
    const kbScale = kenBurnsScale(localFrame, duration);
    return (
      <Video
        src={toAssetUrl(videoSrc)}
        objectFit="cover"
        muted
        volume={0}
        trimBefore={offset}
        trimAfter={trimAfterOverride ?? offset + duration}
        style={{
          width: '100%',
          height: '100%',
          scale: kbScale,
          ...(blur > 0
            ? {
                filter: `blur(${blur}px)`,
                WebkitFilter: `blur(${blur}px)`,
              }
            : {}),
        }}
      />
    );
  };

  /** Plays the trimmed source clip once, then freezes on its last frame. */
  const renderSourceClip = (trimBefore: number, trimAfter: number) => {
    const clipLen = Math.max(1, trimAfter - trimBefore);
    return (
      <>
        <Sequence from={0} durationInFrames={clipLen}>
          {renderVideo(frame, trimBefore, clipLen)}
        </Sequence>
        <Sequence from={clipLen}>
          <Freeze frame={clipLen - 1}>
            {renderVideo(clipLen - 1, trimBefore, clipLen)}
          </Freeze>
        </Sequence>
      </>
    );
  };

  if (scene.visual === 'graphic') {
    const source = scene.source;
    const isHook = scene.type === 'hook';
    const hasSourceClip = Boolean(source && source.end > source.start && videoSrc);
    const trimBefore = source
      ? Math.max(0, Math.round(source.start * fps))
      : 0;
    const trimAfter = source
      ? Math.max(1, Math.round(source.end * fps))
      : 1;

    return (
      <AbsoluteFill style={{ backgroundColor: theme.cardBg }}>
        {hasSourceClip && source ? (
          <>
            {renderSourceClip(trimBefore, trimAfter)}
            {/* Hook keeps the money shot more visible for silent scroll. */}
            <AbsoluteFill
              style={{
                backgroundColor: isHook ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.45)',
              }}
            />
          </>
        ) : null}
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
            opacity: hasSourceClip ? (isHook ? 0.55 : 0.85) : 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '6%',
            right: '-18%',
            width: '62%',
            aspectRatio: '1',
            border: `14px solid ${theme.cardStroke}`,
            borderRadius: '50%',
            opacity: 0.9,
            scale: interpolate(frame, [0, sceneDurationFrames], [0.7, 1.1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.inOut(Easing.ease),
            }),
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            left: '-14%',
            width: '52%',
            aspectRatio: '1',
            border: `10px solid ${theme.accent2}`,
            borderRadius: '50%',
            opacity: 0.55,
            scale: interpolate(frame, [0, sceneDurationFrames], [1.1, 0.75], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.inOut(Easing.ease),
            }),
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 24,
            border: `10px solid ${theme.cardStroke}`,
            borderRadius: 12,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (!videoSrc) {
    return <AbsoluteFill style={{ backgroundColor: theme.surface }} />;
  }

  if (scene.source) {
    const trimBefore = Math.max(0, Math.round(scene.source.start * fps));
    const trimAfter = Math.max(1, Math.round(scene.source.end * fps));
    return <AbsoluteFill>{renderSourceClip(trimBefore, trimAfter)}</AbsoluteFill>;
  }

  return (
    <AbsoluteFill>{renderVideo(frame, 0, sceneDurationFrames)}</AbsoluteFill>
  );
};
