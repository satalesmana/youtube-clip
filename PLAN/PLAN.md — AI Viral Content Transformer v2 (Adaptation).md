# AI Viral Content Transformer — v2 (Adaptation Plan)

> **Status:** Adaptasi dari `PLAN.md — AI Viral Content Transformer.md` terhadap
> codebase `youtube-clip` (viral-highlight-generator v0.1.0) yang sudah berjalan.
> Plan asli tetap menjadi referensi filosofi; dokumen ini memetakan visi ke
> kondisi nyata project dan menetapkan urutan kerja.
>
> **Keputusan arsitektur utama:** tetap mengikuti plan asli, **Remotion tetap
> dipertahankan sebagai video editor tool TAMBAHAN**. Template engine FFmpeg
> yang sudah ada tetap menjadi jalur cepat; Remotion menjadi jalur komposisi
> lanjutan (complex motion graphics, programmatic timeline) yang diintegrasikan
> di belakang satu interface `CompositionEngine` yang sama.

---

## 1. Kenapa Adaptasi Ini Dibuat

Dua masalah pada hasil saat ini:

1. **Monoton** — semua output memakai template statis + caption karaoke yang
   sama; tidak ada narasi orisinal, tidak ada variasi editorial.
2. **Berpotensi kena copyright / reused-content** — output saat ini pada
   dasarnya *re-distribusi* potongan source video dengan caption, tanpa
   tambahan nilai substantif (persis "simple clipper" yang plan asli tolak).

Solusi sesuai §60 plan asli:

```text
SOURCE + CONTEXT + ORIGINAL NARRATION + ANALYSIS + VISUAL STORYTELLING + EDITORIAL VALUE = TRANSFORMED CONTENT
```

---

## 2. Prinsip Kerja (tidak berubah dari plan asli)

- **Pipeline first** — jangan bangun dashboard/publish sebelum inti bekerja.
- **No database initially** — filesystem + JSON, repository abstraction.
- **Human review first** — tidak ada auto-publish.
- **Original value first** — sistem dioptimalkan untuk nilai editorial, bukan
  jumlah footage.
- **Clean isolation** — semua modul baru hidup di folder `src/content/`,
  `src/providers/tts/`, `src/composition/`, endpoint baru `server/api/transform.post.ts`.
  **Tidak ada perubahan pada pipeline `POST /api/process` yang sudah jalan.**

---

## 3. Arsitektur Target

```text
                         SOURCE (YouTube URL / videoId + candidate)
                           │
                           ▼
                  ┌─────────────────┐
                  │ Source Validator│  (existing: YoutubeService)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Transcript   │  (existing: WhisperService — word timestamps)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Candidate Picker│  (existing: HighlightService — Top 5)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Content Angle   │  NEW — 3-5 angle per momen, pilih terbaik
                  │    Generator    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Script Engine  │  NEW — hook/context/source/commentary/analysis/
                  │                 │        conclusion + originality rules
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   TTS / Voice   │  NEW — TTSProvider (edge-tts → OpenAI/ElevenLabs)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Video Planner  │  NEW — script → scene JSON
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │  Template   │ │   Remotion  │ │   Raw FFmpeg│
      │  Engine     │ │  (bonus)    │ │  (bonus)    │
      │  (existing) │ │             │ │             │
      └─────────────┘ └─────────────┘ └─────────────┘
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Quality Check  │  NEW (sebagian ada: clip validation)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Rights Gate   │  NEW — status manual + block publish
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Human Review   │  NEW — UI preview (web app existing)
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │      Output     │  MP4 final (manual publish untuk MVP)
                  └─────────────────┘
```

---

## 4. Mapping Plan Asli → Status Codebase

