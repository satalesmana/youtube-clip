import {
  AbsoluteFill,
  useVideoConfig,
} from 'remotion';
import * as React from 'react';
import { selectTheme } from './design';
import type { Theme } from './design';
import type { OutroCardShortProps } from './types';
import { Outro } from './Outro';

/**
 * Animated High-Converting Creator Outro Card Short (9:16).
 * Renders the chosen outro preset with full kinetic animations and high-converting styling.
 */
export const OutroCardShort: React.FC<OutroCardShortProps> = ({
  channelName = 'kreator',
  ctaText,
  handle,
  creatorLogoUrl,
  durationSeconds = 3,
  themeSeed = 'default:outro',
  outroPreset = 'creator-glass',
  buttonText,
}) => {
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const theme: Theme = selectTheme(themeSeed, 'outro');
  const displayHandle = handle || channelName.replace(/^@/, '');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#07090e' }}>
      <Outro
        theme={theme}
        channelName={displayHandle}
        durationFrames={durationFrames}
        logoSrc={creatorLogoUrl}
        preset={outroPreset}
        ctaText={ctaText}
        buttonText={buttonText}
      />
    </AbsoluteFill>
  );
};
