import { buildScriptSystemPrompt, buildScriptUserPrompt } from '../src/content/content.prompt.js';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

async function run() {
  const systemPrompt = buildScriptSystemPrompt(60);
  assert(
    systemPrompt.includes('translate/adapt it naturally into the target language'),
    'buildScriptSystemPrompt contains cross-lingual hook adaptation rule',
  );

  const userPrompt = buildScriptUserPrompt({
    candidateId: 'cand_1',
    angleId: 'ang_1',
    angleTitle: 'Momen Krusial',
    angleHook: 'Fakta mengejutkan terungkap',
    angleReason: 'Dramatis',
    angleType: 'commentary',
    fixedHook: 'THE MOMENT HE KNEW',
    momentSegments: [{ start: 10, end: 20, text: 'The match was intense.' }],
    candidateTitle: 'Match Moment',
    candidateHook: 'Hook',
    sourceTitle: 'Football Final',
    sourceChannel: 'Sports TV',
    sourceLanguage: 'en',
    targetLanguage: 'id',
  });

  assert(userPrompt.includes('Football Final'), 'User prompt contains video title');
  assert(userPrompt.includes('language: en'), 'User prompt contains source language');
  console.log('\n🎉 ALL CROSS-LINGUAL PROMPT TESTS PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
