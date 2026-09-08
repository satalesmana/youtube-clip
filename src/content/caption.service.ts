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
  llmCaptionItemSchema,
  type LlmCaptionItem,
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
  /**
   * Template string for the source-credit line appended to every caption.
   * Placeholders: `{channel}` → source channel name, `{url}` → source video URL.
   * Empty string → no credit appended.
   */
  creditTemplate: string;
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

    /**
     * Resolve the credit line from the configured template.
     * Only populated when both a template and a source channel are known.
     */
    const creditLine = this.buildCreditLine(context);

    const allPlatforms: SocialPlatform[] = ['tiktok', 'instagram', 'youtube_shorts', 'x', 'threads', 'facebook', 'facebook_reels'];
    const targetPlatforms: SocialPlatform[] = context.platforms && context.platforms.length > 0
      ? context.platforms.filter((p) => allPlatforms.includes(p))
      : allPlatforms;

    this.logger.info(
      { videoId: context.videoId, jobId: context.jobId, tone, lang: effectiveLang, platforms: targetPlatforms },
      'Generating viral social captions for target platforms',
    );

    let parsedResult: Partial<Record<SocialPlatform, LlmCaptionItem>> | null = null;

    try {
      parsedResult = await retry(
        async () => {
          const raw = await this.provider.chat({
            model: this.options.model,
            system: buildCaptionSystemPrompt(tone, effectiveLang, targetPlatforms),
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
          const extractedMap: Partial<Record<SocialPlatform, LlmCaptionItem>> = {};

          if (typeof json === 'object' && json !== null) {
            const rawObj = json as Record<string, unknown>;
            for (const p of targetPlatforms) {
              const rawItem = rawObj[p];
              if (rawItem && typeof rawItem === 'object') {
                const itemRes = llmCaptionItemSchema.safeParse(rawItem);
                if (itemRes.success) {
                  extractedMap[p] = itemRes.data;
                } else {
                  this.logger.debug(
                    { platform: p, issues: itemRes.error.issues },
                    'Platform caption item failed schema validation',
                  );
                }
              }
            }
          }

          const validKeys = Object.keys(extractedMap) as SocialPlatform[];
          if (validKeys.length === 0) {
            this.logger.warn({ json }, 'LLM caption response contained no valid platform objects');
            throw AppError.llmInvalidResponse('No valid platform caption found in LLM response.');
          }

          this.logger.info(
            { validPlatforms: validKeys, count: validKeys.length },
            'Successfully parsed platform captions from LLM',
          );

          return extractedMap;
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

    const fallback = generateFallbackCaptions(context);
    const captionMap: Partial<Record<SocialPlatform, PlatformCaption>> = {};

    for (const p of targetPlatforms) {
      const item = parsedResult?.[p];
      if (item && (item.hook || item.body || item.title)) {
        const formatted = assembleFormattedCaption(p, item, creditLine);
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
          creditLine: creditLine || undefined,
          strategyExplanation: item.strategyExplanation || '',
          recommendedAudioVibe: item.recommendedAudioVibe,
          tags: item.tags,
        };
      } else if (fallback.captions[p]) {
        captionMap[p] = fallback.captions[p];
      }
    }

    const result: VideoCaptionResult = {
      videoId: context.videoId,
      jobId: context.jobId,
      sourceTitle: context.sourceTitle,
      channelName: context.sourceChannel,
      language: effectiveLang,
      tone,
      captions: captionMap,
      generatedAt: new Date().toISOString(),
    };

    // Persist to workspace disk
    await this.saveCaptions(result);

    return result;
  }

  /**
   * Resolves `{channel}` and `{url}` placeholders in `creditTemplate`
   * (context override or configured fallback) using the given generation context.
   * Returns an empty string when the template is empty or when {channel} is required but missing.
   */
  private buildCreditLine(context: CaptionGenerationContext): string {
    const template = context.creditTemplate !== undefined ? context.creditTemplate : this.options.creditTemplate;
    if (!template || !template.trim()) return '';

    if (template.includes('{channel}') && !context.sourceChannel) {
      return '';
    }

    return template
      .replace(/\{channel\}/g, context.sourceChannel ?? '')
      .replace(/\{url\}/g, context.sourceUrl ?? '')
      .trim();
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
