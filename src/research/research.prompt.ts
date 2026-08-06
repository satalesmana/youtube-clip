import { AppError } from '../utils/errors.js';
import type { ResearchTrend } from '../types/research.js';
import type { ResearchSourceItem } from '../types/media.js';

/** Builds the LLM prompt from the collected signals. */
export function buildResearchPrompt(
  signals: ResearchSourceItem[],
  language: string,
  maxTrends: number,
): string {
  const signalText = signals
    .map((signal, index) => {
      const parts = [
        `[${index}] source=${signal.source}`,
        `origin=${signal.origin}`,
        `title=${signal.title}`,
      ];
      if (signal.text) parts.push(`text=${truncate(signal.text, 280)}`);
      if (signal.url) parts.push(`url=${signal.url}`);
      if (signal.engagement !== undefined) parts.push(`engagement=${signal.engagement}`);
      if (signal.publishedAt) parts.push(`published_at=${signal.publishedAt}`);
      if (signal.language) parts.push(`language=${signal.language}`);
      return parts.join(' | ');
    })
    .join('\n');

  return [
    `Analyze the following ${signals.length} signals from news RSS feeds, Reddit, Google Trends and X.`,
    `Identify the ${maxTrends} most viral-worthy topics RIGHT NOW and rank them by likely virality.`,
    '',
    'SIGNALS:',
    signalText,
    '',
    'INSTRUCTIONS:',
    `- Output strict JSON only: {"trends": [ { "slug", "title", "summary", "score", "keywords", "category" } ]}`,
    `- Return exactly ${maxTrends} trends (or fewer if signals are too few/redundant).`,
    '- slug: lowercase-kebab-case unique id, e.g. "elon-musk-twitter-rename".',
    `- title/summary: written in ${language === 'auto' ? 'the dominant language of the signals (usually en or id)' : language}.`,
    '- summary: 1-2 sentences on why it is hot and what angle makes a good short video.',
    '- score: integer 0-100, higher = more likely to go viral. Rank by score descending.',
    '- keywords: comma-separated 2-4 YouTube search keywords, most specific first.',
    '- category: one of tech, politics, sports, entertainment, business, science, health, world, lifestyle, other.',
    '- Prefer topics backed by multiple sources and recent timestamps; drop obvious duplicates.',
    '- Do NOT invent topics that are not supported by the signals.',
    '',
    'RESPOND WITH JSON ONLY.',
  ].join('\n');
}

/** Parses the LLM's response into `ResearchTrend[]`, tolerating markdown fences. */
export function parseResearchLlmResponse(raw: string): ResearchTrend[] {
  const text = stripCodeFences(raw).trim();
  if (!text) {
    throw AppError.researchAnalysisFailed('LLM returned an empty research response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tolerate a single trailing comma (common LLM mistake).
    const fixed = text.replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(fixed);
    } catch {
      throw AppError.researchAnalysisFailed('LLM research response was not valid JSON.');
    }
  }

  const trends = Array.isArray(parsed) ? parsed : (parsed as { trends?: unknown })?.trends;
  if (!Array.isArray(trends)) {
    throw AppError.researchAnalysisFailed('LLM research response missing "trends" array.');
  }

  return trends
    .map((trend): ResearchTrend | undefined => {
      if (typeof trend !== 'object' || trend === null) return undefined;
      const t = trend as Record<string, unknown>;
      if (typeof t.slug !== 'string' || typeof t.title !== 'string') return undefined;

      const score = clampScore(Number(t.score));
      const summary = typeof t.summary === 'string' ? t.summary : '';
      const keywords = typeof t.keywords === 'string' ? t.keywords : t.title;

      return {
        slug: t.slug,
        title: t.title,
        summary,
        score,
        keywords,
        category: typeof t.category === 'string' ? t.category : 'other',
        sources: [],
        videos: [],
      };
    })
    .filter((trend): trend is ResearchTrend => trend !== undefined)
    .sort((a, b) => b.score - a.score);
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