| Plan § | Komponen | Status | Catatan |
|---|---|---|---|
| §7-8, §12-14 | Source, storage, audio | ✅ DONE | `YoutubeService`, job workspace `outputs/{videoId}/` |
| §15, §49 | WhisperX | ✅ DONE+ | 3 provider: whisperx / faster-whisper / whisper-cpp |
| §18-20 | Candidate + scoring | 🟡 PARTIAL | Ada merge & rank; scoring 8-metrik berbobot belum |
| §16-17 | Semantic/topic segmentation | 🟡 PARTIAL | Chunking ada; unit INTRO/QUESTION/... belum |
| §21 | Content Angle | ❌ NEW | `src/content/angle.service.ts` |
| §22-23 | Script + originality | ❌ NEW | `src/content/script.service.ts` |
| §24 | TTS | ❌ NEW | `src/providers/tts/` + `src/services/tts.service.ts` |
| §25 | Video Plan | ❌ NEW | `src/content/video-plan.service.ts` |
| §26-27, §30 | Composition engine | ✅ DONE (FFmpeg template engine) | **Remotion ditambahkan sebagai opsi kedua** — lihat §7 |
| §28-29 | Template commentary | 🟡 NEW TEMPLATE | `templates/commentary/` (engine sudah siap) |
| §31-33 | B-roll / music / SFX | 🟡 PARTIAL | Layer `image`/`gradient` ada; sistem aset + rights belum |
| §34-35 | Quality checker | 🟡 PARTIAL | Clip validation ada; content QA belum |
| §36 | Rights gate | ❌ NEW | `src/rights/` (filesystem JSON) |
| §37 | Human review | ❌ NEW | Web UI existing (`public/`) |
| §38-41 | Variants / publish / analytics | ⏳ LATER | MVP manual |
| §42-45 | API layer / Zod / Pino | ✅ DONE | Pola diikuti untuk semua modul baru |
| §56-58 | DB / queue / S3 | ⏳ LATER | Repository abstraction sejak awal |
| §62 | Milestone | ✅ M1 DONE | URL → transcript → analysis → top-5 candidate |

---

## 5. Remotion sebagai Video Editor Tool Tambahan

### 5.1 Posisi Remotion dalam Arsitektur

Remotion **tidak menggantikan** template engine FFmpeg yang sudah terbukti.
Keduanya hidup di belakang satu interface:

```ts
// src/composition/engine.ts (NEW)
export type CompositionEngineKind = 'ffmpeg-template' | 'remotion';

export interface ICompositionEngine {
  kind: CompositionEngineKind;
  render(plan: VideoPlan, assets: CompositionAssets): Promise<RenderOutput>;
}
```

- **Default / jalur cepat:** `FfmpegTemplateCompositionEngine` — wrapper dari
  `TemplateRendererService` existing, mengonsumsi `VideoPlan` yang sama.
- **Jalur lanjutan:** `RemotionCompositionEngine` — project Remotion
  (`compositions/`) dirender via `npx remotion render`, dipanggil sebagai
  subprocess. Dipakai untuk konten yang butuh motion graphics kompleks,
  dynamic timeline, data-driven animation.

### 5.2 Kapan Pakai Remotion (vs Template Engine)

| Kebutuhan | Engine |
|---|---|
| Hook + source clip + caption + branding, cepat | FFmpeg template (default) |
| Motion graphics kompleks, animated infographics, kinetic typography | Remotion |
| Data-driven scenes (charts, countdown, quiz) | Remotion |
| Progress bar, dynamic text from live data | Remotion |
| A/B variant testing dengan timing presisi | Remotion (atau template) |

### 5.3 Integrasi Remotion (Tahapan)

1. **Setup:** project Remotion minimal di `compositions/` dengan 1 komponen
   `CommentaryShort` (9:16, 30-60s) yang menerima props `VideoPlan`.
2. **Bridge:** `RemotionCompositionEngine.render()` menulis `input-props.json`
   + source assets ke `outputs/{videoId}/remotion/`, lalu spawn
   `npx remotion render <entry> <compositionId> <output.mp4> --props=<json>`.
3. **Pitfall utama:** Remotion butuh Node + bundling; pastikan
   `remotion`/`@remotion/cli` di `devDependencies`, jalur `.output/` production
   tidak kena bundle (subprocess, bukan import).
4. **Fallback:** jika Remotion render gagal (env tidak punya GPU / waktu
   render), pipeline **fallback ke template engine** — output tetap keluar.

### 5.4 Keputusan

- **Sprint E (lihat §8)** membangun jalur FFmpeg-template **dulu** (default),
  karena 90% konten commentary cukup dengan itu dan sudah terbukti.
- **Sprint G** menambahkan jalur Remotion sebagai opsi `engine: "remotion"`
  pada `POST /api/transform` — setelah script + TTS + template commentary
  terbukti menghasilkan konten yang diinginkan.

---

## 6. Data Model Baru

### 6.1 Content Angle

```json
{
  "candidateId": "candidate_01",
  "angles": [
    {
      "id": "angle_01",
      "title": "Why AI won't simply replace developers",
      "angleType": "commentary",
      "hook": "AI may not replace developers — but it could change what they do.",
      "reason": "Membalik narasi umum, memicu curiosity.",
      "score": 88
    }
  ],
  "selectedAngleId": "angle_01"
}
```

### 6.2 Original Script

```json
{
  "candidateId": "candidate_01",
  "angleId": "angle_01",
  "language": "id",
  "sections": [
    { "type": "hook", "text": "AI tidak akan menggantikan developer..." },
    { "type": "context", "text": "Dalam diskusi tadi, ..." },
    { "type": "source", "text": "“AI agents will change how developers work.”" },
    { "type": "commentary", "text": "Yang menarik di sini adalah..." },
    { "type": "analysis", "text": "Artinya, peran developer bergeser dari..." },
    { "type": "conclusion", "text": "Jadi, ..." }
  ],
  "originality": {
    "status": "PASS",
    "notes": ["Tidak ada kutipan palsu", "Konteks source dipertahankan"]
  }
}
```

