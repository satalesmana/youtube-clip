import { defineEventHandler, readBody } from 'h3';
import { container } from '../../src/container/index.js';
import { createError } from 'h3';
import { z } from 'zod';
import type { TransformRequestInput } from '../../src/schemas/transform.schema.js';
import { TransformController } from '../../src/controllers/transform.controller.js';
import { createLogger } from '../../src/utils/logger.js';

/** Request schema for transform with rights check. */
const transformWithRightsSchema = z.object({
  videoId: z.string().optional(),
  youtubeUrl: z.string().optional(),
  candidateId: z.number().int().min(0).default(0),
  selectedAngleId: z.string().optional(),
  template: z.string().optional(),
  channel: z.object({ name: z.string().optional(), logo: z.string().optional() }).optional(),
  language: z.enum(['auto', 'id', 'en']).default('auto'),
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/transform-with-rights
 * Runs the full transform pipeline with automatic rights gate check.
 * If rights status is UNKNOWN or REJECTED, returns error without rendering.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = transformWithRightsSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: `Invalid request: ${parsed.error.message}` });
  }

  const request = parsed.data as TransformRequestInput;
  const videoId = request.youtubeUrl
    ? new URL(request.youtubeUrl).searchParams.get('v') ?? ''
    : request.videoId;

  if (!videoId) {
    throw createError({ statusCode: 400, message: 'videoId or youtubeUrl is required' });
  }

  // Check rights gate first
  const rightsCheck = await container.rightsService.canPublish(videoId);
  if (!rightsCheck.publishable) {
    return {
      success: false,
      blocked: true,
      reason: rightsCheck.reason,
      rightsStatus: rightsCheck.status,
      videoId,
    };
  }

  // Build deps from container
  const deps = {
    youtubeService: container.youtubeService,
    transcriptService: container.transcriptService,
    whisperService: container.whisperService,
    contentAngleService: container.contentAngleService,
    scriptService: container.scriptService,
    ttsService: container.ttsService,
    videoPlanService: container.videoPlanService,
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    assService: container.assService,
    subtitleService: container.subtitleService,
    outputsDir: container.paths.outputs,
    logger: createLogger('transform.with-rights'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
  };

  const controller = new TransformController(deps);
  return controller.transform(request);
});
