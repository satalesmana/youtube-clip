/**
 * Deterministic seed / cache-key helpers.
 *
 * LLM providers accept a `seed` so that the same prompt + temperature + seed
 * reproduce the same output. We derive the seed from stable content identifiers
 * (videoId, candidateId, angleId, ...) so that regenerating the same video always
 * produces the same narration, angles, and story beats.
 */

/** Stable 32-bit FNV-1a hash of the given parts (undefined/null skipped). */
export function hashSeed(...parts: (string | number | undefined)[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    if (part === undefined || part === null) continue;
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Field separator so adjacent parts can't collide across concatenation.
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}