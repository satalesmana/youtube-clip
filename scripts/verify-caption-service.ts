import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import {
  buildCaptionSystemPrompt,
  buildCaptionUserPrompt,
  assembleFormattedCaption,
  generateFallbackCaptions,
} from '../src/content/caption.prompt.js';
import {
  llmCaptionsResponseSchema,
  generateCaptionRequestSchema,
} from '../src/schemas/caption.schema.js';
import { CaptionService } from '../src/content/caption.service.js';
import { CaptionController } from '../src/controllers/caption.controller.js';
import { createLogger } from '../src/utils/logger.js';
import type { IOllamaProvider } from '../src/providers/ollama.provider.js';
import type { ITranscriptService } from '../src/services/transcript.service.js';
import type { CaptionGenerationContext } from '../src/types/caption.js';

console.log('🧪 Starting Viral Caption Service & Controller Verification...\n');

const testOutputDir = resolve(process.cwd(), 'outputs', 'test_caption_workspace');

// ── Test 1: Fallback Generator Verification ───────────────────────────
console.log('1️⃣ Testing Fallback Generator & Rule Compliance...');
const sampleContext: CaptionGenerationContext = {
  videoId: 'test_video_123',
  jobId: 'job_abc',
  sourceTitle: 'Rahasia AI Terbaru yang Mengguncang Dunia Teknologi',
  sourceChannel: 'Tech Insight ID',
  targetLanguage: 'id',
  genre: 'commentary',
  tone: 'viral_hype',
  angle: {
    title: 'AI Ini Bisa Bikin Video Otomatis dalam 5 Detik',
    hook: 'JANGAN SAMPAI KETINGGALAN! AI INI BIKIN KAGET!',
    angleType: 'explainer',
  },
  script: {
    sections: [
      { type: 'hook', text: 'Kalian pasti gak bakal percaya kalau AI ini bisa bikin video dalam sekejap.' },
      { type: 'body', text: 'Teknologi ini baru saja rilis dan langsung menggemparkan para kreator konten.' },
      { type: 'conclusion', text: 'Gimana menurut kalian, apakah masa depan konten kreator bakal tergantikan?' },
    ],
    estimatedDurationSeconds: 45,
  },
  durationSeconds: 45,
};

const fallbackResult = generateFallbackCaptions(sampleContext);
assert.equal(fallbackResult.videoId, 'test_video_123');
assert.equal(fallbackResult.language, 'id');
assert.equal(fallbackResult.tone, 'viral_hype');

// Check TikTok rules
const tt = fallbackResult.captions.tiktok;
assert.ok(tt.hook.length > 0, 'TikTok hook should exist');
assert.ok(tt.callToAction.includes('komentar') || tt.callToAction.includes('👇'), 'TikTok should have comment CTA');
assert.ok(tt.hashtags.length >= 3 && tt.hashtags.length <= 5, 'TikTok should have 3-5 hashtags');
assert.ok(tt.formattedCaption.includes('#'), 'TikTok formatted caption should have hashtags');
assert.ok(tt.strategyExplanation.includes('TikTok SEO'), 'TikTok should have strategy explanation');
console.log('   ✓ TikTok caption rules verified');

// Check Instagram rules
const ig = fallbackResult.captions.instagram;
assert.ok(ig.hook.includes('👇') || ig.hook.includes('BACA CAPTION'), 'IG hook should target fold click');
assert.ok(ig.callToAction.includes('Simpan') || ig.callToAction.includes('Save'), 'IG should have Save/Share CTA');
assert.ok(ig.formattedCaption.includes('---') || ig.formattedCaption.includes('\n\n'), 'IG formatted caption should have line breaks');
console.log('   ✓ Instagram Reels caption rules verified');

// Check YouTube Shorts rules
const yt = fallbackResult.captions.youtube_shorts;
assert.ok(yt.title && yt.title.includes('#Shorts'), 'YouTube Shorts title must include #Shorts');
assert.ok(yt.tags && yt.tags.length > 0, 'YouTube Shorts search tags must exist');
console.log('   ✓ YouTube Shorts caption rules verified');

