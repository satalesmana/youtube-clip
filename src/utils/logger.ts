import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Application-wide Pino logger. Uses pretty printing in development and
 * structured JSON in production (the default pino-pretty transport is only
 * pulled in outside of `production` to avoid the extra dependency at runtime).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'viral-highlight-generator' },
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
        },
});

export type Logger = typeof logger;

/** Creates a child logger scoped to a named component, e.g. `createLogger('youtube.service')`. */
export function createLogger(component: string): Logger {
  return logger.child({ component }) as Logger;
}
