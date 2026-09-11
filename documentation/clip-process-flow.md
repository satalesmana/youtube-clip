# Flow Process: Video Clip Builder (Activity Diagram)

Diagram alur aktivitas lengkap dari riset topik viral, input YouTube URL, sampai video jadi siap diputar/diunduh.

> **Update:** pipeline lama `POST /api/process` (highlight extraction + batch clip render) sudah dihapus.
> Alur aktif kini memiliki beberapa tahap: **`/api/research`** (opsional) → **`/api/hooks/generate`** → **`/api/clips/recommend`** → **`/api/scripts/draft`** (opsional draf naskah tanpa TTS) → **`/api/tts/synthesize`** (opsional preview audio) → **`/api/transform`**,
> plus endpoint restore/utilities: `GET /api/hooks`, `POST /api/hooks/rerender`, `GET /api/clips`, `GET /api/transcript`, `POST /api/transcript/update`, `GET /api/templates`, `GET /api/captions`, dan `POST /api/captions/generate`.
>
> **Tanpa rekomendasi pun pipeline tetap jalan.** Rekomendasi Hook dan Klip Viral sama-sama opsional:
> transform narasi tanpa hook memakai *momen otomatis* (`selectMoment`, `candidateId` 0 → window ±35
> detik pertama transkrip, headline tetap dari LLM); Mode Reel tanpa klip terpilih ditolak rapi di
> frontend (toast + auto-scroll ke panel klip) sekaligus di backend (refine Zod + guard `transformReel`).

## Activity Diagram — End-to-End

