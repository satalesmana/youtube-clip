# AI Viral Content Transformer

## 1. Project Overview

AI Viral Content Transformer adalah backend AI untuk mengubah video source menjadi short-form content yang memiliki nilai editorial/original tambahan.

Project tidak ditujukan sebagai simple video clipper.

### Simple Clipper

```text
YouTube
   ↓
Cut
   ↓
Crop
   ↓
Subtitle
   ↓
Upload
```

### Target Architecture

```text
Authorized Source
       ↓
   Transcription
       ↓
   Content Analysis
       ↓
   Viral Moment Detection
       ↓
   Content Angle
       ↓
   Original Script
       ↓
   Original Narration
       ↓
   Source Evidence
       ↓
   B-Roll / Graphics
       ↓
   Video Composition
       ↓
   Quality & Rights Gate
       ↓
   Human Review
       ↓
   Publish
```

Tujuan utamanya adalah membuat konten yang memberikan **additional editorial value**, bukan sekadar mendistribusikan ulang source video.

---

# 2. Current Project Baseline

Project saat ini:

```text
Name:
viral-highlight-generator

Version:
0.1.0

Runtime:
Node.js >= 22

Language:
TypeScript

Module:
ESM
```

Current scripts:

```text
dev
build
preview
typecheck
lint
lint:fix
format
prepare
```

Current runtime dependencies:

```text
dotenv
h3
nitropack
pino
zod
```

Current development dependencies:

```text
TypeScript
ESLint
Prettier
Husky
lint-staged
Node types
```

Source configuration menunjukkan bahwa project saat ini masih berupa backend foundation yang relatif minimal. Belum ada database, ORM, queue system, atau video rendering framework di dependency list.

---

# 3. Development Principles

## 3.1 No Database Initially

Phase awal tidak menggunakan:

- PostgreSQL
- MySQL
- MongoDB
- Redis
- ORM
- S3
- BullMQ

Gunakan filesystem + JSON sebagai persistence sementara.

Database hanya ditambahkan ketika kebutuhan sudah terbukti.

---

## 3.2 Pipeline First

Prioritas utama:

```text
Source
→ Transcript
→ Analysis
→ Viral Score
→ Content Angle
→ Script
→ Video Plan
→ Render
```

Jangan membangun dashboard/publishing terlebih dahulu sebelum pipeline inti bekerja.

---

## 3.3 Human Review First

MVP tidak melakukan auto-publish.

Flow:

```text
Generated Video
      ↓
Quality Check
      ↓
Rights Check
      ↓
Human Review
      ↓
Approve / Reject
```

---

## 3.4 Original Value First

Sistem harus mengoptimalkan:

```text
Original Value
+
Context
+
Analysis
+
Narration
+
Visual Storytelling
```

Bukan:

```text
Jumlah source footage
```

---

# 4. Target Content Model

Content yang dibuat harus memiliki salah satu atau beberapa elemen berikut:

- Commentary
- Analysis
- Explanation
- Context
- Education
- Comparison
- Fact checking
- Storytelling
- News explanation

---

# 5. Content Formats

## 5.1 Commentary

Example:

```text
"Here's what this actually means."
```

Structure:

```text
Hook
↓
Context
↓
Source clip
↓
Commentary
↓
Supporting visual
↓
Conclusion
```

---

## 5.2 Explainer

Example:

```text
"Why this matters"
```

Structure:

```text
Hook
↓
Problem
↓
Source statement
↓
Explanation
↓
Visual
↓
Conclusion
```

---

## 5.3 What You Missed

Example:

```text
"3 things you probably missed"
```

Structure:

```text
Hook
↓
Point 1
↓
Point 2
↓
Point 3
↓
Conclusion
```

---

## 5.4 Analysis

Example:

```text
"Who actually has the stronger argument?"
```

Structure:

```text
Context
↓
Argument A
↓
Argument B
↓
Evidence
↓
Analysis
↓
Conclusion
```

---

## 5.5 Educational

Example:

```text
"AI Agents explained in 60 seconds"
```

Structure:

```text
Hook
↓
Definition
↓
Example
↓
Visual explanation
↓
Takeaway
```

---

# 6. Initial Target Niche

Recommended initial niche:

```text
AI + Technology
```

Reason:

- High content velocity
- Frequent podcasts/interviews
- Frequent announcements
- Strong educational potential
- Easy to create commentary/explainer formats
- Suitable for developer-oriented content

