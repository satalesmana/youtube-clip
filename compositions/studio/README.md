# Studio Compositions

Remotion 4.0.509 vertical-video compositions (1080×1920 @30fps) for viral highlight generation.

## Design

Style inspired by [remotion-dev/template-prompt-to-video](https://github.com/remotion-dev/template-prompt-to-video):
- Timeline-driven scene composition with Ken Burns zoom + blur enter/exit transitions
- Big UPPERCASE stroke text (white fill, black outline) via Bree Serif (`@remotion/google-fonts`)
- Deterministic theme palettes seeded from `candidateId:angleId` (5 palettes: classic, neon, violet, sunset, ocean)
- Three skins: commentary (default), sports, interview

## Engine Contract

Invoked by `src/composition/remotion.engine.ts`:
- **entry**: `src/index.tsx`
- **props**: JSON with `plan`, `narrationPath`, `sourceVideoPath`, `channelName`
- **env**: `COMPOSITION_STYLE=commentary|sports|interview` → composition IDs `CommentaryShort|SportsShort|InterviewShort`

## Props Schema

```ts
interface CompositionProps {
  plan: {
    candidateId: string;
    angleId: string;
    duration: number;
    scenes: Array<{
      type: 'hook' | 'source' | 'context' | 'analysis' | 'support' | 'conclusion';
      start: number;
      end: number;
      narration: string;
      visual: 'graphic' | 'speaker' | 'source-clip' | 'b-roll';
      source?: { start: number; end: number }; // required when visual==='source-clip'
    }>;
    captions: Array<{ start: number; end: number; text: string; highlightWords: string[] }>;
    audio: { sourceUnderlay: boolean; ducking: boolean };
  };
  narrationPath: string;
  sourceVideoPath: string;
  channelName: string;
}
```

Media files are staged under `public/media/{jobId}/` by the engine (referenced via `staticFile()`).

## Timing Semantics

- `scene.start/end`: absolute seconds in the output video
- `scene.source.start/end`: absolute seconds in the source video (`frame = round(sec × fps)`)
- Source-clip scenes play the clip then freeze on the last frame for the remainder of the scene
- Non-source scenes play the source from frame 0 and hold the last frame at source end

## Installed Remotion Packages

- `@remotion/google-fonts` — Bree Serif font (network fetch at render time)
- `@remotion/animation-utils` — `spring()`, `quickEnter` helpers
- `@remotion/layout-utils` — `fitText()` for responsive typography
- `@remotion/media` — `<Video>` / `<Audio>` with frame-accurate trim support

## Local Dev

```bash
npm install
npm run typecheck          # TypeScript
npx remotion studio        # Interactive browser studio
npx remotion still src/index.tsx CommentaryShort out/hook.png --props=props/example.json --frame=0 --width=270
```

## Verification

Deterministic timing verified against synthetic `colors.mp4` (solid-color segments every 2s):
- Context (media 1s) → red `#ff1800` ✓
- Context (media 4s) → blue `#000efd` ✓
- Source-clip (media 10.5s) → cyan `#00e6ff` ✓
- Source-clip freeze (media >12s) → cyan `#00e6ff` ✓ (blank-frame bug fixed)
