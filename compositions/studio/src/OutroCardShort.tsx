import {
  AbsoluteFill,
  useVideoConfig,
} from 'remotion';
import { Video } from '@remotion/media';
import * as React from 'react';
import { selectTheme } from './design';
import type { Theme } from './design';
import type { OutroCardShortProps } from './types';
import { Outro } from './Outro';
import { toAssetUrl } from './assetUrl';

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
  sourceVideoPath,
  sourceStart = 0,
}) => {
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const theme: Theme = selectTheme(themeSeed, 'outro');
  const displayHandle = handle || channelName.replace(/^@/, '');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#07090e' }}>
      {sourceVideoPath ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Video
            src={toAssetUrl(sourceVideoPath)}
            trimBefore={Math.max(0, Math.round(sourceStart * fps))}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(12px) brightness(0.35)',
              transform: 'scale(1.1)',
            }}
            muted
          />
        </AbsoluteFill>
      ) : null}
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
