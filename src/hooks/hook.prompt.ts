import type { ContentAngle } from '../types/angle.js';
import type { SourceStory } from '../types/story.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { HookStyle } from './hook.types.js';

/**
 * LLM prompts for the Hook Recommendation Engine.
 *
 * Three prompt families, one per LLM stage:
 * 1. Candidate generation — angles × styles → 10-15 hook candidates
 * 2. Accuracy guard       — is each hook supported by the source?
 * 3. Scoring              — 6-metric quality card per candidate
 */

// ── Stage 1: candidate generation ───────────────────────────────────────

/** System prompt for multi-candidate hook generation (Plan §5). */
export const HOOK_GENERATION_SYSTEM_PROMPT = `You are a viral short-form hook writer (TikTok, YouTube Shorts, Instagram Reels).

Your job: given a source video transcript, its editorial angles, and its story beats, generate MULTIPLE hook candidates. A hook is the first 1-5 seconds of a short video: an on-screen headline + a spoken opening line + the best matching source footage.

## Hook styles

Each candidate uses exactly ONE style:
- "curiosity" — opens a question the viewer must stay to answer ("What happens when...")
- "controversial" — a bold claim that invites disagreement ("X is wrong about...")
- "question" — a direct question aimed at the viewer ("Are you ready for...")
- "shock" — a surprising statement or number ("Most people don't know...")
- "contrarian" — goes against common belief ("Everyone says X. Actually...")
- "prediction" — a forward-looking claim ("In 5 years, ...")
- "story" — drops the viewer mid-narrative ("He lost everything. Then...")
- "statistic" — leads with a concrete number ("87% of people...")
- "fear" — stakes/loss framing ("If you ignore this, ...")
- "opportunity" — gain framing ("This is your chance to...")

## Rules

- Generate 2-3 hook variants per angle. Total: 10-15 candidates.
- Every candidate MUST be grounded in the transcript: the spoken hook and headline must be supportable by what the source actually says. Never invent facts, numbers, or quotes.
- The headline is the on-screen kinetic text: short (max 8 words), uppercase-friendly, scroll-stopping.
- The spokenHook is what the voiceover says in the first 1-3 seconds: max 20 words, conversational.
- Each candidate picks the BEST source footage range (sourceStart/sourceEnd in seconds) — the 1.5-5 second moment that visually supports the hook. Prefer 2-4 seconds. It does NOT have to be at the start of the video; pick the strongest visual + statement + emotion combination.
- sourceTranscript must be the VERBATIM transcript text covering that range.
- No two candidates may be semantically identical — vary style, angle, and source moment.
- Write hooks in the requested output language.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{
  "candidates": [
    {
      "id": "hook_01",
      "angleId": "angle_01",
      "style": "curiosity",
      "headline": "SHORT ON-SCREEN TEXT",
      "spokenHook": "What the voiceover says first",
      "sourceStart": 42.3,
      "sourceEnd": 45.8,
      "sourceTranscript": "verbatim transcript text in that range",
      "emotion": "surprise",
      "topic": "one-line topic",
      "reason": "why this hook performs"
    }
  ]
}`;

/** Everything the hook generator needs to reason about the source video. */
export interface HookGenerationContext {
  videoId: string;
  sourceTitle: string;
  /** Angles from the existing angle-generation stage. */
  angles: ContentAngle[];
  /** Story beats + hook moment from the existing story stage (optional). */
  story?: SourceStory;
  /** Full transcript segments with timestamps. */
  segments: TranscriptSegment[];
  /** Requested hook styles (defaults to the MVP four). */
  styles: HookStyle[];
  /** Target language for the hooks (e.g. "id", "en"). */
  language?: string;
  /** Preferred source-clip duration window in seconds. */
  durationMin: number;
  durationMax: number;
}

