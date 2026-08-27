# Tutorial: Menjalankan Proyek Viral Highlight Generator

Proyek ini adalah **backend AI** (Nitro/h3 + TypeScript) yang mengubah video
YouTube menjadi short 9:16 siap upload (Shorts/TikTok/Reels):

```
download video → transkrip (WhisperX) → analisis momen viral (LLM)
→ story/script → narasi (TTS) → render klip + subtitle (Remotion)
```

Ada juga pipeline **Riset Viral** untuk mencari topik viral dari RSS / Reddit /
Google Trends / X, lalu mencocokkannya dengan video YouTube.

> **Status per 19 Agustus 2026 (hasil cek langsung):** server jalan normal
> (`npm run dev`), UI di `/`, API `/api/templates`, `/api/history` merespons OK.
> Sudah terpasang: `node_modules`, `.env` lengkap, FFmpeg-full (libass),
> whisperx + edge-tts di `.venv/`, dan `compositions/studio` (engine Remotion).
> Belum terpasang: Ollama (pakai router, tidak butuh Ollama).
> **Catatan:** `.env.example` hanya berisi opsi TTS; konfigurasi lengkap
> didokumentasikan di §3 dan skema-nya di `src/config/env.ts`.

---

## 1. Prasyarat (wajib)

| Tool                  | Untuk apa                       | Cek                                             | Install                                   |
| --------------------- | ------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Node.js **22+**       | Runtime backend                 | `node -v` ✅ v22.23.2 (sudah ada)               | https://nodejs.org                        |
| Python **3.10+**      | WhisperX & edge-tts (via venv)  | `python3 -V`                                    | `brew install python`                     |
| **yt-dlp**            | Download video                  | `yt-dlp --version` ✅ (sudah ada)               | `brew install yt-dlp`                     |
| **FFmpeg + libass**   | Render klip & burn subtitle     | `ffmpeg -version` ⚠️ default tanpa libass       | `brew install ffmpeg-full` (lihat §3.3)   |
| **Ollama** (opsional) | LLM lokal untuk analisis        | `ollama list` ❌ belum ada                      | `brew install ollama`, `ollama pull qwen3:14b` |

Cek libass pada FFmpeg kamu:

```bash
ffmpeg -filters 2>/dev/null | grep -E "^\s*\S+\s+ass\s"
```

Kalau tidak ada output → pakai `brew install ffmpeg-full` (keg-only, tidak
menimpa ffmpeg bawaan) dan set `FFMPEG_BINARY_PATH` (lihat §3.3).

---

## 2. Setup sekali saja (dari nol)

```bash
# 1) Ambil repo + pasang dependency server
git clone <repo-url> youtube-clip
cd youtube-clip
npm install

# 2) Virtualenv Python untuk WhisperX + edge-tts (dibutuhkan transkripsi & narasi)
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install whisperx edge-tts
deactivate

# 3) Dependency engine render Remotion (dipakai saat COMPOSITION_ENGINE=remotion)
cd compositions/studio
npm install
cd ../..

# 4) Buat file konfigurasi
cp .env.example .env   # lalu isi sesuai §3
```

> Binary di `.venv/bin/` (mis. `whisperx`, `edge-tts`) otomatis ditemukan oleh
> server — cukup tulis nama binary, tidak perlu path absolut.

**Penting:** nilai hex color di `.env` WAJIB diberi tanda kutip, karena `#`
tanpa kutip dianggap komentar oleh dotenv:

```
ASS_HIGHLIGHT_COLOR="#FFE135"
```

---

## 3. Konfigurasi `.env`

`.env.example` hanya berisi opsi TTS. Salin blok berikut sebagai panduan lengkap
(referensi skema: `src/config/env.ts`).

### 3.1 AI provider (analisis momen viral)

**Mode A — Router OpenAI-compatible (disarankan, tidak butuh Ollama):**

```env
AI_PROVIDER=router
ROUTER_BASE_URL=http://127.0.0.1:20128
ROUTER_API_KEY=isi_key_nya
ROUTER_MODEL=auto
ROUTER_TIMEOUT_MS=180000

# LLM khusus riset (opsional, fallback ke ROUTER_* jika kosong)
RESEARCH_LLM_BASE_URL=http://127.0.0.1:20128
RESEARCH_LLM_API_KEY=isi_key_nya
RESEARCH_LLM_MODEL=group-deepseek
```

