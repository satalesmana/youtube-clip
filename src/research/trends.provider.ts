import { runCommand } from '../utils/exec.js';
import type { Logger } from '../utils/logger.js';
import type { ResearchSourceItem } from '../types/media.js';

export interface TrendsProviderOptions {
  maxQueries: number;
  /** Optional ISO 3166-1 alpha-2 region code, e.g. `ID` (default: worldwide). */
  geo?: string;
}

export interface ITrendsProvider {
  /** Collects currently trending / rising search queries from Google Trends. */
  fetchTrendingQueries(): Promise<ResearchSourceItem[]>;
}

interface PytrendsRow {
  query?: string;
  value?: number;
  link?: string;
}

interface PytrendsPayload {
  data?: PytrendsRow[];
  error?: string;
}

/**
 * Google Trends provider backed by Pytrends. The Python helper is spawned
 * lazily on first use and its JSON output is parsed without adding any npm
 * dependency. When Pytrends (or its dependencies) is not installed, an empty
 * result is returned — the research pipeline treats Trends as optional.
 */
export class TrendsProvider implements ITrendsProvider {
  private ready: Promise<boolean> | null = null;

  constructor(
    private readonly options: TrendsProviderOptions,
    private readonly logger: Logger,
  ) {}

  async fetchTrendingQueries(): Promise<ResearchSourceItem[]> {
    const { maxQueries, geo } = this.options;
    const payload = await this.runPytrends(maxQueries, geo);
    if (!payload) return [];

    const rows = (payload.data ?? []).filter((row): row is PytrendsRow => Boolean(row?.query));

    return rows.map((row) => ({
      source: 'trends',
      origin: geo ? `Google Trends (${geo})` : 'Google Trends',
      title: row.query!,
      url: row.link,
      engagement: typeof row.value === 'number' ? row.value : undefined,
    }));
  }

  private async runPytrends(maxQueries: number, geo?: string): Promise<PytrendsPayload | null> {
    const ready = await this.ensureReady();
    if (!ready) return null;

    const script = [
      'import json,sys',
      'try:',
      '  from pytrends.request import TrendReq',
      'except Exception:',
      '  print(json.dumps({"data": []}))',
      '  sys.exit(0)',
      `kwargs = {"hl": "en-US", "tz": 0}`,
      `geo = ${JSON.stringify(geo ?? '')}`,
      `if geo: kwargs["geo"] = geo`,
      'pt = TrendReq(**kwargs)',
      'try:',
      '  df = pt.trending_searches(pn="united_states" if geo == "US" else "indonesia" if geo == "ID" else "")',
      'except Exception:',
      '  df = pt.trending_searches()',
      'queries = []',
      'if df is not None and len(df.columns) > 0:',
      `  for i, v in df[df.columns[0]].head(${maxQueries}).items():`,
      '    queries.append({"query": str(v), "value": None, "link": None})',
      'print(json.dumps({"data": queries}))',
    ].join('\n');

    try {
      const { stdout } = await runCommand('python3', ['-c', script], { logger: this.logger });
      return JSON.parse(stdout) as PytrendsPayload;
    } catch (error) {
      this.logger.warn({ err: error }, 'Google Trends fetch failed, returning empty result');
      return null;
    }
  }

  /** Verifies `pytrends` is importable; caches the result for the process lifetime. */
  private ensureReady(): Promise<boolean> {
    if (this.ready) return this.ready;

    this.ready = (async () => {
      try {
        const { stdout } = await runCommand('python3', [
          '-c',
          'import pytrends; print("ok")',
        ]);
        return stdout.trim() === 'ok';
      } catch {
        this.logger.warn(
          'Pytrends is not installed; Google Trends source disabled ' +
            '(install with: pip install pytrends)',
        );
        return false;
      }
    })();

    return this.ready;
  }
}