```mermaid
flowchart TD
    START([🎬 START]) --> RES{"Mulai dari Riset?"}
    
    RES -->|"Ya"| RESEARCH["POST /api/research\nKumpul sinyal viral (RSS, Reddit, dll)\nAI meranking topik & mencocokkan\nvideo YouTube"]
    RESEARCH --> INPUT["Input\nYouTube URL (dari hasil riset)"]
    
    RES -->|"Tidak"| INPUT["Input\nYouTube URL (manual)"]
    
    INPUT --> RESOLVE{"Video + transcript\nsudah ada di\noutputs/{videoId}/?"}

    RESOLVE -->|"Ya"| REUSE["⚡ FAST-PATH\nPakai video & transcript existing\n(tanpa yt-dlp, tanpa Whisper)\nlog: Using existing video and transcript"]
    RESOLVE -->|"Tidak"| DL["Download Video\nYoutubeService → yt-dlp → mp4\noutputs/{videoId}/downloads/{videoId}.mp4"]
    DL --> WKSP["Create Job Workspace\ncreateJobWorkspace()\noutputs/{videoId}/\n{downloads,temp,transcripts,...}"]
    WKSP --> AUD["Extract Audio\nTranscriptService → FFmpeg\nmono 16kHz WAV"]
    AUD --> TRANS["Transcribe Audio\nWhisperService\nsegments + word timestamps"]
    TRANS --> SAVE["Save Transcript\noutputs/{videoId}/transcripts/{videoId}.json"]
    SAVE --> REUSE

    REUSE --> BRANCH{"Pilih Pipeline"}

    %% ── PATH 1: /api/hooks/generate ──
    BRANCH -->|"/api/hooks/generate"| H_CACHE{"hooks/candidate-{id}.json\nsudah ada?"}
    H_CACHE -->|"Ya"| H_SAVED["Return saved result\ncached response"]
    H_CACHE -->|"Tidak"| H_MOM["Select Moment\nHookController → selectMoment\nsegment window + context"]
    H_MOM --> H_ANG["Generate Angles\nContentAngleService"]
    H_ANG --> H_STORY["Derive Story Beats\nStoryService"]
    H_STORY --> H_GEN["Generate Hook Candidates\nHookGenerator\n10-15 candidates (angles × styles)"]
    H_GEN --> H_GUARD["Accuracy Guard\nHookEvaluator\nreject misleading/clickbait"]
    H_GUARD --> H_SCORE["Score 7 Metrics\nHookScorer\ncuriosity..accuracy → final"]
    H_SCORE --> H_RANK["Rank Top-5\nHookRanker\ndedup + diversity penalty"]
    H_RANK --> H_SAVE["Persist Result\noutputs/{videoId}/hooks/candidate-{id}.json"]
    H_SAVE --> H_PREV["⚡ PARALLEL Preview Render\nPromise.allSettled\nhook-previews/hook-{NN}.mp4\n(1 gagal ≠ semua gagal)"]
    H_PREV --> RESULT_C["Return HookRecommendationResult\n{hooks[5] + previewUrl, candidateCount,\nrejectedCount, duplicateCount}"]
    RESULT_C --> PICK["🎯 Pilih hook\n→ umpan ke /api/transform\n(candidateId)"]

    %% ── PATH 2: /api/clips/recommend ──
    BRANCH -->|"/api/clips/recommend"| C_CACHE{"clips/recommendations.json\nsudah ada?"}
    C_CACHE -->|"Ya"| C_SAVED["Return saved result\n{cached: true}"]
    C_CACHE -->|"Tidak"| CHUNK["Chunk Transcript\noverlap-aware, LLM-sized chunks"]
    CHUNK --> PAR_AI{"⚡ PARALLEL\nAnalyze Each Chunk\nHighlightAnalysisService × N chunks\n(Router AI)"}
    PAR_AI --> MERGE["Merge & Rank\nHighlightService → dedup overlap\nclamp durasi [min,max]\ntop-N by score"]
    MERGE --> C_SAVE["Persist Result\noutputs/{videoId}/clips/recommendations.json"]
    C_SAVE --> C_PREV["⚡ PARALLEL Preview Render\nPromise.allSettled\nclip-previews/clip-{NN}.mp4"]
    C_PREV --> RESULT_D["Return ClipRecommendResult\n{clips[] + previewUrl,\nvideoUrl, cached: false}"]
    RESULT_D --> SEL_CLIP["🎯 Pilih klip range\n→ umpan ke /api/transform\n(outputMode: reel)"]

    %% ── PATH 3: /api/transform ──
    BRANCH -->|"/api/transform"| ANGLE["Generate Angles\nContentAngleService\n(cache via ContentCache)"]
    ANGLE --> STORY["Derive Story Beats\nStoryService\nsource-grounded narrative"]
    STORY --> SCRIPT["Write Script\nScriptService\noriginal narration\n{hook, body, conclusion}"]
    SCRIPT --> TTS["Synthesize TTS\nTtsService (edge-tts / OpenAI)\n→ narration MP3\n(provider/voice override per request)"]
    TTS --> MODE{"outputMode?"}
    MODE -->|"narration"| PLAN["Build Video Plan\nVideoPlanService\ntimeline scenes + timing + watermark"]
    PLAN --> COMPOSE{"Composition Engine\nengine.factory.ts"}
    COMPOSE -->|Remotion| REMOTION["Remotion Engine\nstage media → public/media/\nrun CLI → CommentaryShort|SportsShort\n(+ CaptionService if needed)"]
    COMPOSE -->|"FFmpeg Template"| FFTEMP["FFmpeg Template Engine\ncompose + addAudio mux + watermarks"]
    COMPOSE -->|Fallback| FALL["Fallback\nscale 1080×1920 + pad"]
    MODE -->|"reel"| REEL["ReelComposerService\nintro = styled final-hook-{NN}.mp4 (WYSIWYG)\natau cut sourceRange; planReelSegments\nguard anti-repeat (no second plays twice)\nconcat + segment subtitles\n→ reel.mp4 (tanpa narasi)"]

    REMOTION --> OUT["outputs/{videoId}/render/{jobId}/rendered.mp4\n(fallback: transform/{jobId}/clips/transformed.mp4)"]
    FFTEMP --> OUT
    FALL --> OUT
    REEL --> OUT_REEL["outputs/{videoId}/transform/{jobId}/clips/reel.mp4"]

    OUT --> RESULT_B["Return transform result\n{angle, story, script, narration, videoPlan,\noutputVideo: {path, duration, size}}"]
    OUT_REEL --> RESULT_B

    %% ── Serving ──
    RESULT_C --> SERVE["Media Serving\n/api/media/[...path] (allowlist)"]
    RESULT_D --> SERVE
    RESULT_B --> SERVE
    SERVE --> PLAY["▶️ Play / ⬇️ Download\nWeb UI (hook card / clip panel /\ntransform result card)"]

    PICK --> END([END])
    SEL_CLIP --> END
    PLAY --> END

    %% ── Styling ──
    classDef pipelineR fill:#3a3a1a,stroke:#facc15,color:#e0e0e0
    classDef pipelineC fill:#3a1a2a,stroke:#e879f9,color:#e0e0e0
    classDef pipelineD fill:#1a3a2a,stroke:#4ade80,color:#e0e0e0
    classDef pipelineB fill:#1a2a3a,stroke:#60a5fa,color:#e0e0e0
    classDef shared fill:#2a2a2a,stroke:#a0a0a0,color:#e0e0e0
    classDef serve fill:#3a2a1a,stroke:#fbbf24,color:#e0e0e0

    class RESEARCH pipelineR
    class H_MOM,H_ANG,H_STORY,H_GEN,H_GUARD,H_SCORE,H_RANK,H_SAVE,H_PREV,RESULT_C,PICK,H_SAVED pipelineC
    class CHUNK,PAR_AI,MERGE,C_SAVE,C_PREV,RESULT_D,SEL_CLIP,C_SAVED pipelineD
    class ANGLE,STORY,SCRIPT,TTS,MODE,PLAN,COMPOSE,REMOTION,FFTEMP,FALL,REEL,OUT,OUT_REEL,RESULT_B pipelineB
    class START,RES,INPUT,RESOLVE,REUSE,DL,WKSP,AUD,TRANS,SAVE shared
    class SERVE,PLAY serve
```

