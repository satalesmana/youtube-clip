/**
 * Robust JSON parsing for LLM responses.
 *
 * LLMs (especially local/reasoning models) frequently return JSON that is not
 * strictly parseable: prose around the JSON, Markdown code fences, `<think>`
 * blocks, trailing commas, unquoted keys, single quotes, or truncation. This
 * module implements the multi-strategy parser proven in the research pipeline
 * so every LLM consumer shares one battle-tested implementation.
 */

/**
 * Parses `text` as JSON, trying increasingly aggressive recovery strategies:
 * 1. Direct `JSON.parse`.
 * 2. Extract the first `{...}`/`[...]` block, then parse.
 * 3. Fix common LLM JSON mistakes (comments, trailing commas, unquoted keys,
 *    single quotes, truncation), then parse.
 * 4. Deep brace-matching extraction + fixes, then parse.
 *
 * Throws the original `JSON.parse` error when every strategy fails.
 */
export function parseLlmJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to recovery strategies
  }

  const extracted = extractJsonFromText(trimmed);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch {
      // fall through
    }

    const fixed = fixLlmJson(extracted);
    try {
      return JSON.parse(fixed);
    } catch {
      // fall through
    }
  }

  const deepExtracted = extractJsonDeep(trimmed);
  if (deepExtracted) {
    const deepFixed = fixLlmJson(deepExtracted);
    return JSON.parse(deepFixed);
  }

  throw new SyntaxError('LLM response was not valid JSON.');
}

/** Strips `<think>...</think>` blocks and Markdown code fences. */
export function stripCodeFences(text: string): string {
  let cleaned = text;

  // Strip <think>...</think> tags (DeepSeek reasoning models output these before JSON)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

  return cleaned.trim();
}

/** Extracts the first JSON object or array block from text. */
export function extractJsonFromText(text: string): string | null {
  const objectMatch = /\{[\s\S]*\}/.exec(text);
  if (objectMatch) return objectMatch[0];

  const arrayMatch = /\[[\s\S]*\]/.exec(text);
  if (arrayMatch) return arrayMatch[0];

  return null;
}

/** More aggressive extraction: brace-matches from the first `{` (or `[`). */
export function extractJsonDeep(text: string): string | null {
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
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  if (depth > 0) return text.slice(start);
  return null;
}

function extractArrayDeep(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  if (depth > 0) return text.slice(start);
  return null;
}

/**
 * Fixes common JSON mistakes made by LLMs:
 * - Comments (single-line and multi-line)
 * - Trailing commas before } or ]
 * - Unquoted keys
 * - Single quotes instead of double quotes
 * - Truncated JSON (unclosed braces/brackets)
 */
export function fixLlmJson(text: string): string {
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
  if (!fixed.includes('"')) {
    fixed = fixed.replace(/'/g, '"');
  }

  // Fix truncated JSON by closing open braces/brackets
  const openBraces = (fixed.match(/{/g) ?? []).length;
  const closeBraces = (fixed.match(/}/g) ?? []).length;
  const openBrackets = (fixed.match(/\[/g) ?? []).length;
  const closeBrackets = (fixed.match(/]/g) ?? []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  return fixed;
}
