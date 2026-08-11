/**
 * Extracts the 11-character YouTube video ID from a URL or raw ID string.
 *
 * Supports:
 * - `https://www.youtube.com/watch?v=XXXXXXXXXXX`
 * - `https://youtu.be/XXXXXXXXXXX`
 * - `https://www.youtube.com/embed/XXXXXXXXXXX`
 * - Bare 11-char video ID
 *
 * @returns The video ID, or `null` if the input doesn't match.
 */
export function extractVideoIdFromUrl(url: string): string | null {
  const trimmed = url.trim();

  const patterns = [
    // Standard watch URL: youtube.com/watch?v=ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/ID
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Shorts URL: youtube.com/shorts/ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Bare 11-char video ID
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1];
  }

  return null;
}
