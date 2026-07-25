import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { templateSchema } from './schemas.js';
import { TemplateError } from './template-error.js';
import type { IManifestService } from './manifest.service.js';
import type { Template, TemplateManifest } from '../types/template.js';

export interface LoadedTemplate {
  manifest: TemplateManifest;
  template: Template;
  templateDir: string;
}

/** Reads and structurally parses a template's `manifest.json` + `template.json` from disk. */
export interface ITemplateLoaderService {
  load(templateId?: string): Promise<LoadedTemplate>;
}

export class TemplateLoaderService implements ITemplateLoaderService {
  constructor(private readonly manifestService: IManifestService) {}

  async load(templateId?: string): Promise<LoadedTemplate> {
    const manifest = await this.manifestService.resolve(templateId);
    const templateDir = this.manifestService.getTemplateDir(manifest.id);

    const templatePath = join(templateDir, 'template.json');
    const raw = await readFile(templatePath, 'utf-8').catch((error: unknown) => {
      throw TemplateError.invalidSchema(manifest.id, `could not read "${templatePath}".`, error);
    });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      throw TemplateError.invalidSchema(manifest.id, `"${templatePath}" is not valid JSON.`, error);
    }

    const parsed = templateSchema.safeParse(json);
    if (!parsed.success) {
      throw TemplateError.invalidSchema(manifest.id, parsed.error.issues.map((i) => i.message).join('; '));
    }

    if (parsed.data.id !== manifest.id) {
      throw TemplateError.invalidSchema(
        manifest.id,
        `template.json id "${parsed.data.id}" does not match manifest id "${manifest.id}".`,
      );
    }

    return { manifest, template: parsed.data, templateDir };
  }
}
