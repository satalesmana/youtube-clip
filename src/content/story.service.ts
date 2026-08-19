import { AppError } from '../utils/errors.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { retry } from '../utils/retry.js';
import { hashSeed } from '../utils/seed.js';
import { sourceStorySchema } from '../schemas/story.schema.js';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import type { TranscriptSegment } from '../types/transcript.js';
import type { SourceStory } from '../types/story.js';

export interface StoryServiceOptions { model: string; temperature: number; timeoutMs: number; maxRetries: number; }
export interface IStoryService { buildStory(segments: TranscriptSegment[]): Promise<SourceStory>; }

const SYSTEM = `You are a viral short-form editor (TikTok, YouTube Shorts, Instagram Reels). Your job is to analyze a source video transcript and derive a precise story concept with time-coded beats that HOOK viewers and hold retention — grounded ONLY in what the transcript actually contains.

## Retention Principles

- Hook: the first 1-3 seconds must create curiosity, surprise, or stakes. Identify the single strongest opening cut even if it does not come first chronologically.
- Open loop: each beat should open a question or tension that a later beat answers. Never let a beat just sit there.
- Escalation: tension builds beat over beat toward a payoff — the most surprising/emotional/controversial moment should land where it creates maximum retention.
- Specificity: concrete names, numbers, actions, and quotes beat vague claims every time.
- Cut-ability: a beat is only worth clipping if it has a visible payoff (a result, reaction, or revelation). Mark low-payoff beats with a low engagementScore so the clipper can drop them.

## Concept Detection Map

Choose ONE concept that the source itself supports. Do not force a concept when the source doesn't establish it:

| Signal in source | Concept |
|---|---|
| One person/factor faces a problem, struggles, then achieves a result | character-journey |
| Started behind/failing → overcame adversity → finished better | comeback |
| A strong statement, confession, or realization changes perspective | turning-point |
| Two parties in conflict: claim → response → consequence | claim-consequence |
| An unusual fact or counter-intuitive explanation that challenges common understanding | discovery-explainer |

## Beat Structure

Return 4-7 chronological beats. Each beat MUST include:
- Precise source timestamp range (start/end in seconds, matching the transcript segments)
- 1-2 verbatim evidence excerpts from that range
- A "role" field that describes the narrative function of this beat:
  - "setup" — introduces the situation, context, or characters
  - "tension" — presents the conflict, problem, or obstacle
  - "turningPoint" — the pivotal moment, key evidence, or revelation
  - "resolution" — the outcome, result, or consequence
  - "reflection" — commentary, analysis, or interpretation
  - "conclusion" — closing takeaway or final thought
- A "purpose" describing the beat's role in the story arc AND how it feeds retention (what it opens or what it pays off)
- "engagementScore" (integer 1-10): how compelling this beat is as short-form content. Score by surprise, stakes, emotion, quotability, and visible payoff — NOT by narrative importance alone.
- "quotableLine": the single most caption-worthy verbatim line in this beat (the kind of line a short uses as on-screen text). Empty string ("") when the beat has none.
- "openLoop": the question or tension this beat opens, answered by a later beat — or how it resolves the loop opened by the previous beat.
- "retentionRisk": "high" = the money shot, must keep in the clip; "medium" = keep if length allows; "low" = safe to cut or skip.
- Narrative metadata when the transcript establishes it:
  - kondisiAwal: the state before this beat's events
  - konflik: the conflict, tension, or obstacle
  - titikBalik: the pivotal turning point moment
  - hasil: the result or outcome

The beat sequence must form a complete arc: setup → tension/claim → turning point/evidence → resolution → conclusion.

## Hook Moment

Separately identify the single strongest opening cut in "hookMoment": the exact short range (1-3 seconds) plus a "suggestedLine" — a scroll-stopping on-screen opening line. It is usually the most surprising, emotional, or controversial moment in the transcript, NOT the chronological start. The suggestedLine must be verbatim or a tight paraphrase of the transcript, and must create an immediate question.

## Rules
- Use ONLY facts present in the transcript. Never invent people, numbers, or events.
- Timestamps must be real ranges from the supplied transcript segments.
- Evidence must be verbatim — exact text from the transcript.
- If a narrative field (kondisiAwal, konflik, etc.) is not established by the transcript, omit it.
- engagementScore must reflect real retention value — be honest about boring beats, do not inflate every score to 8+.
- Return JSON only, no explanations.

## Output Format

{"concept":"turning-point","protagonist":"name or subject from transcript","premise":"one-sentence story summary","hookMoment":{"start":12,"end":14,"suggestedLine":"line that makes viewers stop scrolling"},"beats":[{"id":"beat_1","role":"setup","purpose":"introduce the situation","start":0,"end":5,"evidence":["verbatim quote from transcript"],"kondisiAwal":"initial state","engagementScore":5,"quotableLine":"","openLoop":"why does this matter?","retentionRisk":"low"},{"id":"beat_2","role":"tension","purpose":"set up the problem","start":5,"end":12,"evidence":["verbatim quote"],"konflik":"the obstacle or tension","engagementScore":7,"quotableLine":"","openLoop":"what happens next?","retentionRisk":"medium"},{"id":"beat_3","role":"turningPoint","purpose":"present the key evidence","start":12,"end":20,"evidence":["verbatim quote"],"titikBalik":"the turning point","engagementScore":9,"quotableLine":"the caption-worthy line","openLoop":"will it work out?","retentionRisk":"high"},{"id":"beat_4","role":"resolution","purpose":"show the outcome","start":20,"end":28,"evidence":["verbatim quote"],"hasil":"the outcome or result","engagementScore":8,"quotableLine":"","openLoop":"","retentionRisk":"high"},{"id":"beat_5","role":"conclusion","purpose":"land the takeaway","start":28,"end":35,"evidence":["verbatim quote"],"engagementScore":6,"quotableLine":"","openLoop":"","retentionRisk":"medium"}]}`;

