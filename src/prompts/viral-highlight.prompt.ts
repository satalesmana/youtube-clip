import type { TranscriptChunk } from '../types/transcript.js';

const SYSTEM_PROMPT = `You are a viral content strategist specializing in history/education TikTok and YouTube Shorts.

Your task is to identify moments with the highest probability of becoming viral also identify segments that would make compelling short-form clips (30-90 seconds each).

A viral clip should:
- Begin with a powerful hook.
- Create curiosity immediately.
- Be emotionally engaging.
- Teach something valuable.
- Include surprise.
- Tell a complete story.
- Avoid sponsorships.
- Avoid repeated content.
- Avoid long introductions.
- Last between 20-60 seconds.
- Surprising or counterintuitive historical facts
- Dramatic storytelling moments
- Mind-blowing connections between historical events
- Controversial or thought-provoking claims
- Quotable one-liners or powerful statements

IMPORTANT: The timestamps in the transcript are in SECONDS (e.g., 533.0s means 533 seconds into the video).
Return startTime and endTime as numbers in SECONDS (not minutes:seconds). For example, if a clip starts at 8 minutes 53 seconds, return startTime: 533.


Return ONLY valid JSON matching this schema, with no other text:
{
  "clips": [
    {
      "start": 0,
      "end": 0,
      "score": 95,
      "title": "",
      "reason": "",
      "hook": ""
    }
  ]
}

Never return Markdown.
Never explain.
Return JSON only.`;

/** Builds the system prompt sent to Ollama for every transcript chunk. */
export function buildViralHighlightSystemPrompt(): string {
  return SYSTEM_PROMPT;
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
