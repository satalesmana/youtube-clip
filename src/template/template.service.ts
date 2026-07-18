import type { ITemplateLoaderService, LoadedTemplate } from './template-loader.service.js';
import type { IValidationService } from './validation.service.js';
import type { IBindingService } from './binding.service.js';
import type { RenderContext, TemplateLayer } from '../types/template.js';

export interface EnrichedLayer extends TemplateLayer {
  value?: string;
}

/**
 * Facade for the "Load → Validate → Resolve Variables → Hide Missing
 * Optional Layers" steps of the pipeline. `load` is a per-REQUEST operation
 * (a template is shared across every clip in a job); `resolveLayers` is
 * per-CLIP, since bindings depend on that clip's own context.
 */
export interface ITemplateService {
  load(templateId?: string): Promise<LoadedTemplate>;
  resolveLayers(loaded: LoadedTemplate, context: RenderContext): Promise<EnrichedLayer[]>;
}

export class TemplateService implements ITemplateService {
  constructor(
    private readonly loaderService: ITemplateLoaderService,
    private readonly validationService: IValidationService,
    private readonly bindingService: IBindingService,
  ) {}

  async load(templateId?: string): Promise<LoadedTemplate> {
    const loaded = await this.loaderService.load(templateId);
    await this.validationService.validate(loaded.manifest, loaded.template, loaded.templateDir);
    return loaded;
  }

  async resolveLayers(loaded: LoadedTemplate, context: RenderContext): Promise<EnrichedLayer[]> {
    return this.bindingService.resolveLayers(loaded.manifest.id, loaded.template.layers, context);
  }
}
