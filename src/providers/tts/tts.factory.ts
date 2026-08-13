import { AppError } from '../../utils/errors.js';
import type { Logger } from '../../utils/logger.js';
import type { ITTSProvider } from './tts.provider.js';
import { EdgeTtsProvider } from './edge-tts.provider.js';
import type { EdgeTtsProviderOptions } from './edge-tts.provider.js';
import { OpenAiTtsProvider } from './openai-tts.provider.js';
import type { OpenAiTtsProviderOptions } from './openai-tts.provider.js';

export type TTSProviderKind = 'edge-tts' | 'openai';

export interface TtsProviderFactoryOptions {
  kind: TTSProviderKind;
  /** Options for edge-tts (used when kind === 'edge-tts'). */
  edge?: Partial<EdgeTtsProviderOptions>;
  /** Options for OpenAI-compatible (used when kind === 'openai'). */
  openai?: Partial<OpenAiTtsProviderOptions>;
  logger: Logger;
}

/** Creates a TTS provider instance based on the configured kind. */
export function createTtsProvider(options: TtsProviderFactoryOptions): ITTSProvider {
  const { kind, logger } = options;

  switch (kind) {
    case 'edge-tts':
      return new EdgeTtsProvider({
        outputDir: options.edge?.outputDir ?? 'outputs',
        binaryPath: options.edge?.binaryPath,
        rate: options.edge?.rate,
        logger,
      });
    case 'openai': {
      if (!options.openai?.baseUrl || !options.openai?.apiKey) {
        throw AppError.validation('OpenAI TTS requires baseUrl and apiKey.');
      }
      return new OpenAiTtsProvider({
        outputDir: options.openai.outputDir ?? 'outputs',
        baseUrl: options.openai.baseUrl,
        apiKey: options.openai.apiKey,
        model: options.openai.model,
        rate: options.openai.rate,
        logger,
      });
    }
    default:
      throw AppError.validation(`Unknown TTS provider kind: ${String(kind)}`);
  }
}
