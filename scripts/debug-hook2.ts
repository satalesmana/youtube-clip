/** Debug: inspect full router response body */
import { readFile } from 'node:fs/promises';

async function main() {
  const envContent = await readFile('.env', 'utf-8');
  const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
  const apiKey = apiKeyMatch[1]!.trim();

  const transcriptPath = new URL('../outputs/kBoAmrXotlQ/transcripts/kBoAmrXotlQ.json', import.meta.url).pathname;
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf-8'));

  const segments = transcript.segments.slice(0, 4).map(s =>
    `[${s.start.toFixed(2)} -> ${s.end.toFixed(2)}] ${s.text}`
  ).join('\n');

  const userPrompt = `Source video: kBoAmrXotlQ\nOutput language: id\nRequested hook styles: curiosity, shock\n\nEDITORIAL ANGLES:\n- [angle_01] type=analysis | "Finis P9 tapi bersyukur"\n- [angle_02] type=education | "3 kesalahan Veda"\n\nFULL TRANSCRIPT:\n${segments}\n\nTask: generate 5 hook candidates. Return ONLY valid JSON with "candidates" array.`;

  const systemPrompt = `You are a viral short-form hook writer. Generate multiple hook candidates from transcript. Return ONLY valid JSON.`;

  const requestBody = {
    model: 'group-deepseek',
    stream: false,
    temperature: 0.3,
    max_tokens: 4000,
    messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
  };

  const response = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  const bodyText = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Body length: ${bodyText.length}`);

  // Save raw response
  await writeFile('/tmp/router-response.json', bodyText);
  console.log('Saved to /tmp/router-response.json');

  // Parse and show structure
  const data = JSON.parse(bodyText);
  const choice = data.choices?.[0];
  console.log(`\nfinish_reason: ${choice?.finish_reason}`);
  console.log(`message.keys: ${Object.keys(choice?.message ?? {})}`);
  console.log(`content: "${(choice?.message?.content ?? '').slice(0, 100)}"`);
  console.log(`reasoning_content length: ${(choice?.message?.reasoning_content ?? '').length}`);
  console.log(`reasoning_content preview: ${(choice?.message?.reasoning_content ?? '').slice(0, 300)}`);
}

import { writeFile } from 'node:fs/promises';
main().catch(console.error);
