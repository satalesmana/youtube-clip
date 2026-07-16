import { mkdir } from 'node:fs/promises';
import { AppError } from './errors.js';

/** Ensures a directory exists, creating it (and parents) if necessary. */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw AppError.filePermissionError(`Failed to create directory "${dirPath}".`, error);
  }
}
