import { access } from 'node:fs/promises';
import type { RenderContext, TemplateLayer } from '../types/template.js';
import { TemplateError } from './template-error.js';

/** The only variable paths a `{{a.b}}` binding may reference. */
export const ALLOWED_BINDING_PATHS = [
  'clip.title',
  'clip.score',
  'clip.duration',
  'clip.start',
  'clip.end',
  'video.path',
  'subtitle.ass',
  'channel.name',
  'channel.logo',
  'thumbnail.path',
  'commentary.text',
] as const;

export type AllowedBindingPath = (typeof ALLOWED_BINDING_PATHS)[number];

const REQUIRED_BINDING_PATHS = new Set<AllowedBindingPath>(['clip.title', 'video.path', 'subtitle.ass']);

const BINDING_PATTERN = /^\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}$/;

/** Parses `"{{a.b}}"` into `"a.b"`, or returns `null` if the syntax doesn't match. */
export function parseBindingPath(binding: string): string | null {
  const match = BINDING_PATTERN.exec(binding.trim());
  return match ? (match[1] as string) : null;
}

/** Types whose bound value must be a real, readable file on disk to count as "present". */
const FILE_BACKED_LAYER_TYPES = new Set(['image', 'logo']);

/**
 * Resolves `{{a.b}}` bindings against a `RenderContext`, and decides which
 * layers survive into layout — required-but-missing bindings stop rendering,
 * optional-but-missing bindings silently drop the layer.
 */
export interface IBindingService {
  resolve(path: AllowedBindingPath, context: RenderContext): string | undefined;
  resolveLayers(templateId: string, layers: TemplateLayer[], context: RenderContext): Promise<TemplateLayer[]>;
}

interface EnrichedLayer extends TemplateLayer {
  value?: string;
}

export class BindingService implements IBindingService {
  resolve(path: AllowedBindingPath, context: RenderContext): string | undefined {
    switch (path) {
      case 'clip.title':
        return context.clip.title || undefined;
      case 'clip.score':
        return Number.isFinite(context.clip.score) ? String(context.clip.score) : undefined;
      case 'clip.duration':
        return Number.isFinite(context.clip.duration) ? String(context.clip.duration) : undefined;
      case 'clip.start':
        return Number.isFinite(context.clip.start) ? String(context.clip.start) : undefined;
      case 'clip.end':
        return Number.isFinite(context.clip.end) ? String(context.clip.end) : undefined;
      case 'video.path':
        return context.video.path || undefined;
      case 'subtitle.ass':
        return context.subtitle.ass || undefined;
      case 'channel.name':
        return context.channel?.name || undefined;
      case 'channel.logo':
        return context.channel?.logo || undefined;
      case 'thumbnail.path':
        return context.thumbnail?.path || undefined;
      case 'commentary.text':
        return context.commentary?.text || undefined;
      default:
        return undefined;
    }
  }

  async resolveLayers(
    templateId: string,
    layers: TemplateLayer[],
    context: RenderContext,
  ): Promise<EnrichedLayer[]> {
    const resolved: EnrichedLayer[] = [];

    for (const layer of layers) {
      if (layer.visible === false) continue;

      if (!layer.binding) {
        resolved.push({ ...layer, value: layer.text });
        continue;
      }

      const path = parseBindingPath(layer.binding);
      if (!path || !(ALLOWED_BINDING_PATHS as readonly string[]).includes(path)) {
        throw TemplateError.invalidBinding(templateId, layer.id, layer.binding);
      }

      let value = this.resolve(path as AllowedBindingPath, context);

      if (value && FILE_BACKED_LAYER_TYPES.has(layer.type)) {
        const exists = await access(value)
          .then(() => true)
          .catch(() => false);
        if (!exists) value = undefined;
      }

      if (value === undefined) {
        if (layer.optional || !REQUIRED_BINDING_PATHS.has(path as AllowedBindingPath)) {
          continue;
        }
        throw TemplateError.missingRequiredBinding(templateId, layer.id, layer.binding);
      }

      resolved.push({ ...layer, value });
    }

    return resolved;
  }
}