// Check X rules
const xCap = fallbackResult.captions.x;
assert.ok(xCap.characterCount <= 280, `X caption must be <= 280 chars, got ${xCap.characterCount}`);
assert.ok(xCap.hashtags.length <= 2, 'X caption should have <= 2 hashtags');
console.log('   ✓ X / Twitter caption rules verified');

// Check Threads rules
const th = fallbackResult.captions.threads;
assert.ok(th.callToAction.length > 0, 'Threads should have discussion CTA');
console.log('   ✓ Threads caption rules verified\n');

// ── Test 2: Prompt Builder & Schema Validation ─────────────────────────
console.log('2️⃣ Testing Prompt Builders & Schema Validation...');
const sysPrompt = buildCaptionSystemPrompt('viral_hype', 'id');
assert.ok(sysPrompt.includes('TIKTOK'), 'System prompt should mention TikTok rules');
assert.ok(sysPrompt.includes('INSTAGRAM REELS'), 'System prompt should mention Instagram rules');
assert.ok(sysPrompt.includes('YOUTUBE SHORTS'), 'System prompt should mention YouTube Shorts rules');

const userPrompt = buildCaptionUserPrompt(sampleContext);
assert.ok(userPrompt.includes('Rahasia AI'), 'User prompt should include video title');
assert.ok(userPrompt.includes('JANGAN SAMPAI KETINGGALAN'), 'User prompt should include hook');

// Validate Mock LLM JSON output against schema
const mockLlmJson = {
  tiktok: {
    title: 'AI BIKIN VIDEO OTOMATIS!',
    hook: 'AI ini baru rilis dan bisa bikin video dalam 5 detik!',
    body: 'Banyak kreator kaget karena hasilnya rapi banget.',
    callToAction: 'Kalian tim setuju atau takut AI gantiin manusia? Tulis di bawah! 👇',
    hashtags: ['#aiindonesia', '#teknologibaru', '#chatgpt', '#kreatorvideo'],
    searchKeywords: ['ai video generator', 'teknologi ai terbaru'],
    strategyExplanation: 'Search SEO di baris pertama + CTA debat di kolom komentar.',
    recommendedAudioVibe: 'Suspense Tech Beats',
  },
  instagram: {
    title: '🔥 AI BIKIN VIDEO 5 DETIK (BACA CAPTION)',
    hook: 'Gak perlu ribet edit berjam-jam lagi! (BACA DETAIL DI BAWAH 👇)',
    body: 'Ini 3 keunggulan utama AI video generator terbaru:\n1. Otomatis potong momen terbaik\n2. Subtitle animasi instan\n3. Format 9:16 siap upload',
    callToAction: '🔖 Simpan reel ini buat referensi konten kamu nanti & share ke tim kamu!',
    hashtags: ['#reelsindonesia', '#kontenviral', '#aivideo', '#tipskonten'],
    searchKeywords: ['ai video', 'tips reels'],
    strategyExplanation: 'First line hook 125 char fold + high-value bullets + Save/Share ranking signals.',
  },
  youtube_shorts: {
    title: 'AI Bikin Video Dalam 5 Detik?! 😱 #Shorts',
    hook: 'Masa depan pembuatan video berubah drastis berkat AI ini.',
    body: 'Pembahasan lengkap AI video generator tercepat di 2026. Tonton sampai habis untuk melihat hasilnya.',
    callToAction: 'Tekan Like & Subscribe kalau kamu suka update AI seperti ini! 👍',
    hashtags: ['#Shorts', '#AIVideo', '#TeknologiAI', '#TrendingShorts'],
    searchKeywords: ['ai video', 'youtube shorts ai', 'edit video ai'],
    tags: ['ai video', 'shorts', 'teknologi', 'tutorial ai', 'video generator'],
    strategyExplanation: 'CTR title with #Shorts + SEO keywords for YouTube search indexing.',
  },
  x: {
    hook: 'AI video generation sudah sampai di titik ini.',
    body: 'Cuma butuh 5 detik buat generate short video lengkap sama subtitle.',
    callToAction: 'Apakah editor video bakal tergantikan? Quote tweet opini kamu.',
    hashtags: ['#TechAI', '#AIUpdate'],
    searchKeywords: ['ai video'],
    strategyExplanation: 'Snappy tweet with Quote-Tweet bait.',
  },
  threads: {
    hook: 'Jujur masih gak habis pikir sama perkembangan AI tahun ini...',
    body: 'Sekarang bikin video short gak nyampe 1 menit udah kelar.',
    callToAction: 'Menurut kalian AI kayak gini bikin kreator makin malas atau makin produktif? Yuk diskusi.',
    hashtags: ['#aithreads', '#diskusi'],
    searchKeywords: ['ai kreator'],
    strategyExplanation: 'Relatable question encouraging open discussion thread.',
  },
};

