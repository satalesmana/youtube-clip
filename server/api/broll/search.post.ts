import { defineEventHandler, readBody, createError } from 'h3';
import { z } from 'zod';
import { container } from '../../../src/container/index.js';
import { AppError } from '../../../src/utils/errors.js';
import { toHttpError } from '../../../src/utils/http-error.js';

const brollSearchSchema = z.object({
  query: z.string().min(1, 'Query pencarian tidak boleh kosong'),
  minDuration: z.number().positive().optional(),
  maxResults: z.number().int().min(1).max(20).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined);
  const parsed = brollSearchSchema.safeParse(body);

  if (!parsed.success) {
    throw createError(toHttpError(AppError.validation(parsed.error.message)));
  }

  const { query, minDuration, maxResults } = parsed.data;

  const assets = await container.brollService.searchFootage(query, {
    minDurationSeconds: minDuration ?? 2,
    maxResults: maxResults ?? 6,
  });

  return {
    success: true,
    query,
    count: assets.length,
    assets,
  };
});