Other niches can be added later.

---

# 7. End-to-End Architecture

```text
                         SOURCE
                           │
                           ▼
                  ┌─────────────────┐
                  │ Source Validator│
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Source Ingestion│
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Audio Extraction│
                  │     FFmpeg      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Transcriber   │
                  │    WhisperX     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Transcript    │
                  │    Processor    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Topic / Scene  │
                  │   Segmentation  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Viral Candidate │
                  │     Scoring     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Content Angle   │
                  │    Generator    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Script Engine  │
                  └────────┬────────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
               TTS       B-Roll     Graphics
                │          │          │
                └──────────┼──────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Video Planner  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Remotion     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Quality Checker │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Rights Gate   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Human Review   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Publish      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Analytics    │
                  └─────────────────┘
```

---

# 8. Filesystem-Based Storage

Initial storage:

```text
data/
├── jobs/
│   └── <job-id>/
│       ├── job.json
│       ├── input/
│       │   ├── metadata.json
│       │   └── source.mp4
│       │
│       ├── audio/
│       │   └── source.wav
│       │
│       ├── transcript/
│       │   ├── transcript.json
│       │   └── transcript.txt
│       │
│       ├── analysis/
│       │   ├── segments.json
│       │   ├── candidates.json
│       │   └── angles.json
│       │
│       ├── script/
│       │   └── script.json
│       │
│       ├── voice/
│       │   └── narration.wav
│       │
│       ├── assets/
│       │   ├── images/
│       │   ├── broll/
│       │   └── music/
│       │
│       ├── render/
│       │   ├── preview.mp4
│       │   └── final.mp4
│       │
│       └── logs/
│
└── temp/
```

---

# 9. Job Model

Each pipeline execution memiliki `jobId`.

Example:

```text
job_20260812_001
```

Job state:

```json
{
  "id": "job_20260812_001",
  "status": "analyzing",
  "progress": 60,
  "createdAt": "2026-08-12T10:00:00Z",
  "updatedAt": "2026-08-12T10:05:00Z"
}
```

---

# 10. Job Status

```text
CREATED
↓
VALIDATING_SOURCE
↓
INGESTING
↓
EXTRACTING_AUDIO
↓
TRANSCRIBING
↓
ANALYZING
↓
SCORING
↓
GENERATING_ANGLES
↓
GENERATING_SCRIPT
↓
GENERATING_VOICE
↓
PREPARING_VIDEO
↓
RENDERING
↓
QUALITY_CHECK
↓
RIGHTS_CHECK
↓
WAITING_REVIEW
↓
APPROVED
↓
PUBLISHED
```

Failure:

```text
FAILED
```

---

# 11. API Design

## Create Job

```http
POST /api/jobs
```

Request:

```json
{
  "youtubeUrl": "https://youtube.com/watch?v=..."
}
```

Response:

```json
{
  "jobId": "job_20260812_001",
  "status": "CREATED"
}
```

---

## Get Job

```http
GET /api/jobs/:jobId
```

Response:

```json
{
  "jobId": "job_20260812_001",
  "status": "ANALYZING",
  "progress": 60
}
```

---

## Get Transcript

```http
GET /api/jobs/:jobId/transcript
```

---

## Get Candidates

```http
GET /api/jobs/:jobId/candidates
```

---

## Get Content Angles

```http
GET /api/jobs/:jobId/angles
```

---

## Generate Script

```http
POST /api/jobs/:jobId/script
```

---

## Generate Video

```http
POST /api/jobs/:jobId/render
```

Request:

```json
{
  "candidateId": "candidate_01",
  "template": "commentary"
}
```

---

## Get Result

```http
GET /api/jobs/:jobId/result
```

---

# 12. Source Ingestion

Input:

```text
YouTube URL
```

Source processing:

```text
URL
 ↓
Validate URL
 ↓
Read metadata
 ↓
Validate rights status
 ↓
Prepare source
```

Metadata:

```json
{
  "title": "...",
  "channel": "...",
  "duration": 3600,
  "url": "...",
  "rightsStatus": "UNKNOWN"
}
```

Unknown rights must not automatically become publishable content.

---

# 13. Source Rights Model

Supported states:

```text
UNKNOWN
PENDING_VERIFICATION
AUTHORIZED
LICENSED
CREATIVE_COMMONS
PUBLIC_DOMAIN
REJECTED
EXPIRED
```

Publish gate:

