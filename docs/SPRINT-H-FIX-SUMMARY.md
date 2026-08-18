# Sprint H: Auto-Concept Detection from Source Video - Fix Summary

## Issues Fixed

### 1. StoryBeat.type → StoryBeat.role
**Problem**: StoryBeat used `ScriptSectionType` which caused validation failures when LLM returned narrative roles like "setup", "tension" etc.
**Fix**: 
- Created separate `StoryBeatRole` enum (setup, tension, turningPoint, resolution, reflection, conclusion)
- Added `mapBeatRoleToSectionType()` function for mapping
- Updated `attachStorySources()` to use role-based mapping instead of direct type comparison

### 2. SourceQuote Strict Validation
**Problem**: Script generation failed when `source.text` didn't contain `sourceQuote` verbatim (minor formatting differences).
**Fix**: Changed from hard error to warning log.

### 3. Hook/Context Sections Missing beatId
**Problem**: Script sections like "hook" and "context" don't always have beatId references, causing validation failures.
**Fix**: Skip hook section and sections without beatId in `attachStorySources()`.

### 4. Short Transcript Analysis
**Problem**: Story service failed with only moment segments (9-11 segments) - not enough context for beat generation.
**Fix**: Pass both context and moment segments to story service for better analysis.

## Changes Made

| File | Changes |
|------|---------|
| `src/types/story.ts` | Added `StoryBeatRole` enum + `mapBeatRoleToSectionType()` |
| `src/schemas/story.schema.ts` | Updated to use `role` instead of `type` |
| `src/content/story.service.ts` | Added evidence truncation + chronological sorting |
| `src/content/script.service.ts` | Relaxed SourceQuote validation, skip hook/missing beatId |
| `src/content/video-plan.service.ts` | Use beat role for lookup |
| `src/controllers/transform.controller.ts` | Pass context+moment segments to story service, include story in response |
| `src/schemas/transform.schema.ts` | Add story to API response schema |

## Testing Results

```bash
# Story Service Test (full transcript)
✓ Concept: turning-point
✓ Beats: 6 (chronological, with evidence)
✓ All assertions passed

# Integration Test (moment + context)
✓ Story detected: character-journey / comeback / turning-point
✓ Script generated: 7 sections with beat references
✓ Video plan: scenes mapped to story beat timestamps
✓ Pipeline: angle → story → script → TTS → video plan
```

## API Response

Transform response now includes optional `story` field:
```json
{
  "success": true,
  "story": {
    "concept": "turning-point",
    "protagonist": "Zerksy",
    "premise": "A United player scores a crucial goal...",
    "beats": [
      {
        "id": "beat_1",
        "role": "setup",
        "purpose": "establish the rivalry",
        "start": 2.21,
        "end": 10.69,
        "evidence": ["..."]
      }
    ]
  },
  "script": {
    "sections": [
      { "type": "hook", "text": "..." },
      { "type": "source", "beatId": "beat_2", "source": { "start": 14.44, "end": 25.02 } }
    ]
  }
}
```

## Files Created
- `src/types/story.ts`
- `src/schemas/story.schema.ts`
- `src/content/story.service.ts`
- `scripts/test-story.service.mjs`
- `scripts/test-story-integration.mjs`
- `docs/SPRINT-H-STORY-CONCEPT.md`

## Verification
- ✅ Typecheck: PASS
- ✅ Story service test: PASS (with full transcript)
- ✅ Integration test: PASS (with moment + context segments)
- ✅ Graceful fallback: Pipeline continues even if story fails