const parsedLlm = llmCaptionsResponseSchema.safeParse(mockLlmJson);
assert.ok(parsedLlm.success, 'Mock LLM JSON should pass schema validation');
console.log('   ✓ Schema validation passed\n');

// ── Test 3: CaptionService with Mock Provider ─────────────────────────
console.log('3️⃣ Testing CaptionService Execution & Disk Persistence...');

const mockProvider: IOllamaProvider = {
  chat: async () => JSON.stringify(mockLlmJson),
  listModels: async () => ['qwen3:14b'],
  showModel: async () => ({}),
  isRunning: async () => true,
};

const logger = createLogger('test.caption');
const captionService = new CaptionService(
  mockProvider,
  {
    model: 'qwen3:14b',
    temperature: 0.2,
    timeoutMs: 5000,
    maxRetries: 2,
    outputsDir: testOutputDir,
  },
  logger,
);

const serviceResult = await captionService.generateCaptions(sampleContext);
assert.equal(serviceResult.videoId, 'test_video_123');
assert.equal(serviceResult.captions.tiktok.title, 'AI BIKIN VIDEO OTOMATIS!');
assert.ok(serviceResult.captions.tiktok.formattedCaption.includes('Kalian tim setuju'), 'Formatted caption should be assembled');
console.log('   ✓ CaptionService.generateCaptions succeeded');

// Test reading saved from disk
const savedResult = await captionService.getSavedCaptions('test_video_123', 'job_abc');
assert.ok(savedResult !== null, 'Saved captions should be readable from disk');
assert.equal(savedResult.captions.instagram.hashtags.length, 4);
assert.equal(savedResult.cached, true);
console.log('   ✓ CaptionService.getSavedCaptions disk persistence verified\n');

// ── Test 4: CaptionController Integration ─────────────────────────────
console.log('4️⃣ Testing CaptionController Request Flow...');

const mockTranscriptService = {} as ITranscriptService;
const captionController = new CaptionController({
  captionService,
  transcriptService: mockTranscriptService,
  outputsDir: testOutputDir,
  logger,
});

// Request schema check
const reqData = generateCaptionRequestSchema.parse({
  videoId: 'test_video_123',
  jobId: 'job_abc',
  tone: 'viral_hype',
});
assert.equal(reqData.videoId, 'test_video_123');

// Controller generate (cached fast path)
const ctrlCached = await captionController.generate({
  videoId: 'test_video_123',
  jobId: 'job_abc',
  tone: 'viral_hype',
  language: 'id',
  refresh: false,
});
assert.equal(ctrlCached.success, true);
assert.equal(ctrlCached.cached, true);
console.log('   ✓ CaptionController fast-path cached hit verified');

// Controller generate with refresh
const ctrlRefreshed = await captionController.generate({
  videoId: 'test_video_123',
  jobId: 'job_abc',
  tone: 'storytelling',
  language: 'id',
  refresh: true,
  customContext: {
    sourceTitle: 'Cerita Viral',
  },
});
assert.equal(ctrlRefreshed.success, true);
assert.equal(ctrlRefreshed.tone, 'storytelling');
console.log('   ✓ CaptionController regeneration verified\n');

// Clean up test directory
await rm(testOutputDir, { recursive: true, force: true }).catch(() => undefined);

console.log('🎉 ALL VIRAL CAPTION SERVICE & CONTROLLER TESTS PASSED SUCCESSFULLY!\n');
