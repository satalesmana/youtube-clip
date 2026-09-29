// server/api/music/pixabay-search.ts
// =============================================================================
// Direct Pixabay Music Search & Scraping Endpoint
// Melakukan scraping on-the-fly ke pixabay.com/music/search/{query}/
// Mengekstrak Next.js __NEXT_DATA__ JSON dan mengubah audio stream ke proxy in-memory.
// =============================================================================

import { defineEventHandler, getQuery, getHeader } from 'h3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baca katalog pre-scraped Pixabay sebagai fallback jika Cloudflare aktif
function getLocalFallbackTracks(query: string) {
  try {
    const catalogPath = path.resolve(__dirname, '../../../client/src/lib/pixabay-scraped-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const raw = fs.readFileSync(catalogPath, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const q = query.toLowerCase().trim();
        const matched = list.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.artist?.toLowerCase().includes(q) ||
            t.genre?.toLowerCase().includes(q) ||
            t.tags?.some((tag: string) => tag.toLowerCase().includes(q)),
        );
        if (matched.length > 0) return matched;
        return list.slice(0, 6);
      }
    }
  } catch {
    // Abaikan jika gagal baca file lokal
  }
  return [];
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchTerm = String(query.q || '').trim();

  if (!searchTerm) {
    return {
      success: true,
      source: 'empty',
      tracks: [],
    };
  }

  // Cookie dapat dikirimkan dari client header / query param / ENV
  const clientCookie =
    String(query.cookie || '') ||
    getHeader(event, 'x-pixabay-cookie') ||
    process.env.PIXABAY_COOKIE ||
    '';

  const targetUrl = `https://pixabay.com/music/search/${encodeURIComponent(searchTerm)}/`;

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    Referer: 'https://pixabay.com/music/',
    'Cache-Control': 'no-cache',
  };

  if (clientCookie) {
    headers['Cookie'] = clientCookie;
  }

  try {
    const upstreamRes = await fetch(targetUrl, { headers });
    const html = await upstreamRes.text();

    const isCloudflareBlocked =
      upstreamRes.status === 403 ||
      html.includes('Just a moment...') ||
      html.includes('challenges.cloudflare.com') ||
      html.includes('Performing security verification');

    if (isCloudflareBlocked) {
      const fallbackTracks = getLocalFallbackTracks(searchTerm);
      return {
        success: false,
        blockedByCloudflare: true,
        query: searchTerm,
        message:
          'Cloudflare Turnstile WAF aktif di Pixabay. Menampilkan hasil musik dari katalog Pixabay. Hubungkan cookie sesi browser untuk scraping live langsung.',
        tracks: fallbackTracks,
      };
    }

    // Ekstraksi data terstruktur dari Next.js __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.+?})<\/script>/);
    const scrapedTracks: any[] = [];

    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const parsedData = JSON.parse(nextDataMatch[1]);
        const results =
          parsedData?.props?.pageProps?.pageData?.results ||
          parsedData?.props?.pageProps?.results ||
          parsedData?.props?.pageProps?.audio ||
          [];

        if (Array.isArray(results)) {
          for (const item of results) {
            const rawAudioUrl =
              item.audio_url ||
              item.sources?.mp3 ||
              (item.id ? `https://cdn.pixabay.com/download/audio/${item.id}.mp3` : '');

            if (rawAudioUrl) {
              scrapedTracks.push({
                id: `pixabay-${item.id}`,
                title: item.title || item.name || 'Pixabay Music',
                artist: item.user?.name || item.user?.username || 'Pixabay Creator',
                genre: 'lofi', // Default category
                genreLabel: 'Pixabay Live Scraped',
                genreEmoji: '⚡',
                durationSec: item.duration || 60,
                bpm: item.bpm || undefined,
                streamUrl: `/api/music/stream?url=${encodeURIComponent(rawAudioUrl)}`,
                coverUrl:
                  item.image_url ||
                  item.user?.avatar ||
                  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=300&q=80',
                tags: item.tags ? (typeof item.tags === 'string' ? item.tags.split(',') : item.tags) : ['pixabay', 'scraped'],
                license: 'Pixabay Content License (Royalty-Free)',
                isLiveScraped: true,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('[Pixabay Search] Error parsing __NEXT_DATA__:', err.message);
      }
    }

    // Fallback regex jika struktur DOM berbeda
    if (scrapedTracks.length === 0) {
      const itemRegex = /class="[^"]*audio-item[^"]*"[^>]*data-id="(\d+)"[^>]*data-title="([^"]*)"[^>]*data-artist="([^"]*)"/g;
      let match;
      while ((match = itemRegex.exec(html)) !== null) {
        const [, id, title, artist] = match;
        scrapedTracks.push({
          id: `pixabay-${id}`,
          title: title || 'Pixabay Music',
          artist: artist || 'Pixabay Creator',
          genre: 'lofi',
          genreLabel: 'Pixabay Live Scraped',
          genreEmoji: '⚡',
          durationSec: 60,
          streamUrl: `/api/music/stream?url=${encodeURIComponent(`https://cdn.pixabay.com/download/audio/${id}.mp3`)}`,
          coverUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=300&q=80',
          tags: ['pixabay', 'scraped'],
          license: 'Pixabay Content License (Royalty-Free)',
          isLiveScraped: true,
        });
      }
    }

    return {
      success: true,
      source: 'pixabay-live',
      query: searchTerm,
      count: scrapedTracks.length,
      tracks: scrapedTracks.length > 0 ? scrapedTracks : getLocalFallbackTracks(searchTerm),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      query: searchTerm,
      tracks: getLocalFallbackTracks(searchTerm),
    };
  }
});
