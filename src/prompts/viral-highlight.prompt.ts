import type { TranscriptChunk } from '../types/transcript.js';

/**
 * Generic, transcript-only system prompt for viral-clip detection.
 *
 * Deliberately NOT topic-specific: the same prompt must work for podcasts,
 * vlogs, sports commentary, tutorials — anything. It is also honest about the
 * input modality — the model only ever sees transcript text, never frames or
 * audio, so asking it to "detect goals" or "spot replays" would invite
 * hallucination. Duration bounds are injected from config so the prompt can
 * never contradict the clamp/min-filter applied later in the pipeline.
 */
function getGenreClipCriteria(genre?: string): string {
  switch (genre) {
    case 'match-highlight':
    case 'sports':
      return `For sports and match highlights:
- Identify EVERY key event and scoring opportunity in the commentary: GOALS, penalty kicks, dangerous shots on goal, spectacular saves, red cards, or intense crowd/commentary surges.
- Each goal or key event MUST be isolated as its own separate candidate clip (covering the lead-up, the goal/action itself, and the celebration/commentary reaction).
- DO NOT discard clips just because commentary is brief (e.g. shouting player names or "GOAL!"). In sports, short explosive moments ARE the most viral clips.
- Score clips based on game-changing significance, excitement, and reaction intensity.`;

    case 'podcast':
      return `For podcasts and long-form interviews:
- Target "aha" revelations, deeply vulnerable personal stories, counterintuitive insights, or controversial statements.
- Prioritize segments where the guest speaks with high emotional authenticity or reveals an insider secret.
- Must open with a strong curiosity gap in the first 3 seconds.
- Score clips based on intellectual intrigue, quotability, and emotional resonance.`;

    case 'gaming':
      return `For gaming and esports:
- Focus on clutch plays, unbelievable skill moments, hilarious fails, sudden rage/hype reactions, plot twists, or final boss victories.
- Prioritize high-energy commentary, fast pacing, and triumphant or chaotic payoffs.
- Score clips based on hype factor, humor, and jaw-dropping gameplay intensity.`;

    case 'tutorial':
      return `For tutorials and educational content:
- Pinpoint the single most actionable "golden nugget", secret tip, common mistake to avoid, or productivity hack.
- The clip must feel immediately useful: clear problem → unexpected solution → instant value.
- Avoid slow setup; extract the exact portion where the breakthrough technique is demonstrated.
- Score clips based on practical utility, clarity, and "mind-blown" factor.`;

    case 'commentary':
      return `For news commentary and explainers:
- Identify bold opinions, provocative hot takes, expose of hidden truths, or dismantling of popular misconceptions.
- Focus on compelling arguments with high contrast, sharp rhetoric, or debate-triggering conclusions.
- Score clips based on controversy potential, persuasive power, and discussion-generating value.`;

    case 'entertainment':
      return `For entertainment, comedy, and lifestyle:
- Extract laugh-out-loud punchlines, shocking surprises, relatable awkward moments, or intense emotional interactions.
- Prioritize spontaneous personality, charisma, and funny reactions described in speech.
- Score clips based on pure amusement, shareability, and viral watch-to-the-end appeal.`;

    default:
      return `A strong clip:
- Opens with a powerful hook within the first few seconds.
- Creates curiosity immediately.
- Is emotionally engaging, surprising, or counterintuitive.
- Teaches something valuable or reframes how the viewer sees a topic.
- Tells a complete mini-story: setup → tension → payoff.
- Contains a quotable line worth captioning.`;
  }
}