## Sequence Diagram — /api/research (Viral Signal & Topic Research)

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser (Web UI)
    participant API as POST /api/research
    participant RS as ResearchService
    participant DP as Data Providers (RSS/Reddit/X/Trends)
    participant AI as AI Engine (Router)
    participant YT as YouTube Data API

    Browser->>API: { max_trends, language, providers, ... }
    API->>RS: research(request)
    
    par Fetch Signals
        RS->>DP: Fetch trends from selected providers
        DP-->>RS: Raw Signals (Topics, Keywords, Articles)
    end
    
    RS->>AI: Evaluate & Rank Topics (AI Model)
    AI-->>RS: Ranked Trend List with viral scores
    
    loop For each top trend
        RS->>YT: Search YouTube videos based on keywords
        YT-->>RS: Video Candidates
        RS->>AI: Re-evaluate video relevance to trend
        AI-->>RS: Matched Videos
    end
    
    RS-->>API: ResearchResult { trends[], signalCount }
    API-->>Browser: { success: true, trends, signalCount }
```

## Sequence Diagram — /api/hooks/generate (Hook Recommendation Engine)

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser (Web UI)
    participant API as POST /api/hooks/generate
    participant YT as YoutubeService
    participant TS as TranscriptService
    participant WH as WhisperService
    participant ANG as ContentAngleService
    participant STR as StoryService
    participant GEN as HookGenerator
    participant EVAL as HookEvaluator
    participant SC as HookScorer
    participant RK as HookRanker
    participant PR as PreviewRenderer

    Browser->>API: {youtubeUrl|videoId, candidateId?, language?,\n duration? {min,max}, styles?, platform?}

    alt youtubeUrl provided
        API->>API: resolveTranscript()\nfast-path: video + transcript existing?
        opt Belum ada di workspace
            API->>YT: downloadVideo(url, workspace)
            YT-->>API: {videoPath, videoId}
            API->>TS: extractAudio(videoPath)
            API->>WH: transcribe(audioPath)
            WH-->>API: TranscriptDocument
            API->>TS: saveTranscript()
        end
    else videoId provided
        API->>TS: loadTranscript(videoId) + workspace fallback
        TS-->>API: TranscriptDocument
    end

    API->>API: selectMoment(candidateId) → momentSegments + contextSegments
    API->>ANG: generateAngles(momentContext) (cached)
    ANG-->>API: AngleGenerationResult {angles[], selected}
    API->>STR: buildStory(context+moment segments) (cached)
    STR-->>API: SourceStory | undefined

    API->>GEN: generate(angles, story, segments, styles, language, duration)
    GEN-->>API: HookCandidate[] (10-15, angles × styles)

    API->>EVAL: guard(candidates, segments)
    EVAL-->>API: {accepted[], rejected[]} (accuracy guard)

    API->>SC: score(accepted)
    SC-->>API: HookCandidate[] + 7-metric score card

    API->>RK: rank(scored)
    RK-->>API: {ranked[top-5], duplicateCount} (diversity penalty)

    API->>API: persist → outputs/{videoId}/hooks/candidate-{id}.json

    par Preview render (allSettled, best-effort)
        API->>PR: styled render HookIntroShort → hook-previews/final-hook-{NN}.mp4
        PR-->>API: previewUrl + previewPath + finalDurationSeconds
        Note over API,PR: gagal → fallback raw cut (PreviewRendererService)<br/>hook-{NN}.mp4. Matikan via env HOOK_PREVIEW_STYLED=0.<br/>(Gunakan POST /api/hooks/rerender untuk re-render tanpa LLM)
    and
        API-->>Browser: HookRecommendationResult\n{hooks[5] + previewUrl, candidateCount,\n rejectedCount, duplicateCount, generatedAt}
    end
```

