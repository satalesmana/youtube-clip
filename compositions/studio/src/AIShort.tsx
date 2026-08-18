import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import * as React from 'react';
import { Caption } from './Caption';
import { ProgressBar } from './ProgressBar';
import { SceneBackground } from './SceneBackground';
import { SceneText } from './SceneText';
import { toAssetUrl } from './assetUrl';
import { FONT, selectTheme } from './design';
import type { Theme } from './design';
import { toFrame } from './timing';
import type { CompositionProps } from './types';

export type Skin = {
  id: string;
  theme?: Theme;
  labels?: Record<string, string>;
  Overlay?: React.FC<{ theme: Theme; durationFrames: number }>;
};

export const DEFAULT_SKIN: Skin = { id: 'default' };

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
  skin,
}) => {
  const { fps } = useVideoConfig();
  const activeSkin = skin ?? DEFAULT_SKIN;
  const theme = activeSkin.theme ?? selectTheme(plan.candidateId, plan.angleId);
  const durationFrames = toFrame(plan.duration, fps);

  const sourceUnderlay = plan.audio?.sourceUnderlay ?? false;
  const ducking = plan.audio?.ducking ?? false;
  const sourceMuted = !sourceUnderlay;
  const sourceVolume = ducking ? 0.2 : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface, fontFamily: FONT }}>
      {plan.scenes.map((scene, index) => {
        const startFrame = toFrame(scene.start, fps);
        const sceneDurationFrames = Math.max(1, toFrame(scene.end, fps) - startFrame);
        return (
          <Sequence
            key={`scene-${index}`}
            from={startFrame}
            durationInFrames={sceneDurationFrames}
          >
            <SceneBackground
              scene={scene}
              videoSrc={sourceVideoPath}
              theme={theme}
              isFirst={index === 0}
              isLast={index === plan.scenes.length - 1}
              sceneDurationFrames={sceneDurationFrames}
              sourceMuted={sourceMuted}
              sourceVolume={sourceVolume}
            />
            <SceneText scene={scene} theme={theme} labels={activeSkin.labels} />
          </Sequence>
        );
      })}

      {plan.captions.map((caption, index) => {
        const startFrame = toFrame(caption.start, fps);
        const capDur = Math.max(1, toFrame(caption.end, fps) - startFrame);
        return (
          <Sequence key={`cap-${index}`} from={startFrame} durationInFrames={capDur}>
            <Caption caption={caption} theme={theme} durationFrames={capDur} />
          </Sequence>
        );
      })}

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