```text
AUTHORIZED
LICENSED
CREATIVE_COMMONS
PUBLIC_DOMAIN
```

Only when usage rights are actually appropriate for the intended use.

The system should not attempt to bypass copyright or reused-content enforcement.

---

# 14. Audio Extraction

Use FFmpeg.

```text
source.mp4
     ↓
FFmpeg
     ↓
audio.wav
```

Recommended intermediate format:

```text
WAV
Mono
16 kHz
```

The exact settings can be adjusted according to WhisperX requirements.

---

# 15. WhisperX Integration

WhisperX responsibilities:

- Speech-to-text
- Segment timestamps
- Word timestamps
- Speaker diarization when required
- Alignment

Output:

```json
{
  "language": "en",
  "segments": [
    {
      "start": 12.4,
      "end": 18.7,
      "speaker": "SPEAKER_01",
      "text": "..."
    }
  ]
}
```

---

# 16. Transcript Processing

Raw transcript:

```text
Speaker 1:
...

Speaker 2:
...
```

Transform menjadi semantic units:

```text
INTRO
QUESTION
ANSWER
STORY
ARGUMENT
EXAMPLE
FACT
OPINION
CONCLUSION
```

---

# 17. Topic Segmentation

Transcript dibagi berdasarkan topic.

Example:

```text
00:00–03:20 Introduction

03:20–08:45 AI Agents

08:45–14:10 Software Development

14:10–20:30 Future of Developers
```

Output:

```json
{
  "topic": "Future of Developers",
  "start": 850,
  "end": 1230
}
```

---

# 18. Candidate Generation

AI mencari candidate moments berdasarkan:

- Strong statement
- Unexpected statement
- Useful insight
- Emotional moment
- Controversial opinion
- Story
- Clear explanation
- Interesting question/answer
- Novel information

Output:

```text
Top 10 candidate moments
```

---

# 19. Viral Scoring

Initial score:

```text
viralScore =
    hookStrength        × 0.20
  + curiosity           × 0.15
  + informationDensity × 0.15
  + novelty             × 0.10
  + emotionalIntensity  × 0.10
  + trendRelevance     × 0.15
  + standaloneContext  × 0.10
  + shareability        × 0.05
```

Each metric:

```text
0–100
```

Example:

```json
{
  "hookStrength": 91,
  "curiosity": 88,
  "informationDensity": 94,
  "novelty": 87,
  "emotionalIntensity": 72,
  "trendRelevance": 95,
  "standaloneContext": 89,
  "shareability": 91,
  "viralScore": 89
}
```

---

# 20. Candidate Validation

A candidate must pass:

```text
Minimum duration
Maximum duration
Standalone context
Clear beginning
Clear ending
Topic relevance
Transcript quality
```

Reject if:

```text
Starts mid-sentence
Requires >30 seconds of missing context
Transcript is unclear
Audio quality is unusable
Statement is misleading without context
```

---

# 21. Content Angle Generation

This is a critical stage.

One source moment should generate multiple possible angles.

Example:

```text
Source:
"AI agents will change how developers work."
```

Possible angles:

```text
1. Why AI won't simply replace developers

2. The new role of software engineers

3. What developers should learn next

4. Why coding may become less important

5. What AI agents actually change
```

Select the strongest angle.

---

# 22. Script Generation

Script structure:

```text
HOOK
↓
CONTEXT
↓
SOURCE
↓
COMMENTARY
↓
ANALYSIS
↓
SUPPORTING INFORMATION
↓
CONCLUSION
```

Example:

```text
HOOK:
"AI may not replace developers — but it could change
what developers actually do."

CONTEXT:
"During the discussion, ..."

SOURCE:
[Selected source moment]

COMMENTARY:
"The interesting part is..."

ANALYSIS:
"This means..."

CONCLUSION:
"The developer role may shift from..."
```

---

# 23. Originality Rules

Script must not:

- Simply repeat transcript
- Copy source narration
- Create fake quotations
- Remove important context
- Misrepresent the speaker
- Invent facts
- Present speculation as fact

Script should add:

- Context
- Explanation
- Interpretation
- Supporting information
- Narrative structure

---

# 24. TTS

Pipeline:

```text
Script
 ↓
TTS
 ↓
Narration
 ↓
Audio normalization
```

Voice should sound:

```text
Natural
Conversational
Informative
Not overly robotic
```

Voice provider should be abstracted behind an interface.