## Sequence Diagram — /api/clips/recommend (Viral Clip Recommendation)

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser (Web UI)
    participant API as POST /api/clips/recommend
    participant YT as YoutubeService
    participant TS as TranscriptService
    participant WH as WhisperService
    participant AI as HighlightAnalysisService / Router
    participant HL as HighlightService
    participant PR as PreviewRenderer

    Browser->>API: {youtubeUrl, sttProvider?}

    API->>API: resolveTranscript()\nfast-path: video + transcript existing?
    opt Belum ada di workspace
        API->>YT: downloadVideo(url, workspace)
        YT-->>API: {videoPath, videoId}
        API->>TS: extractAudio(videoPath)
        API->>WH: transcribe(audioPath)
        WH-->>API: TranscriptDocument
        API->>TS: saveTranscript()
    end

    API->>TS: chunkTranscript() → TranscriptChunk[]

    loop Each chunk (parallel, allSettled — 1 gagal ≠ semua gagal)
        API->>AI: analyzeChunk(chunk)
        AI-->>API: HighlightClip[] {start,end,score,title,hook}
    end

    API->>HL: mergeAndRank(allClips)
    HL-->>API: ranked clips (dedup, clamp durasi, top-N)

    API->>API: persist → outputs/{videoId}/clips/recommendations.json

    par Preview render (allSettled, best-effort)
        API->>PR: renderPreview(clip, video, clip-previews/)
        PR-->>API: clip-{NN}.mp4 → previewUrl
    and
        API-->>Browser: ClipRecommendResult\n{clips[] + previewUrl, videoUrl, cached: false}
    end

    Note over Browser,PR: Restore after reload:<br/>GET /api/clips?url=... → saved recommendations.json (cached: true)
