import { AppError, type ErrorCode } from '../utils/errors.js';

interface TemplateErrorParams {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  templateId?: string;
  layerId?: string;
  cause?: unknown;
}

/**
 * `AppError` specialization for template-engine failures. Carries the
 * offending template/layer alongside the usual code/message/statusCode so
 * every template error is self-describing, per the spec's "every error
 * includes code, message, template, layer id" requirement.
 */
export class TemplateError extends AppError {
  readonly templateId?: string;
  readonly layerId?: string;

  constructor({ code, message, statusCode = 400, templateId, layerId, cause }: TemplateErrorParams) {
    super({ code, message, statusCode, cause });
    this.name = 'TemplateError';
    this.templateId = templateId;
    this.layerId = layerId;
  }

  static notFound(templateId: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_NOT_FOUND',
      message: `Template "${templateId}" was not found.`,
      statusCode: 404,
      templateId,
    });
  }

  static invalidManifest(templateId: string, message: string, cause?: unknown): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_MANIFEST',
      message: `Template "${templateId}" has an invalid manifest: ${message}`,
      templateId,
      cause,
    });
  }

  static invalidSchema(templateId: string, message: string, cause?: unknown): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_SCHEMA',
      message: `Template "${templateId}" has an invalid template definition: ${message}`,
      templateId,
      cause,
    });
  }

  static unsupportedLayer(templateId: string, layerId: string, type: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_UNSUPPORTED_LAYER',
      message: `Template "${templateId}" layer "${layerId}" uses unsupported layer type "${type}".`,
      templateId,
      layerId,
    });
  }

  static invalidCoordinates(templateId: string, layerId: string, message: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_COORDINATES',
      message: `Template "${templateId}" layer "${layerId}" has invalid coordinates: ${message}`,
      templateId,
      layerId,
    });
  }

  static missingAsset(templateId: string, layerId: string, assetPath: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_MISSING_ASSET',
      message: `Template "${templateId}" layer "${layerId}" references missing asset "${assetPath}".`,
      templateId,
      layerId,
    });
  }

  static invalidBinding(templateId: string, layerId: string, binding: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_BINDING',
      message: `Template "${templateId}" layer "${layerId}" has an invalid or unknown binding "${binding}".`,
      templateId,
      layerId,
    });
  }

  static duplicateLayerId(templateId: string, layerId: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_DUPLICATE_LAYER_ID',
      message: `Template "${templateId}" has duplicate layer id "${layerId}".`,
      templateId,
      layerId,
    });
  }

  static invalidColor(templateId: string, layerId: string, field: string, value: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_COLOR',
      message: `Template "${templateId}" layer "${layerId}" has an invalid color for "${field}": "${value}".`,
      templateId,
      layerId,
    });
  }

  static invalidFont(templateId: string, layerId: string, value: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_FONT',
      message: `Template "${templateId}" layer "${layerId}" has an invalid font: "${value}".`,
      templateId,
      layerId,
    });
  }

  /** Missing required binding (e.g. `clip.title`) — stops rendering for the affected clip. */
  static missingRequiredBinding(templateId: string, layerId: string, binding: string): TemplateError {
    return new TemplateError({
      code: 'TEMPLATE_INVALID_BINDING',
      message: `Template "${templateId}" layer "${layerId}" requires "${binding}", which is missing from the render context.`,
      statusCode: 500,
      templateId,
      layerId,
    });
  }

  override toJSON(): { message: string; code: ErrorCode; statusCode: number; template?: string; layer?: string } {
    return {
      ...super.toJSON(),
      template: this.templateId,
      layer: this.layerId,
    };
  }
}
