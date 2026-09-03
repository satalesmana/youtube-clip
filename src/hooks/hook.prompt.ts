import type { ContentAngle } from '../types/angle.js';
import type { SourceStory } from '../types/story.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { HookStyle } from './hook.types.js';
import type { ContentGenre } from '../types/genre.js';
import { getGenrePreset } from '../types/genre.js';

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
export const HOOK_GENERATION_SYSTEM_PROMPT = `You are a world-class viral short-form hook copywriter (TikTok, YouTube Shorts, Instagram Reels) specialized in maximum retention and pattern interrupts across ANY video genre (podcasts, tutorials, gaming, tech, finance, lifestyle, news, sports, entertainment, comedy, etc.).

Your job: given a source video transcript, its editorial angles, and its story beats, generate MULTIPLE hook candidates. A hook is the first 1-5 seconds of a short video: an on-screen headline + a spoken opening line + the best matching source footage.

## Hook Styles

Each candidate uses exactly ONE style tailored to the context of the video:
- "curiosity" — opens an irresistible curiosity gap ("The real reason why...", "What actually happened when...")
- "controversial" — a bold, polarizing statement that triggers instant reaction ("Most people get this completely wrong about...")
- "question" — a direct, high-stakes question aimed at the viewer ("Are you making this mistake?")
- "shock" — a surprising statement, unbelievable result, or extreme number ("This outcome was completely unexpected...")
- "contrarian" — goes against common belief ("Everyone thinks X, but the truth is...")
- "prediction" — a bold forward-looking claim ("This changes everything about...")
- "story" — drops the viewer in the middle of peak drama/action ("The exact moment everything changed...")
- "statistic" — leads with a concrete number, ranking, metric, or timeframe ("In just 3 seconds, everything shifted...")
- "fear" — high stakes/loss framing ("Do not make this mistake before it's too late...")
- "opportunity" — massive gain/exclusive reveal framing ("The single most effective way to...")

## STRICT COPYWRITING RULES (DO NOT BREAK)

1. **INCLUDE REAL SUBJECTS/NAMES FROM THE TRANSCRIPT**:
   - Feel free and encouraged to use the real names of people, tools, products, games, or topics mentioned in the transcript to make the hook specific, relatable, and authentic.
   - Always formulate the headline as an active, high-tension hook statement or curiosity gap (e.g. combining the subject with the action, conflict, or surprising outcome).
2. **HEADLINE MUST BE PUNCHY & HIGH-TENSION**:
   - 4 to 8 words maximum, uppercase-friendly, instant scroll-stopper.
   - Combine the subject/topic with high-impact power words suited to the context (e.g. RAHASIA, TERUNGKAP, DETIK-DETIK, JANGAN KAGET, TERNYATA, TERBAIK, TERCEPAT, MUSTAHIL).
3. **TAG BADGE**:
   - Provide a short 2-3 word pattern-interrupt pill tag with relevant emoji matching the moment (e.g. "🔥 MOMEN VIRAL", "⚡ DETIK KRUSIAL", "👀 JANGAN DI-SKIP", "💡 TIPS PENTING", "😱 TIDAK DISANGKA", "🏆 FAKTA MENGEJUTKAN").
4. **HIGHLIGHT WORDS**:
   - Pick 1-2 most emotional/impactful words from the headline to be highlighted in bright accent color.
5. **SPOKEN HOOK**:
   - What the voiceover or opening says: 1-2 punchy sentences, max 20 words, conversational, keeping the curiosity loop open.
6. **SOURCE FOOTAGE SELECTION**:
   - Pick the BEST visual + emotional footage range (sourceStart and sourceEnd in seconds) from the transcript.
   - Must fall within the preferred duration window.
   - sourceTranscript must be the VERBATIM transcript text in that range.
7. **LANGUAGE**:
   - Write hooks in the requested output language.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{
  "candidates": [
    {
      "id": "hook_01",
      "angleId": "angle_01",
      "style": "curiosity",
      "headline": "DETIK-DETIK KEJADIAN TAK TERDUGA!",
      "tag": "⚡ DETIK KRUSIAL",
      "highlightWords": ["TAK TERDUGA"],
      "spokenHook": "Banyak yang tidak menyangka hal mengejutkan ini bisa terjadi!",
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
  /** Optional content genre — biases preferred hook styles in the user prompt. */
  genre?: ContentGenre;
  /** Optional custom creator instruction / tone direction. */
  customPrompt?: string;
}

/** Builds the user prompt for hook candidate generation. */
export function buildHookGenerationUserPrompt(context: HookGenerationContext): string {
  // Build optional genre guidance line that biases hook style selection.
  const genrePreset = context.genre ? getGenrePreset(context.genre) : undefined;
  const genreHint = genrePreset
    ? `GENRE: ${genrePreset.label} — prioritise these hook styles for this audience: ${genrePreset.hookStyleHints.slice(0, 4).join(', ')}. Tone: ${genrePreset.toneDescription}`
    : '';

  const lines = [
    `Source video: ${context.sourceTitle} (${context.videoId})`,
    context.language ? `Output language: ${context.language}` : '',
    `Requested hook styles: ${context.styles.join(', ')}`,
    `Preferred source clip duration: ${context.durationMin}-${context.durationMax} seconds`,
    genreHint,
    context.customPrompt ? `CREATOR DIRECTION / TONE: ${context.customPrompt}` : '',
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
- score: 0-100 how well the hook is supported by the evidence. When supported is false, score MUST be below 50.
- confidence: 0-100 how confident you are in the verdict.
- risk: "low" (faithful), "medium" (slight stretch, acceptable), "high" (misleading/clickbait — must reject).
- explanation: one short sentence citing the specific evidence or the specific exaggeration.

Example:
Source: "AI could replace some repetitive jobs."
Hook: "AI WILL REPLACE EVERY JOB." → supported: false, score: 15, risk: "high" (absolute claim from a qualified statement).

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
- curiosity: how strongly it opens a question the viewer must stay to answer
- retention: likelihood the viewer keeps watching past second 3
- emotional: emotional impact (surprise, fear, excitement, outrage)
- visual: how vividly the transcript text evokes a watchable or emotionally resonant moment — score high when the source words describe a concrete scene, action, or reaction that translates well on screen
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
