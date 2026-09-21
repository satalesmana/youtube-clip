export interface BrollPromptOptions {
  segmentStart: number;
  segmentEnd: number;
  maxCues?: number;
}

/**
 * System prompt instructing the LLM to identify visual moments in speech
 * suitable for royalty-free stock B-roll overlay cutaways.
 */
export function buildBrollSystemPrompt(options?: BrollPromptOptions): string {
  const maxCues = options?.maxCues ?? 3;

  return `You are an expert short-form video editor specializing in visual pacing, retention hooks, and B-roll cutaways for viral Shorts/Reels/TikToks.

Your task: Read the provided dialogue segment and identify 0 to ${maxCues} precise moments where inserting a relevant 2.0-3.5 second B-roll stock footage overlay will dramatically boost viewer retention.

Strict Guidelines for B-roll Cutaways:
1. Stock Search Query Formulation:
   - Formulate queries as: [Concrete Subject] + [Action/Motion] + [Context/Setting].
   - Examples: "motorcycle racer speeding track", "hand counting US dollar bills", "woman scrolling smartphone screen cafe", "bitcoin candlestick chart red falling", "programmer typing code laptop dark room".
   - Keep queries in clean English (2 to 5 words max).
   - AVOID abstract adjectives or non-visual keywords like "mindset", "success", "future", "problem", "smart", "solution".

2. Metaphor & Idiom Resolution:
   - Always translate metaphors, slang, or idioms into concrete physical visuals:
     * "pasar berdarah" / "market bleeding" -> "stock market candlestick crash red"
     * "bakar uang" / "burning cash" -> "burning paper dollar cash bills"
     * "banjir pesanan" / "flooded orders" -> "warehouse shipping packages boxes"
     * "dikejar waktu" / "racing against time" -> "hourglass running sand fast" or "fast ticking wall clock"

3. Pacing & Golden Hook Rule:
   - Golden Hook: If the segment begins at or near the start (segmentStart < 2.5s), do NOT place B-roll during the first 2.5 seconds (cue start must be >= segmentStart + 2.5s) so the speaker's talking head establishes the hook.
   - Ideal cutaway duration: 2.0 to 3.5 seconds.
   - Spacing: Leave at least 3.0 seconds between consecutive B-roll cutaways.

4. Output Schema:
   - "start" and "end" must be numbers in absolute seconds within the segment boundary.
   - "mood" must be one of: dynamic, focused, dramatic, exciting, tense, curious, inspirational.

Return ONLY valid JSON matching this schema, with no markdown fences or other text:
{"cues": [{"start": 10.0, "end": 13.0, "query": "cryptocurrency trading chart red", "mood": "tense"}]}`;
}

/**
 * Builds user prompt containing the transcript segment with timestamped words/sentences.
 */
export function buildBrollUserPrompt(params: {
  segmentText: string;
  start: number;
  end: number;
}): string {
  return [
    `Segment duration: ${params.start.toFixed(2)}s - ${params.end.toFixed(2)}s`,
    '',
    'Transcript text:',
    params.segmentText,
  ].join('\n');
}
