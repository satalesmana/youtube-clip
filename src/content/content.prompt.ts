import type { ContentAngleContext } from './angle.service.js';
import type { OriginalScript, ScriptSection } from '../types/script.js';
import type { SourceStory } from '../types/story.js';
import type { ContentGenre } from '../types/genre.js';
import { getGenrePreset } from '../types/genre.js';


/** Builds the genre guidance block injected into the angle system prompt. */
function buildAngleGenreGuidance(genre: ContentGenre): string {
  const preset = getGenrePreset(genre);
  if (!preset) return '';
  const topAngles = preset.preferredAngleTypes.slice(0, 3).join(', ');
  return [
    '',
    `## Genre Context: ${preset.label}`,
    `The source video belongs to the "${genre}" genre. Apply the following biases:`,
    `- Preferred angle types (try to include at least one): ${topAngles}`,
    `- Tone: ${preset.toneDescription}`,
    `- This audience expects ${preset.narrativePacing === 'fast' ? 'fast, punchy content — skip lengthy analysis' : preset.narrativePacing === 'reflective' ? 'thoughtful, insight-rich content — deeper analysis is welcome' : 'balanced content with a clear hook and concise analysis'}.`,
    `You may still use other angle types when the moment clearly calls for them.`,
  ].join('\n');
}

/**
 * Builds the system prompt for the content-angle generation stage.
 * When a genre is supplied, a guidance block is injected that biases the LLM
 * toward angle types and tone that work best for that genre.
 */
export function buildContentAngleSystemPrompt(genre?: ContentGenre): string {
  const base = `You are a viral content strategist for short-form video (TikTok, YouTube Shorts, Instagram Reels).

Your job is to propose multiple EDITORIAL ANGLES for a single viral moment taken from a source video. An editorial angle is a fresh, original way to present the moment — the "point of view" that makes the new short content different from the raw source clip.

Rules:
- Generate 3 to 5 distinct angles per moment. Each must be a DIFFERENT angle type — no two angles may share the same angleType. Use types from: commentary, analysis, explainer, education, comparison, fact-check, storytelling, what-you-missed, news-explanation.
- Each angle must add ORIGINAL editorial value: context, interpretation, explanation, or a new framing. Never propose an angle that simply re-cuts the source footage.
- The hook must be a short, curiosity-driven on-screen opening line for a short-form video (max 8 words). Favor concrete specifics over vague teases — a good hook names a real person, number, or claim.
- The reason must explain concisely why this angle would perform well.
- Score each angle 0-100 using these three weighted criteria:
  - Hook strength (50%): does the hook stop a scroll and create an immediate question?
  - Curiosity and information density (30%): does the angle reveal something the viewer did not know?
  - Standalone value (20%): can a viewer who has not seen the source still understand and enjoy it?
- After listing all angles, choose the single strongest angle id in "selectedAngleId".
- The source moment text may be in any language; write angles in the language of the moment unless a target language is explicitly requested.

Return ONLY valid JSON matching this exact schema, with no other text, no Markdown fences:
{
  "angles": [
    {
      "id": "angle_01",
      "title": "One-line editorial angle",
      "angleType": "commentary",
      "hook": "Max 8-word on-screen hook",
      "reason": "Why this angle performs well",
      "score": 88
    }
  ],
  "selectedAngleId": "angle_01"
}`;
  return genre ? base + buildAngleGenreGuidance(genre) : base;
}

/**
 * Backward-compatible alias: the static system prompt used when no genre is
 * available. New code should use `buildContentAngleSystemPrompt(genre)`.
 * @deprecated Use `buildContentAngleSystemPrompt(genre?)` instead.
 */
export const CONTENT_ANGLE_SYSTEM_PROMPT = buildContentAngleSystemPrompt();

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
    ...(context.selectedClips && context.selectedClips.length > 1
      ? [
          '',
          `User Selected Multi-Clip Sequence (${context.selectedClips.length} clips):`,
          ...context.selectedClips.map((c, i) => `Clip ${i + 1}: [${c.start.toFixed(2)}s -> ${c.end.toFixed(2)}s] ${c.title ? `("${c.title}")` : ''}`),
          'Propose editorial angles that unify these selected clips into a single coherent narrative arc.',
        ]
      : []),
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

