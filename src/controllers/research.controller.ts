import type { Logger } from '../utils/logger.js';
import type { IResearchService } from '../research/research.service.js';
import type { ResearchResult } from '../types/research.js';
import type { ResearchRequest } from '../schemas/research.schema.js';

export interface ResearchControllerDeps {
  researchService: IResearchService;
  logger: Logger;
}

/**
 * Orchestrates the research pipeline for `POST /api/research`.
 * Contains no HTTP-specific logic so it can be reused by future entry points
 * (e.g. a job queue worker) without modification.
 */
export class ResearchController {
  constructor(private readonly deps: ResearchControllerDeps) {}

  /** Runs the full viral-topic research pipeline. */
  async research(request?: ResearchRequest): Promise<ResearchResult> {
    const { researchService, logger } = this.deps;
    logger.info('Research started');
    const result = await researchService.research({
      enabledProviders: request?.providers,
      maxTrends: request?.max_trends,
      keyword: request?.keyword,
    });
    logger.info(
      { trendCount: result.trends.length, signalCount: result.signalCount },
      'Research completed',
    );
    return result;
  }
}
