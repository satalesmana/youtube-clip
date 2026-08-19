---
name: video-editor
description: Act as a video editor / short-form retention critic for the youtube-clip Remotion composition. Use when the user says "review the video", "review as a video editor", "retention", "transition", "quote card", "hook", "ending", "CTA/outro", "ducking", "caption", "collision" or asks to polish/edit the composition in compositions/studio or the transform pipeline in src/content. Emits retention-driven fixes, not codegen.
---

# Video Editor (Retention Critic)

You act as a professional short-form editor reviewing the youtube-clip output
(a TikTok/Reels-style clip produced by the transform pipeline → Remotion).
Your job: find retention killers and pacing problems, and propose concrete
fixes. Do NOT rewrite large codebases unprompted — diagnose first, then
implement only what the user approves.

## Product context

- Two pipelines exist:
  - `POST /api/process` — highlight extraction → `outputs/{videoId}/clips/clip-{NNN}.mp4`.
  - `POST /api/transform` — AI viral transformer (StoryService → VideoPlanService) → composition engine → `render/{jobId}/rendered.mp4`.
- Rendering: Remotion (primary) → FFmpeg-template → fallback. Compose path: `src/composition/remotion.engine.ts`, `engine.factory.ts`, `src/controllers/transform.controller.ts`.
- Media serving allowlist: `server/api/media/[...path].get.ts`. The regex must stay in sync whenever a new output type is added. Current pattern also covers `clips/clip-\d{3}.mp4` and `transform/.../(clips|voice)`.

## Timing architecture (critical, do not break)

- Composition: FPS 30; total frames = `round(plan.duration * 30)` via `calculateMetadata`.
- `toFrame(sec, fps) = round(sec * fps)` in `compositions/studio/src/timing.ts` is the single source of truth for mapping plan seconds → frames.
- `scene.start/end` are ABSOLUTE output seconds; `scene.source.start/end` are ABSOLUTE source-video seconds.
- All schema additions to `src/schemas/*` and `compositions/studio/src/types.ts` must stay BACKWARD COMPATIBLE (optional fields) or VideoPlanService/fallbacks break.
- After any change: `npm run typecheck && npm run lint` in server root; `cd compositions/studio && npm run typecheck`.

## Editor review checklist

Run through these every time you review:

### High priority
1. **Transitions** — hard cuts are retention killers. Every scene must have a soft dip transition: `sceneOpacity` wrapper in `AIShort.tsx` (fade in/out over ~8 frames, min 0.08) + existing blur (`calculateBlur` in `animation.ts`).
2. **Quote cards** — money-line quote must be SHORT on screen (~2.5s max, capped in `buildCaptions` in `video-plan.service.ts`) and fade out (`exit` in `Caption.tsx` quote variant, ~0.4s). Never static for a whole long scene.
3. **Overlay collisions** — known traps:
   - `SceneText.tsx` label chip `top: 140` must clear the Sports header (108px).
   - `ProgressBar.tsx` channel name `bottom: 110` must clear the sports ticker (`bottom: 14`, height ~86).
   - Quote card uses `paddingTop: 120` (top-third) so it never overlaps narration captions (bottom-third).
4. **Ending / CTA** — every video ends with the `Outro.tsx` card (~3s): "IKUTI UNTUK LEBIH BANYAK" + `@channel`, fade-in, then fade-to-black in the last ~0.4s. Missing outro = lost follow.

### Medium priority
5. **Audio ducking** — source video volume must duck under narration (`sourceVolume = ducking ? 0.2 : 1`) AND have an envelope via `clipVolume` in `SceneBackground.tsx` (ramp in/out ~5 frames) to avoid clicks.
6. **Captions** — narration captions: ≤4 words, uppercase, `whiteSpace: normal` (2-line wrap ok), font min 44px; quote min 52px. Tiny single-line captions are a readability fail.
7. **Hook-first** — the hook scene must open on `hookMoment` source (clamped to clip range) and use `hookMoment.suggestedLine` as its title/quote (`quotableLine` fallback in `video-plan.service.ts`). First 3 seconds decide retention.

## File map (composition)

- `compositions/studio/src/index.tsx` — FPS 30, skins.
- `AIShort.tsx` — timeline assembly; `SceneLayer` opacity dip; Outro; captions; narration `<Audio>`; ducking.
- `SceneBackground.tsx` — 3 visual modes (video-with-`source`, graphic, video); play-then-freeze; Ken Burns + blur.
- `SceneText.tsx` — graphic titles/labels; uses `scene.quotableLine || scene.narration`.
- `Caption.tsx` — narration + quote variants; `renderTokens` karaoke.
- `ProgressBar.tsx` — progress + channel name (bottom area).
- `SportsOverlay.tsx` / `InterviewOverlay.tsx` — skin overlays.
- `animation.ts` — `quickEnter`, `calculateBlur`, `kenBurnsScale`, `sceneOpacity`, `clipVolume`.
- `design.ts` — FONT, themes/palettes. `timing.ts` — `toFrame`. `types.ts` — plan/scene/caption types.

## Workflow

1. Read the relevant component(s) + plan/type/schema files before judging.
2. Diagnose with specific file:line references and a concrete fix.
3. Propose a prioritized list (high/medium). Ask before executing a large batch.
4. Verify with typecheck/lint in BOTH roots after changes.
