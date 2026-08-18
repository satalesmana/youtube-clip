import { AppError } from './errors.js';

/** Shape consumed by `h3`'s `createError` to build an HTTP error response. */
export interface HttpErrorInput {
  statusCode: number;
  statusMessage: string;
  message: string;
  data: { message: string; code: string; statusCode: number; cause?: string };
}

/**
 * Centralizes the mapping from any thrown error to the HTTP error shape used
 * across every API route, so route handlers never hand-roll status codes.
 */
export function toHttpError(error: unknown): HttpErrorInput {
  const appError = AppError.from(error);

  return {
    statusCode: appError.statusCode,
    statusMessage: appError.code,
    message: appError.message,
    data: appError.toJSON(),
  };
}
