import { defineEventHandler, setResponseStatus } from 'h3';

/**
 * Some browser development tooling probes Webpack's legacy HMR endpoint even
 * though this application is served by Nitro and has no Webpack HMR client.
 * A quiet no-content response prevents the probe from being logged as an
 * unmatched application route.
 */
export default defineEventHandler((event) => {
  setResponseStatus(event, 204);
  return null;
});
