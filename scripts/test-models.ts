/** Debug: test router with larger max_tokens */
import { readFile } from 'node:fs/promises';

async function main() {
  const envContent = await readFile('.env', 'utf-8');
  const apiKeyMatch = envContent.match(/^ROUTER_API_KEY=(.+)$/m);
  const apiKey = apiKeyMatch[1]!.trim();

  // Smaller prompt for testing
  const userPrompt = `Generate 5 hook candidates for a video about motorcycle racing. Transcript: "Veda finish P9 after incident. He learned from mistakes." Styles: curiosity, shock. Language: id. Return JSON: {"candidates":[{"style":"...","headline":"...","spokenHook":"..."}]}`;

  for (const model of ['group-deepseek', 'kimchi/deepseek-v4-flash-0731', 'agn/agnes-2.5-flash']) {
    console.log(`\n=== Testing model: ${model} ===`);
    
    const requestBody = {
      model,
      stream: false,
      temperature: 0.3,
      max_tokens: 8192,
      messages: [{ role: 'user', content: userPrompt }],
    };

    try {
      const response = await fetch('http://127.0.0.1:20128/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody),
      });

      const bodyText = await response.text();
      const data = JSON.parse(bodyText);
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      
      console.log(`  Status: ${response.status}`);
      console.log(`  finish_reason: ${choice?.finish_reason}`);
      console.log(`  content length: ${content.length}`);
      console.log(`  content preview: "${content.slice(0, 150)}..."`);
      
      // Try to parse JSON
      try {
        const jsonStart = content.indexOf('{');
        if (jsonStart >= 0) {
          const parsed = JSON.parse(content.slice(jsonStart));
          console.log(`  ✅ JSON valid: ${parsed.candidates?.length ?? '?'} candidates`);
        }
      } catch {
        console.log(`  ❌ JSON invalid`);
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e}`);
    }
  }
}

main().catch(console.error);