```

## Sequence Diagram — /api/transform (AI Viral Transformer, SSE)

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser (Web UI)
    participant API as POST /api/transform
    participant YT as YoutubeService
    participant TS as TranscriptService
    participant WH as WhisperService
    participant ANG as ContentAngleService
    participant STR as StoryService
    participant SCR as ScriptService
    participant TTS as TtsService
    participant VP as VideoPlanService
    participant ENG as CompositionEngine
    participant RC as ReelComposerService
    participant MEDIA as /api/media

    Browser->>API: {youtubeUrl, template?, language?, sttProvider?,\n ttsProvider?, ttsVoice?, hookBadge?, channel?, outputMode?,\n selectedClips?, sourceRange?, customHook?, dryRun?}\nAccept: text/event-stream
    Note over Browser,API: Tanpa pilihan hook/klip pun body tetap valid:\nfrontend hanya mengirim youtubeUrl+setting dasar\n(tanpa sourceRange/customHook/selectedClips).

    API->>API: fast-path: video + transcript existing?\n(stage download/transcript emitted skipped)
    opt Belum ada di workspace
        API->>YT: downloadVideo(url, job)
        YT-->>API: {videoPath, videoId}
        API-->>Browser: event: stage {stage:"download"}
        API->>TS: extractAudio(videoPath)
        API->>WH: transcribe(audioPath)
        WH-->>API: TranscriptDocument
        API->>TS: saveTranscript()
    end
    API-->>Browser: event: stage {stage:"transcript"}
    API->>TS: loadTranscript(videoId)

    Note over API,ANG: Pemilihan momen sumber:\nsourceRange ada (hook dipilih) → selectRange(range)\nsourceRange absen → selectMoment(candidateId default 0)\n= window ±35 detik pertama transkrip (momen otomatis)

    API-->>Browser: event: stage {stage:"angle"}
    API->>ANG: generateAngles(angleContext) (cache via ContentCache)
    ANG-->>API: AngleGenerationResult {angles[], selected}

    API-->>Browser: event: stage {stage:"story"}
    API->>STR: buildStory(segments) (cached)
    STR-->>API: Story {concept, beats[]}

    API-->>Browser: event: stage {stage:"script"}
    API->>SCR: generateScript(scriptContext) (cached)
    SCR-->>API: OriginalScript {sections[], estimatedDuration}

    alt outputMode = "reel"
        Note over API,RC: Guard dua lapis saat tidak ada klip terpilih:\nfrontend menolak dulu (toast + scroll ke panel klip),\nbackend menolak lagi (refine Zod + guard transformReel).\nTanpa hook: intro = undefined → hanya klip terpilih.
        API-->>Browser: event: stage {stage:"reel"}
        Note over API,RC: intro = file final-hook-{NN}.mp4 bila ada (WYSIWYG),\nelse potongan sourceRange. planReelSegments memangkas\ndetik yang tumpang tindih → tidak ada detik sumber diputar dua kali.
        API->>RC: compose(intro + selected ranges + subtitles)
        RC-->>API: reel.mp4 (tanpa narasi TTS)
    else outputMode = "narration" (default)
        API-->>Browser: event: stage {stage:"tts"}
        opt ttsProvider + ttsVoice provided
            API->>API: createTtsServiceWith(kind, voice) → per-request service
        end
        API->>TTS: synthesizeScript(script, workspaceDir)
        TTS-->>API: {narrationPath, durationSeconds}

        API-->>Browser: event: stage {stage:"plan"}
        API->>VP: buildPlan({script, clipRange, narration})
        VP-->>API: VideoPlan {scenes[], captions[], audio}

        API-->>Browser: event: stage {stage:"render"}
        API->>ENG: render(videoPlan, assets)

        alt Composition Engine = Remotion
            ENG->>ENG: stage media → public/media/{jobId}/\nremotion render CommentaryShort|SportsShort\n(menyertakan CaptionService/WatermarkFilterService jika aktif)
        else Composition Engine = FFmpeg Template
            ENG->>ENG: compose (FFmpeg filtergraph) + addAudio mux
        else Fallback
            Note over ENG: video.sourceTrim = rentang hook terpilih\n(jika ada) → footage dibuka di momen yang dipilih
            ENG->>ENG: trim source + scale 1080×1920 + pad
        end
        ENG-->>API: {path, duration, size}
    end

    API-->>Browser: event: result {outputVideo, narration, script, angle, videoPlan}

    Note over Browser,MEDIA: Playback
    Browser->>MEDIA: GET /api/media/{videoId}/render/{jobId}/rendered.mp4
    MEDIA-->>Browser: stream mp4
```

## Media Serving & Playback Flow

