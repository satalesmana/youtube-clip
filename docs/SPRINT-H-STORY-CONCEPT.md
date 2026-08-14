# Sprint H: Auto-Concept Detection from Source Video

## Overview
Auto-detect story concept from YouTube transcript, generate timestamped story beats, and integrate with script/video plan pipeline.

## Architecture

```
Source YouTube
    ↓
Transcript + Timestamps (Whisper)
    ↓
StoryService.buildStory()
    ├─ Detect concept: turning-point / comeback / character-journey / claim-consequence / discovery-explainer
    ├─ Generate 4-7 beats with source timestamps
    ├─ Extract verbatim evidence per beat
    └─ Fill narrative metadata (kondisiAwal, konflik, titikBalik, hasil)
    ↓
ScriptService.generateScript()
    ├─ Map story beats to script sections
    └─ Generate original narration with beat references
    ↓
VideoPlanService.buildPlan()
    └─ Use beat timestamps for source clip ranges
    ↓
TTS + Render
```

## Key Components

### 1. Story Types (`src/types/story.ts`)
- `StoryConcept`: 5 auto-detected concepts
- `StoryBeatRole`: Narrative role (setup, tension, turningPoint, resolution, reflection, conclusion)
- `SourceStory`: Concept + protagonist + premise + beats

### 2. Story Service (`src/content/story.service.ts`)
- LLM-powered concept detection from transcript
- Validates beats are chronological with valid evidence
- Pre-processes LLM output: truncate evidence to 2 items, sort beats chronologically

### 3. Schema (`src/schemas/story.schema.ts`)
- Zod validation for story response
- Required fields: concept, protagonist, premise, beats
- Beat requirements: role, purpose, timestamps, evidence

### 4. Integration Points
- Transform controller calls `storyService.buildStory()` before script generation
- Script prompt receives story beats for beat-mapped script sections
- Video plan uses beat source timestamps for visual clipping

## Concept Detection Map

| Signal in Source | Concept |
|------------------|---------|
| One person/factor faces problem, struggles, achieves result | `character-journey` |
| Started behind/failing → overcame adversity → finished better | `comeback` |
| Strong statement/confession changes perspective | `turning-point` |
| Two parties in conflict: claim → response → consequence | `claim-consequence` |
| Unusual fact/explanation counters common understanding | `discovery-explainer` |

## Beat Structure

Each beat has:
- `role`: Narrative function (setup, tension, turningPoint, resolution, reflection, conclusion)
- `purpose`: What this beat achieves in the story arc
- `start`, `end`: Source video timestamps (seconds)
- `evidence`: Verbatim transcript excerpts
- Optional narrative metadata:
  - `kondisiAwal`: Initial state
  - `konflik`: Conflict or obstacle
  - `titikBalik`: Turning point moment
  - `hasil`: Outcome or result

## Mapping to Script Sections

| StoryBeatRole | ScriptSectionType |
|---------------|-------------------|
| setup | context |
| tension | source |
| turningPoint | source |
| resolution | commentary |
| reflection | analysis |
| conclusion | conclusion |

## API Response

Transform response now includes optional `story` field:
```json
{
  "success": true,
  "jobId": "...",
  "story": {
    "concept": "turning-point",
    "protagonist": "Manchester United",
    "premise": "One-sentence story summary...",
    "beats": [
      {
        "id": "beat_1",
        "role": "setup",
        "purpose": "establish the rival match",
        "start": 2.21,
        "end": 10.69,
        "evidence": ["..."],
        "kondisiAwal": "..."
      }
    ]
  },
  ...
}
```

## Testing

Run story service test:
```bash
npx tsx scripts/test-story.service.mjs
```

Run integration test:
```bash
npx tsx scripts/test-story-integration.mjs
```

## Files Added
- `src/types/story.ts`
- `src/schemas/story.schema.ts`
- `src/content/story.service.ts`
- `scripts/test-story.service.mjs`
- `scripts/test-story-integration.mjs`

## Files Modified
- `src/container/index.ts` - Export storyService
- `src/controllers/transform.controller.ts` - Call storyService, include story in response
- `src/content/script.service.ts` - Map beat roles to section types
- `src/content/video-plan.service.ts` - Use beat roles for lookup
- `src/content/content.prompt.ts` - Display beat roles in prompt
- `src/schemas/transform.schema.ts` - Add story to response schema

## Pitfalls

1. **Evidence array overflow**: LLM may return >2 evidence items. Truncate to max 2 before schema validation.
2. **Out-of-order beats**: LLM may return beats in wrong chronological order. Sort by start time before validation.
3. **Beat role vs section type**: Story beats use narrative roles, script sections use editorial types. Use mapping function.
4. **Fallback handling**: If story service fails, fall back to compatibility script mode without story beats.