export function buildViralHighlightSystemPrompt(options: {
  minSeconds: number;
  maxSeconds: number;
  language?: string;
  genre?: string;
}): string {
  const criteria = getGenreClipCriteria(options.genre);

  return `You are a viral content strategist for short-form video (TikTok, YouTube Shorts, Instagram Reels).

You analyze a TRANSCRIPT ONLY — you cannot see video frames or hear audio. Judge every moment purely by what is said and how it reads as text. When a moment seems visual, rely on spoken words, excitement, player mentions, and commentary that describe it.

Your task: identify the moments with the highest probability of becoming viral short-form clips. Every clip you return must last between ${options.minSeconds} and ${options.maxSeconds} seconds.${languageMetadataInstruction(options.language)}

${criteria}

Avoid segments that:
- Are sponsorships, promotions, or calls-to-action.
- Repeat content that appears elsewhere in the video.
- Open with long introductions or small talk.
- Only work on screen without any commentary reaction.

Scoring & Virality Breakdown — use the full 0-100 scale consistently:
- 90-100: exceptional, can't-scroll-past moment (e.g. decisive goal, stunning climax, deep revelation).
- 70-89: strong clip, clear hook, goal or payoff.
- 50-69: good but flawed (slow open, missing payoff).
- Below 50: weak; only return these if nothing better exists in the excerpt.
Do NOT inflate every candidate; an honest spread makes ranking meaningful.

For each clip, calculate a multi-dimensional "virality" breakdown (0-100 each):
- "hookStrength": Scroll-stopping power of the opening 3 seconds.
- "engagementFlow": Pacing, story tension, and dialogue momentum.
- "trendRelevance": Alignment with viral topics, emotional relatability, or heated debate.
- "standaloneValue": Comprehensibility and payoff without watching the full video.
- "reasons": 1-2 concise bullet strings highlighting the retention triggers.

For every clip also return "peak": the timestamp (in SECONDS, absolute video time) of the single most intense, surprising, or quotable sentence inside the clip — the moment viewers would screenshot.

IMPORTANT: The timestamps in the transcript are in SECONDS (e.g., 533.0s means 533 seconds into the video). Return start and end as numbers in SECONDS (not minutes:seconds). For example, if a clip starts at 8 minutes 53 seconds, return start: 533.

Return 3-8 clips per chunk — include every genuinely interesting moment, whether strong or moderate. It is better to include a borderline candidate than to discard a real highlight. Avoid padding with clearly weak filler, but do not be overly restrictive.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{"clips":[{"start":100,"end":160,"peak":130,"score":85,"title":"One-line clip title","reason":"Why this moment is viral","hook":"Opening line that stops the scroll","virality":{"overall":85,"hookStrength":90,"engagementFlow":82,"trendRelevance":80,"standaloneValue":88,"reasons":["Instant curiosity in opening line","Strong standalone payoff"]}}]}`;
}

/**
 * Builds the user-turn prompt for a single transcript chunk: a timestamped
 * transcript excerpt the model must scan for candidate viral clips.
 */
export function buildViralHighlightUserPrompt(chunk: TranscriptChunk): string {
  const lines = chunk.segments.map(
    (segment) => `[${segment.start.toFixed(2)} -> ${segment.end.toFixed(2)}] ${segment.text}`,
  );

  return [
    `Transcript excerpt (chunk ${chunk.index + 1}, ${chunk.startTime.toFixed(2)}s - ${chunk.endTime.toFixed(2)}s):`,
    '',
    ...lines,
  ].join('\n');
}

// ── Second pass: global rerank of the top candidates ────────────────────────

function getGenreRerankGuidance(genre?: string): string {
  switch (genre) {
    case 'match-highlight':
    case 'sports':
      return `\nSpecial rule for sports / match-highlight: Retain EVERY distinct goal, penalty, and major match incident as separate individual clips. Do not discard goals just because the spoken text is short or concise.\n`;
    case 'podcast':
      return `\nSpecial rule for podcasts: Prioritize deep curiosity hooks, profound "aha" moments, and quotable insights over mundane conversational banter.\n`;
    case 'gaming':
      return `\nSpecial rule for gaming: Prioritize clutch plays, hype reactions, and comedic fails over slow gameplay walkthrough sections.\n`;
    case 'tutorial':
      return `\nSpecial rule for tutorials: Prioritize actionable, punchy tips that deliver standalone breakthrough value.\n`;
    case 'commentary':
      return `\nSpecial rule for commentary: Prioritize strong, debate-provoking arguments and bold revelations.\n`;
    case 'entertainment':
      return `\nSpecial rule for entertainment: Prioritize maximum comedic timing, emotional peaks, and shareable punchlines.\n`;
    default:
      return '';
  }
}

