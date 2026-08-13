import { staticFile } from 'remotion';

/**
 * Resolves an asset path for <Video>/<Audio>.
 *
 * Remotion only serves files inside the project's `public/` folder, so the
 * engine stages media there and passes `public`-relative paths. Absolute paths
 * (e.g. manual Studio testing) are passed through unchanged instead of being
 * rejected by `staticFile()`.
 */
export const toAssetUrl = (path: string): string => {
  if (!path) {
    return path;
  }
  if (/^(https?:|file:|data:)/.test(path) || path.startsWith('/') || path.includes('://')) {
    return path;
  }
  return staticFile(path);
};
