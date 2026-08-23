import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import * as React from 'react';
import { FONT } from './design';
import type { Theme } from './design';

/** Elegant interview skin overlay: thin gold frame lines + subtle vignette + lower third. */
export const InterviewOverlay: React.FC<{
  theme: Theme;
  durationFrames: number;
  /** Optional speaker name shown in the lower-third card (first 4s). */
  speakerName?: string;
  /** Optional speaker title / context line. */
  speakerTitle?: string;
}> = ({ theme, durationFrames, speakerName, speakerTitle }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Lower third slides in from the left during first 4 seconds
  const lowerThirdDuration = Math.round(4 * 30);
  const lowerThirdVisible = frame < lowerThirdDuration;

  const slideIn = interpolate(frame, [0, 18], [-(width * 0.6), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideOut = interpolate(
    frame,
    [Math.max(0, lowerThirdDuration - 18), lowerThirdDuration],
    [0, -(width * 0.6)],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const fadeOut = interpolate(
    frame,
    [Math.max(0, lowerThirdDuration - 18), lowerThirdDuration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const lowerX = lowerThirdVisible ? slideIn : slideOut;
  const lowerOpacity = lowerThirdVisible ? fadeIn : fadeOut;

  // "MOMEN VIRAL" stamp — fades in mid-video
  const stampOpacity = interpolate(frame, [durationFrames * 0.4, durationFrames * 0.55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Top accent line */}
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

      {/* Bottom accent line */}
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

      {/* Cinematic vignette */}
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

      {/* Lower third name card — slides in from left */}
      {(speakerName || speakerTitle) && (
        <div
          style={{
            position: 'absolute',
            bottom: 260,
            left: 0,
            translate: `${lowerX}px 0px`,
            opacity: lowerOpacity,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {/* Accent bar */}
          <div
            style={{
              width: 6,
              height: speakerTitle ? 86 : 54,
              backgroundColor: theme.accent,
              position: 'absolute',
              left: 48,
              top: 0,
            }}
          />
          {/* Name block */}
          <div
            style={{
              paddingLeft: 68,
              paddingRight: 32,
            }}
          >
            {speakerName && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 40,
                  fontWeight: 'bold',
                  letterSpacing: 2,
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  paddingTop: 10,
                  paddingBottom: speakerTitle ? 4 : 10,
                  paddingLeft: 16,
                  paddingRight: 24,
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                }}
              >
                {speakerName}
              </div>
            )}
            {speakerTitle && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 28,
                  letterSpacing: 1,
                  color: theme.accent2,
                  textTransform: 'uppercase',
                  backgroundColor: theme.accent,
                  paddingTop: 6,
                  paddingBottom: 6,
                  paddingLeft: 16,
                  paddingRight: 24,
                  display: 'inline-block',
                }}
              >
                {speakerTitle}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
