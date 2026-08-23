/** Debug: test router with full hook generation prompt */
import { readFile } from 'node:fs/promises';

async function main() {
  const envContent = await readFile('.env', 'utf-8');
  const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
  const apiKey = apiKeyMatch[1]!.trim();

  // Load transcript
  const transcriptPath = new URL('../outputs/kBoAmrXotlQ/transcripts/kBoAmrXotlQ.json', import.meta.url).pathname;
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf-8'));

  const segments = transcript.segments.slice(0, 4).map(s =>
    `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`
  ).join('\n');

  const userPrompt = `Source video: kBoAmrXotlQ
Output language: id
Requested hook styles: curiosity, shock
Preferred source clip duration: 2-5 seconds

EDITORIAL ANGLES:
- [angle_01] type=analysis | "Finis P9 tapi bersyukur" | hook="Finis P9, tapi dia bersyukur."
- [angle_02] type=education | "3 kesalahan Veda" | hook="Start bagus tapi kenapa P9?"

FULL TRANSCRIPT:
${segments}

Task: generate 10-15 hook candidates. Return ONLY valid JSON.`;

  const systemPrompt = `You are a viral short-form hook writer. Generate multiple hook candidates from transcript. Return ONLY valid JSON with "candidates" array.`;

  const requestBody = {
    model: 'group-deepseek',
    stream: false,
    temperature: 0.3,
    max_tokens: 4000,
    messages: [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ],
  };

  console.log('Sending hook generation request...');
  const response = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`Status: ${response.status}`);
  const bodyText = await response.text();
  console.log(`Body length: ${bodyText.length}`);

  const data = JSON.parse(bodyText);
  const content = data.choices?.[0]?.message?.content ?? '';
  console.log(`\nContent length: ${content.length}`);
  console.log(`Content preview: ${content.slice(0, 800)}`);

  // Try to parse JSON
  if (content.includes('"candidates"')) {
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      const jsonStr = content.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      console.log(`\n✅ Parsed ${parsed.candidates?.length ?? 0} candidates`);
    } catch (e) {
      console.error(`❌ JSON parse error: ${e}`);
    }
  }
}

main().catch(console.error);
