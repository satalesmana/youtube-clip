import { useVideoConfig } from 'remotion';
import * as React from 'react';
import type { Theme } from './design';
import type { PlanCaption, PlanScene } from './types';
import { HookHeadline } from './HookHeadline';
import { resolveVisualPreset, type VisualPresetId } from './visual-preset/index';

/** Per-scene text: Hook headline during hook scene, clean for other scenes. */
export const SceneText: React.FC<{
  scene: PlanScene;
  theme: Theme;
  labels?: Record<string, string>;
  /** Absolute frame where this scene starts on the output timeline. */
  absoluteStartFrame?: number;
  /** Duration of this scene in frames. */
  durationFrames?: number;
  /** Real word boundaries for the scene's narration (concatenated from captions). */
  wordTimings?: PlanCaption['wordTimings'];
}> = ({ scene, theme, absoluteStartFrame, durationFrames, wordTimings }) => {
  const { fps } = useVideoConfig();

  if (scene.type === 'hook') {
    const visualPreset = resolveVisualPreset({
      manualPreset: scene.visualPreset as VisualPresetId | undefined,
    });

    return (
      <HookHeadline
        text={scene.hookTitle || scene.quotableLine || scene.narration || ''}
        tag={scene.hookTag}
        badgePresetId={scene.hookBadgePresetId}
        badgeColor={scene.hookBadgeColor}
        highlightWords={scene.highlightWords}
        visualPreset={visualPreset}
        theme={theme}
        wordTimings={wordTimings}
        absoluteStartFrame={absoluteStartFrame ?? 0}
        durationFrames={durationFrames ?? Math.max(1, Math.round((scene.end - scene.start) * fps))}
      />
    );
  }

  return null;
};
