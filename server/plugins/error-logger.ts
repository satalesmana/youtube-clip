import { defineNitroPlugin } from 'nitropack/runtime';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('nitro');

/** Stray requests to routes this app never registers (e.g. dev-tooling probes) — not a real error. */
function isUnmatchedRouteError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Cannot find any route matching');
}

/**
 * Centralized error-logging hook. Every error that reaches Nitro's error
 * pipeline (including ones from future routes) is logged consistently here,
 * separate from the per-route HTTP status mapping in `utils/http-error.ts`.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event } = {}) => {
    if (isUnmatchedRouteError(error)) {
      logger.debug({ path: event?.path }, 'Unmatched route (no handler registered)');
      return;
    }

    logger.error({ err: error, path: event?.path }, 'Unhandled request error');
  });
});