**Mode B — Ollama (lokal, gratis, model ~9 GB):**

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:14b
```

### 3.2 Whisper (transkripsi)

WhisperX (disarankan — forced alignment untuk timestamp kata akurat):

```env
WHISPER_PROVIDER=whisperx
WHISPER_BINARY_PATH=whisperx
WHISPER_MODEL=medium        # medium = seimbang untuk 8GB RAM; coba base kalau lambat
WHISPER_LANGUAGE=auto       # "en" / "id" untuk akurasi lebih baik
WHISPER_EXTRA_ARGS=--device cpu --compute_type float32
```

Alternatif: `faster-whisper` (`pip install whisper-ctranslate2`,
`WHISPER_PROVIDER=faster-whisper`) atau `whisper-cpp`
(`brew install whisper-cpp`, `WHISPER_BINARY_PATH=whisper-cli`,
`WHISPER_MODEL=models/ggml-base.bin`).

### 3.3 FFmpeg (render)

```env
FFMPEG_BINARY_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
```

### 3.4 TTS (narasi) & engine render

```env
TTS_PROVIDER=edge-tts           # edge-tts (gratis) | openai
TTS_VOICE=id-ID-ArdiNeural
TTS_BINARY_PATH=.venv/bin/edge-tts

COMPOSITION_ENGINE=remotion     # remotion (baru) | ffmpeg-template (legacy)
COMPOSITION_STYLE=commentary    # commentary | sports | interview
```

### 3.5 yt-dlp bot-check (opsional tapi sering dibutuhkan)

Kalau YouTube balas _"Sign in to confirm you're not a bot"_:

```env
YT_DLP_EXTRA_ARGS=--cookies-from-browser chrome
```

---

## 4. Menjalankan server

```bash
cd ~/youtube-clip
npm run dev        # dev server + hot reload → http://localhost:3000/
```

> Jika port 3000 sedang dipakai, Nitro otomatis naik ke port berikutnya (3001).

Mode produksi:

```bash
npm run build      # build ke .output/
npm run preview    # jalankan build produksi
```

Setelah server jalan, buka **http://localhost:3000/** — UI bawaan (tidak perlu
frontend terpisah) punya 3 tab:

| Tab                | Fungsi                                                            |
| ------------------ | ----------------------------------------------------------------- |
| 🔍 **Riset Viral** | Cari topik viral dari RSS/Reddit/Trends/X, lalu match video YouTube |
| ✂️ **Transform**   | Tempel URL YouTube → angle → script → narasi → render short 9:16   |
| 🕘 **Riwayat**     | Daftar klip yang sudah berhasil dibuat                            |

Untuk memakai engine Remotion interaktif (optional):

```bash
cd compositions/studio
npx remotion studio   # editor visual → preview ke komposisi
```

---

## 5. API

### Pipeline transform (utama)

```bash
# Transform penuh: download → transkrip → angle → script → TTS → render
curl -X POST http://localhost:3000/api/transform \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID", "template": "commentary", "language": "id"}'

# Transform + cek hak (rights/quality) dulu
curl -X POST http://localhost:3000/api/transform-with-rights \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# Preview tanpa render (kembalikan script + video plan untuk review)
curl -X POST http://localhost:3000/api/transform \
  -H "Content-Type: application/json" \
  -d '{"videoId": "VIDEO_ID", "dryRun": true}'
```

### Riset viral

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"max_trends": 10, "language": "id"}'
```

### Helper

```bash
curl http://localhost:3000/api/templates          # daftar template (commentary, news, ...)
curl http://localhost:3000/api/history            # riwayat transform
curl http://localhost:3000/api/quality-check?videoPath=outputs/VIDEO_ID/downloads/source.mp4
curl http://localhost:3000/api/rights/VIDEO_ID    # GET status hak / POST jalankan cek
```

> `POST /api/process` masih ada sebagai endpoint legacy pipeline klip lama.