```text
TTSProvider
├── OpenAI
├── ElevenLabs
├── Google
└── Local
```

---

# 25. Video Plan

LLM generates a structured video plan.

Example:

```json
{
  "duration": 60,
  "scenes": [
    {
      "type": "hook",
      "duration": 4
    },
    {
      "type": "source",
      "start": 120.4,
      "end": 127.2
    },
    {
      "type": "commentary",
      "duration": 12
    },
    {
      "type": "source",
      "start": 135.2,
      "end": 141.8
    },
    {
      "type": "analysis",
      "duration": 20
    },
    {
      "type": "conclusion",
      "duration": 6
    }
  ]
}
```

---

# 26. Video Composition

Target:

```text
1080 × 1920
9:16
30–60 seconds
```

Main layers:

```text
Background
Source Video
B-Roll
Images
Graphics
Captions
Speaker Labels
Narration
Music
SFX
Branding
```

---

# 27. Remotion

Remotion becomes the primary composition engine.

Responsibilities:

- Timeline
- Scene composition
- Captions
- Text animation
- Source clips
- B-roll
- Graphics
- Transitions
- Audio synchronization
- Branding

---

# 28. Template Architecture

Initial templates:

```text
templates/
├── commentary/
├── explainer/
├── educational/
└── what-you-missed/
```

Only implement one template first:

```text
commentary
```

---

# 29. First Template

```text
0–3s
HOOK

3–10s
SOURCE

10–25s
COMMENTARY

25–35s
SOURCE

35–52s
ANALYSIS

52–60s
CONCLUSION
```

---

# 30. Caption Engine

WhisperX word timestamps should be used for captions.

Features:

- Word-level highlighting
- Sentence grouping
- Keyword emphasis
- Speaker identification
- Dynamic positioning
- Safe area

Caption output must remain readable on mobile.

---

# 31. Visual Enrichment

Source footage should not be the only visual element.

Use:

```text
Source clip
+
Animated captions
+
B-roll
+
Screenshots
+
Charts
+
Diagrams
+
Context cards
+
Motion graphics
```

Visual selection should follow the script.

---

# 32. B-Roll System

B-roll sources can be:

- Owned assets
- Licensed stock
- Public-domain assets
- Generated graphics
- Generated images
- Screenshots that are appropriate to use

B-roll metadata:

```json
{
  "type": "image",
  "path": "...",
  "duration": 3.2,
  "source": "...",
  "rightsStatus": "..."
}
```

---

# 33. Music & Sound

Optional in MVP.

Later support:

```text
Background music
Sound effects
Transitions
Audio ducking
```

Narration must remain dominant.

---

# 34. Quality Checker

Before approval:

```text
Video resolution
Aspect ratio
Duration
Audio presence
Audio clipping
Silent sections
Black frames
Caption coverage
Caption overflow
Scene overlap
Missing assets
Rendering errors
```

Output:

```json
{
  "status": "PASS",
  "checks": {
    "resolution": "PASS",
    "audio": "PASS",
    "captions": "PASS",
    "blackFrames": "PASS"
  }
}
```

---

# 35. Content Quality Checker

AI quality checks:

```text
Hook clarity
Narrative flow
Context completeness
Factual consistency
Source attribution
Original contribution
Repetition
Misleading statements
```

Output:

```text
PASS
WARNING
FAIL
```

---

# 36. Rights Gate

Before publish:

```text
Source rights
+
B-roll rights
+
Music rights
+
Image rights
+
Voice rights
```

Every asset should have a rights status.

Example:

```json
{
  "asset": "source.mp4",
  "rightsStatus": "AUTHORIZED"
}
```

Publishing should be blocked when required rights are unresolved.

---

# 37. Human Review

MVP review process:

```text
Generated
   ↓
Preview
   ↓
Human Review
   ├── Approve
   ├── Reject
   └── Regenerate
```

Reviewer should see:

```text
Source
Transcript
Selected clip
Script
Final video
Rights information
AI scores
```

---

# 38. Output Variants

One candidate can generate:

```text
Variant A
Strong curiosity hook

Variant B
Educational hook

Variant C
Controversial question
```

Initially generate only one.

A/B testing comes later.

---

# 39. Publishing

MVP:

```text
Render
 ↓
Save MP4
 ↓
Human downloads/uploads manually
```

Later:

```text
Approved
 ↓
Platform Adapter
 ├── YouTube
 ├── TikTok
 ├── Instagram
 └── Facebook
```

