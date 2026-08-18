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
 * - `graphic` scenes render a themed title card (template intro style).
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
  sourceMuted: boolean;
  sourceVolume: number;
}> = ({
  scene,
  videoSrc,
  theme,
  isFirst,
  isLast,
  sceneDurationFrames,
  sourceMuted,
  sourceVolume,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (scene.visual === 'graphic') {
    return (
      <AbsoluteFill style={{ backgroundColor: theme.cardBg }}>
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
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
        muted={sourceMuted}
        volume={sourceMuted ? 0 : sourceVolume}
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

  if (scene.source) {
    const trimBefore = Math.max(0, Math.round(scene.source.start * fps));
    const trimAfter = Math.max(1, Math.round(scene.source.end * fps));
    const clipLen = Math.max(1, trimAfter - trimBefore);
    return (
      <AbsoluteFill>
        <Sequence from={0} durationInFrames={clipLen}>
          {renderVideo(frame, trimBefore, clipLen)}
        </Sequence>
        <Sequence from={clipLen}>
          <Freeze frame={clipLen - 1}>
            {renderVideo(clipLen - 1, trimBefore, clipLen)}
          </Freeze>
        </Sequence>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      {renderVideo(frame, 0, sceneDurationFrames)}
    </AbsoluteFill>
  );
};
