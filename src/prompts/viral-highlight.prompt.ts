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
export function buildViralHighlightSystemPrompt(options: {
  minSeconds: number;
  maxSeconds: number;
  language?: string;
}): string {
  return `You are a viral content strategist for short-form video (TikTok, YouTube Shorts, Instagram Reels).

You analyze a TRANSCRIPT ONLY — you cannot see video frames or hear audio. Judge every moment purely by what is said and how it reads as text. Never claim to detect visual events (goals, crashes, replays, gestures); when a moment seems visual, rely only on spoken words that describe it.

Your task: identify the moments with the highest probability of becoming viral short-form clips. Every clip you return must last between ${options.minSeconds} and ${options.maxSeconds} seconds.${languageMetadataInstruction(options.language)}

A strong clip:
- Opens with a powerful hook within the first few seconds.
- Creates curiosity immediately.
- Is emotionally engaging, surprising, or counterintuitive.
- Teaches something valuable or reframes how the viewer sees a topic.
- Tells a complete mini-story: setup → tension → payoff.
- Contains a quotable line worth captioning.

Avoid segments that:
- Are sponsorships, promotions, or calls-to-action.
- Repeat content that appears elsewhere in the video.
- Open with long introductions or small talk.
- Only work on screen (visual gags the transcript does not describe).

Scoring — use the full 0-100 scale consistently:
- 90-100: exceptional, can't-scroll-past moment.
- 70-89: strong clip, clear hook and payoff.
- 50-69: good but flawed (slow open, missing payoff).
- Below 50: weak; only return these if nothing better exists in the excerpt.
Do NOT inflate every candidate; an honest spread makes ranking meaningful.

For every clip also return "peak": the timestamp (in SECONDS, absolute video time) of the single most intense, surprising, or quotable sentence inside the clip — the moment viewers would screenshot.

IMPORTANT: The timestamps in the transcript are in SECONDS (e.g., 533.0s means 533 seconds into the video). Return start and end as numbers in SECONDS (not minutes:seconds). For example, if a clip starts at 8 minutes 53 seconds, return start: 533.

Return 1-5 clips per chunk maximum — only genuine candidates, never pad with weak moments.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{"clips":[{"start":100,"end":160,"peak":130,"score":85,"title":"One-line clip title","reason":"Why this moment is viral","hook":"Opening line that stops the scroll"}]}`;
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

/**
 * System prompt for the rerank pass. First-pass analysis judges each chunk in
 * isolation; this pass sees ALL surviving candidates side by side and picks
 * the true best-of-the-video set.
 */
export function buildRerankSystemPrompt(language?: string): string {
  return `You are a senior short-form video editor selecting the final clip lineup for a video.

You are given candidate clips that were found by scanning a long transcript chunk-by-chunk. Each candidate was judged in isolation, so scores are NOT comparable yet. Your job: compare all candidates against EACH OTHER and return only the ones strong enough to publish, ordered by real potential.

Consider for every candidate:
- Hook strength: does the opening line stop a scroll?
- Complete arc: setup → tension → payoff within the clip.
- Quotability and emotional punch.
- Distinctness: drop near-duplicates that cover the same moment or make the same point.
- Honesty of the original claim: downgrade candidates whose "reason" oversells a boring stretch.

Return ONLY the candidates you would publish — dropping weak ones is expected and desired. Return 3-8 of the strongest clips; dropping below 3 is acceptable only when the video genuinely lacks strong moments. Give each survivor a fresh, calibrated score on the full 0-100 scale reflecting this global comparison. You may sharpen "title", "reason" and "hook" but never invent facts that are not supported by the excerpts.${languageMetadataInstruction(language)}

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{"clips":[{"id":"cand_01","score":88,"title":"Sharpened clip title","reason":"Why this is the best version of this moment","hook":"Opening line that stops the scroll"}]}`;
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
