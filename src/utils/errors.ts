/** Stable machine-readable error codes surfaced through the API and logs. */
export type ErrorCode =
  | 'INVALID_URL'
  | 'VALIDATION_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'FFMPEG_FAILED'
  | 'WHISPER_FAILED'
  | 'OLLAMA_TIMEOUT'
  | 'OLLAMA_INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'FILE_PERMISSION_ERROR'
  | 'MISSING_SOURCE_VIDEO'
  | 'CORRUPTED_SOURCE_VIDEO'
  | 'INTERNAL_ERROR';

interface AppErrorParams {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  cause?: unknown;
}

/**
 * Canonical application error. Every error that can cross a service boundary
 * should be (or be wrapped into) an `AppError` so the API layer can respond
 * with a consistent `{ message, code, statusCode }` shape.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor({ code, message, statusCode = 500, cause }: AppErrorParams) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  static invalidUrl(message = 'The provided URL is not a valid YouTube video URL.'): AppError {
    return new AppError({ code: 'INVALID_URL', message, statusCode: 400 });
  }

  static validation(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, cause });
  }

  static downloadFailed(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'DOWNLOAD_FAILED', message, statusCode: 502, cause });
  }

  static ffmpegFailed(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'FFMPEG_FAILED', message, statusCode: 500, cause });
  }

  static whisperFailed(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'WHISPER_FAILED', message, statusCode: 500, cause });
  }

  static ollamaTimeout(message = 'Ollama request timed out.', cause?: unknown): AppError {
    return new AppError({ code: 'OLLAMA_TIMEOUT', message, statusCode: 504, cause });
  }

  static ollamaInvalidResponse(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'OLLAMA_INVALID_RESPONSE', message, statusCode: 502, cause });
  }

  static networkError(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'NETWORK_ERROR', message, statusCode: 503, cause });
  }

  static filePermissionError(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'FILE_PERMISSION_ERROR', message, statusCode: 500, cause });
  }

  static missingSourceVideo(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'MISSING_SOURCE_VIDEO', message, statusCode: 500, cause });
  }

  static corruptedSourceVideo(message: string, cause?: unknown): AppError {
    return new AppError({ code: 'CORRUPTED_SOURCE_VIDEO', message, statusCode: 500, cause });
  }

  static internal(message = 'Internal server error.', cause?: unknown): AppError {
    return new AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500, cause });
  }

  /** Normalizes any thrown value into an `AppError`, preserving existing ones as-is. */
  static from(error: unknown, fallbackMessage = 'Unexpected error.'): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) return AppError.internal(error.message || fallbackMessage, error);
    return AppError.internal(fallbackMessage, error);
  }

  toJSON(): { message: string; code: ErrorCode; statusCode: number } {
    return { message: this.message, code: this.code, statusCode: this.statusCode };
  }
}
