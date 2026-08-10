/**
 * Smoke test for the research pipeline — runs without an external LLM by
 * stubbing the AI provider. Verifies the full flow: collect signals from
 * live sources → LLM ranking (stubbed) → YouTube search → result shape.
 *
 * Usage: npx tsx scripts/smoke-research.ts
 */
import { RssProvider } from '../src/research/rss.provider.js';
import { RedditProvider } from '../src/research/reddit.provider.js';
import { TrendsProvider } from '../src/research/trends.provider.js';
import { XProvider } from '../src/research/x.provider.js';
import { YouTubeSearchProvider } from '../src/research/youtube-search.provider.js';
import type { LlmProvider } from '../src/research/llm.provider.js';
import { ResearchService } from '../src/research/research.service.js';
import { createLogger } from '../src/utils/logger.js';
import type { ResearchSourceItem } from '../src/types/media.js';

/** Minimal fake signals to test LLM ranking without external LLM. */
const STUB_SIGNALS: ResearchSourceItem[] = [
  {
    source: 'rss',
    origin: 'cnn-indonesia',
    title: 'Pemerintah umumkan kebijakan ekonomi baru untuk UMKM',
    text: 'Paket stimulus baru untuk usaha mikro kecil dan menengah.',
    language: 'id',
  },
  {
    source: 'reddit',
    origin: 'r/technology',
    title: 'OpenAI releases new model that beats benchmarks',
    engagement: 4200,
  },
  {
    source: 'trends',
    origin: 'Google Trends',
    title: 'iPhone 17 Pro Max',
  },
];

const logger = createLogger('smoke-research');

/** Stub provider that returns a fixed, valid JSON analysis. */
class StubLlm implements LlmProvider {
  async chat(): Promise<string> {
    return STUB_LLM_RESPONSE;
  }
}

const STUB_LLM_RESPONSE = JSON.stringify({
  trends: [
    {
      slug: 'openai-new-model',
      title: 'OpenAI releases new flagship model',
      summary: 'OpenAI dropped a new model topping the benchmarks; tech Twitter is exploding.',
      score: 95,
      keywords: 'openai new model, openai benchmark, openai release',
      category: 'tech',
    },
    {
      slug: 'umkm-stimulus',
      title: 'Pemerintah umumkan stimulus UMKM baru',
      summary: 'Paket stimulus ekonomi baru untuk UMKM diumumkan pemerintah.',
      score: 80,
      keywords: 'stimulus umkm, kebijakan ekonomi pemerintah',
      category: 'business',
    },
  ],
});

async function main() {
  console.log('🧪 Research pipeline smoke test (LLM stubbed)\n');

  // 1. Live source collection.
  const rss = new RssProvider(
    {
      feeds: [
        { url: 'https://www.cnnindonesia.com/rss', label: 'cnn-indonesia', language: 'id' },
        { url: 'https://feeds.bbci.co.uk/news/rss.xml', label: 'bbc', language: 'en' },
        { url: 'https://rss.detik.com', label: 'detik', language: 'id' },
      ],
      maxItemsPerFeed: 5,
      timeoutMs: 8000,
    },
    logger,
  );
  const reddit = new RedditProvider(
    { subreddits: ['worldnews', 'technology'], maxPostsPerSubreddit: 5, timeoutMs: 8000 },
    logger,
  );
  const trends = new TrendsProvider(
    {
      feedUrl: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id',
      maxQueries: 10,
      timeoutMs: 8000,
    },
    logger,
  );
  const x = new XProvider({ searchQuery: '', maxPosts: 5 }, logger);
  const youtube = new YouTubeSearchProvider(
    { apiKey: process.env.YOUTUBE_API_KEY, maxResults: 3, timeoutMs: 15_000, ytDlpBinaryPath: 'yt-dlp' },
    logger,
  );

  // Collect signals (each source is independent; failures are isolated).
  const skipped: { source: string; reason: string }[] = [];
  const sources = [
    { name: 'rss', fetch: () => rss.fetchLatest() },
    { name: 'reddit', fetch: () => reddit.fetchHotPosts() },
    { name: 'trends', fetch: () => trends.fetchTrendingQueries() },
    { name: 'x', fetch: () => x.fetchRecentPosts() },
  ];
  const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
  const signals: ResearchSourceItem[] = [];
  settled.forEach((outcome, i) => {
    const name = sources[i]?.name ?? '?';
    if (outcome.status === 'fulfilled') {
      const items = outcome.value ?? [];
      console.log(`  ✓ ${name}: ${items.length} signals`);
      signals.push(...items);
    } else {
      skipped.push({ source: name, reason: String(outcome.reason) });
      console.log(`  ✗ ${name}: skipped (${String(outcome.reason).slice(0, 80)})`);
    }
  });

  // 2. LLM ranking (stubbed — uses the stub provider).
  const service = new ResearchService(
    {
      maxTrends: 10,
      maxSignalsForLlm: 80,
      language: 'auto',
    },
    rss,
    reddit,
    trends,
    x,
    youtube,
    new StubLlm(),
    logger,
  );

  // We bypass `research()` (which re-collects) and test the private pieces
  // via the public surface: use the service to rank the stub + real signals.
  // @ts-expect-error testing internals
  const trendsRanked = await service.analyzeAndRank([...STUB_SIGNALS, ...signals], 10);
  console.log(`\n  ✓ LLM ranking: ${trendsRanked.length} trends`);
  for (const t of trendsRanked.slice(0, 5)) {
    console.log(`    - [${t.score}] ${t.title} (${t.category})`);
  }

  // 3. YouTube search via yt-dlp (will be skipped if yt-dlp missing).
  console.log('\n  YouTube search (yt-dlp fallback):');
  for (const t of trendsRanked.slice(0, 2)) {
    try {
      const videos = await youtube.search(t.keywords.split(',')[0] ?? t.title);
      console.log(`    ✓ "${t.title}": ${videos.length} videos`);
      videos.slice(0, 2).forEach((v) => console.log(`      - ${v.title} [${v.channel}]`));
    } catch (error) {
      console.log(
        `    ✗ "${t.title}": ${error instanceof Error ? error.message.slice(0, 100) : error}`,
      );
    }
  }

  console.log(`\n  skippedSources: ${skipped.length > 0 ? JSON.stringify(skipped) : 'none'}`);
  console.log('\n✅ Smoke test complete');
}

main().catch((error) => {
  console.error('❌ Smoke test failed:', error);
  process.exit(1);
});
