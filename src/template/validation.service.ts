import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { ALLOWED_BINDING_PATHS, parseBindingPath } from './binding.service.js';
import { TemplateError } from './template-error.js';
import type { ILayerRegistry } from './layer-registry.js';
import type { Template, TemplateManifest } from '../types/template.js';

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** Types intentionally handled outside the registry (see `filtergraph.service.ts`). */
const IMPLICITLY_SUPPORTED_TYPES = new Set(['subtitle']);
const STATIC_ASSET_TYPES = new Set(['background', 'image', 'logo']);

const COLOR_FIELDS = ['color', 'backgroundColor', 'outlineColor', 'shadowColor'] as const;

/** Validates a loaded manifest + template before it's ever handed to layout/rendering. */
export interface IValidationService {
  validate(manifest: TemplateManifest, template: Template, templateDir: string): Promise<void>;
}

export class ValidationService implements IValidationService {
  constructor(private readonly layerRegistry: ILayerRegistry) {}

  async validate(manifest: TemplateManifest, template: Template, templateDir: string): Promise<void> {
    if (!ASPECT_RATIO_PATTERN.test(manifest.aspectRatio)) {
      throw TemplateError.invalidManifest(manifest.id, `aspectRatio "${manifest.aspectRatio}" must look like "9:16".`);
    }
    if (!VERSION_PATTERN.test(manifest.version)) {
      throw TemplateError.invalidManifest(manifest.id, `version "${manifest.version}" must look like "1.0.0".`);
    }

    const seenIds = new Set<string>();

    for (const layer of template.layers) {
      if (seenIds.has(layer.id)) {
        throw TemplateError.duplicateLayerId(manifest.id, layer.id);
      }
      seenIds.add(layer.id);

      if (!IMPLICITLY_SUPPORTED_TYPES.has(layer.type) && !this.layerRegistry.has(layer.type)) {
        throw TemplateError.unsupportedLayer(manifest.id, layer.id, layer.type);
      }

      this.validateBinding(manifest.id, layer.id, layer.binding);
      await this.validateColors(manifest.id, layer);
      this.validateCoordinates(manifest.id, layer);
      await this.validateStaticAsset(manifest.id, layer, templateDir);
    }
  }

  private validateBinding(templateId: string, layerId: string, binding: string | undefined): void {
    if (!binding) return;

    const path = parseBindingPath(binding);
    if (!path || !(ALLOWED_BINDING_PATHS as readonly string[]).includes(path)) {
      throw TemplateError.invalidBinding(templateId, layerId, binding);
    }
  }

  private async validateColors(
    templateId: string,
    layer: Template['layers'][number],
  ): Promise<void> {
    for (const field of COLOR_FIELDS) {
      const value = layer.style[field];
      if (typeof value === 'string' && !HEX_COLOR_PATTERN.test(value)) {
        throw TemplateError.invalidColor(templateId, layer.id, field, value);
      }
    }

    if (layer.style.gradient) {
      for (const field of ['from', 'to'] as const) {
        const value = layer.style.gradient[field];
        if (!HEX_COLOR_PATTERN.test(value)) {
          throw TemplateError.invalidColor(templateId, layer.id, `gradient.${field}`, value);
        }
      }
    }
  }

  private validateCoordinates(templateId: string, layer: Template['layers'][number]): void {
    const { position } = layer.style;

    if (position.mode === 'relative') {
      if (!position.region) {
        throw TemplateError.invalidCoordinates(templateId, layer.id, 'relative layers must declare a region.');
      }
      if (position.heightFraction !== undefined && position.heightFraction <= 0) {
        throw TemplateError.invalidCoordinates(templateId, layer.id, 'heightFraction must be positive.');
      }
      return;
    }

    for (const field of ['x', 'y', 'width', 'height'] as const) {
      const value = position[field];
      if (value === undefined) continue;
      if (typeof value === 'number' && Number.isFinite(value)) continue;
      if (typeof value === 'string' && (/^-?\d+(\.\d+)?%$/.test(value) || Number.isFinite(Number(value)))) continue;
      throw TemplateError.invalidCoordinates(templateId, layer.id, `"${field}" must be a number or a "NN%" string.`);
    }
  }

  private async validateStaticAsset(
    templateId: string,
    layer: Template['layers'][number],
    templateDir: string,
  ): Promise<void> {
    if (!STATIC_ASSET_TYPES.has(layer.type)) return;
    if (layer.binding || !layer.style.src) return;

    const assetPath = join(templateDir, layer.style.src);
    const exists = await access(assetPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw TemplateError.missingAsset(templateId, layer.id, layer.style.src);
    }
  }
}
