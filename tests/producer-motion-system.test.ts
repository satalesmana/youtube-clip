import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ProducerService, parseOrRepairHtmlOverlay } from '../src/services/producer.service.js';
import type { IAiProvider } from '../src/providers/ai.provider.js';
import type { Logger } from '../src/utils/logger.js';
import type { ProducerEditorContext } from '../src/types/producer.js';

test('AI Producer & Remotion Motion Production System Suite', async (t) => {
  const dummyProvider: IAiProvider = {
    chat: async () => '{"reply": "ok", "actions": []}',
    generateText: async () => 'ok',
  };
  const dummyLogger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => dummyLogger,
  } as unknown as Logger;

  const producerService = new ProducerService(
    dummyProvider,
    { model: 'dummy', temperature: 0.7, timeoutMs: 10000, maxRetries: 2 },
    dummyLogger,
  );

  const mockContext: ProducerEditorContext = {
    step: 3,
    aspectRatio: '9:16',
    genre: 'tech',
    outputMode: 'reel',
    templateId: 'beast',
    hook: {
      selectedHookIndex: 0,
      currentHookText: 'Rahasia coding AI',
      visualPreset: 'kinetic-punch',
      layout: 'centered',
      animation: 'spring-punch',
      typography: 'kinetic',
      badgePreset: 'neon-outline',
      badgeColor: 'cyan',
      enableHookIntro: true,
    },
    clips: {
      count: 3,
      selectedIndices: [0],
    },
    broll: {
      enableBroll: true,
      count: 2,
    },
    outro: {
      enableIntroOutro: true,
      preset: 'creator-glass',
      ctaText: 'Follow for more',
      buttonText: 'Subscribe',
      duration: 3,
      channelName: 'tech_channel',
    },
    audio: {
      sourceVolume: 100,
    },
  };

  await t.test('1. Producer System Prompt incorporates 3-Phase Animation Physics knowledge', () => {
    // Access private buildSystemPrompt via any for testing prompt integrity
    const systemPrompt = (producerService as any).buildSystemPrompt(mockContext);

    assert.ok(
      systemPrompt.includes('3-Phase Animation Law'),
      'System prompt must include 3-Phase Animation Law',
    );
    assert.ok(
      systemPrompt.includes('Entrance - Frames 0 to 25'),
      'System prompt must specify Phase 1 Entrance frames',
    );
    assert.ok(
      systemPrompt.includes('Sustained Hold & Micro-Life'),
      'System prompt must specify Phase 2 Micro-Life hold',
    );
    assert.ok(
      systemPrompt.includes('Exit Transition - Final 18-20 Frames'),
      'System prompt must specify Phase 3 Exit transition',
    );
    assert.ok(
      systemPrompt.includes('kinetic-punch'),
      'System prompt must guide preset combinations for kinetic-punch',
    );
  });

  await t.test('2. Heuristic Action Extractor maps animation physics keywords', () => {
    const resSpring = (producerService as any).heuristicActionExtractor(
      'Ubah hook jadi lebih punchy dengan spring overshoot',
      mockContext,
    );
    assert.ok(
      resSpring.actions.some(
        (a: any) => a.type === 'SET_HOOK_ANIMATION' && a.animation === 'spring-punch',
      ),
      'Should extract SET_HOOK_ANIMATION spring-punch',
    );
    assert.ok(
      resSpring.appliedBadges.some((b: string) => b.includes('Spring Punch') || b.includes('spring-punch')),
      'Should derive badge for spring-punch',
    );

    const resCascade = (producerService as any).heuristicActionExtractor(
      'Bikin teksnya cascade bertingkat per kata',
      mockContext,
    );
    assert.ok(
      resCascade.actions.some(
        (a: any) => a.type === 'SET_HOOK_ANIMATION' && a.animation === 'word-cascade',
      ),
      'Should extract SET_HOOK_ANIMATION word-cascade',
    );
  });

  await t.test('3. Fallback generator gracefully handles animation commands', () => {
    const fallbackRes = (producerService as any).generateFallbackResponse(
      [{ role: 'user', content: 'Tolong buat animasinya spring punch' }],
      mockContext,
    );
    assert.ok(
      fallbackRes.actions.some((a: any) => a.type === 'SET_HOOK_ANIMATION' && a.animation === 'spring-punch'),
      'Fallback should generate SET_HOOK_ANIMATION action',
    );
    assert.ok(
      fallbackRes.reply.includes('Spring Punch'),
      'Fallback reply should explain Spring Punch motion physics',
    );
  });

  await t.test('4. Remotion studio animation utilities enforce 3-Phase Physics in source', () => {
    const animSource = readFileSync(
      resolve(process.cwd(), 'compositions/studio/src/animation.ts'),
      'utf-8',
    );

    assert.ok(animSource.includes('export const microLifeHold'), 'Must export microLifeHold');
    assert.ok(animSource.includes('export const smoothExitProgress'), 'Must export smoothExitProgress');
    assert.ok(animSource.includes('export const antiFlashOffset'), 'Must export antiFlashOffset');
    assert.ok(animSource.includes('Easing.inOut(Easing.cubic)'), 'Must use cubic easing for smooth exits');
  });

  await t.test('5. Remotion headline renderers wire durationFrames for complete exit cycles', () => {
    const headlineSource = readFileSync(
      resolve(process.cwd(), 'compositions/studio/src/HookHeadline.tsx'),
      'utf-8',
    );
    assert.ok(
      headlineSource.includes('durationFrames,'),
      'HookHeadline must pass durationFrames into commonProps',
    );

    const kineticSource = readFileSync(
      resolve(process.cwd(), 'compositions/studio/src/headline-renderers/KineticRenderer.tsx'),
      'utf-8',
    );
    assert.ok(kineticSource.includes('microLifeHold'), 'KineticRenderer must use microLifeHold');
    assert.ok(kineticSource.includes('smoothExitProgress'), 'KineticRenderer must use smoothExitProgress');

    const slideUpSource = readFileSync(
      resolve(process.cwd(), 'compositions/studio/src/headline-renderers/SlideUpRenderer.tsx'),
      'utf-8',
    );
    assert.ok(slideUpSource.includes('microLifeHold'), 'SlideUpRenderer must use microLifeHold');
    assert.ok(slideUpSource.includes('smoothExitProgress'), 'SlideUpRenderer must use smoothExitProgress');
  });

  await t.test('6. Producer System Prompt incorporates Remotion Caption & Safe-Zone Engineering', () => {
    const systemPrompt = (producerService as any).buildSystemPrompt(mockContext);

    assert.ok(
      systemPrompt.includes('REMOTION SUBTITLE & CAPTION ENGINEERING'),
      'Must include Remotion Subtitle & Caption Engineering section',
    );
    assert.ok(
      systemPrompt.includes('Safe-Zones & Collision Prevention'),
      'Must specify platform safe zones and collision prevention',
    );
    assert.ok(
      systemPrompt.includes('Top Safe Zone (Header Clearance)'),
      'Must specify top header clearance rule',
    );
    assert.ok(
      systemPrompt.includes('Bottom Safe Zone (Platform Footer Clearance)'),
      'Must specify bottom platform footer clearance rule',
    );
    assert.ok(
      systemPrompt.includes('Word Chunking & Pacing Rules'),
      'Must specify 2-4 words per subtitle chunk rule',
    );
  });

  await t.test('7. Producer System Prompt incorporates Visual Pacing & Audio Ducking Laws', () => {
    const systemPrompt = (producerService as any).buildSystemPrompt(mockContext);

    assert.ok(
      systemPrompt.includes('2.5s - 3.5s Visual Stimulus Law'),
      'Must include 2.5s - 3.5s Visual Stimulus Law for short-form retention',
    );
    assert.ok(
      systemPrompt.includes('ACOUSTIC DYNAMICS & AUDIO DUCKING LAW'),
      'Must include Audio Ducking Law from Remotion skills',
    );
    assert.ok(
      systemPrompt.includes('15% - 20%'),
      'Must specify ducking source video down to 15% - 20% under AI narration',
    );
  });

  await t.test('8. Heuristic Action Extractor handles Remotion audio ducking, layout, and outro', () => {
    const resDucking = (producerService as any).heuristicActionExtractor(
      'Tolong lakukan audio ducking kecilkan suara asli video',
      mockContext,
    );
    assert.ok(
      resDucking.actions.some((a: any) => a.type === 'SET_SOURCE_VOLUME' && a.volume === 20),
      'Should extract SET_SOURCE_VOLUME ducking to 20%',
    );
    assert.ok(
      resDucking.appliedBadges.some((b: string) => b.includes('Volume: 20%')),
      'Should include Volume badge',
    );

    const resLayout = (producerService as any).heuristicActionExtractor(
      'Posisikan teks di layout tengah agar aman dari safe zone',
      mockContext,
    );
    assert.ok(
      resLayout.actions.some((a: any) => a.type === 'SET_HOOK_LAYOUT' && a.layout === 'centered'),
      'Should extract SET_HOOK_LAYOUT centered',
    );

    const resOutro = (producerService as any).heuristicActionExtractor(
      'Tambahkan outro card di akhir video',
      mockContext,
    );
    assert.ok(
      resOutro.actions.some((a: any) => a.type === 'SET_OUTRO' && a.outro.enable === true),
      'Should extract SET_OUTRO enable: true',
    );
  });

  await t.test('9. Fallback response handles audio ducking and layout commands', () => {
    const fallbackDucking = (producerService as any).generateFallbackResponse(
      [{ role: 'user', content: 'Kecilkan suara latar agar voiceover jelas' }],
      mockContext,
    );
    assert.ok(
      fallbackDucking.actions.some((a: any) => a.type === 'SET_SOURCE_VOLUME' && a.volume === 20),
      'Fallback should emit SET_SOURCE_VOLUME 20%',
    );
    assert.ok(
      fallbackDucking.reply.includes('ducking'),
      'Fallback reply should explain audio ducking',
    );
  });

  await t.test('10. Heuristic and fallback extractor handles B-roll with timestamp (e.g. detik ke 20)', () => {
    const resBrollHeuristic = (producerService as any).heuristicActionExtractor(
      'tambahkan b roll pada detik ke 20',
      mockContext,
    );
    assert.ok(
      resBrollHeuristic.actions.some((a: any) => a.type === 'SET_ENABLE_BROLL' && a.value === true),
      'Should emit SET_ENABLE_BROLL true',
    );
    const brollPlacementAction = resBrollHeuristic.actions.find((a: any) => a.type === 'ADD_BROLL_PLACEMENT');
    assert.ok(brollPlacementAction, 'Should extract ADD_BROLL_PLACEMENT');
    assert.equal(brollPlacementAction.placement.start, 20, 'Placement start should be 20');
    assert.equal(brollPlacementAction.placement.end, 23, 'Placement end should default to 23 (+3s)');

    const fallbackBroll = (producerService as any).generateFallbackResponse(
      [{ role: 'user', content: 'tambahkan b roll pada detik ke 20' }],
      mockContext,
    );
    const fallbackPlacement = fallbackBroll.actions.find((a: any) => a.type === 'ADD_BROLL_PLACEMENT');
    assert.ok(fallbackPlacement, 'Fallback should emit ADD_BROLL_PLACEMENT');
    assert.equal(fallbackPlacement.placement.start, 20, 'Fallback start should be 20');
    assert.ok(fallbackBroll.reply.includes('20.0'), 'Fallback reply should mention detik 20.0');
  });

  await t.test('11. Frontend useAiProducer and RemotionVideoEditor support ADD_BROLL_PLACEMENT and timeline wiring', () => {
    const useAiProducerSource = readFileSync(
      resolve(process.cwd(), 'client/src/hooks/useAiProducer.ts'),
      'utf-8',
    );
    assert.ok(
      useAiProducerSource.includes("case 'ADD_BROLL_PLACEMENT':"),
      'useAiProducer must implement ADD_BROLL_PLACEMENT handler',
    );
    assert.ok(
      useAiProducerSource.includes("case 'CLEAR_BROLL':"),
      'useAiProducer must implement CLEAR_BROLL handler',
    );
    assert.ok(
      useAiProducerSource.includes('searchBrollFootage'),
      'useAiProducer should enrich B-roll asset via searchBrollFootage',
    );

    const editorSource = readFileSync(
      resolve(process.cwd(), 'client/src/components/editor/RemotionVideoEditor.tsx'),
      'utf-8',
    );
    assert.ok(
      editorSource.includes('onBrollBlockMove'),
      'RemotionVideoEditor must wire onBrollBlockMove',
    );
    assert.ok(
      editorSource.includes('onBrollBlockResize'),
      'RemotionVideoEditor must wire onBrollBlockResize',
    );
  });

  await t.test('12. Zero-Code Dynamic Extension: System Prompt, Heuristics, and Fallback support SET_DYNAMIC_STYLE and ADD_DYNAMIC_OVERLAY', () => {
    const systemPrompt = (producerService as any).buildSystemPrompt(mockContext);
    assert.ok(
      systemPrompt.includes('ZERO-CODE DYNAMIC EXTENSION & SEMANTIC APPROXIMATION'),
      'System prompt must include Zero-Code Dynamic Extension instructions',
    );
    assert.ok(
      systemPrompt.includes('SET_DYNAMIC_STYLE'),
      'System prompt must mention SET_DYNAMIC_STYLE',
    );
    assert.ok(
      systemPrompt.includes('ADD_DYNAMIC_OVERLAY'),
      'System prompt must mention ADD_DYNAMIC_OVERLAY',
    );

    // Heuristics: glow & miring
    const resGlow = (producerService as any).heuristicActionExtractor(
      'Beri efek glow neon biru pada teks headline',
      mockContext,
    );
    const glowAction = resGlow.actions.find((a: any) => a.type === 'SET_DYNAMIC_STYLE');
    assert.ok(glowAction, 'Should extract SET_DYNAMIC_STYLE for glow prompt');
    assert.equal(glowAction.target, 'hook', 'Target should be hook');
    assert.ok(glowAction.styles.filter.includes('drop-shadow'), 'Should inject drop-shadow CSS filter');
    assert.ok(resGlow.appliedBadges.some((b: string) => b.includes('Custom Style: hook')), 'Should include badge');

    // Heuristics: stiker panah
    const resArrow = (producerService as any).heuristicActionExtractor(
      'Tolong beri stiker panah di video',
      mockContext,
    );
    const arrowAction = resArrow.actions.find((a: any) => a.type === 'ADD_DYNAMIC_OVERLAY');
    assert.ok(arrowAction, 'Should extract ADD_DYNAMIC_OVERLAY for sticker prompt');
    assert.equal(arrowAction.overlay.type, 'sticker', 'Overlay type should be sticker');
    assert.equal(arrowAction.overlay.content, '👉', 'Overlay content should be arrow emoji');

    // Fallback: miring
    const fallbackMiring = (producerService as any).generateFallbackResponse(
      [{ role: 'user', content: 'Bikin teksnya miring dikit' }],
      mockContext,
    );
    const miringAction = fallbackMiring.actions.find((a: any) => a.type === 'SET_DYNAMIC_STYLE');
    assert.ok(miringAction, 'Fallback should emit SET_DYNAMIC_STYLE for miring prompt');
    assert.equal(miringAction.styles.transform, 'rotate(-4deg)', 'Should rotate -4deg');
  });

  await t.test('13. Frontend useAiProducer and RemotionStudioComposition wire dynamic styles and universal overlays', () => {
    const useAiProducerSource = readFileSync(
      resolve(process.cwd(), 'client/src/hooks/useAiProducer.ts'),
      'utf-8',
    );
    assert.ok(
      useAiProducerSource.includes("case 'SET_DYNAMIC_STYLE':"),
      'useAiProducer must handle SET_DYNAMIC_STYLE',
    );
    assert.ok(
      useAiProducerSource.includes("case 'ADD_DYNAMIC_OVERLAY':"),
      'useAiProducer must handle ADD_DYNAMIC_OVERLAY',
    );
    assert.ok(
      useAiProducerSource.includes('transform.updateDynamicStyle'),
      'useAiProducer must call transform.updateDynamicStyle',
    );

    const compSource = readFileSync(
      resolve(process.cwd(), 'client/src/components/editor/RemotionStudioComposition.tsx'),
      'utf-8',
    );
    assert.ok(
      compSource.includes('dynamicStyles.hook'),
      'RemotionStudioComposition must apply dynamicStyles.hook',
    );
    assert.ok(
      compSource.includes('dynamicStyles.video'),
      'RemotionStudioComposition must apply dynamicStyles.video',
    );
    assert.ok(
      compSource.includes('dynamicOverlays.map'),
      'RemotionStudioComposition must iterate and render dynamicOverlays',
    );
  });

  await t.test('14. B-roll extraction without explicit timestamp & live preview video cutaway rendering', () => {
    // 1. Heuristic extractor without timestamp extracts query and assigns default start/end
    const resPromptBroll = (producerService as any).heuristicActionExtractor(
      'masukkan b-roll mobil balap di video ini',
      mockContext,
    );
    assert.ok(
      resPromptBroll.actions.some((a: any) => a.type === 'SET_ENABLE_BROLL' && a.value === true),
      'Should emit SET_ENABLE_BROLL true',
    );
    const brollAction = resPromptBroll.actions.find((a: any) => a.type === 'ADD_BROLL_PLACEMENT');
    assert.ok(brollAction, 'Should emit ADD_BROLL_PLACEMENT even without explicit timestamp');
    assert.ok(brollAction.placement.start >= 0, 'Should assign a valid start time');
    assert.ok(brollAction.placement.end > brollAction.placement.start, 'End time should be after start');

    // 2. RemotionStudioComposition renders Video cutaway inside Sequence
    const compSource = readFileSync(
      resolve(process.cwd(), 'client/src/components/editor/RemotionStudioComposition.tsx'),
      'utf-8',
    );
    assert.ok(
      compSource.includes('brollPlacements?.map'),
      'RemotionStudioComposition must map over brollPlacements',
    );
    assert.ok(
      compSource.includes('broll.assetUrl'),
      'RemotionStudioComposition must reference broll.assetUrl for video rendering',
    );
    assert.ok(
      compSource.includes('<Video'),
      'RemotionStudioComposition must render <Video component for B-roll cutaway',
    );

    // 3. RemotionVideoEditor implements normalizedBrollList rebasing relative to clipStart
    const editorSource = readFileSync(
      resolve(process.cwd(), 'client/src/components/editor/RemotionVideoEditor.tsx'),
      'utf-8',
    );
    assert.ok(
      editorSource.includes('normalizedBrollList'),
      'RemotionVideoEditor must calculate normalizedBrollList with rebasing',
    );
    assert.ok(
      editorSource.includes('resolveStockBrollUrl'),
      'RemotionVideoEditor must use resolveStockBrollUrl for fallback video preview',
    );
  });

  await t.test('15. Rich HTML/CSS data overlay parsing, auto-repair, and broadcast card rendering', () => {
    // 1. Repairs truncated/leading CSS style fragments into self-contained HTML widget
    const truncatedCssSnippet = `'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.35; color: #fff; width: 280px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"><div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #ff007f; padding-bottom: 4px; margin-bottom: 6px;"><span style="font-weight: 900; letter-spacing: 1px; color: #ff007f; font-size: 11px;">🏁MOTO3 OFFICIAL GRID</span><span style="font-size: 9px; background: #ff007f; color: #fff; padding: 1px 6px; border-radius: 3px; font-weight: 800; letter-spacing: 0.5px;">Q2 TIMING</span></div><div style="display: flex; flex-direction: column; gap: 4px; font-weight: 700;"><div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.07); padding: 3px 6px; border-radius: 4px; font-size: 11px;"><span>ROW 1 • P1 D. ALONSO</span><span style="color:#FFE500;">1:41.223</span></div></div><div style="margin-top: 6px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">🔥 SECTOR 3 RECORD • TOP SPEED: 238.4 KM/H</div></div>`;

    const repaired = parseOrRepairHtmlOverlay(truncatedCssSnippet);
    assert.ok(repaired, 'Must return a repaired HTML string');
    assert.ok(repaired.startsWith('<div style="font-family: \'Segoe UI\''), 'Must wrap with proper outer div and font-family rule');
    assert.ok(repaired.includes('MOTO3 OFFICIAL GRID'), 'Must preserve inner Moto3 content');
    assert.ok(repaired.endsWith('</div>'), 'Must properly close div tags');

    // 2. Ignores plain text and emoji
    assert.equal(parseOrRepairHtmlOverlay('👉 BACA CAPTION'), null, 'Plain text should return null');
    assert.equal(parseOrRepairHtmlOverlay('🔥'), null, 'Emoji should return null');

    // 3. Client composition supports HTML overlay rendering and auto-repair
    const compSource = readFileSync(
      resolve(process.cwd(), 'client/src/components/editor/RemotionStudioComposition.tsx'),
      'utf-8',
    );
    assert.ok(
      compSource.includes('parseOrRepairHtmlOverlay'),
      'RemotionStudioComposition must include parseOrRepairHtmlOverlay',
    );
    assert.ok(
      compSource.includes('dangerouslySetInnerHTML'),
      'RemotionStudioComposition must render HTML overlay with dangerouslySetInnerHTML',
    );
  });
});

