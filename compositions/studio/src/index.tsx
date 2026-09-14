import { Composition, registerRoot } from 'remotion';
import { AIShort, DEFAULT_SKIN } from './AIShort';
import { HookIntroShort } from './HookIntroShort';
import { OutroCardShort } from './OutroCardShort';
import { GOLD_THEME, SPORTS_THEME } from './design';
import { InterviewOverlay } from './InterviewOverlay';
import { SportsOverlay } from './SportsOverlay';
import type { Skin } from './AIShort';
import * as React from 'react';
import type { CompositionProps, HookIntroProps, OutroCardShortProps } from './types';

const FPS = 30;

/** Available composition styles - add new ones here */
const SKINS: Record<string, Skin> = {
  commentary: DEFAULT_SKIN,
  sports: { id: 'sports', theme: SPORTS_THEME, Overlay: SportsOverlay },
  interview: { id: 'interview', theme: GOLD_THEME, Overlay: InterviewOverlay },
};

const makeSkinComponent =
  (skin: Skin): React.FC<CompositionProps> =>
  (props) => <AIShort {...props} skin={skin} />;

/** Fixed composition ids so the render engine can request any style. */
const STYLE_MAP: Record<string, React.ComponentType<CompositionProps>> = {
  commentary: makeSkinComponent(SKINS.commentary),
  sports: makeSkinComponent(SKINS.sports),
  interview: makeSkinComponent(SKINS.interview),
};

const defaultProps: CompositionProps = {
  plan: {
    candidateId: '',
    angleId: '',
    duration: 60,
    scenes: [],
    captions: [],
    audio: { sourceUnderlay: false, ducking: false },
  },
  narrationPath: '',
  sourceVideoPath: '',
  channelName: '',
  hookBadge: '',
};

/** Default props for the standalone styled hook intro composition. */
const defaultHookIntroProps: HookIntroProps = {
  hook: {
    duration: 4,
    headlineText: 'HOOK HEADLINE',
    themeSeed: 'default:hook-intro',
  },
  sourceVideoPath: '',
  sourceStart: 0,
  sourceEnd: 1,
};

const defaultOutroCardShortProps: OutroCardShortProps = {
  channelName: 'kreator',
  ctaText: 'Suka konten ini? Ikuti untuk update harian & momen viral berikutnya!',
  durationSeconds: 3,
  themeSeed: 'default:outro',
};

const OUTRO_SECONDS = 3;

/**
 * Registers every style as its own composition (CommentaryShort, SportsShort,
 * InterviewShort) so the engine can pick one per render. Relying on a build-time
 * env var to decide the single composition id is fragile — the bundler strips
 * process.env during evaluation, so the requested id never matches.
 */
registerRoot(() => (
  <>
    {Object.entries(STYLE_MAP).map(([name, Component]) => (
      <Composition
        key={name}
        id={name.charAt(0).toUpperCase() + name.slice(1) + 'Short'}
        component={Component}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={60 * FPS}
        calculateMetadata={({ props }) => {
          const contentDuration = props.plan?.duration ?? 60;
          const contentFrames = Math.max(1, Math.round(contentDuration * FPS));
          const outroFrames = Math.round(OUTRO_SECONDS * FPS);
          return {
            durationInFrames: contentFrames + outroFrames,
          };
        }}
        defaultProps={defaultProps}
      />
    ))}
    <Composition
      id="HookIntroShort"
      component={HookIntroShort}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={4 * FPS}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round((props.hook?.duration ?? 4) * FPS)),
      })}
      defaultProps={defaultHookIntroProps}
    />
    <Composition
      id="OutroCardShort"
      component={OutroCardShort}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={3 * FPS}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round((props.durationSeconds ?? 3) * FPS)),
      })}
      defaultProps={defaultOutroCardShortProps}
    />
  </>
));