import type { Logger } from '../utils/logger.js';
import type { HookCandidate, RankedHook } from './hook.types.js';

export interface HookRankerOptions {
  /** How many hooks to return (default 5, Plan §6). */
  topN?: number;
  /**
   * Penalty subtracted from the final score for each candidate beyond the
   * second that shares a style with already-selected hooks (Plan §6
   * diversity rule: never 5 hooks of the same style).
   */
  diversityPenalty?: number;
  /**
   * Normalized text similarity (0-1) above which two candidates count as
   * semantic duplicates and the weaker one is dropped.
   */
  duplicateSimilarityThreshold?: number;
}

/** Ranks scored candidates into a diverse Top-N list (Plan Phase 6). */
export interface IHookRanker {
  rank(candidates: HookCandidate[]): { ranked: RankedHook[]; duplicateCount: number };
}

/** Normalizes text for similarity comparison (lowercase, letters/digits only). */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Token set of a normalized string. */
function tokens(value: string): Set<string> {
  return new Set(normalizeText(value).split(' ').filter((t) => t.length > 1));
}

/**
 * Jaccard similarity between two texts (0 = disjoint, 1 = identical token
 * sets). Cheap, deterministic, and good enough to catch hooks that are the
 * same sentence reworded — the LLM was already told not to produce them.
 */
export function textSimilarity(a: string, b: string): number {
  const tokensA = tokens(a);
  const tokensB = tokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

/**
 * Deterministic ranker — no LLM involved (Plan §23: the engine decides WHICH).
 *
 * Pipeline: remove semantic duplicates → greedy selection with a diversity
 * penalty so the Top-N never stacks the same hook style.
 */
export class HookRanker implements IHookRanker {
  constructor(
    private readonly options: HookRankerOptions,
    private readonly logger: Logger,
  ) {}

  rank(candidates: HookCandidate[]): { ranked: RankedHook[]; duplicateCount: number } {
    const topN = this.options.topN ?? 5;
    const diversityPenalty = this.options.diversityPenalty ?? 8;
    const threshold = this.options.duplicateSimilarityThreshold ?? 0.6;

    // 1) Drop semantic duplicates — keep the higher-scoring of each pair.
    const sorted = [...candidates].sort(
      (a, b) => (b.score?.final ?? 0) - (a.score?.final ?? 0),
    );
    const unique: HookCandidate[] = [];
    let duplicateCount = 0;

    for (const candidate of sorted) {
      const candidateText = `${candidate.headline.text} ${candidate.spokenHook.text}`;
      const isDuplicate = unique.some((kept) => {
        const keptText = `${kept.headline.text} ${kept.spokenHook.text}`;
        return textSimilarity(candidateText, keptText) >= threshold;
      });
      if (isDuplicate) {
        duplicateCount += 1;
        this.logger.debug({ hookId: candidate.id }, 'Dropped duplicate hook candidate');
      } else {
        unique.push(candidate);
      }
    }

    // 2) Greedy selection with diversity penalty: pick the highest adjusted
    //    score, penalize same-style followers, repeat until Top-N is full.
    const remaining = [...unique];
    const selected: RankedHook[] = [];
    const styleCounts = new Map<string, number>();

    while (selected.length < topN && remaining.length > 0) {
      let bestIndex = 0;
      let bestAdjusted = -Infinity;

      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i]!;
        const sameStyleCount = styleCounts.get(candidate.style) ?? 0;
        // Plan §6: if sameStyleCount > 2 → reduce ranking score. Applied
        // progressively so the 3rd+ hook of one style keeps losing ground.
        const penalty = sameStyleCount >= 2 ? diversityPenalty * (sameStyleCount - 1) : 0;
        const adjusted = (candidate.score?.final ?? 0) - penalty;
        if (adjusted > bestAdjusted) {
          bestAdjusted = adjusted;
          bestIndex = i;
        }
      }

      const chosen = remaining.splice(bestIndex, 1)[0]!;
      styleCounts.set(chosen.style, (styleCounts.get(chosen.style) ?? 0) + 1);
      selected.push({
        ...chosen,
        rank: selected.length + 1,
        rankScore: Math.round(bestAdjusted * 10) / 10,
      });
    }

    this.logger.info(
      {
        inputCount: candidates.length,
        duplicateCount,
        rankedCount: selected.length,
        styles: selected.map((h) => h.style),
      },
      'Hook ranking completed',
    );

    return { ranked: selected, duplicateCount };
  }
}
