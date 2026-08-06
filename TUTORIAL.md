# Tutorial: Menjalankan Proyek Viral Highlight Generator

Proyek ini adalah **backend AI** (Nitro/h3 + TypeScript) yang mengubah video
YouTube menjadi klip pendek 9:16 siap upload (Shorts/TikTok/Reels):
download video → transkrip (Whisper) → analisis momen viral (LLM) →
render klip + subtitle + thumbnail.

> Status per 6 Agustus 2026 (hasil cek langsung): `node_modules` sudah terpasang,
> server jalan normal (`npm run dev`), UI di `/` dan API `/api/templates`,
> `/api/history` merespons OK. `.env` belum dibuat, FFmpeg **tanpa libass**,
> Whisper & Ollama **belum terpasang** → bagian tersebut perlu setup.

---

## 1. Prasyarat (wajib)

| Tool | Untuk apa | Cek | Install |
|---|---|---|---|
| Node.js **22+** | Runtime | `node -v` ✅ v22.23.2 (sudah ada) | https://nodejs.org |
| **yt-dlp** | Download video | `yt-dlp --version` ✅ (sudah ada) | `brew install yt-dlp` |
| **FFmpeg + libass** | Render klip & burn subtitle | `ffmpeg -version` ⚠️ ada, tapi **tanpa libass** | `brew install ffmpeg-full` (lihat §3) |
| **Ollama** | LLM lokal untuk analisis | `ollama list` ❌ belum ada | `brew install ollama`, lalu `ollama pull qwen3:14b` |
| **Whisper CLI** | Transkripsi + timestamp kata | ❌ belum ada | `pip install whisper-ctranslate2` (lihat §4) |

Cek libass pada FFmpeg kamu:

```bash
ffmpeg -filters 2>/dev/null | grep -E "^\s*\S+\s+ass\s"
```

Kalau tidak ada output → pakai `brew install ffmpeg-full` (keg-only, tidak
menimpa ffmpeg bawaan) dan set `FFMPEG_BINARY_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` di `.env`.

---

## 2. Setup (sekali saja)

```bash
cd ~/youtube-clip
npm install                 # sudah pernah dijalankan — jalankan lagi jika ada dep baru
cp .env.example .env        # lalu edit isinya (lihat §3–§5)
```

**Penting:** nilai hex color di `.env` WAJIB diberi tanda kutip, karena `#`
tanpa kutip dianggap komentar oleh dotenv:

```
ASS_HIGHLIGHT_COLOR="#FFE135"
```

---

## 3. Pilih AI provider di `.env`

Ada dua mode:

**A. Ollama (lokal, gratis, butuh download model ~9 GB untuk qwen3:14b):**
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:14b
```

**B. Router OpenAI-compatible (9Router — sudah dipakai sebelumnya):**
```env
AI_PROVIDER=router
ROUTER_BASE_URL=http://10.9.14.126:20128
ROUTER_API_KEY=isi_key_nya
ROUTER_MODEL=FreeModel
```

Mode B tidak butuh Ollama — cukup untuk menjalankan server & riset viral.

---

## 4. Whisper (transkripsi)

Default `.env.example` memakai **faster-whisper**:
```env
WHISPER_PROVIDER=faster-whisper
WHISPER_BINARY_PATH=whisper
WHISPER_MODEL=base
```

Install:
```bash
pip install whisper-ctranslate2   # menyediakan perintah `whisper`
```

Alternatif (whisper.cpp): `brew install whisper-cpp`, lalu
```env
WHISPER_PROVIDER=whisper-cpp
WHISPER_BINARY_PATH=whisper-cli
WHISPER_MODEL=models/ggml-base.bin   # harus path file model, bukan nama
```

---

## 5. yt-dlp bot-check (opsional tapi sering dibutuhkan)

Kalau YouTube balas *"Sign in to confirm you're not a bot"*:
```env
YT_DLP_EXTRA_ARGS=--cookies-from-browser chrome
```

---

## 6. Menjalankan server

```bash
cd ~/youtube-clip
npm run dev        # dev server + hot reload → http://localhost:3000/
```

Mode produksi:
```bash
npm run build      # build ke .output/
npm run preview    # jalankan build produksi
```

Setelah server jalan, buka **http://localhost:3000/** — UI bawaan (tidak perlu
frontend terpisah) punya 3 tab:

| Tab | Fungsi |
|---|---|
| 🔍 **Riset Viral** | Cari topik viral dari RSS/Reddit/Trends/X, lalu match video YouTube |
| ✂️ **Buat Klip** | Tempel URL YouTube → render klip 9:16 + subtitle + thumbnail |
| 🕘 **Riwayat** | Daftar klip yang sudah berhasil dibuat |

---

## 7. API (tanpa UI)

```bash
# Proses satu video → klip viral
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# Riset topik viral + video match
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"max_trends": 10, "language": "id"}'

# Helper read-only
curl http://localhost:3000/api/templates
curl http://localhost:3000/api/history
```

Hasil klip tersimpan di:
- `outputs/clips/clip-001.mp4` — video final 1080×1920
- `outputs/subtitles/clip-001.ass` — file subtitle
- `outputs/thumbnails/clip-001.jpg` — thumbnail
- `outputs/metadata/clips.json` — manifest semua klip

---

## 8. Verifikasi cepat (smoke test)

```bash
npm run typecheck   # cek tipe TypeScript
npm run lint        # lint ESLint
```

Ada juga stub server LLM untuk tes tanpa Ollama/router:
```bash
node scripts/stub-llm-server.mjs
```

---

## 9. Checklist jalankan pertama kali

1. ✅ `node -v` → ≥22
2. ✅ `npm install`
3. ✅ `cp .env.example .env` + isi `AI_PROVIDER`, `OLLAMA_*`/`ROUTER_*`
4. ✅ Pasang Whisper (`pip install whisper-ctranslate2`)
5. ✅ Pasang FFmpeg full kalau mau render subtitle (`brew install ffmpeg-full`)
6. ✅ (opsional) `ollama pull qwen3:14b` kalau pakai mode ollama
7. ✅ `npm run dev` → buka http://localhost:3000/

---

## Troubleshooting

| Gejala | Penyebab → Solusi |
|---|---|
| Subtitle tidak ke-burn / error filter `ass` | FFmpeg tanpa libass → `brew install ffmpeg-full` + set `FFMPEG_BINARY_PATH` |
| yt-dlp: "Sign in to confirm you're not a bot" | Set `YT_DLP_EXTRA_ARGS=--cookies-from-browser chrome` |
| Nilai warna kosong di subtitle | Hex di `.env` tanpa kutip → `ASS_HIGHLIGHT_COLOR="#FFE135"` |
| `WHISPER_FAILED` | Binary/model salah → cek `WHISPER_BINARY_PATH` & `WHISPER_MODEL` vs `whisper --help` |
| `LLM_TIMEOUT` / `LLM_INVALID_RESPONSE` | Ollama belum jalan / model belum di-pull; atau `OLLAMA_TIMEOUT_MS` terlalu kecil |
| Error `RESEARCH_*` | Sumber opsional gagal — tidak fatal; cek log `LOG_LEVEL=debug` |
| Server tidak reload config | `.env` dibaca saat start → restart `npm run dev` setelah ubah `.env` |
