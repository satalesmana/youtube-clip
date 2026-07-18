import { join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { manifestSchema } from './schemas.js';
import { TemplateError } from './template-error.js';
import type { TemplateManifest } from '../types/template.js';

export interface ManifestServiceOptions {
  templatesDir: string;
}

/**
 * Discovers templates from the `templates/` directory at runtime — adding a
 * template means adding a folder, never touching this service.
 */
export interface IManifestService {
  discover(): Promise<TemplateManifest[]>;
  resolve(templateId?: string): Promise<TemplateManifest>;
  getTemplateDir(templateId: string): string;
}

export class ManifestService implements IManifestService {
  private cache: TemplateManifest[] | null = null;

  constructor(private readonly options: ManifestServiceOptions) {}

  async discover(): Promise<TemplateManifest[]> {
    if (this.cache) return this.cache;

    const entries = await readdir(this.options.templatesDir, { withFileTypes: true }).catch(() => []);
    const manifests: TemplateManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = join(this.options.templatesDir, entry.name, 'manifest.json');
      const raw = await readFile(manifestPath, 'utf-8').catch(() => null);
      if (raw === null) continue;

      const parsed = manifestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw TemplateError.invalidManifest(entry.name, parsed.error.issues.map((i) => i.message).join('; '));
      }

      manifests.push(parsed.data);
    }

    this.cache = manifests;
    return manifests;
  }

  async resolve(templateId?: string): Promise<TemplateManifest> {
    const manifests = await this.discover();

    if (!templateId) {
      const defaultManifest = manifests.find((m) => m.default);
      if (!defaultManifest) {
        throw TemplateError.notFound('(default)');
      }
      return defaultManifest;
    }

    const found = manifests.find((m) => m.id === templateId);
    if (!found) {
      throw TemplateError.notFound(templateId);
    }
    return found;
  }

  getTemplateDir(templateId: string): string {
    return join(this.options.templatesDir, templateId);
  }
}