Publishing adapters should be isolated from the core pipeline.

---

# 40. Analytics

Phase berikutnya.

Collect:

```text
Views
Likes
Comments
Shares
Saves
Watch time
Average view duration
Retention
Completion rate
Follower conversion
```

---

# 41. Feedback Loop

Eventually:

```text
Viral Prediction
       ↓
Published Video
       ↓
Real Performance
       ↓
Compare Prediction
       ↓
Update Scoring
```

Example:

```text
Predicted Score: 91
Actual Performance: Poor

Possible cause:
Weak first 3 seconds
```

The system can eventually learn which factors actually correlate with performance.

---

# 42. API Layer

Use current Nitro/H3 architecture.

Recommended modules:

```text
src/
├── routes/
│   └── api/
│       └── jobs/
│
├── modules/
│   ├── source/
│   ├── transcription/
│   ├── analysis/
│   ├── scoring/
│   ├── content/
│   ├── script/
│   ├── voice/
│   ├── video/
│   ├── quality/
│   └── rights/
│
├── services/
│   ├── ffmpeg/
│   ├── whisper/
│   ├── llm/
│   ├── tts/
│   └── storage/
│
├── schemas/
│   ├── job.ts
│   ├── source.ts
│   ├── transcript.ts
│   ├── candidate.ts
│   ├── script.ts
│   └── video.ts
│
├── utils/
│
└── config/
```

---

# 43. Service Interfaces

External AI services should be abstracted.

## LLM

```text
LLMProvider
├── generate()
├── generateStructured()
└── analyze()
```

## Transcription

```text
TranscriptionProvider
└── transcribe()
```

## TTS

```text
TTSProvider
└── synthesize()
```

This prevents the core application from being coupled to a single AI provider.

---

# 44. Zod Schemas

Use existing Zod dependency for every external input.

Examples:

```text
CreateJobSchema
SourceSchema
TranscriptSchema
CandidateSchema
ScriptSchema
VideoPlanSchema
RenderRequestSchema
```

Every LLM structured output must also be validated.

---

# 45. Logging

Use existing Pino.

Log:

```text
jobId
stage
duration
status
error
provider
model
```

Example:

```text
job=abc
stage=transcription
status=completed
duration=12400ms
```

Do not log:

- API keys
- Private URLs
- Sensitive credentials
- Full user secrets

---

# 46. Error Handling

Each pipeline stage must return structured errors.

Example:

```json
{
  "code": "TRANSCRIPTION_FAILED",
  "stage": "transcription",
  "message": "WhisperX process failed"
}
```

Error categories:

```text
SOURCE_INVALID
SOURCE_UNAVAILABLE
RIGHTS_UNKNOWN
DOWNLOAD_FAILED
AUDIO_EXTRACTION_FAILED
TRANSCRIPTION_FAILED
ANALYSIS_FAILED
SCORING_FAILED
SCRIPT_FAILED
TTS_FAILED
RENDER_FAILED
QUALITY_FAILED
RIGHTS_FAILED
```

---

# 47. Retry Strategy

MVP:

```text
Retry manually
```

Later:

```text
Automatic retry
```

Only retry transient failures.

Do not retry:

```text
Invalid URL
Invalid rights
Invalid input
Invalid script schema
```

---

# 48. Configuration

Use `.env`.

Example:

```text
NODE_ENV=

LLM_PROVIDER=
LLM_MODEL=
LLM_API_KEY=

WHISPER_PROVIDER=
WHISPER_BINARY_PATH=
WHISPER_MODEL=
WHISPER_LANGUAGE=

TTS_PROVIDER=
TTS_API_KEY=

FFMPEG_PATH=

DATA_DIR=
```

Never commit secrets.

---

# 49. WhisperX Configuration

Initial target:

```text
WHISPER_PROVIDER=faster-whisper
WHISPER_MODEL=base
WHISPER_LANGUAGE=auto
```

The exact binary/command integration should be implemented through a dedicated `WhisperService`.

Model progression:

```text
base
 ↓
small
 ↓
medium
 ↓
large-v3
```

Only upgrade when quality requirements justify the additional processing cost.

---

# 50. Development Phases

# Phase 0 — Foundation

Current:

```text
Node 22
TypeScript
Nitro
H3
Zod
Pino
```

Tasks:

- Establish source structure
- Environment configuration
- Logger
- Error handling
- Zod validation
- Filesystem storage abstraction

