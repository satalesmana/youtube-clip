import { z } from 'zod';

/** Structural (shape-only) validation for `manifest.json` / `template.json`. Semantic checks live in `validation.service.ts`. */

export const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  default: z.boolean().optional(),
  description: z.string().optional(),
  aspectRatio: z.string().min(1),
});

const layerPositionSchema = z.object({
  mode: z.enum(['absolute', 'relative']),
  x: z.union([z.number(), z.string()]).optional(),
  y: z.union([z.number(), z.string()]).optional(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  region: z.enum(['top', 'middle', 'bottom']).optional(),
  heightFraction: z.number().positive().optional(),
});

const layerStyleSchema = z
  .object({
    position: layerPositionSchema,
    align: z.enum(['left', 'center', 'right']).optional(),
    verticalAlign: z.enum(['top', 'center', 'bottom']).optional(),
    padding: z.number().min(0).optional(),
    margin: z.number().min(0).optional(),
    zIndex: z.number().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    backgroundFit: z.enum(['block', 'line']).optional(),
    backgroundPadding: z.number().min(0).optional(),
    opacity: z.number().min(0).max(1).optional(),
    gradient: z
      .object({ from: z.string(), to: z.string(), direction: z.enum(['vertical', 'horizontal']).optional() })
      .optional(),
    font: z.string().optional(),
    fontSize: z.number().positive().optional(),
    minFontSize: z.number().positive().optional(),
    bold: z.boolean().optional(),
    outlineColor: z.string().optional(),
    outlineWidth: z.number().min(0).optional(),
    shadowColor: z.string().optional(),
    shadowDepth: z.number().min(0).optional(),
    fit: z.enum(['contain', 'cover', 'blur-background']).optional(),
    src: z.string().optional(),
  })
  .catchall(z.unknown());

const layerTypeSchema = z.enum([
  'background',
  'gradient',
  'rectangle',
  'image',
  'logo',
  'header',
  'title',
  'text',
  'video',
  'subtitle',
  'watermark',
]);

const templateLayerSchema = z.object({
  id: z.string().min(1),
  type: layerTypeSchema,
  binding: z.string().optional(),
  text: z.string().optional(),
  optional: z.boolean().optional(),
  visible: z.boolean().optional(),
  style: layerStyleSchema,
});

export const templateSchema = z.object({
  id: z.string().min(1),
  canvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    safeArea: z
      .object({
        top: z.number().min(0).optional(),
        right: z.number().min(0).optional(),
        bottom: z.number().min(0).optional(),
        left: z.number().min(0).optional(),
      })
      .optional(),
  }),
  layers: z.array(templateLayerSchema).min(1),
});