---

## 6. Hasil render

Output kini ter-isolasi per video di `outputs/{videoId}/`:

```
outputs/downloads/{videoId}.mp4                             # video sumber
outputs/{videoId}/transcripts/{videoId}.json                # transkrip Whisper
outputs/{videoId}/transform/{jobId}/voice/voice/narration.mp3 # narasi TTS
outputs/{videoId}/transform/{jobId}/clips/transformed.mp4   # video final 1080×1920
outputs/{videoId}/render/{jobId}/rendered.mp4               # output engine remotion
```

File media yang dihasilkan bisa distream via `GET /api/media/[...path]`.

File media yang dihasilkan bisa distream via `GET /api/media/[...path]`.

---

## 7. Verifikasi cepat (smoke test)

```bash
npm run typecheck   # cek tipe TypeScript
npm run lint        # lint ESLint
```

Ada juga stub server LLM untuk tes tanpa router/Ollama:

```bash
node scripts/stub-llm-server.mjs
```

---

## 8. Checklist pertama kali

1. ✅ `node -v` → ≥22
2. ✅ `npm install`
3. ✅ `.venv` + `pip install whisperx edge-tts`
4. ✅ `compositions/studio` → `npm install`
5. ✅ `cp .env.example .env` + isi `AI_PROVIDER`, `ROUTER_*`/`OLLAMA_*`, `FFMPEG_BINARY_PATH`, `TTS_*`
6. ✅ (opsional) `ollama pull qwen3:14b` kalau pakai mode ollama
7. ✅ `npm run dev` → buka http://localhost:3000/ → tab Transform

---

## Troubleshooting

| Gejala                                                 | Penyebab → Solusi                                                                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Subtitle tidak ke-burn / error filter `ass`            | FFmpeg tanpa libass → `brew install ffmpeg-full` + set `FFMPEG_BINARY_PATH`                                                                     |
| `whisperx` tidak ditemukan                             | Pastikan `pip install whisperx` di `.venv` sudah jalan (`source .venv/bin/activate`); binary di `.venv/bin/` di-resolve otomatis                |
| `WHISPER_FAILED`                                       | Model/binary salah → cek `WHISPER_PROVIDER`, `WHISPER_BINARY_PATH`, `WHISPER_MODEL`; coba `WHISPER_MODEL=base` kalau `medium` terlalu berat      |
| Narasi kosong / TTS error                              | `edge-tts` belum terpasang di `.venv`; cek `TTS_VOICE` (`edge-tts --list-voices`), `TTS_BINARY_PATH`                                            |
| yt-dlp: "Sign in to confirm you're not a bot"          | Set `YT_DLP_EXTRA_ARGS=--cookies-from-browser chrome`                                                                                           |
| Nilai warna kosong di subtitle                         | Hex di `.env` tanpa kutip → `ASS_HIGHLIGHT_COLOR="#FFE135"`                                                                                     |
| `LLM_TIMEOUT` / `LLM_INVALID_RESPONSE`                 | Router/Ollama belum jalan atau model salah; perbesar `ROUTER_TIMEOUT_MS` / `OLLAMA_TIMEOUT_MS`                                                   |
| `Missing model` (HTTP 400) dari router                 | `RESEARCH_LLM_BASE_URL`/model tidak ada di router → pastikan `RESEARCH_LLM_MODEL` (mis. `group-deepseek`) tersedia                              |
| Router balas `content: ""` + `finish_reason: "length"` | Model reasoning menghabiskan `max_tokens` → pastikan `reasoning_effort: "low"` dikirim (lihat `src/providers/router.provider.ts`)               |
| Render remotion gagal                                  | `compositions/studio` belum `npm install`, atau `COMPOSITION_ENGINE`/`COMPOSITION_STYLE` tidak cocok; cek log `LOG_LEVEL=trace`                 |
| Port 3000 sudah dipakai                                | Nitro otomatis naik ke 3001; atau ubah `PORT` di `.env` dan restart                                                                            |
| Server tidak reload config                             | `.env` dibaca saat start → restart `npm run dev` setelah ubah `.env`                                                                            |