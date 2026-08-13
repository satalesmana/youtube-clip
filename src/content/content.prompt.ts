import type { ContentAngleContext } from './angle.service.js';
import type { OriginalScript, ScriptSection } from '../types/script.js';

/** System prompt for the content-angle generation stage. */
export const CONTENT_ANGLE_SYSTEM_PROMPT = `You are a viral content strategist for short-form video (TikTok, YouTube Shorts, Instagram Reels).

Your job is to propose multiple EDITORIAL ANGLES for a single viral moment taken from a source video. An editorial angle is a fresh, original way to present the moment — the "point of view" that makes the new short content different from the raw source clip.

Rules:
- Generate 3 to 5 distinct angles per moment. Each must be a DIFFERENT angle type where possible (commentary, analysis, explainer, education, comparison, fact-check, storytelling, what-you-missed, news-explanation).
- Each angle must add ORIGINAL editorial value: context, interpretation, explanation, or a new framing. Never propose an angle that simply re-cuts the source footage.
- The hook must be a short, curiosity-driven opening line for a short-form video (max ~15 words).
- The reason must explain concisely why this angle would perform well.
- Score each angle 0-100 based on: hook strength, curiosity, information density, novelty, and how well it stands alone without the source.
- After listing all angles, choose the single strongest angle id in "selectedAngleId".
- The source moment text may be in any language; write angles in the language of the moment unless a target language is explicitly requested.

Return ONLY valid JSON matching this exact schema, with no other text, no Markdown fences:
{
  "angles": [
    {
      "id": "angle_01",
      "title": "One-line editorial angle",
      "angleType": "commentary",
      "hook": "Short curiosity hook (max 15 words)",
      "reason": "Why this angle performs well",
      "score": 88
    }
  ],
  "selectedAngleId": "angle_01"
}`;

