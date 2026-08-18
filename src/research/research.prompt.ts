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

  // Strategy 1: Direct parse.
  try {
    parsed = JSON.parse(text);
  } catch {
    // Strategy 2: Try to extract JSON object/array from surrounding text.
    const extracted = extractJsonFromText(text);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch {
        // Strategy 3: Fix common LLM JSON mistakes.
        const fixed = fixLlmJson(extracted);
        try {
          parsed = JSON.parse(fixed);
        } catch {
          // Strategy 4: Try to extract even more aggressively (nested braces).
          const deepExtracted = extractJsonDeep(text);
          if (deepExtracted) {
            const deepFixed = fixLlmJson(deepExtracted);
            try {
              parsed = JSON.parse(deepFixed);
            } catch {
              throw AppError.researchAnalysisFailed('LLM research response was not valid JSON.');
            }
          } else {
            throw AppError.researchAnalysisFailed('LLM research response was not valid JSON.');
          }
        }
      }
    } else {
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
  let cleaned = text;

  // Strip <think>...</think> tags (DeepSeek reasoning models output these before JSON)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Strip <think>...</think> tags (some models use this variant)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

  return cleaned.trim();
}

/**
 * Extracts a JSON object or array from text that may contain surrounding prose.
 * Looks for the first `{...}` or `[...]` block.
 */
function extractJsonFromText(text: string): string | null {
  // Try to find a JSON object (starts with { ends with })
  const objectMatch = /\{[\s\S]*\}/.exec(text);
  if (objectMatch) return objectMatch[0];

  // Try to find a JSON array (starts with [ ends with ])
  const arrayMatch = /\[[\s\S]*\]/.exec(text);
  if (arrayMatch) return arrayMatch[0];

  return null;
}

/**
 * More aggressive extraction: finds the first `{` and matches braces to find
 * the complete object, ignoring text before/after.
 */
function extractJsonDeep(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    const arrStart = text.indexOf('[');
    if (arrStart === -1) return null;
    return extractArrayDeep(text, arrStart);
  }
  return extractObjectDeep(text, start);
}

function extractObjectDeep(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  // If we get here, the JSON might be truncated — return what we have
  // and let fixLlmJson try to repair it.
  if (depth > 0) {
    return text.slice(start);
  }
  return null;
}

function extractArrayDeep(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  if (depth > 0) {
    return text.slice(start);
  }
  return null;
}

/**
 * Fixes common JSON mistakes made by LLMs:
 * - Trailing commas before } or ]
 * - Comments (single-line and multi-line)
 * - Unquoted keys
 * - Single quotes instead of double quotes
 * - Truncated JSON (unclosed braces/brackets)
 */
function fixLlmJson(text: string): string {
  let fixed = text;

  // Remove single-line comments (// ...)
  fixed = fixed.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments (/* ... */)
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  // Fix unquoted keys: {"key": ...} patterns where key isn't quoted
  fixed = fixed.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  // Replace single quotes with double quotes (simple cases only)
  // Only do this if there are no double quotes as values
  if (!fixed.includes('"')) {
    fixed = fixed.replace(/'/g, '"');
  }

  // Try to fix truncated JSON by closing open braces/brackets
  const openBraces = (fixed.match(/{/g) ?? []).length;
  const closeBraces = (fixed.match(/}/g) ?? []).length;
  const openBrackets = (fixed.match(/\[/g) ?? []).length;
  const closeBrackets = (fixed.match(/]/g) ?? []).length;

  // Close any unclosed arrays first, then objects
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  // Remove any trailing comma before the closing brackets we just added
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  return fixed;
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