```mermaid
flowchart LR
    subgraph Disk["outputs/"]
        A["{videoId}/render/{jobId}/rendered.mp4\n(from /api/transform narration)"]
        B["{videoId}/transform/{jobId}/clips/transformed.mp4\n(fallback render)"]
        C["{videoId}/transform/{jobId}/clips/reel.mp4\n(outputMode reel)"]
        D["{videoId}/transform/{jobId}/voice/voice/narration.mp3\n(TTS audio)"]
        E["{videoId}/clip-previews/clip-{NN}.mp4\n(preview /api/clips/recommend)"]
        F["{videoId}/hook-previews/hook-{NN}.mp4\n(preview /api/hooks/generate)"]
        G["{videoId}/clips/clip-NNN.mp4\n(legacy /api/process)"]
    end

    subgraph API["Media Endpoint"]
        M["/api/media/[...path].get.ts\nallowlist regex"]
    end

    subgraph FE["Web UI"]
        H["Hook card / Clip panel"]
        T["Transform result card"]
    end

    A -->|allowed| M
    B -->|allowed| M
    C -->|allowed| M
    D -->|allowed, audio/mpeg| M
    E -->|allowed| M
    F -->|allowed| M
    G -->|allowed (legacy artifact)| M

    M -->|"stream mp4/mpeg"| H
    M -->|"stream mp4/mpeg"| T

    H -->|"▶️ play / ⬇️ download"| BROWSER["Browser"]
    T -->|"▶️ play / ⬇️ download"| BROWSER

    style A fill:#1a2a3a,stroke:#60a5fa,color:#e0e0e0
    style C fill:#1a3a2a,stroke:#4ade80,color:#e0e0e0
    style E fill:#1a3a2a,stroke:#4ade80,color:#e0e0e0
    style F fill:#3a1a2a,stroke:#e879f9,color:#e0e0e0
    style M fill:#2a2a2a,stroke:#a0a0a0,color:#e0e0e0
```

## File Artifact Map

```
outputs/{videoId}/
├── downloads/
│   └── {videoId}.mp4              ← YouTube video (yt-dlp, dipakai ulang via fast-path)
├── temp/
│   ├── audio.wav                  ← extracted audio (FFmpeg)
│   └── *.tmp                      ← temp files (thumbnail, focal point)
├── transcripts/
│   └── {videoId}.json             ← Whisper transcript (bisa di-update via POST /api/transcript/update)
├── hooks/                         ← /api/hooks/generate
│   └── candidate-{N}.json         ← HookRecommendationResult (persist)
├── hook-previews/
│   ├── final-hook-{NN}.mp4        ← styled final intro (HookIntroShort) —
│   │                                 dipakai ulang reel sebagai pembuka (WYSIWYG)
│   └── hook-{NN}.mp4              ← fallback raw cut per hook
├── clip-previews/
│   └── clip-{NN}.mp4              ← preview video per klip (/api/clips/recommend)
├── clips/                         ← /api/clips/recommend
│   ├── recommendations.json       ← ClipRecommendResult (persist)
│   └── clip-001.mp4               ← (legacy /api/process, tak lagi diproduksi)
├── metadata/
│   └── clips.json                 ← (legacy; masih dibaca GET /api/history bila ada)
├── render/                        ← /api/transform output (composition engine)
│   └── {jobId}/
│       ├── rendered.mp4           ← final transformed video
│       └── input-props.json       ← Remotion props (if using Remotion)
└── transform/                     ← /api/transform fallback & reel output
    └── {jobId}/
        ├── clips/
        │   ├── transformed.mp4    ← fallback render
        │   └── reel.mp4           ← outputMode "reel"
        └── voice/
            └── voice/
                └── narration.mp3  ← TTS narration audio
```

## Key Architectural Patterns