/**
 * System prompt for the rerank pass. First-pass analysis judges each chunk in
 * isolation; this pass sees ALL surviving candidates side by side and picks
 * the true best-of-the-video set.
 */
export function buildRerankSystemPrompt(language?: string, genre?: string): string {
  const genreGuidance = getGenreRerankGuidance(genre);

  return `You are a senior short-form video editor selecting the final clip lineup for a video.
${genreGuidance}
You are given candidate clips that were found by scanning a long transcript chunk-by-chunk. Each candidate was judged in isolation, so scores are NOT comparable yet. Your job: compare all candidates against EACH OTHER and return only the ones strong enough to publish, ordered by real potential.

Consider for every candidate:
- Hook strength: does the opening line stop a scroll?
- Complete arc or action: high-intensity action, goal, or payoff within the clip.
- Quotability and emotional punch.
- Distinctness: drop near-duplicates that cover the same moment or make the same point. Keep distinct events (different goals/plays) as separate clips.
- Honesty of the original claim: downgrade candidates whose "reason" oversells a boring stretch.

Return the best candidates you would publish. Return 5-10 clips in order of strength; dropping below 5 is acceptable ONLY when the video genuinely has very few compelling moments — prefer keeping a borderline clip over an empty slot. Give each survivor a fresh, calibrated score on the full 0-100 scale reflecting this global comparison. You may sharpen "title", "reason", "hook", and calibrate the "virality" breakdown, but never invent facts that are not supported by the excerpts.${languageMetadataInstruction(language)}

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{"clips":[{"id":"cand_01","score":88,"title":"Sharpened clip title","reason":"Why this is the best version of this moment","hook":"Opening line that stops the scroll","virality":{"overall":88,"hookStrength":92,"engagementFlow":85,"trendRelevance":84,"standaloneValue":90,"reasons":["Scroll-stopping curiosity hook","High emotional payoff"]}}]}`;
}

/** One candidate as presented to (and echoed back by) the rerank pass. */
export interface RerankCandidateInput {
  id: string;
  start: number;
  end: number;
  title: string;
  reason: string;
  hook: string;
}

/**
 * Builds the user-turn prompt for the rerank pass: the candidate list plus the
 * verbatim transcript text under each clip, so the model can judge substance
 * instead of trusting the earlier summaries.
 */
export function buildRerankUserPrompt(params: {
  videoTitle: string;
  candidates: RerankCandidateInput[];
  /** Verbatim transcript lines per candidate id. */
  excerptById: Record<string, string>;
}): string {
  const blocks = params.candidates.map((candidate) => {
    const excerpt = params.excerptById[candidate.id]?.trim() || '(transcript excerpt unavailable)';
    return [
      `[${candidate.id}] ${candidate.start.toFixed(2)}s-${candidate.end.toFixed(2)}s`,
      `title: ${candidate.title}`,
      `hook: ${candidate.hook}`,
      `reason: ${candidate.reason}`,
      'transcript:',
      excerpt,
    ].join('\n');
  });

  return [
    `Video: ${params.videoTitle}`,
    '',
    `Candidates (${params.candidates.length}):`,
    '',
    ...blocks.flatMap((block, index) =>
      index === 0 ? [block] : ['', '---', '', block],
    ),
  ].join('\n');
}

/**
 * Metadata-language instruction shared by both passes. Empty when the output
 * language is automatic — the model then matches the transcript naturally.
 */
function languageMetadataInstruction(language?: string): string {
  if (!language || language === 'auto') return '';
  return `\n\nWrite every "title", "reason" and "hook" in this language: ${language}.`;
}
