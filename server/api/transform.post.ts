import { defineEventHandler, readBody, getHeader, setResponseHeader } from 'h3';
import { transformRequestSchema } from '../../src/schemas/transform.schema.js';
import { container } from '../../src/container/index.js';
import { createError } from 'h3';
import { toHttpError } from '../../src/utils/http-error.js';
import { AppError } from '../../src/utils/errors.js';
import { createLogger } from '../../src/utils/logger.js';
import type { TransformControllerDeps } from '../../src/controllers/transform.controller.js';
import { TransformController } from '../../src/controllers/transform.controller.js';

/**
 * POST /api/transform
 *
 * Runs the AI Viral Content Transformer pipeline:
 *   download/transcribe → content angle → script → TTS → video plan → render
 *
 * When the client sends `Accept: text/event-stream`, progress events are
 * streamed in real-time so the UI can update each stage as it completes.
 * Falls back to a standard JSON response for non-SSE clients.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = transformRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const request = parsed.data;
  const wantsSSE = (getHeader(event, 'accept') ?? '').includes('text/event-stream');

  // SSE: stream stage progress events in real-time
  if (wantsSSE) {
    setResponseHeader(event, 'content-type', 'text/event-stream');
    setResponseHeader(event, 'cache-control', 'no-cache');
    setResponseHeader(event, 'connection', 'keep-alive');

    const stream = new ReadableStream({
      start(streamController) {
        const encoder = new TextEncoder();
        const send = (eventName: string, data: unknown) => {
          streamController.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const deps: TransformControllerDeps = {
          youtubeService: container.youtubeService,
          transcriptService: container.transcriptService,
          whisperService: container.whisperService,
          contentAngleService: container.contentAngleService,
          scriptService: container.scriptService,
          ttsService: container.ttsService,
          videoPlanService: container.videoPlanService,
          storyService: container.storyService,
          templateService: container.templateService,
          templateRendererService: container.templateRendererService,
          assService: container.assService,
          subtitleService: container.subtitleService,
          outputsDir: container.paths.outputs,
          logger: createLogger('transform.controller'),
          assStyle: container.assStyle,
          compositionEngine: container.compositionEngine,
          contentCache: container.contentCache,
          reelComposer: container.reelComposer,
          onStage: (stage, opts) => send('stage', { stage, skipped: opts?.skipped ?? false }),
        };

        const pipeline = new TransformController(deps);
        pipeline.transform(request)
          .then((result) => {
            send('result', result);
            streamController.close();
          })
          .catch((error) => {
            send('error', { message: error?.message ?? 'Transform failed' });
            streamController.close();
          });
      },
      cancel() {
        // Client disconnected — abort is handled by h3 automatically
      },
    });

    return stream;
  }

  // Regular JSON response (backward compatible)
  const deps: TransformControllerDeps = {
    youtubeService: container.youtubeService,
    transcriptService: container.transcriptService,
    whisperService: container.whisperService,
    contentAngleService: container.contentAngleService,
    scriptService: container.scriptService,
    ttsService: container.ttsService,
    videoPlanService: container.videoPlanService,
    storyService: container.storyService,
    templateService: container.templateService,
    templateRendererService: container.templateRendererService,
    assService: container.assService,
    subtitleService: container.subtitleService,
    outputsDir: container.paths.outputs,
    logger: createLogger('transform.controller'),
    assStyle: container.assStyle,
    compositionEngine: container.compositionEngine,
    contentCache: container.contentCache,
    reelComposer: container.reelComposer,
  };

  const controller = new TransformController(deps);
  const result = await controller.transform(request);
  return result;
});
