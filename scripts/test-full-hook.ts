/** Full pipeline test with group-deepseek */
import { readFile } from 'node:fs/promises';

async function main() {
  const envContent = await readFile('.env', 'utf-8');
  const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
  const apiKey = apiKeyMatch[1]!.trim();

  const transcriptPath = new URL('../outputs/kBoAmrXotlQ/transcripts/kBoAmrXotlQ.json', import.meta.url).pathname;
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf-8'));

  // Build full prompt
  const systemPrompt = `You are a viral short-form hook writer (TikTok, YouTube Shorts, Instagram Reels).

Your job: given a source video transcript, its editorial angles, and its story beats, generate MULTIPLE hook candidates. A hook is the first 1-5 seconds of a short video: an on-screen headline + a spoken opening line + the best matching source footage.

## Hook styles
Each candidate uses exactly ONE style:
- "curiosity" — opens a question the viewer must stay to answer
- "controversial" — a bold claim that invites disagreement
- "question" — a direct question aimed at the viewer
- "shock" — a surprising statement or number
- "contrarian" — goes against common belief

## Rules
- Generate 5 hook variants. Total: 5 candidates.
- Every candidate MUST be grounded in the transcript.
- The headline is on-screen kinetic text: short (max 8 words).
- The spokenHook is what the voiceover says in the first 1-3 seconds: max 20 words.
- Each candidate picks the BEST source footage range (sourceStart/sourceEnd in seconds) — 1.5-5 second moment.
- sourceTranscript must be the VERBATIM transcript text covering that range.
- No two candidates may be semantically identical.
- Write hooks in Indonesian.

Return ONLY valid JSON matching this exact schema, no Markdown fences:
{
  "candidates": [
    {
      "id": "hook_01",
      "style": "curiosity",
      "headline": "SHORT ON-SCREEN TEXT",
      "spokenHook": "What the voiceover says first",
      "sourceStart": 42.3,
      "sourceEnd": 45.8,
      "sourceTranscript": "verbatim transcript text in that range",
      "reason": "why this hook performs"
    }
  ]
}`;

  const segments = transcript.segments.map((s: any) =>
    `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`
  ).join('\n');

  const userPrompt = `Source video: kBoAmrXotlQ
Output language: id
Requested hook styles: curiosity, shock

EDITORIAL ANGLES:
- [angle_01] type=analysis | "Finis P9 tapi bersyukur"
- [angle_02] type=education | "3 kesalahan Veda"

FULL TRANSCRIPT (verbatim, with timestamps):
${segments}

Task: generate 5 hook candidates. Every candidate must reference a real transcript range.`;

  const requestBody = {
    model: 'group-deepseek',
    stream: false,
    temperature: 0.3,
    max_tokens: 16384,
    messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
  };

  console.log('Testing hook generation with group-deepseek...');
  console.log(`Prompt length: ${(systemPrompt + userPrompt).length} chars`);

  const response = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  const bodyText = await response.text();
  const data = JSON.parse(bodyText);
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? '';
  
  console.log(`\nStatus: ${response.status}`);
  console.log(`finish_reason: ${choice?.finish_reason}`);
  console.log(`content length: ${content.length}`);
  console.log(`\nContent preview:\n${content.slice(0, 500)}`);

  // Save response
  await writeFile('/tmp/hook-full-response.json', bodyText);
  console.log('\nFull response saved to /tmp/hook-full-response.json');

  // Parse JSON
  try {
    const jsonStart = content.indexOf('{');
    if (jsonStart >= 0) {
      const parsed = JSON.parse(content.slice(jsonStart));
      console.log(`\n✅ Parsed ${parsed.candidates?.length ?? 0} candidates`);
      if (parsed.candidates) {
        for (const c of parsed.candidates.slice(0, 3)) {
          console.log(`  - [${c.style}] ${c.headline}`);
        }
      }
    }
  } catch (e) {
    console.log(`\n❌ JSON parse error: ${e}`);
  }
}

import { writeFile } from 'node:fs/promises';
main().catch(console.error);