export class StoryService implements IStoryService {
  constructor(private readonly provider: IOllamaProvider, private readonly options: StoryServiceOptions, private readonly logger: Logger) {}

  async buildStory(segments: TranscriptSegment[]): Promise<SourceStory> {
    if (segments.length === 0) throw AppError.validation('Cannot build a story from an empty transcript selection.');
    const source = segments.map((s) => `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`).join('\\n');
    return retry(async () => {
      this.logger.info({ segmentCount: segments.length }, 'Building source story');
      const raw = await this.provider.chat({
        model: this.options.model,
        system: SYSTEM,
        prompt: `SOURCE TRANSCRIPT:\\n${source}`,
        temperature: this.options.temperature,
        timeoutMs: this.options.timeoutMs,
        // Deterministic output: same transcript selection → same story beats.
        seed: hashSeed('story', ...segments.map((s) => `${s.start}|${s.end}|${s.text}`)),
      });
      const parsed = parseLlmJson(raw) as Record<string, unknown>;
      // Pre-process: truncate evidence arrays to max 2 items before schema validation
      if (parsed.beats && Array.isArray(parsed.beats)) {
        for (const beat of parsed.beats as Array<Record<string, unknown>>) {
          if (Array.isArray(beat.evidence) && beat.evidence.length > 2) {
            beat.evidence = beat.evidence.slice(0, 2);
          }
        }
      }
      const validated = sourceStorySchema.safeParse(parsed);
      if (!validated.success) throw AppError.llmInvalidResponse(`Story plan is invalid: ${validated.error.message}`);
      // Sort beats chronologically to fix any out-of-order responses from LLM
      validated.data.beats.sort((a, b) => a.start - b.start);
      validateStory(validated.data, segments);
      return validated.data;
    }, { attempts: this.options.maxRetries, onRetry: (err, attempt) => this.logger.warn({ err, attempt }, 'Retrying source story') });
  }
}

function validateStory(story: SourceStory, segments: TranscriptSegment[]): void {
  const transcript = segments.map((s) => normalize(s.text)).join(' ');
  let previous = -1;
  for (const beat of story.beats) {
    if (beat.end <= beat.start || beat.start < previous) throw AppError.llmInvalidResponse('Story beats must be chronological ranges.');
    previous = beat.start;
    if (!beat.evidence.every((quote) => transcript.includes(normalize(quote)))) throw AppError.llmInvalidResponse(`Story beat ${beat.id} has evidence outside the transcript.`);
  }
}
function normalize(value: string): string { return value.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim().replace(/\\s+/g, ' '); }