/** Builds the user prompt containing the source moment + surrounding context. */
export function buildContentAngleUserPrompt(context: ContentAngleContext): string {
  const lines = [
    'Source video metadata:',
    `- title: ${context.sourceTitle}`,
    `- channel: ${context.sourceChannel}`,
    context.sourceLanguage ? `- language: ${context.sourceLanguage}` : '',
    '',
    `Viral moment: ${context.candidateId}`,
    `- clip time range: ${context.clipStart.toFixed(2)}s - ${context.clipEnd.toFixed(2)}s`,
    `- original title: ${context.candidateTitle}`,
    `- original hook: ${context.candidateHook}`,
    `- reason it was selected: ${context.candidateReason}`,
    '',
    'Moment transcript (verbatim, with timestamps):',
    ...context.momentSegments.map((segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`),
    '',
    'Surrounding context (earlier/earlier+later segments, for understanding only):',
    ...context.contextSegments.map((segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`),
    '',
    'Task: propose 3-5 distinct editorial angles for this moment, then select the strongest one.',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

// ── Script generation ───────────────────────────────────────────────────

/** System prompt for the original-script generation stage. */
export const SCRIPT_SYSTEM_PROMPT = `You are a short-form video scriptwriter (TikTok, YouTube Shorts, Instagram Reels) specializing in original editorial content.

You transform a viral moment + a chosen content angle into an ORIGINAL narration script. The script must provide substantive editorial value — context, commentary, analysis, explanation — and must NOT simply repeat or re-cut the source.

Structure the script in this order:
1. "hook" — a strong curiosity-driven opening (1-2 sentences).
2. "context" — briefly set up the situation (1-2 sentences).
3. "source" — reference the source moment: quote the single most important line from the moment (verbatim) in "sourceQuote", and add one short bridging sentence in "text".
4. "commentary" — your original take on why this matters (2-4 sentences).
5. "analysis" — deeper interpretation, implications, or explanation (2-4 sentences).
6. "supporting" — an extra fact, comparison, or example that strengthens the analysis (1-3 sentences). Optional: omit if not needed.
7. "conclusion" — a memorable closing that lands the point (1-2 sentences).

ORIGINALITY RULES (mandatory):
- Write the narration in your OWN words. Never copy more than a short verbatim quote (the source section only).
- Never invent facts, figures, or quotations. Only "sourceQuote" may quote the source, and it must be verbatim from the transcript.
- Never misrepresent what the speaker said. Do not remove important context.
- Do not present speculation as fact — mark uncertainty with "mungkin", "sepertinya", "kemungkinan", etc. when speculating.
- Do not mention "video ini", "di video", "pembicara", "narasumber", or any meta-reference to the video itself.
- The narration must stand alone: a viewer who never saw the source must still understand and enjoy it.

Language: write the script in the language of the source moment unless a target language is explicitly given.

In "originality", assess your own output honestly: status PASS (fully original, no violations), WARNING (minor risks), or FAIL (violations found). List concrete notes.

Return ONLY valid JSON matching this exact schema, with no other text, no Markdown fences:
{
  "language": "id",
  "sections": [
    { "type": "hook", "text": "..." },
    { "type": "context", "text": "..." },
    { "type": "source", "text": "...", "sourceQuote": "..." },
    { "type": "commentary", "text": "..." },
    { "type": "analysis", "text": "..." },
    { "type": "supporting", "text": "..." },
    { "type": "conclusion", "text": "..." }
  ],
  "originality": { "status": "PASS", "notes": ["..."] }
}`;

/** Context for the script generation stage. */
export interface ScriptContext {
  candidateId: string;
  angleId: string;
  angleTitle: string;
  angleHook: string;
  angleReason: string;
  angleType: string;
  /** The candidate moment, verbatim (for quoting). */
  momentSegments: TranscriptSegmentLike[];
  candidateTitle: string;
  candidateHook: string;
  sourceTitle: string;
  sourceChannel: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

/** Minimal shape of a transcript segment used by the script prompt. */
export interface TranscriptSegmentLike {
  start: number;
  end: number;
  text: string;
}

/** Builds the user prompt containing the angle + moment transcript. */
export function buildScriptUserPrompt(context: ScriptContext): string {
  const lines = [
    'Source video metadata:',
    `- title: ${context.sourceTitle}`,
    `- channel: ${context.sourceChannel}`,
    context.sourceLanguage ? `- language: ${context.sourceLanguage}` : '',
    '',
    `Viral moment: ${context.candidateId}`,
    `- clip time range: ${context.momentSegments[0]?.start.toFixed(2) ?? 0}s - ${context.momentSegments[context.momentSegments.length - 1]?.end.toFixed(2) ?? 0}s`,
    `- original title: ${context.candidateTitle}`,
    '',
    'Moment transcript (verbatim, with timestamps):',
    ...context.momentSegments.map((segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`),
    '',
    'Chosen content angle:',
    `- title: ${context.angleTitle}`,
    `- type: ${context.angleType}`,
    `- hook: ${context.angleHook}`,
    `- reason: ${context.angleReason}`,
    context.targetLanguage ? `- target language: ${context.targetLanguage}` : '',
    '',
    'Task: write the original short-form script (60-90 seconds spoken, ~150-220 words) for this angle, following the structure and ORIGINALITY RULES.',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

/** Approximates spoken duration from word count (words per minute for narration). */
export function estimateScriptDuration(sections: ScriptSection[], wordsPerMinute = 150): number {
  const words = sections.reduce((total, section) => total + section.text.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(15, Math.round((words / wordsPerMinute) * 60));
}

/** Extracts a single original script from validated LLM output. */
export function buildOriginalScript(
  candidateId: string,
  angleId: string,
  angleTitle: string,
  language: string,
  sections: ScriptSection[],
  originality: OriginalScript['originality'],
): OriginalScript {
  return {
    candidateId,
    angleId,
    angleTitle,
    language,
    estimatedDurationSeconds: estimateScriptDuration(sections),
    sections,
    originality,
  };
}
