import { z } from 'zod';
import type { RightsStatus } from './rights.types.js';

/** Rights statuses from the domain types. */
export const rightsStatusSchema = z.enum([
  'UNKNOWN',
  'PENDING',
  'AUTHORIZED',
  'LICENSED',
  'CC',
  'PD',
  'REJECTED',
  'EXPIRED',
]) as z.ZodType<RightsStatus>;

/** Zod schema for RightsMetadata. */
export const rightsMetadataSchema = z.object({
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  status: rightsStatusSchema.default('UNKNOWN'),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RightsMetadataInput = z.infer<typeof rightsMetadataSchema>;
