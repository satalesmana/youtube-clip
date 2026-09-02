/**
 * Test caption service resilience with partial / malformed LLM responses.
 * Run: npx tsx scripts/test-caption-resilience.ts
 */
import { CaptionService } from '../src/content/caption.service.js';
import type { IOllamaProvider, OllamaChatOptions } from '../src/providers/ollama.provider.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ OK: ${message}`);
  }
}

// Mock provider that returns the exact malformed output reported by user
const malformedRawContent = `{
  "tiktok": {
    "title": "Transfer Spurs: Tonali seharga 92,5 Juta Pound!",
    "hook": "Tottenham belanja 226 juta pound buat cari juara Premier League. Tapi yang bikin heboh: brilian atau gila?",
    "body": "Tonali datang dari Newcastle dengan bayang skandal judi. Van Hecke, Mateus Fernandes, plus Robertson gratisan. Semua taruhan besar Spurs musim ini!",
    "callToAction": "Menurut lo, 92,5 juta pound buat Tonali itu investasi brilian atau buang uang? Komen di bawah!",
    "hashtags": ["#TransferSpurs", "#PremierLeague", "#Tonali", "#SPFC", "#Sepakbola"],
    "searchKeywords": ["transfer spurs 2025", "brandon williams spurs", "tonali spurs premier league"],
    "strategyExplanation": "Caption ini menggunakan keyword pencarian natural yang sering diketik di TikTok (transfer spurs, tonali spurs) di 1-2 baris pertama untuk SEO. Body singkat dan punchy agar tidak menutupi subtitle di layar mobile. CTA berupa pertanyaan polarizing yang memancing debate di kolom komentar, mendorong viewer tetap nonton video berulang kali sambil mengetik komentar.",
    "recommendedAudioVibe": "Suspense tension beats dengan drop dramatis"
  },
  "instagram": "title: "
}`;

const mockProvider: IOllamaProvider = {
  chat: async (_opts: OllamaChatOptions): Promise<string> => {
    return malformedRawContent;
  },
};

const dummyLogger = {
  info: (obj: unknown, msg?: string) => console.log(`[INFO] ${msg || ''}`, typeof obj === 'string' ? obj : ''),
  warn: (obj: unknown, msg?: string) => console.log(`[WARN] ${msg || ''}`, typeof obj === 'string' ? obj : ''),
  error: (obj: unknown, msg?: string) => console.log(`[ERROR] ${msg || ''}`, typeof obj === 'string' ? obj : ''),
  debug: () => {},
} as any;

const captionService = new CaptionService(
  mockProvider,
  {
    model: 'test-model',
    temperature: 0.1,
    timeoutMs: 5000,
    maxRetries: 1,
    outputsDir: 'outputs',
  },
  dummyLogger,
);

console.log('=== TEST PARTIAL CAPTION RECOVERY ===');
const result = await captionService.generateCaptions({
  videoId: 'test_vid',
  sourceTitle: 'Transfer Spurs 2025',
  targetLanguage: 'id',
});

// 1. TikTok should be preserved from the LLM!
console.log('\n--- TikTok Caption (From LLM) ---');
console.log('Title:', result.captions.tiktok.title);
console.log('Hook:', result.captions.tiktok.hook);
console.log('Strategy:', result.captions.tiktok.strategyExplanation);

assert(result.captions.tiktok.title === 'Transfer Spurs: Tonali seharga 92,5 Juta Pound!', 'TikTok title matched LLM');
assert(result.captions.tiktok.hashtags.includes('#TransferSpurs'), 'TikTok hashtags preserved');

// 2. Instagram was broken in the LLM response, so it should be safely filled with fallback!
console.log('\n--- Instagram Caption (Graceful Fallback) ---');
console.log('Hook:', result.captions.instagram.hook);
console.log('CTA:', result.captions.instagram.callToAction);

assert(result.captions.instagram !== undefined, 'Instagram caption exists');
assert(result.captions.instagram.hook.length > 0, 'Instagram has fallback hook');
assert(result.captions.youtube_shorts !== undefined, 'YouTube Shorts has fallback');
assert(result.captions.x !== undefined, 'X has fallback');
assert(result.captions.threads !== undefined, 'Threads has fallback');

console.log('\n🎉 TEST PASSED! The partial failure was recovered smoothly without crashing or losing the TikTok caption.');