---

# Phase 1 — Source Pipeline

Tasks:

- Create job
- Validate URL
- Source metadata
- Source rights status
- Source storage
- Job status

Output:

```text
job
+
source
```

---

# Phase 2 — Audio & WhisperX

Tasks:

- FFmpeg integration
- Audio extraction
- WhisperX integration
- Transcript JSON
- Word timestamps
- Optional speaker diarization

Output:

```text
source
→ transcript.json
```

---

# Phase 3 — AI Analysis

Tasks:

- Transcript normalization
- Topic segmentation
- Semantic segmentation
- Candidate detection
- Candidate validation

Output:

```text
10–20 candidate moments
```

---

# Phase 4 — Viral Scoring

Tasks:

- Hook score
- Curiosity score
- Information score
- Novelty score
- Trend relevance
- Standalone context
- Shareability
- Final score

Output:

```text
Top 5 candidates
```

---

# Phase 5 — Content Transformation

Tasks:

- Generate content angles
- Select best angle
- Generate hook
- Generate commentary
- Generate context
- Generate conclusion

Output:

```text
Original short-form script
```

---

# Phase 6 — Video Planning

Tasks:

- Scene planning
- Source clip selection
- Narration timing
- B-roll placement
- Caption placement
- Graphic placement

Output:

```text
video-plan.json
```

---

# Phase 7 — Voice

Tasks:

- TTS provider
- Generate narration
- Normalize audio
- Calculate duration
- Sync script with timeline

Output:

```text
narration.wav
```

---

# Phase 8 — Remotion

Tasks:

- Setup Remotion
- First template
- 9:16 composition
- Source video
- Narration
- Captions
- Motion graphics
- Branding
- Render MP4

Output:

```text
final.mp4
```

---

# Phase 9 — Quality & Rights

Tasks:

- Technical checks
- Content checks
- Rights checks
- Human review

Output:

```text
APPROVED
```

or:

```text
REJECTED
```

---

# Phase 10 — Publishing

MVP:

```text
Manual publishing
```

Later:

```text
YouTube
TikTok
Instagram
Facebook
```

---

# Phase 11 — Analytics

Tasks:

- Collect metrics
- Compare predictions
- Measure retention
- Measure engagement
- Track content formats
- Track templates
- Track topics

---

# Phase 12 — Optimization

Use analytics to improve:

```text
Hook
Duration
Topic
Template
Narration
Visual style
Source selection
Viral scoring
```

---

# 51. MVP Definition

MVP dianggap selesai ketika sistem dapat:

```text
YouTube URL
      ↓
Source
      ↓
WhisperX
      ↓
Transcript
      ↓
AI Analysis
      ↓
Top 5 Viral Candidates
      ↓
Content Angle
      ↓
Original Script
      ↓
TTS
      ↓
Video Plan
      ↓
Remotion
      ↓
Final MP4
      ↓
Quality Check
      ↓
Human Review
```

---

# 52. MVP Output

Input:

```text
1 source video
```

Output:

```text
Top 5 candidates

Candidate #1
Score: 94

Candidate #2
Score: 91

Candidate #3
Score: 88

Candidate #4
Score: 84

Candidate #5
Score: 81
```

Untuk satu candidate:

```text
1 original script
1 narration
1 video plan
1 final video
```

---

# 53. First Production Template

Gunakan satu template terlebih dahulu:

```text
COMMENTARY
```

Timeline:

```text
0–3s
HOOK

3–10s
SOURCE

10–25s
COMMENTARY

25–35s
SOURCE

35–52s
ANALYSIS

52–60s
CONCLUSION
```

Jangan membuat banyak template sebelum template pertama terbukti efektif.

---

# 54. Definition of Done

## Source

- [ ] URL validation
- [ ] Metadata extraction
- [ ] Rights status
- [ ] Source storage

## Transcription

- [ ] FFmpeg
- [ ] WhisperX
- [ ] Timestamp
- [ ] Word alignment
- [ ] JSON output

## Analysis

- [ ] Topic segmentation
- [ ] Candidate extraction
- [ ] Candidate validation
- [ ] Viral scoring

## Content

- [ ] Content angle
- [ ] Hook
- [ ] Commentary
- [ ] Context
- [ ] Conclusion
- [ ] Script validation

## Video

- [ ] Video plan
- [ ] TTS
- [ ] Remotion
- [ ] Captions
- [ ] Source clips
- [ ] Graphics
- [ ] 9:16 output

