import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

/** Elegant interview skin overlay: thin gold frame lines + subtle vignette. */
export const InterviewOverlay: React.FC<{
  theme: Theme;
  durationFrames: number;
}> = ({ theme }) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 0,
          width: '100%',
          height: 6,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 0,
          width: '100%',
          height: 6,
          background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          boxShadow: 'inset 0 0 220px rgba(0,0,0,0.55)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 56,
          fontFamily: FONT,
          fontSize: 26,
          letterSpacing: 3,
          color: theme.accent2,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        }}
      >
        MOMEN VIRAL
      </div>
    </>
  );
};
