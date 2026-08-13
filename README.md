# Studio Compositions

Remotion 4.0.509 compositions for viral highlight generation (1080×1920 @30fps).

## Design

Style inspired by [remotion-dev/template-prompt-to-video](https://github.com/remotion-dev/template-prompt-to-video):
- Timeline-driven scenes with Ken Burns zoom + blur enter/exit
- Big UPPERCASE stroke text (white fill, black outline) via Bree Serif
- Deterministic theme palettes seeded from `candidateId:angleId`
- Three skins: commentary (default), sports, interview

## Engine Contract

The engine is invoked by `src/composition/remotion.engine.ts` with:
- **entry**: `compositions/studio/src/index.tsx`
- **props**: JSON with `plan`, `narrationPath`, `sourceVideoPath`, `channelName`
- **env**: `COMPOSITION_STYLE=commentary|sports|interview` → maps to `CommentaryShort|SportsShort|InterviewShort`

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
      source?: { start: number; end: number }; // required for visual==='source-clip'
    }>;
    captions: Array<{
      start: number;
      end: number;
      text: string;
      highlightWords: string[];
    }>;
    audio: { sourceUnderlay: boolean; ducking: boolean };
  };
  narrationPath: string;
  sourceVideoPath: string;
  channelName: string;
}
```

Media files are staged under `public/media/{jobId}/` by the engine and referenced via `staticFile()`.

## Timing Semantics

- `scene.start/end`: absolute seconds in the output video
- `scene.source.start/end`: absolute seconds in the source video (frames = `round(sec × fps)`)
- Source-clip scenes play the clip then freeze on the last frame for the remainder of the scene
- Non-source scenes play the source from `0` to natural end (hold-last-frame at source end)

## Types

- `Theme`: palette with `id`, `accent`, `accent2`, `cardBg`, `cardText`, `cardStroke`, `stroke`, `fill`, `gradient`, `surface`
- `PlanScene`: per-scene metadata (see Props Schema above)
- `Skin`: `{ id, theme?, labels?, Overlay? }` — composition skin config

## Local Development

```bash
cd compositions/studio
npm install
npm run typecheck   # TypeScript check
npx remotion studio  # Interactive studio
```

## Verification

Deterministic timing verified against synthetic colors.mp4:
- Context (media 1s) → red `#ff1800` ✓
- Context (media 4s) → blue `#000efd` ✓
- Source-clip (media 10.5s) → cyan `#00e6ff` ✓
- Source-clip freeze (media >12s) → cyan `#00e6ff` ✓ (blank bug fixed)
