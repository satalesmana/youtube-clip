/** Debug: test raw router response */
import { readFile } from 'node:fs/promises';

async function main() {
  const envContent = await readFile('.env', 'utf-8');
  const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
  if (!apiKeyMatch) throw new Error('ROUTER_API_KEY not found');
  const apiKey = apiKeyMatch[1]!.trim();

  const requestBody = {
    model: 'group-deepseek',
    stream: false,
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: 'Reply with: {"test": true}',
      },
    ],
  };

  console.log('Sending request to router...');
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
  console.log(`Body preview: ${bodyText.slice(0, 500)}`);

  // Parse and extract content
  const data = JSON.parse(bodyText);
  const content = data.choices?.[0]?.message?.content ?? '';
  console.log(`\nExtracted content length: ${content.length}`);
  console.log(`Content: ${content.slice(0, 200)}`);
}

main().catch(console.error);