### 6.3 Video Plan (dikonsumsi composition engine)

```json
{
  "duration": 60,
  "scenes": [
    { "type": "hook", "duration": 4, "narration": "..." },
    { "type": "source", "start": 120.4, "end": 127.2, "sourceClip": "..." },
    { "type": "commentary", "duration": 12, "narration": "..." },
    { "type": "source", "start": 135.2, "end": 141.8 },
    { "type": "analysis", "duration": 20, "narration": "..." },
    { "type": "conclusion", "duration": 6, "narration": "..." }
  ],
  "captions": [
    { "start": 0, "end": 4, "text": "...", "highlightWords": [...] }
  ],
  "audio": {
    "narration": "outputs/{videoId}/voice/narration.wav",
    "sourceUnderlay": true,
    "ducking": false
  }
}
```

---

## 7. Modul Baru — Struktur & Tanggung Jawab

```text
src/
├── content/                          ← NEW (inti transformasi)
│   ├── angle.service.ts              ← ContentAngleService (LLM)
│   ├── script.service.ts             ← ScriptService (LLM + originality check)
│   ├── video-plan.service.ts         ← VideoPlanService (script → scenes)
│   └── content.prompt.ts             ← prompt template (angles, script, plan)
│
├── providers/
│   └── tts/                          ← NEW
│       ├── tts.provider.ts           ← TTSProvider interface + factory
│       ├── edge-tts.provider.ts      ← impl #1 (free, local, natural)
│       └── openai-tts.provider.ts    ← impl #2 (slot, OpenAI-compatible)
│
├── services/
│   ├── tts.service.ts                ← facade: synthesize → normalize WAV
│   └── (existing services tidak berubah)
│
├── composition/                      ← NEW
│   ├── engine.ts                     ← ICompositionEngine + factory (ffmpeg-template | remotion)
│   ├── ffmpeg-template.engine.ts     ← wrap TemplateRendererService
│   └── remotion.engine.ts            ← spawn npx remotion render (Sprint G)
│
├── rights/                           ← NEW (Sprint F)
│   ├── rights.service.ts             ← RightsService (filesystem JSON)
│   └── rights.schema.ts              ← Zod: UNKNOWN/PENDING/AUTHORIZED/LICENSED/CC/PD/REJECTED/EXPIRED
│
├── schemas/
│   ├── transform.schema.ts           ← Zod untuk POST /api/transform
│   ├── angle.schema.ts
│   ├── script.schema.ts
│   └── video-plan.schema.ts
│
├── types/
│   ├── transform.ts
│   ├── angle.ts
│   ├── script.ts
│   └── video-plan.ts
│
├── controllers/
│   └── transform.controller.ts       ← orchestrasi (tanpa HTTP)
│
└── container/index.ts                ← wiring baru (tidak menyentuh wiring existing)

server/api/
└── transform.post.ts                 ← NEW endpoint
```

---

## 8. Roadmap Implementasi (Sprint)

### Sprint A — Content Angle Generator
- [ ] `src/content/angle.service.ts` + prompt
- [ ] Input: candidate + transcript context (segmen di sekitar momen)
- [ ] Output: 3-5 angles, `selectedAngleId` (Zod validated)
- [ ] `src/schemas/angle.schema.ts`, `src/types/angle.ts`

### Sprint B — Script Engine
- [ ] `src/content/script.service.ts` + `content.prompt.ts`
- [ ] Originality rules (§23 plan asli) sebagai instruksi prompt + post-check
      sederhana (deteksi copy-paste fragmen transcript, panjang narasi)
- [ ] Output: `script.json` (sections HOOK→CONCLUSION), Zod validated
- [ ] `src/schemas/script.schema.ts`, `src/types/script.ts`

### Sprint C — TTS
- [ ] `TTSProvider` interface + factory (`edge-tts` default, `openai` slot)
- [ ] `src/services/tts.service.ts`: synthesize → WAV mono 16kHz, duration probe
- [ ] `.env`: `TTS_PROVIDER`, `TTS_VOICE`, `TTS_RATE` (+ `EDGE_TTS_BINARY` jika CLI)
- [ ] Fallback: jika TTS gagal → pipeline tetap jalan tanpa narasi (warning)

### Sprint D — Video Planner
- [ ] `src/content/video-plan.service.ts`: script + candidate timestamps → scenes
- [ ] Map ke layer template engine (video source, caption, teks commentary)
- [ ] `src/schemas/video-plan.schema.ts`, `src/types/video-plan.ts`