## Quality

- [ ] Technical check
- [ ] Content check
- [ ] Rights check
- [ ] Human review

---

# 55. Initial Success Metrics

Technical:

```text
Pipeline success rate > 90%
Transcription success > 95%
Render success > 95%
```

Content:

```text
Candidate relevance
Script quality
Context completeness
Original contribution
```

Operational:

```text
Generation time/video
CPU/GPU usage
LLM cost/video
Storage/video
```

---

# 56. Future Database Migration

Database tidak dibutuhkan pada V1.

Ketika kebutuhan meningkat:

```text
Filesystem
    ↓
Repository abstraction
    ↓
PostgreSQL
```

Karena storage access harus diabstraksikan sejak awal:

```text
JobRepository
SourceRepository
TranscriptRepository
CandidateRepository
ScriptRepository
RenderRepository
```

V1 implementation:

```text
FileSystemRepository
```

Future:

```text
PostgresRepository
```

Core business logic tidak perlu berubah.

---

# 57. Future Queue Migration

V1:

```text
HTTP Request
 ↓
Pipeline
```

Future:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Pipeline
```

Potential future:

```text
BullMQ
Redis
```

Tetapi jangan memasukkannya ke MVP sebelum pipeline membutuhkan asynchronous processing.

---

# 58. Future Storage Migration

V1:

```text
local filesystem
```

Future:

```text
S3 / R2 / MinIO
```

Gunakan abstraction:

```text
StorageProvider
├── LocalStorage
└── ObjectStorage
```

---

# 59. Recommended Build Order

Urutan implementasi yang harus diikuti:

```text
1. Project foundation
       ↓
2. Job management
       ↓
3. Filesystem storage
       ↓
4. Source ingestion
       ↓
5. FFmpeg
       ↓
6. WhisperX
       ↓
7. Transcript processing
       ↓
8. AI segmentation
       ↓
9. Viral scoring
       ↓
10. Content angle
       ↓
11. Script generation
       ↓
12. TTS
       ↓
13. Video plan
       ↓
14. Remotion
       ↓
15. Quality checker
       ↓
16. Rights gate
       ↓
17. Human review
       ↓
18. Publishing
       ↓
19. Analytics
       ↓
20. Optimization
```

---

# 60. Critical Product Rule

Project ini tidak boleh dioptimalkan untuk:

```text
"Bagaimana menghindari banned?"
```

Tetapi:

```text
"Bagaimana membuat konten yang secara substantif
berbeda dan memberikan nilai baru?"
```

Core formula:

```text
SOURCE
+
CONTEXT
+
ORIGINAL NARRATION
+
ANALYSIS
+
VISUAL STORYTELLING
+
EDITORIAL VALUE
=
TRANSFORMED CONTENT
```

---

# 61. Final Target

Long-term architecture:

```text
                  ┌────────────────────┐
                  │   SOURCE DISCOVERY │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   RIGHTS SYSTEM    │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   TRANSCRIPTION    │
                  │     WhisperX       │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   AI UNDERSTANDING │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   VIRAL SCORING    │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │ CONTENT STRATEGY   │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │  ORIGINAL SCRIPT   │
                  └─────────┬──────────┘
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
                TTS       B-ROLL    GRAPHICS
                 │          │          │
                 └──────────┼──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │      REMOTION      │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   QUALITY GATE     │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   RIGHTS GATE      │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   HUMAN REVIEW     │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │     PUBLISH        │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │     ANALYTICS      │
                  └─────────┬──────────┘
                            │
                            └──────► FEEDBACK LOOP
```

---

# 62. Immediate Next Step

Jangan langsung mengimplementasikan seluruh architecture.

Milestone pertama:

```text
YouTube URL
    ↓
WhisperX
    ↓
Transcript JSON
    ↓
LLM
    ↓
Semantic Segmentation
    ↓
Viral Scoring
    ↓
Top 5 Candidates
```

Milestone kedua:

```text
Top Candidate
    ↓
Content Angle
    ↓
Original Script
    ↓
Video Plan JSON
```

Milestone ketiga:

```text
Video Plan
    ↓
TTS
    ↓
Remotion
    ↓
9:16 MP4
```

Setelah tiga milestone tersebut stabil, baru tambahkan **B-roll, multiple templates, human review UI, publishing API, analytics, database, queue, dan cloud storage**.