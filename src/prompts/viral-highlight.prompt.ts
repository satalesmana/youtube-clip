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

const FOOTBALL_PROMPT =`You are an expert football video analyst.

Your task is to identify the exact moment when a goal is scored in a football match and extract the complete highlight sequence around that event.

## Objective
Detect every legitimate goal and return the timestamps covering the entire goal moment.

A goal moment should include:
1. The attacking build-up (5-15 seconds before the shot).
2. The shot or finishing action.
3. The ball completely crossing the goal line.
4. Immediate player celebration.
5. Crowd reaction (if available).
6. Replay(s) (if available).
7. Scoreboard update showing the new score (if visible).

## Detection Signals

A goal is likely when multiple signals occur together:

### Visual
- Ball enters the goal.
- Net movement.
- Goalkeeper fails to stop the ball.
- Players celebrate.
- Referee points to the center circle.
- Scoreboard changes.
- Replay transition appears.

### Audio
- Crowd suddenly becomes much louder.
- Commentator raises excitement.
- Words such as:
  - Goal!
  - It's in!
  - What a finish!
  - Scores!
  - Incredible!
  - Equalizer!
  - Winner!

### Context
- Multiple camera angle changes.
- Slow-motion replay.
- Celebration lasting several seconds.

## Ignore

Do NOT detect:
- Near misses.
- Shots hitting the post.
- Saved penalties.
- Offside goals later disallowed.
- Fouls without a goal.
- Goal kicks.
- Corner kicks without a goal.
- Crowd cheering unrelated to a goal.

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

/** Builds the system prompt sent to Ollama for every transcript chunk. */
export function buildGoalHighlightSystemPrompt(): string {
  return FOOTBALL_PROMPT;
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