| Pattern | Location | Purpose |
|---|---|---|
| Workspace Fast-Path | `resolveTranscript()` di clip/hook/transform controller | Cek `outputs/{videoId}/downloads/{videoId}.mp4` + transcript dulu (`fs.access`) — skip yt-dlp & Whisper untuk video yang sudah pernah diproses |
| Per-Video Isolation | `createJobWorkspace()` | Semua artifact terisolasi per videoId; `downloadVideo()` wajib terima workspace |
| Result Persistence + Restore | `hooks/candidate-{N}.json`, `clips/recommendations.json` + `GET /api/hooks`, `GET /api/clips` | Hasil tersimpan ke disk; UI restore tanpa menjalankan pipeline |
| Pre-Pipeline Research | `ResearchController` | Mengumpulkan sinyal topik viral dari luar (RSS, Reddit, Trends) dan mencocokkan video YouTube secara AI-driven sebelum URL diproses pipeline |
| Fast Design Testing | `POST /api/hooks/rerender` | Re-render preview hook dengan styling Remotion terbaru tanpa harus memanggil ulang LLM atau transcribe pipeline |
| Editable Transcripts | `POST /api/transcript/update` | Segmen transkrip yang dikoreksi user disimpan kembali, mempengaruhi hasil caption rendering |
| Fault Isolation | `Promise.allSettled()` pada preview render (hook & clip controller) | 1 preview gagal ≠ semua gagal |
| Editorial Cache | `ContentCache` (`outputs/transform-cache/`) | Angle/story/script di-cache per videoId+candidateId+range |
| Decoupled Script Drafting | `POST /api/scripts/draft` + `TransformController.draftScript` | Menyusun draf naskah AI orisinal (Angle → Story → Script) tanpa memanggil TTS sama sekali (hemat kuota & cepat) |
| On-Demand TTS Synthesis | `POST /api/tts/synthesize` + `TransformController.synthesizeTts` | Menghasilkan audio TTS untuk naskah kustom/hasil review secara on-demand saat user ingin preview audio |
| Real-Time SSE Progress | `TransformController.onStage` + `server/api/transform.post.ts` | Stream `stage`/`result`/`error` events; UI update tiap stage live |
| Dual Output Mode | `outputMode: 'reel' \| 'narration'` | Reel = concat range terpilih (ReelComposerService); Narration = script → TTS → video plan → composition engine |
| No-Selection Default | `TransformController.selectMoment` + guard `transformReel` | Transform tetap jalan tanpa rekomendasi: narasi pakai momen otomatis (35 detik pertama transkrip, headline dari LLM); reel tanpa klip ditolak rapi (toast frontend + refine Zod + guard controller) |
| Accuracy Guard | `HookEvaluator` (hook engine stage 2) | Tolak hook yang tidak didukung sumber (anti-clickbait) |
| 7-Metric Quality Card | `HookScorer` (hook engine stage 3) | Skor objektif 0-100: curiosity, retention, emotional, visual, clarity, relevance, accuracy → `final` |
| Diversity Ranking | `HookRanker` (hook engine stage 4) | Dedup semantic (>60% overlap) + diversity penalty → Top-5 |
| Reused Editorial Stages | `HookController` | Hook engine mengkonsumsi angle/story yang ada, tidak mengubah pipeline transform |
| Per-Request TTS Override | `createTtsServiceWith(kind, voice)` | User pilih provider/voice per request (`ttsProvider`, `ttsVoice`) |
| Allowlist Media Serving | `server/api/media/[...path].get.ts` | Hanya serve path yang cocok regex (render/transform/previews/narration) |
| Retry + Validation | Download, LLM calls, render | Auto-retry + output validation |

## Environment Config Reference

| Variable | Default | Purpose |
|---|---|---|
| `OUTPUTS_DIR` | `outputs` | Root output directory |
| `HIGHLIGHT_MIN_SECONDS` | 20 | Durasi minimum klip saat merge & rank (`HighlightService`) |
| `HIGHLIGHT_MAX_SECONDS` | 60 | Durasi maksimum klip saat merge & rank |
| `HIGHLIGHT_TOP_N` | 10 | Jumlah klip top-N hasil rank |
| `COMPOSITION_ENGINE` | `ffmpeg-template` | Engine: `remotion` or `ffmpeg-template` |
| `TTS_PROVIDER` | `edge-tts` | TTS backend: `edge-tts` or `openai` (bisa di-override per request via `ttsProvider`/`ttsVoice`) |
| `AI_PROVIDER` | `router` | AI backend: OpenAI-compatible router (e.g. 9Router) |

> Konfigurasi hook engine (jumlah kandidat, top-N, batas durasi window) di-hardcode di `src/container/index.ts` / controller — tidak punya env vars sendiri. Hasil hook & klip kini dipersist ke disk (`hooks/`, `clips/recommendations.json`) dan dapat diumpankan ke `/api/transform` via `candidateId` + `selectedClips`.
>
> Verifikasi perilaku "tanpa pilihan" (narasi jalan penuh dengan momen otomatis, reel ditolak rapi, fast-path tetap reuse): `npx tsx scripts/verify-no-selection-default.ts`.
