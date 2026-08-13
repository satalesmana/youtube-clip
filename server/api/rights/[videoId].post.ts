import { defineEventHandler, readBody } from 'h3';
import { container } from '../../../src/container/index.js';
import { createError } from 'h3';
import { z } from 'zod';
import type { RightsStatus } from '../../../src/rights/rights.types.js';

/** Request schema for updating rights status. */
const updateRightsSchema = z.object({
  status: z.enum(['PENDING', 'AUTHORIZED', 'LICENSED', 'CC', 'PD', 'REJECTED', 'EXPIRED']),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/rights/:videoId
 * Updates the rights status for a video.
 */
export default defineEventHandler(async (event) => {
  const videoId = event.context.params?.videoId;
  if (!videoId) {
    throw createError({ statusCode: 400, message: 'videoId is required' });
  }

  const body = await readBody(event);
  const parsed = updateRightsSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: `Invalid request: ${parsed.error.message}` });
  }

  const rights = await container.rightsService.updateStatus(videoId, parsed.data.status as RightsStatus, {
    approvedBy: parsed.data.approvedBy,
    notes: parsed.data.notes,
  });

  const canPublish = await container.rightsService.canPublish(videoId);
  return { ...rights, canPublish: canPublish.publishable };
});
