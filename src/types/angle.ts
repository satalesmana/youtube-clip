/** Content angle types for the AI Viral Content Transformer pipeline. */

/** The kind of editorial angle an LLM can propose for a source moment. */
export type AngleType =
  | 'commentary'
  | 'analysis'
  | 'explainer'
  | 'education'
  | 'comparison'
  | 'fact-check'
  | 'storytelling'
  | 'what-you-missed'
  | 'news-explanation';

/** A single candidate content angle derived from one viral moment. */
export interface ContentAngle {
  id: string;
  /** One-line editorial angle (e.g. "Why AI won't simply replace developers"). */
  title: string;
  angleType: AngleType;
  /** A short, curiosity-driven hook for a short-form video opening. */
  hook: string;
  /** Why this angle is strong / what makes it viral-worthy. */
  reason: string;
  /** 0-100 estimated viral potential of this angle. */
  score: number;
}

/** Full result of the angle-generation stage for one candidate moment. */
export interface AngleGenerationResult {
  candidateId: string;
  angles: ContentAngle[];
  /** The id of the strongest angle, chosen by the LLM itself. */
  selectedAngleId: string;
}
