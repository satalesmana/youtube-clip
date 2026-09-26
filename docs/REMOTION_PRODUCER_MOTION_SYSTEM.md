# Remotion Motion Production System (Oren x AI Producer Integration)

This document specifies how **The 3-Prompt Production System** (by Oren @TheOrenTech) is adapted and implemented inside this project (`youtube-clip` / Viral Highlight Generator).

---

## 1. Arsitektur & Pembagian Peran

| Konsep Asli Oren | Implementasi di Project Ini | Lokasi Kode |
| :--- | :--- | :--- |
| **Step 01: System Prompt (`rules.md`)** | Otak & Heuristik Sutradara AI Producer | `src/services/producer.service.ts` |
| **Motion Physics Law** | Library animasi deterministik 3-Phase | `compositions/studio/src/animation.ts` |
| **Modular Compositions** | Headline Renderers, Hook Intro, Outro Card | `compositions/studio/src/headline-renderers/`, `HookIntroShort.tsx`, `Outro.tsx` |
| **Step 03: Reusable Template Prompt** | Prompt form untuk pembuatan overlay / preset baru | Bagian 3 dokumen ini |

---

## 2. Hukum Fisika Animasi (3-Phase Animation Law)

Setiap elemen visual motion graphics yang dirender oleh Remotion harus mematuhi 3 fase:

```
[ Frame 0 ] ──── Phase 1: Entrance ────> [ Frame 25 ] ──── Phase 2: Micro-Life ────> [ End - 18f ] ──── Phase 3: Exit ────> [ End ]
             Spring / Cascade / Slide                   Floating Bob & Pulse                   Cubic Easing Smooth Exit
```

### A. Phase 1: Entrance (Frames 0 to 25 / ~0.8s)
* Menggunakan physics spring (`spring-punch`, `scale-burst`, `word-cascade`, `slide-up`) dengan parameter damping, stiffness, dan overshoot yang terukur.
* Mencegah kedipan 1-frame dengan `antiFlashOffset` atau scale settle.

### B. Phase 2: Sustained Hold & Micro-Life (Fase Tengah)
* Elemen **dilarang statis/kaku**.
* Diberi `microLifeHold`:
  * Floating bobbing vertikal ($2 \sim 4\text{ px}$) via gelombang sinus deterministik: $\sin(\frac{\text{frame}}{\text{fps}} \cdot \pi \cdot f) \times A$.
  * Scale breathing ($1 \pm 0.012$).
  * Glow pulse pada badge atau accent neon ($0.85 \sim 1.0$).

### C. Phase 3: Smooth Exit Cycle (Final 18–20 Frames)
* Menggunakan `smoothExitProgress` dengan `Easing.inOut(Easing.cubic)`:
  * Opacity memudar ($1 \to 0$).
  * Scale mengecil halus ($1 \to 0.94$).
  * TranslateY bergeser ($0 \to -20\text{ px}$).
* Mencegah pergantian klip yang patah/jarring.

---

## 3. Template Prompt Pembuatan Komposisi / Preset Baru (Step 03 Adapter)

Gunakan form ini saat meminta AI membuat preset visual atau overlay Remotion baru di `compositions/studio/src/`:

```markdown
Build a production-ready, modular Remotion motion graphic component in `compositions/studio/src/`:

1. SPECIFICATIONS:
- Component Name: [NAMA_KOMPONEN].tsx
- Category / Type: [Hook / Stat Counter / Lower Third / Notification Card / Wipe]
- Canvas Dimensions: 1080x1920 (9:16 Vertical Short @ 30 FPS)
- Duration: [DURASI_DETIK]s ([DURASI_FRAMES] frames)

2. BRAND DESIGN SYSTEM:
- Canvas Base: #0F172A (Deep Slate) / Transparent Overlay
- Text & Accent: High contrast, 1px/2px sharp borders, vibrant neon highlights (#00F0FF Cyan / #FFE500 Yellow)
- Title Safe Area: Tetap dalam margin aman 10% dari tepi layar

3. 3-PHASE CHOREOGRAPHY:
- Phase 1 (Entrance 0-25 frames): Spring punch / slide-up dengan overshoot natural
- Phase 2 (Hold Phase): Micro-life floating bobbing via `microLifeHold(frame, fps)`
- Phase 3 (Exit Transition final 18-20 frames): Smooth exit via `smoothExitProgress(frame, durationFrames, fps)`

4. CONTRACT & INTEGRATION:
- Terima props: `theme: Theme`, `durationFrames: number`, dan props konten.
- Jangan hardcode style, gunakan design tokens dari `../design.ts`.
```
