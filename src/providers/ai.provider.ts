export interface AiChatOptions {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  /** Fixed seed for deterministic output (same prompt + seed → same result). */
  seed?: number;
  /** Instructs the model to return a JSON object (if supported by provider) */
  responseFormat?: 'json_object';
  /** Max completion tokens to generate. */
  maxTokens?: number;
}

export interface AiVisionOptions {
  model?: string;
  prompt: string;
  imagePath?: string;
  imageBuffer?: Buffer;
  timeoutMs?: number;
}

/** Unified transport-layer abstraction for AI/LLM providers (e.g. OpenAI-compatible AI Router). */
export interface IAiProvider {
  chat(options: AiChatOptions): Promise<string>;
  chatVision?(options: AiVisionOptions): Promise<string>;
}
