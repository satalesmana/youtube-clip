const INDEX_URL = 'https://remocn.dev/llms-components.txt';
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_INDEX_CHARS = 80_000;
const MAX_DETAIL_CHARS = 5_000;

export interface RemocnCandidate {
  name: string;
  url: string;
  indexEntry: string;
  details?: string;
}

export interface RemocnCatalogLookup {
  available: boolean;
  message?: string;
  candidates: RemocnCandidate[];
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? [];
}

function normalizeDocsUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://remocn.dev');
    if (url.hostname !== 'remocn.dev' && url.hostname !== 'www.remocn.dev') return null;
    if (url.pathname.startsWith('/docs/') && !url.pathname.endsWith('.md')) url.pathname += '.md';
    return url.toString();
  } catch {
    return null;
  }
}

function rowsFromIndex(index: string): Array<{ name: string; url: string; row: string }> {
  return index.split('\n').flatMap((line) => {
    const row = line.trim();
    if (!row || !row.includes('|')) return [];
    const markdownLink = row.match(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/i);
    const rawUrl = markdownLink?.[2];
    const url = rawUrl ? normalizeDocsUrl(rawUrl) : null;
    if (!url) return [];
    const name = markdownLink?.[1]?.trim() || row.split('|').map((cell) => cell.trim()).find(Boolean) || '';
    return name ? [{ name, url, row: row.slice(0, 1_200) }] : [];
  });
}

export class RemocnCatalogService {
  private cachedIndex: { fetchedAt: number; text: string } | null = null;

  async findComponents(query: string, limit = 3): Promise<RemocnCatalogLookup> {
    const index = await this.fetchIndex();
    if (!index) {
      return {
        available: false,
        message: 'Katalog Remocn live tidak bisa diakses. Jangan menebak nama, props, atau durasi komponen.',
        candidates: [],
      };
    }

    const queryWords = [...new Set(words(query))];
    const ranked = rowsFromIndex(index).map((candidate) => {
      const haystack = `${candidate.name} ${candidate.row}`.toLowerCase();
      const score = queryWords.reduce((sum, word) => sum + (haystack.includes(word) ? (candidate.name.toLowerCase().includes(word) ? 3 : 1) : 0), 0);
      return { ...candidate, score };
    }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

    const candidates = await Promise.all(ranked.map(async ({ score: _score, ...candidate }) => {
      const details = await this.fetchText(candidate.url);
      return { name: candidate.name, url: candidate.url, indexEntry: candidate.row, ...(details ? { details } : {}) };
    }));

    return { available: true, candidates };
  }

  private async fetchIndex(): Promise<string | null> {
    if (this.cachedIndex && Date.now() - this.cachedIndex.fetchedAt < 10 * 60_000) return this.cachedIndex.text;
    const text = await this.fetchText(INDEX_URL);
    if (!text) return null;
    this.cachedIndex = { fetchedAt: Date.now(), text: text.slice(0, MAX_INDEX_CHARS) };
    return this.cachedIndex.text;
  }

  private async fetchText(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1' },
      });
      if (!response.ok) return null;
      return (await response.text()).slice(0, url === INDEX_URL ? MAX_INDEX_CHARS : MAX_DETAIL_CHARS);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
