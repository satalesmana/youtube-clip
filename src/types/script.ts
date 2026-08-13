/** Script types for the AI Viral Content Transformer pipeline. */

/** Editorial sections of an original short-form script. */
export type ScriptSectionType =
  | 'hook'
  | 'context'
  | 'source'
  | 'commentary'
  | 'analysis'
  | 'supporting'
  | 'conclusion';

/** One section of the original script. */
export interface ScriptSection {
  type: ScriptSectionType;
  /** Narration text for this section (original words, not copied from source). */
  text: string;
  /** Optional: the quoted source statement this section references (source section only). */
  sourceQuote?: string;
}

/** Result of the originality self-check embedded in the script generation. */
export interface ScriptOriginality {
  status: 'PASS' | 'WARNING' | 'FAIL';
  notes: string[];
}

/** The complete original script for one content angle of a candidate moment. */
export interface OriginalScript {
  candidateId: string;
  angleId: string;
  angleTitle: string;
  /** Language the script is written in (e.g. "id", "en"). */
  language: string;
  /** Estimated spoken duration in seconds (sum of narration words / speaking rate). */
  estimatedDurationSeconds: number;
  sections: ScriptSection[];
  originality: ScriptOriginality;
}