/** Builds the genre-specific pacing block appended to the script system prompt. */
function buildScriptGenreGuidance(genre: ContentGenre): string {
  const preset = getGenrePreset(genre);
  if (!preset) return '';
  const { narrativePacing, toneDescription, beatCountRange, label } = preset;

  const pacingInstruction =
    narrativePacing === 'fast'
      ? 'Keep the script tight and punchy. The "analysis" and "reflection" sections should be brief (1-2 sentences max) or omitted entirely when beats do not justify them. Every word must earn its place — no padding.'
      : narrativePacing === 'reflective'
      ? 'Deeper "analysis" and "supporting" sections are expected and welcome — the audience wants to understand the "why". Aim for 2-4 sentences per analytical section when evidence supports it.'
      : 'Maintain a clear, balanced structure. "analysis" sections should be concise but substantive — 2-3 sentences each.';

  return [
    '',
    `## Genre Context: ${label}`,
    `This script is for a "${genre}" genre video. Adjust accordingly:`,
    `- Pacing: ${pacingInstruction}`,
    `- Tone: ${toneDescription}`,
    `- Preferred beat count: ${beatCountRange.min}–${beatCountRange.max} story beats. Match the script section count to this range.`,
    `Override these biases only when the transcript content genuinely calls for a different treatment.`,
  ].join('\n');
}

/**
 * Builds the system prompt for the original-script generation stage.
 * @param targetSeconds Target video duration in seconds (default 60).
 *   Injected so the LLM never writes more narration than the video can hold.
 * @param genre Optional content genre — when supplied, injects genre-specific
 *   pacing and tone guidance that shapes how sections are weighted.
 */
export function buildScriptSystemPrompt(targetSeconds = 60, genre?: ContentGenre): string {
  const targetWords = Math.round((targetSeconds / 60) * 150);
  const base = `You are a short-form video scriptwriter (TikTok, YouTube Shorts, Instagram Reels) specializing in original editorial content.

You transform a viral moment + a chosen content angle into an ORIGINAL narration script. The script must provide substantive editorial value — context, commentary, analysis, explanation — and must NOT simply repeat or re-cut the source.

Target narration length: approximately ${targetSeconds} seconds at 150 words per minute (~${targetWords} words total). Write only as much as the available facts support — never pad with generic commentary to reach the target.

Structure the script in this order:
1. "hook" — a strong curiosity-driven opening (1-2 sentences). When the story supplies a HOOK MOMENT or quotable lines, build the hook from them: open on the most surprising/emotional/controversial detail, not on the beginning of the chronology. Keep the hook tight enough to read within the first 2-3 seconds of the video. If a MANDATORY HOOK is supplied in the input, use that text as the opening hook: if its language matches the target script language, use it verbatim; if its language differs from the target language (e.g. English hook with Indonesian target language), translate/adapt it naturally into the target language so the voiceover narration and subtitles flow seamlessly in one unified language. Write the rest of the script so it flows naturally from that opening.
2. "context" — briefly set up the situation (1-2 sentences).
3. "source" — reference the source moment: quote the single most important line from the moment verbatim in "sourceQuote" AND include that same quote naturally in "text" with one short bridging sentence. The "text" field is what the TTS reads.
4. "commentary" — your original take on why this matters (2-4 sentences).
5. "analysis" — deeper interpretation, implications, or explanation (2-4 sentences).
6. "supporting" — an extra fact, comparison, or example that strengthens the analysis (1-3 sentences). OPTIONAL: omit this section entirely (do not include the key at all) when the available transcript evidence does not support an additional point.
7. "conclusion" — a memorable closing that lands the point (1-2 sentences). For maximum short-form retention, construct the final sentence so it functions as a seamless loop that grammatically and thematically flows directly back into the opening hook line when the video replays.

ORIGINALITY RULES (mandatory):
- Write the narration in your OWN words. Never copy more than a short verbatim quote (the source section only).
- Never invent facts, figures, or quotations. Only "sourceQuote" may quote the source, and it must be verbatim from the transcript.
- Be SPECIFIC: name the people, actions, claims, sequence, numbers, and constraints actually present in the supplied transcript. Do not substitute vague or filler phrases unless you first identify the concrete transcript detail they refer to.
- Every factual/editorial section (context, source, commentary, analysis, and supporting when present) MUST include an "evidence" array containing 1-2 short verbatim excerpts copied exactly from the supplied transcript. Evidence is internal grounding metadata: do not read it out in "text" unless it is the "sourceQuote".
- Any interpretation must explicitly connect to its evidence (for example: "When X said Y, this shows ..."). If the transcript does not establish a fact, omit it rather than guessing.
- When STORY BEATS are supplied, write one section for each beat in chronological order and include its id in "beatId". Do not invent an extra event.
- Never misrepresent what the speaker said. Do not remove important context.
- Do not present speculation as fact — mark uncertainty with "maybe", "possibly", "likely" when speculating.
- Do not mention the video itself ("in this video", "the speaker says", "the narrator") — the narration must read as original editorial content.
- The narration must stand alone: a viewer who never saw the source must still understand and enjoy it.

Language: write the script in the language of the source moment unless a target language is explicitly given. Write ALL field names, keys, and JSON structure in English regardless of content language.

In "originality", assess your own output honestly: status PASS (fully original, no violations), WARNING (minor risks), or FAIL (violations found). List concrete notes.

Return ONLY valid JSON matching this exact schema, with no other text, no Markdown fences:
{
  "language": "id",
  "sections": [
    { "type": "hook", "beatId": "beat_1", "text": "..." },
    { "type": "context", "text": "...", "evidence": ["verbatim transcript excerpt"] },
    { "type": "source", "text": "...", "sourceQuote": "...", "evidence": ["verbatim transcript excerpt"] },
    { "type": "commentary", "text": "...", "evidence": ["verbatim transcript excerpt"] },
    { "type": "analysis", "text": "...", "evidence": ["verbatim transcript excerpt"] },
    { "type": "conclusion", "text": "..." }
  ],
  "originality": { "status": "PASS", "notes": ["..."] }
}`;
  return genre ? base + buildScriptGenreGuidance(genre) : base;
}