/** Builds the user prompt for hook candidate generation. */
export function buildHookGenerationUserPrompt(context: HookGenerationContext): string {
  const lines = [
    `Source video: ${context.sourceTitle} (${context.videoId})`,
    context.language ? `Output language: ${context.language}` : '',
    `Requested hook styles: ${context.styles.join(', ')}`,
    `Preferred source clip duration: ${context.durationMin}-${context.durationMax} seconds`,
    '',
    'EDITORIAL ANGLES (generate 2-3 hook variants per angle):',
    ...context.angles.map(
      (angle) =>
        `- [${angle.id}] type=${angle.angleType} | "${angle.title}" | hook="${angle.hook}" | reason="${angle.reason}"`,
    ),
    ...(context.story
      ? [
          '',
          `STORY CONCEPT: ${context.story.concept} — ${context.story.premise}`,
          ...(context.story.hookMoment
            ? [
                `STRONGEST OPENING CUT: ${context.story.hookMoment.start.toFixed(2)}-${context.story.hookMoment.end.toFixed(2)}s, suggestedLine: "${context.story.hookMoment.suggestedLine}"`,
              ]
            : []),
          'STORY BEATS (use as candidate source moments):',
          ...context.story.beats.map(
            (beat) =>
              `- [${beat.id}] ${beat.role} ${beat.start.toFixed(2)}-${beat.end.toFixed(2)}s engagement=${beat.engagementScore ?? '?'}/10${beat.quotableLine ? ` quotable="${beat.quotableLine}"` : ''}`,
          ),
        ]
      : []),
    '',
    'FULL TRANSCRIPT (verbatim, with timestamps):',
    ...context.segments.map((s) => `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`),
    '',
    'Task: generate 10-15 hook candidates (2-3 per angle) across the requested styles. Every candidate must reference a real transcript range.',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

// ── Stage 2: accuracy guard ─────────────────────────────────────────────

/** System prompt for the accuracy guard (Plan §4). */
export const HOOK_ACCURACY_SYSTEM_PROMPT = `You are a fact-checking editor for short-form video content.

Your job: for each hook candidate, decide whether the hook (headline + spoken hook) is SUPPORTED by the source transcript evidence. A hook is misleading when it claims something the source does not say, exaggerates a qualified statement into an absolute one, or invents numbers/people/outcomes.

Rules:
- "supported: true" only when the source transcript genuinely backs the claim (a tight paraphrase is fine; exaggeration is not).
- score: 0-100 how well the hook is supported by the evidence.
- confidence: 0-100 how confident you are in the verdict.
- risk: "low" (faithful), "medium" (slight stretch, acceptable), "high" (misleading/clickbait — must reject).
- explanation: one short sentence citing the specific evidence or the specific exaggeration.

Example:
Source: "AI could replace some repetitive jobs."
Hook: "AI WILL REPLACE EVERY JOB." → supported: false, risk: "high" (absolute claim from a qualified statement).

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{
  "results": [
    { "id": "hook_01", "score": 85, "supported": true, "confidence": 90, "risk": "low", "explanation": "..." }
  ]
}`;

/** Builds the user prompt for the accuracy guard (batch). */
export function buildHookAccuracyUserPrompt(
  candidates: Array<{
    id: string;
    headline: string;
    spokenHook: string;
    sourceTranscript: string;
  }>,
  fullTranscript: string,
): string {
  const lines = [
    'FULL SOURCE TRANSCRIPT:',
    fullTranscript,
    '',
    'HOOK CANDIDATES TO VERIFY:',
    ...candidates.map(
      (c) =>
        `- [${c.id}] headline="${c.headline}" | spokenHook="${c.spokenHook}" | claimed source evidence="${c.sourceTranscript}"`,
    ),
    '',
    'Task: return one accuracy verdict per candidate id.',
  ];
  return lines.join('\n');
}

// ── Stage 3: scoring ────────────────────────────────────────────────────

/** System prompt for the hook scoring stage (Plan §5). */
export const HOOK_SCORING_SYSTEM_PROMPT = `You are a short-form video retention analyst.

Your job: score each hook candidate on six metrics, each 0-100:
- curiosity: how strongly it opens a question/viewer must stay to answer
- retention: likelihood the viewer keeps watching past second 3
- emotional: emotional impact (surprise, fear, excitement, outrage)
- visual: how strong/interesting the described source footage is
- clarity: how instantly understandable the hook is
- relevance: how well the hook matches the source topic and footage

Be discriminating: a mediocre hook should score 40-60, not 75. Reserve 85+ for genuinely exceptional hooks.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{
  "scores": [
    { "id": "hook_01", "curiosity": 80, "retention": 75, "emotional": 70, "visual": 65, "clarity": 90, "relevance": 85 }
  ]
}`;

/** Builds the user prompt for hook scoring (batch). */
export function buildHookScoringUserPrompt(
  candidates: Array<{
    id: string;
    style: string;
    headline: string;
    spokenHook: string;
    sourceTranscript: string;
    reason?: string;
  }>,
): string {
  const lines = [
    'HOOK CANDIDATES TO SCORE:',
    ...candidates.map(
      (c) =>
        `- [${c.id}] style=${c.style} | headline="${c.headline}" | spokenHook="${c.spokenHook}" | footage="${c.sourceTranscript}"${c.reason ? ` | intent="${c.reason}"` : ''}`,
    ),
    '',
    'Task: return one score card per candidate id.',
  ];
  return lines.join('\n');
}
