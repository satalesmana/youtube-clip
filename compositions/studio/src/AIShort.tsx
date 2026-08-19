import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import * as React from 'react';
import { Badge } from './Badge';
import { Caption } from './Caption';
import { Outro } from './Outro';
import { ProgressBar } from './ProgressBar';
import { SceneBackground } from './SceneBackground';
import { SceneText } from './SceneText';
import { toAssetUrl } from './assetUrl';
import { FONT, selectTheme } from './design';
import { sceneOpacity } from './animation';
import type { Theme } from './design';
import { toFrame } from './timing';
import type { CompositionProps, PlanCaption } from './types';

export type Skin = {
  id: string;
  theme?: Theme;
  labels?: Record<string, string>;
  Overlay?: React.FC<{ theme: Theme; durationFrames: number }>;
};

export const DEFAULT_SKIN: Skin = { id: 'default' };

const OUTRO_SECONDS = 3;
const BADGE_SECONDS = 2;
const SCENE_FADE_FRAMES = 8;

/** One scene: background + text, with a soft fade-in/out dip at boundaries. */
const SceneLayer: React.FC<{
  scene: CompositionProps['plan']['scenes'][number];
  videoSrc: string;
  theme: Theme;
  isFirst: boolean;
  isLast: boolean;
  sceneDurationFrames: number;
  /** Absolute frame where this scene starts on the output timeline. */
  absoluteStartFrame: number;
  /** Real word boundaries for the scene's narration, concatenated from captions. */
  wordTimings?: PlanCaption['wordTimings'];
  labels?: Record<string, string>;
}> = ({
  scene,
  videoSrc,
  theme,
  isFirst,
  isLast,
  sceneDurationFrames,
  absoluteStartFrame,
  wordTimings,
  labels,
}) => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, sceneDurationFrames, {
    fadeIn: true,
    fadeOut: true,
    fadeFrames: SCENE_FADE_FRAMES,
    min: 0.08,
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneBackground
        scene={scene}
        videoSrc={videoSrc}
        theme={theme}
        isFirst={isFirst}
        isLast={isLast}
        sceneDurationFrames={sceneDurationFrames}
      />
      <SceneText
        scene={scene}
        theme={theme}
        labels={labels}
        absoluteStartFrame={absoluteStartFrame}
        durationFrames={sceneDurationFrames}
        wordTimings={wordTimings}
      />
    </AbsoluteFill>
  );
};

/**
 * Template-inspired engine: per-scene video backgrounds (Ken Burns + blur
 * transitions), TikTok-style stroke captions, seeded theme and narration.
 * All timing is derived from a single `toFrame()` helper so video, captions
 * and scene text stay frame-accurate.
 */
export const AIShort: React.FC<CompositionProps & { skin?: Skin }> = ({
  plan,
  narrationPath,
  sourceVideoPath,
  channelName,
  hookBadge,
  skin,
}) => {
  const { fps } = useVideoConfig();
  const activeSkin = skin ?? DEFAULT_SKIN;
  const theme = activeSkin.theme ?? selectTheme(plan.candidateId, plan.angleId);
  const durationFrames = toFrame(plan.duration, fps);

  const outroFrames = Math.max(1, Math.round(OUTRO_SECONDS * fps));
  const badgeFrames = Math.max(1, Math.round(BADGE_SECONDS * fps));

  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface, fontFamily: FONT }}>
      {plan.scenes.map((scene, index) => {
        const startFrame = toFrame(scene.start, fps);
        const sceneDurationFrames = Math.max(1, toFrame(scene.end, fps) - startFrame);
        const wordTimings = plan.captions
          .filter(
            (caption) =>
              caption.wordTimings &&
              caption.type !== 'quote' &&
              caption.start >= scene.start - 0.01 &&
              caption.end <= scene.end + 0.01,
          )
          .flatMap((caption) => caption.wordTimings!);
        return (
          <Sequence
            key={`scene-${index}`}
            from={startFrame}
            durationInFrames={sceneDurationFrames}
          >
            <SceneLayer
              scene={scene}
              videoSrc={sourceVideoPath}
              theme={theme}
              isFirst={index === 0}
              isLast={index === plan.scenes.length - 1}
              sceneDurationFrames={sceneDurationFrames}
              absoluteStartFrame={startFrame}
              wordTimings={wordTimings}
              labels={activeSkin.labels}
            />
          </Sequence>
        );
      })}

      {plan.captions.map((caption, index) => {
        const startFrame = toFrame(caption.start, fps);
        const capDur = Math.max(1, toFrame(caption.end, fps) - startFrame);
        return (
          <Sequence key={`cap-${index}`} from={startFrame} durationInFrames={capDur}>
            <Caption
              caption={caption}
              theme={theme}
              durationFrames={capDur}
              absoluteStartFrame={startFrame}
            />
          </Sequence>
        );
      })}

      <Sequence from={Math.max(0, durationFrames - outroFrames)}>
        <Outro theme={theme} channelName={channelName} durationFrames={outroFrames} />
      </Sequence>

      {hookBadge ? (
        <Sequence from={0} durationInFrames={badgeFrames}>
          <Badge text={hookBadge} theme={theme} durationFrames={badgeFrames} />
        </Sequence>
      ) : null}

      {activeSkin.Overlay ? (
        <activeSkin.Overlay theme={theme} durationFrames={durationFrames} />
      ) : null}

      <ProgressBar
        theme={theme}
        channelName={channelName}
        durationFrames={durationFrames}
      />

      {narrationPath ? <Audio src={toAssetUrl(narrationPath)} /> : null}
    </AbsoluteFill>
  );
};