/** Context for the script generation stage. */
export interface ScriptContext {
  candidateId: string;
  angleId: string;
  angleTitle: string;
  angleHook: string;
  angleReason: string;
  angleType: string;
  /**
   * Hook text explicitly chosen by the user (from the hook recommendation).
   * When set, the "hook" section MUST use this text verbatim — the LLM must
   * not write a new hook. Optional: absent when no hook was selected.
   */
  fixedHook?: string;
  /** Target video duration in seconds. Injected into the system prompt to cap script length. Defaults to 60. */
  targetDurationSeconds?: number;
  /** The candidate moment, verbatim (for quoting). */
  momentSegments: TranscriptSegmentLike[];
  /** Nearby segments, supplied only to resolve references and chronology. */
  contextSegments?: TranscriptSegmentLike[];
  /** Source-grounded story beats that determine the visual timeline. */
  story?: SourceStory;
  candidateTitle: string;
  candidateHook: string;
  sourceTitle: string;
  sourceChannel: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  /** Optional content genre — when supplied, conditions pacing and tone in the system prompt. */
  genre?: ContentGenre;
  /** Optional user-selected multi-clip sequence. */
  selectedClips?: Array<{ start: number; end: number; title?: string }>;
}

/** Minimal shape of a transcript segment used by the script prompt. */
export interface TranscriptSegmentLike {
  start: number;
  end: number;
  text: string;
}

