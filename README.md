# Viral Highlight Generator

Backend service that takes a YouTube URL, finds the moments most likely to
go viral using local speech-to-text and a local LLM, and renders each one
into an upload-ready 9:16 short with burned-in animated captions —
immediately postable to YouTube Shorts, TikTok, Instagram Reels, or
Facebook Reels.

```
YouTube URL → download → extract audio → transcribe (Whisper, word timestamps)
            → chunk → analyze each chunk (Ollama) → merge & rank
            → refine clip boundaries → burn subtitles + reframe to 9:16
            → generate thumbnail → upload-ready MP4
```

## Requirements

Install these on your machine (or point the env vars below at existing
installs):

| Tool | Purpose | Install |
|---|---|---|
| Node.js 22+ | Runtime | https://nodejs.org |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video download | `brew install yt-dlp` |
| **FFmpeg with libass** | Reframing, encoding, and subtitle burn-in | see below — this is not the default Homebrew `ffmpeg` |
| [Ollama](https://ollama.com) | Local LLM inference | `brew install ollama`, then `ollama pull qwen3:14b` |
| A Whisper CLI | Transcription, with word-level timestamps | see below |
| `fc-list` (fontconfig) | Preflight check that the configured caption font exists | `brew install fontconfig` (optional — skipped gracefully if absent) |

**yt-dlp bot-check**: YouTube sometimes responds with "Sign in to confirm
you're not a bot," especially after repeated automated requests. Fix it by
passing cookies via `YT_DLP_EXTRA_ARGS` in `.env`, e.g.:

```
YT_DLP_EXTRA_ARGS=--cookies-from-browser chrome
```

(or `--cookies /path/to/cookies.txt` — see yt-dlp's
[cookies FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)).

**FFmpeg**: subtitle burn-in needs the `ass`/`subtitles` filter, which
requires FFmpeg to be built with `libass`. Homebrew's plain `ffmpeg` formula
does **not** include it — check with:

```bash
ffmpeg -filters | grep -E "^\s*\S+\s+ass\s"
```

If that prints nothing, install the full formula (keg-only, so it won't
touch your existing `ffmpeg`):

```bash
brew install ffmpeg-full
```

Then point `.env` at it instead of `ffmpeg`:

```
FFMPEG_BINARY_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
```

**Whisper**: the service shells out to a CLI and normalizes its JSON output,
so any CLI matching one of these two shapes works. Word-level timestamps are
required — clip refinement and subtitle timing are both derived directly
from them, never from the LLM.

- **Preferred** — a Faster Whisper CLI such as
  [`whisper-ctranslate2`](https://github.com/Softcatala/whisper-ctranslate2)
  (`pip install whisper-ctranslate2`), invoked with
  `--output_format json --word_timestamps True`.
- **Fallback** — [whisper.cpp](https://github.com/ggerganov/whisper.cpp)'s
  `main`/`whisper-cli` binary (e.g. `brew install whisper-cpp`), invoked with
  `-oj -ojf` (full JSON output, sentence-level segments with nested
  word-level token timestamps).

Set `WHISPER_PROVIDER`, `WHISPER_BINARY_PATH`, and `WHISPER_MODEL` in `.env`
to match whichever you install — flags for either tool can vary by version,
so double-check `<binary> --help` against `src/services/whisper.service.ts`
if transcription fails.

If using whisper.cpp, `WHISPER_MODEL` must point to an actual `ggml-*.bin`
model file (not just a name like `base`) — download one into a local
`models/` directory (gitignored):

```bash
mkdir -p models
curl -fsSL -o models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

Then in `.env`:

```
WHISPER_PROVIDER=whisper-cpp
WHISPER_BINARY_PATH=whisper-cli
WHISPER_MODEL=models/ggml-base.bin
```

## Setup

```bash
npm install
cp .env.example .env   # adjust binary paths / model names as needed
npm run dev             # development server with hot reload
```

```bash
npm run build            # production build to .output/
npm run preview           # run the production build
```

```bash
npm run typecheck
npm run lint
```

**Note on hex colors in `.env`**: values like `ASS_HIGHLIGHT_COLOR` must be
quoted (`ASS_HIGHLIGHT_COLOR="#FFE135"`) — an unquoted leading `#` is parsed
by `dotenv` as a comment and silently empties the value.

## API

### `POST /api/process`

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Response:

```json
{
  "success": true,
  "video": "downloads/dQw4w9WgXcQ.mp4",
  "transcript": "transcripts/dQw4w9WgXcQ.json",
  "clips": [
    {
      "id": 1,
      "title": "Biggest Entrepreneur Mistake",
      "reason": "Strong emotional hook with practical advice.",
      "hook": "Nobody tells you this...",
      "score": 98,
      "start": 193.2,
      "end": 229.8,
      "duration": 36.6,
      "resolution": "1080x1920",
      "video": "outputs/clips/clip-001.mp4",
      "subtitle": "outputs/subtitles/clip-001.ass",
      "thumbnail": "outputs/thumbnails/clip-001.jpg"
    }
  ],
  "clipErrors": []
}
```

A highlight that fails validation or rendering shows up in `clipErrors`
instead of `clips`, and never blocks the other clips:

```json
{
  "index": 3,
  "code": "DURATION_OUT_OF_RANGE",
  "message": "Clip 3 refined duration (5.0s) is outside the allowed range [15, 90]s.",
  "start": 0,
  "end": 5,
  "timestamp": "2026-07-16T18:30:00.000Z"
}
```

On a request-level failure:

```json
{
  "statusCode": 502,
  "statusMessage": "DOWNLOAD_FAILED",
  "message": "Failed to download video \"...\".",
  "data": { "message": "...", "code": "DOWNLOAD_FAILED", "statusCode": 502 }
}
```

Error codes: `INVALID_URL`, `VALIDATION_ERROR`, `DOWNLOAD_FAILED`,
`FFMPEG_FAILED`, `WHISPER_FAILED`, `OLLAMA_TIMEOUT`,
`OLLAMA_INVALID_RESPONSE`, `NETWORK_ERROR`, `FILE_PERMISSION_ERROR`,
`MISSING_SOURCE_VIDEO`, `CORRUPTED_SOURCE_VIDEO`, `INTERNAL_ERROR`. Per-clip
errors (in `clipErrors`) use their own codes: `INVALID_TIMESTAMP`,
`DURATION_OUT_OF_RANGE`, `INVALID_SUBTITLE`, `MISSING_FONT`,
`UNSUPPORTED_CODEC`, `FFMPEG_FAILED`, `OUTPUT_WRITE_FAILED`,
`THUMBNAIL_FAILED`, `CORRUPTED_OUTPUT`.

## Architecture

```
server/api/process.post.ts   → HTTP layer only: parse, validate, delegate, map errors
src/controllers/              → orchestrates the pipeline, no HTTP-specific code
src/services/                 → one responsibility each, all behind an interface
src/providers/                → thin transport clients (Ollama HTTP)
src/prompts/                  → prompt templates, decoupled from the HTTP call
src/schemas/                  → Zod schemas (request validation + LLM output validation)
src/types/                    → shared TypeScript types
src/utils/                    → logger, retry, ffmpeg/exec wrappers, error types
src/config/env.ts             → Zod-validated environment config (framework-independent)
src/container/index.ts        → composition root: wires concrete services into controllers
```

Routes never contain business logic — they parse the request, call the
controller, and map errors to HTTP responses via
`src/utils/http-error.ts`. Every service is defined by an interface
(`IYoutubeService`, `IWhisperService`, etc.) and constructed with its
dependencies passed in (constructor injection), so any service can be
swapped or unit-tested in isolation without touching the others.

### Rendering pipeline

Once highlights are ranked, `src/services/renderer.service.ts` turns each one
into an upload-ready short, orchestrating:

1. **`clip-refinement.service.ts`** — never trusts Ollama's raw timestamps.
   Snaps `start`/`end` to real sentence boundaries in the transcript (which
   are already word-aligned, since they come from Whisper), then pads with
   2-3s of lead-in and 1-2s of trailing silence — using FFmpeg's
   `silencedetect` to find genuinely silent gaps rather than guessing, so
   padding never bites into neighboring speech. Extends short clips by
   pulling in whole following sentences to hit the 20-60s target, and trims
   long ones back to the last sentence boundary that fits.
2. **`subtitle.service.ts`** — groups Whisper's word-level timestamps (never
   LLM output) into caption events: ≤4 words each, wrapped across ≤2 lines,
   breaking on sentence boundaries or >0.5s pauses. Flags likely keywords
   (numbers, money, percentages, an emotional/action-verb wordlist, and a
   naive capitalized-word heuristic for names) for extra emphasis.
3. **`ass.service.ts`** — serializes those events into a real ASS file: bold
   white text, black outline, soft shadow, centered, sitting at a
   configurable vertical position (`ASS_VERTICAL_POSITION_FRACTION`, default
   75%). Per-word karaoke (`\k`) timing drives word-by-word highlighting;
   `ASS_ANIMATION_STYLE` (`karaoke` / `pop` / `fade` / `slide` / `none`)
   layers scale/fade/slide transforms on top. Keyword words get their own
   accent color and scale.
4. **`reframe.service.ts`** + **`face-detection.service.ts`** — computes the
   9:16 crop region around a focal point. Reframing priority is face
   detection → speaker tracking → multi-person framing → motion tracking →
   center-crop fallback; today only the center-crop fallback is live —
   `face-detection.service.ts` is a documented no-op
   (`NoOpFaceDetectionService`) that always reports "nothing found," which is
   the seam a real detector (MediaPipe, YOLO, a cloud Vision API, ...) plugs
   into later without touching any rendering logic.
5. A **single** FFmpeg pass then trims, crops, scales to 1080×1920, sets
   30fps, and burns the ASS file in one filtergraph
   (`crop,scale,fps,ass=...`) — avoiding a second encode pass.
6. **`thumbnail.service.ts`** — samples a few candidate frames from the
   *rendered* clip (skipping the first/last 10%), prefers any candidate
   where `IFaceDetectionService` finds a subject, and otherwise falls back
   to the largest JPEG by file size — a cheap, dependency-free proxy for
   "more detail / less motion blur," not real blur/emotion detection.

Up to `CLIP_MAX_CONCURRENCY` clips render at once via a small bounded
concurrency pool (`src/utils/concurrency.ts`), each retried up to
`CLIP_MAX_RETRIES` times on failure. One clip failing never stops the
others — failures are collected into `clipErrors` with the clip index,
timestamp, and raw FFmpeg stderr when available. A manifest of every
successful clip is written to `outputs/metadata/clips.json`.

## Configuration

All configuration is environment-driven — see `.env.example` for the full
list: Ollama model/temperature/timeout, Whisper provider/model, yt-dlp/FFmpeg
binary paths, chunking size/overlap, highlight duration bounds and top-N,
clip refinement padding/target duration, subtitle grouping, ASS caption
style/animation, thumbnail candidate count, render output resolution/frame
rate/preset/CRF/bitrate, storage directories, log level.

## Future Extensibility

Planned next steps — real face/speaker detection (swap
`NoOpFaceDetectionService`), speaker diarization, auto zoom on emphasis,
dynamic camera movement, emoji insertion, background music with ducking,
intro/outro templates, watermarks, AI-generated titles/descriptions/hashtags,
multi-language subtitles and dubbing, job queues (BullMQ), progress via
SSE/WebSocket, cloud storage, multi-user auth, GPU acceleration — all slot in
as new services behind new interfaces, or a new controller reusing the
existing ones, without changing the pipeline already implemented here.
