import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IOllamaProvider } from '../providers/ollama.provider.js';
import type { Logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { parseLlmJson } from '../utils/llm-json.js';
import { hashSeed } from '../utils/seed.js';
import { AppError } from '../utils/errors.js';
import type {
  CaptionGenerationContext,
  CaptionTone,
  PlatformCaption,
  SocialPlatform,
  VideoCaptionResult,
} from '../types/caption.js';
import {
  llmCaptionsResponseSchema,
  type LlmCaptionsResponse,
} from '../schemas/caption.schema.js';
import {
  buildCaptionSystemPrompt,
  buildCaptionUserPrompt,
  assembleFormattedCaption,
  generateFallbackCaptions,
} from './caption.prompt.js';

export interface CaptionServiceOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  outputsDir: string;
}

export interface ICaptionService {
  generateCaptions(context: CaptionGenerationContext): Promise<VideoCaptionResult>;
  getSavedCaptions(videoId: string, jobId?: string): Promise<VideoCaptionResult | null>;
}

export class CaptionService implements ICaptionService {
  constructor(
    private readonly provider: IOllamaProvider,
    private readonly options: CaptionServiceOptions,
    private readonly logger: Logger,
  ) {}

  async generateCaptions(context: CaptionGenerationContext): Promise<VideoCaptionResult> {
    const tone: CaptionTone = context.tone || 'viral_hype';
    const lang = context.targetLanguage || context.videoLanguage || 'auto';
    const effectiveLang = lang === 'auto' ? 'id' : lang;

    this.logger.info(
      { videoId: context.videoId, jobId: context.jobId, tone, lang: effectiveLang },
      'Generating viral social captions for all platforms',
    );

    let parsedResult: LlmCaptionsResponse | null = null;

    try {
      parsedResult = await retry(
        async () => {
          const raw = await this.provider.chat({
            model: this.options.model,
            system: buildCaptionSystemPrompt(tone, effectiveLang),
            prompt: buildCaptionUserPrompt(context),
            temperature: this.options.temperature ?? 0.1,
            timeoutMs: this.options.timeoutMs,
            responseFormat: 'json_object',
            seed: hashSeed(
              'caption',
              context.videoId,
              context.sourceTitle,
              tone,
              effectiveLang,
              context.angle?.title || '',
              context.angle?.hook || '',
            ),
          });

          const json = parseLlmJson(raw);
          const validated = llmCaptionsResponseSchema.safeParse(json);

          if (!validated.success) {
            this.logger.warn({ err: validated.error }, 'LLM caption response schema validation failed');
            throw AppError.llmInvalidResponse(`Invalid caption schema: ${validated.error.message}`);
          }

          return validated.data;
        },
        {
          attempts: this.options.maxRetries,
          onRetry: (err, attempt) => {
            this.logger.warn({ attempt, err }, 'Retrying caption generation');
          },
        },
      );
    } catch (err) {
      this.logger.error({ err }, 'Caption generation via LLM failed, falling back to heuristic generator');
    }

    let result: VideoCaptionResult;

    if (parsedResult) {
      const platforms: SocialPlatform[] = ['tiktok', 'instagram', 'youtube_shorts', 'x', 'threads'];
      const captionMap: Record<SocialPlatform, PlatformCaption> = {} as Record<SocialPlatform, PlatformCaption>;

      for (const p of platforms) {
        const item = parsedResult[p];
        const formatted = assembleFormattedCaption(p, item);
        captionMap[p] = {
          platform: p,
          title: item.title,
          hook: item.hook,
          body: item.body,
          callToAction: item.callToAction,
          hashtags: item.hashtags || [],
          formattedCaption: formatted,
          searchKeywords: item.searchKeywords || [],
          characterCount: formatted.length,
          strategyExplanation: item.strategyExplanation,
          recommendedAudioVibe: item.recommendedAudioVibe,
          tags: item.tags,
        };
      }

      result = {
        videoId: context.videoId,
        jobId: context.jobId,
        sourceTitle: context.sourceTitle,
        channelName: context.sourceChannel,
        language: effectiveLang,
        tone,
        captions: captionMap,
        generatedAt: new Date().toISOString(),
      };
    } else {
      result = generateFallbackCaptions(context);
    }

    // Persist to workspace disk
    await this.saveCaptions(result);

    return result;
  }

  /**
   * Persists generated captions to `outputs/{videoId}/captions/{jobId}.json`
   * and also as `latest.json` for quick retrieval.
   */
  private async saveCaptions(result: VideoCaptionResult): Promise<void> {
    if (!result.videoId) return;
    try {
      const captionsDir = join(this.options.outputsDir, result.videoId, 'captions');
      await mkdir(captionsDir, { recursive: true });

      const content = JSON.stringify(result, null, 2);
      if (result.jobId) {
        await writeFile(join(captionsDir, `${result.jobId}.json`), content, 'utf-8');
      }
      await writeFile(join(captionsDir, 'latest.json'), content, 'utf-8');
      this.logger.debug({ videoId: result.videoId, jobId: result.jobId }, 'Saved captions to disk');
    } catch (err) {
      this.logger.warn({ err, videoId: result.videoId }, 'Failed to save captions to disk');
    }
  }

  /**
   * Loads saved captions from disk.
   */
  async getSavedCaptions(videoId: string, jobId?: string): Promise<VideoCaptionResult | null> {
    const captionsDir = join(this.options.outputsDir, videoId, 'captions');
    const targetFile = jobId
      ? join(captionsDir, `${jobId}.json`)
      : join(captionsDir, 'latest.json');

    try {
      const raw = await readFile(targetFile, 'utf-8');
      const parsed = JSON.parse(raw) as VideoCaptionResult;
      return { ...parsed, cached: true };
    } catch {
      // If specific jobId was requested but not found, try latest.json
      if (jobId) {
        try {
          const raw = await readFile(join(captionsDir, 'latest.json'), 'utf-8');
          const parsed = JSON.parse(raw) as VideoCaptionResult;
          return { ...parsed, cached: true };
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
