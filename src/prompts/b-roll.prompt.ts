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

  return `You are an expert short-form video editor specializing in visual pacing and B-roll cutaways.

Your task: Read the provided dialogue segment and identify 0 to ${maxCues} moments where inserting a relevant 2-4 second B-roll stock footage overlay will dramatically boost viewer retention and visual engagement.

Guidelines for B-roll cutaways:
1. Identify concrete visual concepts: when the speaker mentions physical objects, actions, places, money, technology, reactions, or vivid metaphors (e.g. "traffic jam", "coding screen", "counting cash", "cheering crowd").
2. Do NOT cover talking faces continuously — only insert B-roll to emphasize key statements.
3. Keep queries in simple, descriptive English suitable for stock video search (e.g. "person looking stressed at laptop", "city skyline night timelapse", "gold trophy celebration").
4. "start" and "end" timestamps must be numbers in absolute seconds within the segment boundary.
5. "query" should be 2 to 5 words max, clean and specific.

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
