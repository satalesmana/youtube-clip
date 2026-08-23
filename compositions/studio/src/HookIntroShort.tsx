import { AbsoluteFill, Sequence, Freeze, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import * as React from 'react';
import { Badge } from './Badge';
import { HookHeadline } from './HookHeadline';
import { ProgressBar } from './ProgressBar';
import { calculateBlur, kenBurnsScale } from './animation';
import { toAssetUrl } from './assetUrl';
import { selectTheme } from './design';
import type { Theme } from './design';
import { toFrame } from './timing';
import type { HookIntroProps } from './types';

const BADGE_SECONDS = 2;

/**
 * Standalone styled hook intro — the exact opening a full clipper render
 * produces (kinetic headline over the hook's source footage, badge, channel
 * watermark), as its own video. No narration, no captions, no outro: the
 * source clip plays once muted, then freezes on its last frame.
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

  const trimBefore = Math.max(0, toFrame(sourceStart, fps));
  const trimAfter = Math.max(trimBefore + 1, toFrame(sourceEnd, fps));
  const clipLen = trimAfter - trimBefore;

  /** Plays the trimmed source clip once, then freezes on its last frame. */
  const backgroundVideo = (localFrame: number) => (
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
        scale: kenBurnsScale(localFrame, durationFrames),
        ...(localFrame < 8
          ? {
              filter: `blur(${calculateBlur({
                localFrame,
                sceneDurationFrames: durationFrames,
                fps,
                blurIn: true,
                blurOut: false,
              })}px)`,
              WebkitFilter: `blur(${calculateBlur({
                localFrame,
                sceneDurationFrames: durationFrames,
                fps,
                blurIn: true,
                blurOut: false,
              })}px)`,
            }
          : {}),
      }}
    />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: theme.surface, fontFamily: 'sans-serif' }}>
      {/* Source footage of the hook moment, play-once-then-freeze. */}
      <Sequence from={0} durationInFrames={clipLen}>
        {backgroundVideo(frame)}
      </Sequence>
      <Sequence from={clipLen}>
        <Freeze frame={clipLen - 1}>{backgroundVideo(clipLen - 1)}</Freeze>
      </Sequence>

      {/* Same dim + gradient treatment as the hook scene in AIShort. */}
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.28)' }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
          opacity: 0.55,
        }}
      />

      {/* Kinetic headline across the whole intro (no word timings → even pops). */}
      <HookHeadline
        text={hook.headlineText}
        theme={theme}
        highlightWords={hook.highlightWords}
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