### Sprint E — Template Commentary + Endpoint
- [ ] `templates/commentary/` (manifest + template.json): video atas 60%,
      caption tengah, band teks commentary bawah + branding
- [ ] `server/api/transform.post.ts` + `src/controllers/transform.controller.ts`
- [ ] Request: `{ youtubeUrl | videoId, candidateId?, template?, channel? }`
- [ ] Response: `{ jobId?, angle, script, narration, videoPlan, previewVideo }`
- [ ] Wiring di `container/index.ts` (baru, tidak menyentuh existing)

### Sprint F — Rights Gate + Quality + Human Review (UI)
- [ ] `src/rights/rights.service.ts` (JSON per video: source + assets)
- [ ] Status default `UNKNOWN` → tidak publishable
- [ ] Quality check: durasi, audio presence, caption coverage, black frames
      (FFmpeg probe — sebagian sudah ada di renderer)
- [ ] Web UI: halaman review (preview video, script, rights, approve/reject)

### Sprint G — Remotion Integration (video editor tool tambahan)
- [ ] Project Remotion minimal di `compositions/`
- [ ] `src/composition/remotion.engine.ts` + `ICompositionEngine`
- [ ] `engine: "ffmpeg-template" | "remotion"` pada `POST /api/transform`
- [ ] Fallback otomatis ke template engine saat render Remotion gagal
- [ ] Dokumentasi setup (`@remotion/cli`, bundling, input-props)

### Sprint H — Analytics & Feedback Loop (FASE BERIKUTNYA)
- [ ] Collect metrics (views/likes/watch time) — manual input dulu
- [ ] Bandingkan prediksi vs performa → update scoring

---

## 9. Definition of Done (DoD) per Sprint

- Typecheck & lint pass: `npm run typecheck && npm run lint`
- Semua modul baru punya interface + Zod schema + logging pino (pola existing)
- **Tidak ada file existing yang diubah** kecuali `.env.example`, `container`
  (tambah wiring saja), dan `nitro.config.ts` jika perlu env baru
- Endpoint baru bisa dipanggil dengan curl dan menghasilkan artifact nyata
  (script.json / narration.wav / preview.mp4)
- Fallback TTS & Remotion tidak pernah membuat pipeline gagal total

---

## 10. Konfigurasi Baru (`.env.example`)

```text
# --- TTS ---
# edge-tts (default, gratis, lokal) | openai (OpenAI-compatible)
TTS_PROVIDER=edge-tts
# Nama suara: lihat `edge-tts --list-voices` (mis. id-ID-ArdiNeural, en-US-AndrewMultilingualNeural)
TTS_VOICE=id-ID-ArdiNeural
TTS_RATE=+10%
TTS_OUTPUT_DIR=outputs

# --- Transform pipeline ---
TRANSFORM_LANGUAGE=id
TRANSFORM_MAX_ANGLES=5
# ffmpeg-template (default) | remotion
COMPOSITION_ENGINE=ffmpeg-template

# --- Rights ---
RIGHTS_DIR=outputs/rights
```

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Remotion render lambat / butuh GPU | Fallback ke template engine; Remotion opsional |
| TTS gratis (edge-tts) kualitas kurang | Interface memungkinkan swap ke OpenAI/ElevenLabs |
| LLM output script tidak valid | Zod strict + retry + robust JSON parser (pengalaman qwen3:14b) |
| Konten tetap terlihat "klip ulang" | Originality rules di prompt + narasi orisinal + variasi angle |
| Scope creep (queue/db/UI sebelum inti) | Sprint A-F dulu, baru infrastruktur |

---

## 12. Milestone Ringkas

```text
M1 (DONE)    URL → transcript → analysis → Top-5 candidates
M2 (Sprint A-C) angle → script → TTS narration
M3 (Sprint D-E) video plan → template commentary → preview MP4
M4 (Sprint F)   rights gate + quality + human review
M5 (Sprint G)   Remotion sebagai engine tambahan
M6 (Sprint H)   analytics + feedback loop
```

---

## 13. Verifikasi (bagaimana tahu plan bekerja)

1. Jalankan `POST /api/transform` pada video yang sudah ada di `outputs/`:
   dapat `script.json` yang **berbeda secara substantif** dari transcript.
2. Narasi TTS terdengar natural, sinkron dengan scene timeline.
3. Preview MP4 9:16 memiliki: hook kuat, source clip pendek, commentary,
   caption karaoke, branding — tanpa dominasi footage source.
4. Rights status `UNKNOWN` memblokir publish.
5. `engine: "remotion"` menghasilkan output setara tanpa mengubah script/TTS.
