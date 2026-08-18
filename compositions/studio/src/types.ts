/** Shared prop types for all Remotion compositions. Mirrors server VideoPlan. */

export type PlanScene = {
  type: string;
  start: number;
  end: number;
  narration: string;
  source?: { start: number; end: number };
  visual?: string;
};

export type PlanCaption = {
  start: number;
  end: number;
  text: string;
  highlightWords?: string[];
};

export type CompositionPlan = {
  candidateId: string;
  angleId: string;
  duration: number;
  scenes: PlanScene[];
  captions: PlanCaption[];
  audio: {
    narration?: string;
    sourceUnderlay: boolean;
    ducking: boolean;
  };
};

export type CompositionProps = {
  plan: CompositionPlan;
  narrationPath: string;
  sourceVideoPath: string;
  channelName?: string;
};
