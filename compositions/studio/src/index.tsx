import { Composition, registerRoot } from 'remotion';
import { AIShort, DEFAULT_SKIN } from './AIShort';
import { GOLD_THEME } from './design';
import { InterviewOverlay } from './InterviewOverlay';
import { SportsOverlay } from './SportsOverlay';
import type { Skin } from './AIShort';
import * as React from 'react';
import type { CompositionProps } from './types';

const FPS = 30;

/** Available composition styles - add new ones here */
const SKINS: Record<string, Skin> = {
  commentary: DEFAULT_SKIN,
  sports: { id: 'sports', Overlay: SportsOverlay },
  interview: { id: 'interview', theme: GOLD_THEME, Overlay: InterviewOverlay },
};

const makeSkinComponent =
  (skin: Skin): React.FC<CompositionProps> =>
  (props) => <AIShort {...props} skin={skin} />;

const STYLE_MAP: Record<string, React.ComponentType<CompositionProps>> = {
  commentary: makeSkinComponent(SKINS.commentary),
  sports: makeSkinComponent(SKINS.sports),
  interview: makeSkinComponent(SKINS.interview),
};

/** Get style from env, fallback to first available */
function getActiveStyle(): string {
  const envStyle = process.env.COMPOSITION_STYLE;
  if (envStyle && STYLE_MAP[envStyle]) {
    return envStyle;
  }
  return 'commentary';
}

const activeStyle = getActiveStyle();
const ActiveComponent = STYLE_MAP[activeStyle] || STYLE_MAP.commentary;
const compositionId = activeStyle.charAt(0).toUpperCase() + activeStyle.slice(1) + 'Short';

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
};

registerRoot(() => (
  <Composition
    id={compositionId}
    component={ActiveComponent}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={60 * FPS}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round((props.plan?.duration ?? 60) * FPS)),
    })}
    defaultProps={defaultProps}
  />
));
