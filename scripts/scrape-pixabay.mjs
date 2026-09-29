// scripts/scrape-pixabay.mjs
// =============================================================================
// Pixabay Music Catalog Scraper
//
// Catatan Teknis:
// Pixabay memproteksi halaman web (pixabay.com/music/) dengan Cloudflare Turnstile WAF.
// Script ini menyediakan 2 metode:
// 1. Direct Request (mencoba fetch langsung dengan User-Agent browser modern).
// 2. Cookie / Session Bypass: Jika terhadang Cloudflare, Anda dapat menyertakan
//    cookie browser (cf_clearance) melalui argument --cookie atau ENV PIXABAY_COOKIE.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parameter query genre/kategori Pixabay
const GENRES = [
  { id: 'lofi', search: 'lofi chill', label: 'Lo-Fi Chill & Study', emoji: '☕' },
  { id: 'phonk', search: 'phonk drift bass', label: 'Phonk & High Energy', emoji: '⚡' },
  { id: 'cinematic', search: 'cinematic trailer', label: 'Cinematic & Mystery', emoji: '🎬' },
  { id: 'upbeat', search: 'upbeat corporate tech', label: 'Upbeat Pop & Tech', emoji: '🚀' },
  { id: 'ambient', search: 'ambient calm acoustic', label: 'Ambient & Acoustic', emoji: '🍃' },
];

function getCliArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

const customCookie = getCliArg('--cookie') || process.env.PIXABAY_COOKIE || '';

async function fetchPixabayPage(query) {
  const encodedQuery = encodeURIComponent(query);
  const targetUrl = `https://pixabay.com/music/search/${encodedQuery}/`;

  console.log(`\n🔍 Fetching Pixabay Music: ${targetUrl}`);

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    Referer: 'https://pixabay.com/music/',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  if (customCookie) {
    headers['Cookie'] = customCookie;
  }

  try {
    const res = await fetch(targetUrl, { headers });

    if (res.status === 403) {
      console.warn(`⚠️ HTTP 403 Forbidden: Halaman Pixabay diproteksi Cloudflare Turnstile WAF.`);
      return { html: await res.text(), isBlocked: true };
    }

    if (!res.ok) {
      console.warn(`⚠️ HTTP ${res.status}: Gagal mengambil data.`);
      return { html: '', isBlocked: true };
    }

    const html = await res.text();
    const isChallenge =
      html.includes('Just a moment...') ||
      html.includes('challenges.cloudflare.com') ||
      html.includes('Performing security verification');

    return { html, isBlocked: isChallenge };
  } catch (err) {
    console.error('❌ Error fetch:', err.message);
    return { html: '', isBlocked: true };
  }
}

function parseTracksFromHtml(html, genreConfig) {
  const tracks = [];

  // 1. Ekstraksi data-audio atau skrip JSON-LD / internal window state
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});/s) ||
                    html.match(/<script id="__NEXT_DATA__" type="application\/json">({.+?})<\/script>/);

  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      console.log('✓ Berhasil menemukan JSON state terstruktur pada halaman Pixabay');
      // Ekstraksi data tracks dari JSON state
      if (Array.isArray(data?.music?.tracks)) {
        for (const t of data.music.tracks) {
          tracks.push({
            id: `pixabay-${t.id}`,
            title: t.title || t.name,
            artist: t.artist || t.user?.username || 'Pixabay Creator',
            genre: genreConfig.id,
            genreLabel: genreConfig.label,
            genreEmoji: genreConfig.emoji,
            durationSec: t.duration || 60,
            bpm: t.bpm || undefined,
            streamUrl: t.audio_url || `https://cdn.pixabay.com/download/audio/${t.id}.mp3`,
            coverUrl: t.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
            tags: t.tags ? t.tags.split(',').map((s) => s.trim()) : [genreConfig.id, 'pixabay'],
            license: 'Pixabay Content License (Free for Commercial Use)',
          });
        }
      }
    } catch {
      // Abaikan jika parse gagal
    }
  }

  // 2. Regex fallback pencarian item audio di DOM HTML
  const itemRegex = /class="[^"]*audio-item[^"]*"[^>]*data-id="(\d+)"[^>]*data-title="([^"]*)"[^>]*data-artist="([^"]*)"/g;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const [, id, title, artist] = match;
    tracks.push({
      id: `pixabay-${id}`,
      title: title || 'Pixabay Track',
      artist: artist || 'Pixabay Creator',
      genre: genreConfig.id,
      genreLabel: genreConfig.label,
      genreEmoji: genreConfig.emoji,
      durationSec: 60,
      streamUrl: `https://cdn.pixabay.com/download/audio/${id}.mp3`,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      tags: [genreConfig.id, 'pixabay', 'royalty-free'],
      license: 'Pixabay Content License (Free for Commercial Use)',
    });
  }

  return tracks;
}

async function main() {
  console.log('=====================================================');
  console.log('🚀 Memulai Scraping Katalog Musik Pixabay...');
  console.log('=====================================================');

  const allTracks = [];
  let blockedCount = 0;

  for (const genre of GENRES) {
    const { html, isBlocked } = await fetchPixabayPage(genre.search);

    if (isBlocked) {
      blockedCount++;
      console.log(`🛡️  Proteksi Cloudflare aktif pada pencarian "${genre.search}".`);
    } else {
      const parsed = parseTracksFromHtml(html, genre);
      console.log(`✓ Berhasil mengekstrak ${parsed.length} track untuk ${genre.label}`);
      allTracks.push(...parsed);
    }
  }

  console.log('\n=====================================================');
  console.log('📊 Ringkasan Scraping:');
  console.log(`- Total track berhasil diekstrak: ${allTracks.length}`);
  console.log(`- Request tertahan Cloudflare Turnstile: ${blockedCount}/${GENRES.length}`);

  if (blockedCount > 0) {
    console.log('\n💡 CARA MELEWATI CLOUDFLARE TURNSTILE (Bypass):');
    console.log('1. Buka browser (Chrome/Edge/Safari) dan buka: https://pixabay.com/music/');
    console.log('2. Buka DevTools (F12) -> Tab Application -> Storage -> Cookies -> https://pixabay.com');
    console.log('3. Salin nilai cookie (terutama "cf_clearance" dan "__cf_bm").');
    console.log('4. Jalankan script ini dengan flag cookie:');
    console.log('   node scripts/scrape-pixabay.mjs --cookie "cf_clearance=...; __cf_bm=..."');
  }

  if (allTracks.length > 0) {
    const outPath = path.resolve(__dirname, '../client/src/lib/pixabay-scraped-catalog.json');
    fs.writeFileSync(outPath, JSON.stringify(allTracks, null, 2), 'utf-8');
    console.log(`\n💾 Hasil scraping tersimpan di: ${outPath}`);
  }
}

main().catch(console.error);
