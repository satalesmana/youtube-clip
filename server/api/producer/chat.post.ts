import { defineEventHandler, readBody, createError } from 'h3';
import { z } from 'zod';
import { container } from '../../../src/container/index.js';
import { AppError } from '../../../src/utils/errors.js';
import { toHttpError } from '../../../src/utils/http-error.js';

const producerChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(4000),
    }),
  ).min(1).max(12),
  currentContext: z.object({
    video: z
      .object({
        videoId: z.string().optional(),
        title: z.string().optional(),
        channelTitle: z.string().optional(),
        duration: z.number().optional(),
      })
      .optional(),
    step: z.number().int().min(1).max(4),
    aspectRatio: z.enum(['9:16', '16:9', '1:1']),
    genre: z.string(),
    outputMode: z.enum(['reel', 'narration']),
    templateId: z.string(),
    hook: z.object({
      selectedHookIndex: z.number().nullable(),
      currentHookText: z.string().optional(),
      customHookText: z.string().optional(),
      customHookTag: z.string().optional(),
      visualPreset: z.string().optional(),
      layout: z.string().optional(),
      animation: z.string().optional(),
      typography: z.string().optional(),
      badgePreset: z.string().optional(),
      badgeColor: z.string().optional(),
      enableHookIntro: z.boolean(),
    }),
    clips: z.object({
      count: z.number().int().min(0).max(100),
      selectedIndices: z.array(z.number().int().min(0).max(100)).max(100),
      list: z
        .array(
          z.object({
            index: z.number(),
            start: z.number(),
            end: z.number(),
            duration: z.number(),
            score: z.number(),
            title: z.string(),
            hook: z.string().optional(),
          }),
        )
        .max(20).optional(),
    }),
    broll: z.object({
      enableBroll: z.boolean(),
      count: z.number().int().min(0).max(100),
      placements: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            query: z.string(),
            mood: z.string().optional(),
            source: z.string().optional(),
          }),
        )
        .max(20).optional(),
    }),
    outro: z.object({
      enableIntroOutro: z.boolean(),
      preset: z.string(),
      ctaText: z.string(),
      buttonText: z.string(),
      duration: z.number(),
      channelName: z.string(),
      logoUrl: z.string().max(2048).nullable().optional(),
    }),
    audio: z.object({
      ttsVoice: z.string().optional(),
      sourceVolume: z.number(),
      backgroundMusic: z
        .object({
          trackId: z.string().nullable().optional(),
          volume: z.number().optional(),
          autoDucking: z.boolean().optional(),
        })
      .optional(),
    }),
    dynamicStyles: z.record(z.string(), z.record(z.string(), z.union([z.string().max(160), z.number().finite()]))).optional(),
    dynamicOverlays: z.array(z.object({
      id: z.string().default(() => crypto.randomUUID()),
      start: z.number().finite(),
      end: z.number().finite(),
      type: z.enum(['sticker', 'callout', 'shape', 'text', 'badge', 'html']),
      content: z.string().max(5000),
      position: z.object({ x: z.union([z.string().max(40), z.number().finite()]).optional(), y: z.union([z.string().max(40), z.number().finite()]).optional() }).optional(),
      styles: z.record(z.string(), z.union([z.string().max(160), z.number().finite()])).optional(),
      animation: z.enum(['bounce', 'pulse', 'fade', 'slide', 'spin', 'none']).optional(),
    })).max(20).optional(),
  }),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = producerChatSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  try {
    const result = await container.producerService.chat(parsed.data);
    return {
      success: true,
      ...result,
    };
  } catch (err) {
    const appErr = err instanceof AppError ? err : AppError.internal('AI Producer gagal memproses permintaan.');
    throw createError(toHttpError(appErr));
  }
});