/** Builds the user prompt containing the angle + moment transcript. */
export function buildScriptUserPrompt(context: ScriptContext): string {
  const isCrossLingual = Boolean(
    context.targetLanguage &&
    context.sourceLanguage &&
    context.targetLanguage.toLowerCase() !== context.sourceLanguage.toLowerCase(),
  );

  const lines = [
    ...(context.targetLanguage
      ? [
          `=========================================`,
          `CRITICAL REQUIREMENT - TARGET LANGUAGE: ${context.targetLanguage.toUpperCase()}`,
          `You MUST write the ENTIRE script narration in ${context.targetLanguage === 'id' ? 'INDONESIAN (Bahasa Indonesia)' : context.targetLanguage}. Every single section (hook, context, source, commentary, analysis, conclusion) must be spoken in ${context.targetLanguage === 'id' ? 'Bahasa Indonesia' : context.targetLanguage}.`,
          `=========================================`,
          '',
        ]
      : []),
    'Source video metadata:',
    `- title: ${context.sourceTitle}`,
    `- channel: ${context.sourceChannel}`,
    context.sourceLanguage ? `- source language: ${context.sourceLanguage}` : '',
    '',
    `Viral moment: ${context.candidateId}`,
    `- clip time range: ${context.momentSegments[0]?.start.toFixed(2) ?? 0}s - ${context.momentSegments[context.momentSegments.length - 1]?.end.toFixed(2) ?? 0}s`,
    `- original title: ${context.candidateTitle}`,
    ...(context.selectedClips && context.selectedClips.length > 1
      ? [
          '',
          `User Selected Multi-Clip Sequence (${context.selectedClips.length} clips):`,
          ...context.selectedClips.map((c, i) => `Clip ${i + 1}: [${c.start.toFixed(2)}s -> ${c.end.toFixed(2)}s] ${c.title ? `("${c.title}")` : ''}`),
          'Write a continuous voiceover narration that bridges these selected moments chronologically, creating smooth narrative transitions between them.',
        ]
      : []),
    '',
    'Moment transcript (verbatim, with timestamps):',
    ...context.momentSegments.map((segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`),
    ...(context.contextSegments?.length
      ? [
          'Nearby transcript context (use only when it clarifies the moment):',
          ...context.contextSegments.map((segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`),
        ]
      : []),
    ...(context.story
      ? [
          '',
          `Selected source-story concept: ${context.story.concept}`,
          `Protagonist/subject: ${context.story.protagonist}`,
          `Story premise: ${context.story.premise}`,
          ...(context.story.hookMoment
            ? [
                `HOOK MOMENT — open the video here: ${context.story.hookMoment.start.toFixed(2)}s-${context.story.hookMoment.end.toFixed(2)}s; suggestedLine: "${context.story.hookMoment.suggestedLine}"`,
              ]
            : []),
          'STORY BEATS — preserve order and use every beat id:',
          ...context.story.beats.map((beat) => {
            const parts = [
              `[${beat.id}] role=${beat.role}`,
              `${beat.start.toFixed(2)}-${beat.end.toFixed(2)}s`,
              beat.purpose,
              beat.engagementScore != null ? `engagement=${beat.engagementScore}/10` : '',
              beat.retentionRisk ? `retention=${beat.retentionRisk}` : '',
              beat.openLoop ? `openLoop="${beat.openLoop}"` : '',
              beat.quotableLine ? `quotable="${beat.quotableLine}"` : '',
              `evidence: ${beat.evidence.map((quote) => `"${quote}"`).join(' | ')}`,
            ].filter((part) => part !== '');
            return parts.join('; ');
          }),
        ]
      : []),
    '',
    'Chosen content angle:',
    `- title: ${context.angleTitle}`,
    `- type: ${context.angleType}`,
    `- hook: ${context.angleHook}`,
    `- reason: ${context.angleReason}`,
    context.targetLanguage ? `- target language: ${context.targetLanguage}` : '',
    ...(context.fixedHook?.trim()
      ? [
          '',
          isCrossLingual
            ? `USER-SELECTED HOOK (Translate & adapt to ${context.targetLanguage === 'id' ? 'Bahasa Indonesia' : context.targetLanguage}):`
            : 'MANDATORY HOOK (user-selected):',
          isCrossLingual
            ? `Translate and adapt this hook naturally into ${context.targetLanguage === 'id' ? 'Bahasa Indonesia' : context.targetLanguage} as the opening hook section text so all voiceover narration flows seamlessly in ${context.targetLanguage === 'id' ? 'Bahasa Indonesia' : context.targetLanguage}: "${context.fixedHook.trim()}"`
            : `The "hook" section MUST be exactly this text, verbatim — do not paraphrase, translate, shorten, or rewrite it: "${context.fixedHook.trim()}"`,
        ]
      : []),
    '',
    `Task: write a concise original short-form script in ${context.targetLanguage === 'id' ? 'Bahasa Indonesia' : context.targetLanguage ?? 'the requested language'} grounded in this material. Use only as much duration as the available facts support; never pad it with generic motivational commentary. Follow the structure and ORIGINALITY RULES.`,
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
