import type { IAiProvider } from '../providers/ai.provider.js';
import type { Logger } from '../utils/logger.js';
import { parseLlmJson, stripCodeFences } from '../utils/llm-json.js';
import { retry } from '../utils/retry.js';
import type {
  ProducerAction,
  ProducerChatMessage,
  ProducerChatRequest,
  ProducerChatResponse,
  ProducerEditorContext,
} from '../types/producer.js';

export interface ProducerServiceOptions {
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
}

export class ProducerService {
  constructor(
    private readonly provider: IAiProvider,
    private readonly options: ProducerServiceOptions,
    private readonly logger: Logger,
  ) {}

  async chat(request: ProducerChatRequest): Promise<ProducerChatResponse> {
    const { messages, currentContext } = request;
    const systemPrompt = this.buildSystemPrompt(currentContext);

    // Format chat messages for context
    const conversationHistory = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const userPrompt = `Conversation so far:\n${conversationHistory}\n\nRespond as the AI Producer with your JSON payload.`;

    try {
      const raw = await retry(
        async () => {
          return await this.provider.chat({
            model: this.options.model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: this.options.temperature,
            timeoutMs: this.options.timeoutMs,
            responseFormat: 'json_object',
          });
        },
        {
          attempts: this.options.maxRetries,
          onRetry: (err, attempt) => {
            this.logger.warn({ err, attempt }, 'Retrying AI Producer chat call');
          },
        },
      );

      const parsed = this.parseResponse(raw, currentContext);
      return parsed;
    } catch (err) {
      this.logger.error({ err }, 'AI Producer chat invocation failed, generating fallback response');
      return this.generateFallbackResponse(messages, currentContext);
    }
  }

  private buildSystemPrompt(context: ProducerEditorContext): string {
    return `You are "AI Producer", an elite AI video editor co-pilot modeled after Opus Clip's AI Producer & Video Co-Pilot.
You assist video creators in real-time by directing, refining, styling, and optimizing their short-form video (TikTok, YouTube Shorts, Reels) directly inside the video editor.

### CURRENT VIDEO EDITOR STATE (LIVE CONTEXT):
- Step: ${context.step} (1: Ingest, 2: Clips Selection, 3: Styling & Composer, 4: Master Output)
- Video: "${context.video?.title || 'Untitled'}" (ID: ${context.video?.videoId || 'unknown'})
- Aspect Ratio: ${context.aspectRatio}
- Genre: ${context.genre}
- Output Mode: ${context.outputMode} ('reel' = original video audio, 'narration' = AI voice-over TTS)
- Subtitle Template: ${context.templateId} (options: 'beast' [MrBeast yellow/cyan bold], 'hormozi' [Alex Hormozi punchy boxes], 'clean' [Minimal Modern])
- Hook Intro Enabled: ${context.hook.enableHookIntro}
- Hook Text: "${context.hook.currentHookText || context.hook.customHookText || 'Belum diisi'}"
- Hook Tag/Badge: "${context.hook.customHookTag || '👀 JANGAN DI-SKIP'}"
- Visual Preset: ${context.hook.visualPreset || 'auto'} (options: 'kinetic-punch', 'curiosity-stack', 'story-slide', 'minimal-question', 'bold-impact', 'data-punch', 'opportunity-glow', 'focus-brush', 'clean-fade', 'scribble-quote', 'action-pointer', 'burst-stat')
- Hook Layout: ${context.hook.layout || 'auto'} ('centered', 'top-heavy', 'split-proof', 'full-screen-text', 'subject-first')
- Hook Animation: ${context.hook.animation || 'auto'} ('spring-punch', 'word-cascade', 'slide-up', 'scale-burst', 'fade')
- Hook Badge Preset: ${context.hook.badgePreset || 'neon-outline'} ('neon-outline', 'solid-impact', 'highlight-chip', 'editorial-label', 'price-tag', 'speech-bubble', 'burst-stamp', 'diagonal-slash')
- Hook Badge Color: ${context.hook.badgeColor || 'auto'} ('cyan', 'magenta', 'red', 'yellow', 'green', 'purple', 'gold')
- B-Roll: Enabled = ${context.broll.enableBroll}, Count = ${context.broll.count}
- Outro: Enabled = ${context.outro.enableIntroOutro}, Preset = ${context.outro.preset}, CTA = "${context.outro.ctaText}", Channel = "${context.outro.channelName}"
- TTS Voice: ${context.audio.ttsVoice || 'default'}, Source Volume: ${context.audio.sourceVolume}%
- Available Clips Count: ${context.clips.count}, Selected Indices: [${context.clips.selectedIndices.join(', ')}]
${
  context.clips.list && context.clips.list.length > 0
    ? `Clips list:\n${context.clips.list.map((c) => `  [#${c.index + 1}] ${c.title} (${c.duration}s, score: ${c.score}/100, range: ${c.start}s-${c.end}s)`).join('\n')}`
    : ''
}

### YOUR CAPABILITIES & COMMANDS:
You can return a list of concrete \`actions\` that will be IMMEDIATELY executed by the editor in real-time!
Supported actions:
1. {"type": "SET_STEP", "step": 1 | 2 | 3 | 4}
2. {"type": "SET_ASPECT_RATIO", "value": "9:16" | "16:9" | "1:1"}
3. {"type": "SET_GENRE", "value": string}
4. {"type": "SET_OUTPUT_MODE", "mode": "reel" | "narration"}
5. {"type": "SET_TEMPLATE_ID", "templateId": "beast" | "hormozi" | "clean"}
6. {"type": "SET_HOOK_TEXT", "text": string}
7. {"type": "SET_HOOK_TAG", "tag": string}
8. {"type": "SET_VISUAL_PRESET", "preset": string}
9. {"type": "SET_HOOK_LAYOUT", "layout": string}
10. {"type": "SET_HOOK_ANIMATION", "animation": string}
11. {"type": "SET_HOOK_TYPOGRAPHY", "typography": string}
12. {"type": "SET_HOOK_BADGE_PRESET", "preset": string}
13. {"type": "SET_HOOK_BADGE_COLOR", "color": string}
14. {"type": "SET_ENABLE_HOOK_INTRO", "value": boolean}
15. {"type": "SET_ENABLE_BROLL", "value": boolean}
16. {"type": "ADD_BROLL_PLACEMENT", "placement": {"start": number, "end": number, "query": string, "mood": string}}
17. {"type": "CLEAR_BROLL"}
18. {"type": "SET_OUTRO", "outro": {"enable"?: boolean, "preset"?: string, "ctaText"?: string, "buttonText"?: string, "duration"?: number, "channelName"?: string}}
19. {"type": "SET_TTS_VOICE", "voice": string}
20. {"type": "SET_SOURCE_VOLUME", "volume": number}
21. {"type": "SELECT_CLIPS", "indices": number[]}
22. {"type": "TRIM_CLIP", "index": number, "start": number, "end": number}
23. {"type": "TRIGGER_GENERATE_HOOKS", "refresh"?: boolean}
24. {"type": "TRIGGER_GENERATE_BROLL", "force"?: boolean}
25. {"type": "TRIGGER_RENDER"}

### EDITORIAL BEHAVIOR & RULES:
- Language: Always communicate naturally in the same language the user speaks (Indonesian or English). If user speaks Indonesian, respond in conversational Indonesian.
- Personality: Energetic, proactive, helpful, viral-growth focused like a veteran TikTok/Reels video producer.
- When user asks for styling changes or edits, explain the editorial reason briefly (e.g. why MrBeast style or kinetic hook works best for retention) and emit the exact action(s).
- Include helpful "appliedBadges" (short 2-4 word tags of what was updated, e.g. "🎨 Subtitle: MrBeast", "⚡ Hook Diperbarui", "📐 Format 9:16").
- Provide 2-4 "suggestedQuestions" offering next logical steps to streamline their workflow.
- ALWAYS return a valid JSON object matching the schema below.

### RESPONSE JSON SCHEMA:
{
  "reply": "string (conversational response with markdown formatting)",
  "actions": [
    /* Array of action objects defined above */
  ],
  "appliedBadges": ["string (e.g. '🎨 Style MrBeast', '⚡ Hook Teks')"],
  "suggestedQuestions": ["string", "string"]
}`;
  }

  private parseResponse(raw: string, context: ProducerEditorContext): ProducerChatResponse {
    try {
      const cleaned = stripCodeFences(raw);
      const json = parseLlmJson(cleaned) as Record<string, unknown>;

      const reply = typeof json.reply === 'string' ? json.reply : 'Perubahan telah diterapkan ke editor video.';
      const actions: ProducerAction[] = Array.isArray(json.actions)
        ? (json.actions as ProducerAction[]).filter((a) => a && typeof a.type === 'string')
        : [];
      const appliedBadges: string[] = Array.isArray(json.appliedBadges)
        ? (json.appliedBadges as string[])
        : this.deriveBadgesFromActions(actions);
      const suggestedQuestions: string[] = Array.isArray(json.suggestedQuestions)
        ? (json.suggestedQuestions as string[])
        : this.getDefaultSuggestedQuestions(context);

      return {
        reply,
        actions,
        appliedBadges,
        suggestedQuestions,
      };
    } catch (parseErr) {
      this.logger.warn({ parseErr, raw }, 'Failed to parse LLM response directly, extracting heuristics');
      return this.heuristicActionExtractor(raw, context);
    }
  }

  private deriveBadgesFromActions(actions: ProducerAction[]): string[] {
    const badges: string[] = [];
    for (const a of actions) {
      switch (a.type) {
        case 'SET_TEMPLATE_ID':
          badges.push(`🎨 Subtitle: ${a.templateId.toUpperCase()}`);
          break;
        case 'SET_ASPECT_RATIO':
          badges.push(`📐 Rasio: ${a.value}`);
          break;
        case 'SET_HOOK_TEXT':
          badges.push('⚡ Hook Diperbarui');
          break;
        case 'SET_HOOK_TAG':
          badges.push(`🏷️ Badge: ${a.tag}`);
          break;
        case 'SET_VISUAL_PRESET':
          badges.push(`✨ Preset: ${a.preset}`);
          break;
        case 'SET_ENABLE_BROLL':
          badges.push(a.value ? '🎬 B-Roll Aktif' : '🎬 B-Roll Nonaktif');
          break;
        case 'ADD_BROLL_PLACEMENT':
          badges.push(`🎥 +B-Roll: "${a.placement.query}"`);
          break;
        case 'SET_OUTRO':
          badges.push('🏁 Outro CTA Diperbarui');
          break;
        case 'SELECT_CLIPS':
          badges.push(`✂️ Klip Dipilih (${a.indices.length})`);
          break;
        case 'TRIGGER_RENDER':
          badges.push('🚀 Render Dimulai');
          break;
        case 'TRIGGER_GENERATE_HOOKS':
          badges.push('💡 Regenerate Hook');
          break;
        case 'TRIGGER_GENERATE_BROLL':
          badges.push('🎬 Refresh B-Roll');
          break;
      }
    }
    return badges;
  }

  private getDefaultSuggestedQuestions(context: ProducerEditorContext): string[] {
    if (context.step === 1) {
      return [
        'Pilih klip terbaik dari video ini',
        'Ganti aspect ratio ke 9:16 portrait',
        'Bantu analisa topik viralnya',
      ];
    }
    if (context.step === 2) {
      return [
        'Pilih klip nomor 1',
        'Bikinkan hook viral yang clickbait',
        'Lanjut ke step 3 styling subtitle & b-roll',
      ];
    }
    if (context.step === 3) {
      return [
        'Ganti subtitle style ke MrBeast',
        'Ganti visual preset ke kinetic-punch',
        'Tambahkan B-roll visual pendukung',
        'Render video sekarang',
      ];
    }
    return [
      'Render ulang dengan style berbeda',
      'Buat caption viral untuk TikTok & IG',
      'Ganti hook headline',
    ];
  }

  private heuristicActionExtractor(text: string, context: ProducerEditorContext): ProducerChatResponse {
    const actions: ProducerAction[] = [];
    const lower = text.toLowerCase();

    // Template detection
    if (lower.includes('beast') || lower.includes('mrbeast')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'beast' });
    } else if (lower.includes('hormozi')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'hormozi' });
    } else if (lower.includes('clean') || lower.includes('minimal')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'clean' });
    }

    // Aspect ratio detection
    if (lower.includes('9:16') || lower.includes('tiktok') || lower.includes('shorts') || lower.includes('portrait')) {
      actions.push({ type: 'SET_ASPECT_RATIO', value: '9:16' });
    } else if (lower.includes('1:1') || lower.includes('square') || lower.includes('feed')) {
      actions.push({ type: 'SET_ASPECT_RATIO', value: '1:1' });
    } else if (lower.includes('16:9') || lower.includes('landscape')) {
      actions.push({ type: 'SET_ASPECT_RATIO', value: '16:9' });
    }

    // Preset detection
    if (lower.includes('kinetic') || lower.includes('kinetic-punch')) {
      actions.push({ type: 'SET_VISUAL_PRESET', preset: 'kinetic-punch' });
    } else if (lower.includes('bold') || lower.includes('bold-impact')) {
      actions.push({ type: 'SET_VISUAL_PRESET', preset: 'bold-impact' });
    } else if (lower.includes('curiosity') || lower.includes('curiosity-stack')) {
      actions.push({ type: 'SET_VISUAL_PRESET', preset: 'curiosity-stack' });
    }

    // B-Roll detection
    if (lower.includes('aktifkan b-roll') || lower.includes('nyalakan b-roll') || lower.includes('tambah b-roll')) {
      actions.push({ type: 'SET_ENABLE_BROLL', value: true });
    } else if (lower.includes('matikan b-roll') || lower.includes('hapus b-roll') || lower.includes('disable b-roll')) {
      actions.push({ type: 'SET_ENABLE_BROLL', value: false });
    }

    // Render detection
    if (lower.includes('render') || lower.includes('ekspor') || lower.includes('proses video')) {
      actions.push({ type: 'TRIGGER_RENDER' });
    }

    return {
      reply: text.replace(/```json[\s\S]*?```/g, '').trim() || 'Perubahan telah diterapkan oleh AI Producer.',
      actions,
      appliedBadges: this.deriveBadgesFromActions(actions),
      suggestedQuestions: this.getDefaultSuggestedQuestions(context),
    };
  }

  private generateFallbackResponse(
    messages: ProducerChatMessage[],
    context: ProducerEditorContext,
  ): ProducerChatResponse {
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    const lower = lastUserMsg.toLowerCase();
    const actions: ProducerAction[] = [];

    let reply = 'Tentu! Saya telah menganalisis instruksi Anda dan menyesuaikan konfigurasi video.';

    if (lower.includes('beast') || lower.includes('mrbeast')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'beast' });
      reply = 'Subtitle telah diubah ke MrBeast Style dengan teks uppercase tebal dan highlight warna kuning-cyan yang eye-catching!';
    } else if (lower.includes('hormozi')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'hormozi' });
      reply = 'Subtitle diubah ke gaya Alex Hormozi dengan background box kontras tinggi untuk retensi maksimal.';
    } else if (lower.includes('clean') || lower.includes('minimal')) {
      actions.push({ type: 'SET_TEMPLATE_ID', templateId: 'clean' });
      reply = 'Subtitle diubah ke gaya Minimal Modern yang rapi dan elegan.';
    } else if (lower.includes('9:16') || lower.includes('shorts') || lower.includes('tiktok')) {
      actions.push({ type: 'SET_ASPECT_RATIO', value: '9:16' });
      reply = 'Aspect ratio video telah diset ke 9:16 portrait ideal untuk TikTok, Reels, dan YouTube Shorts.';
    } else if (lower.includes('b-roll') && (lower.includes('mati') || lower.includes('off'))) {
      actions.push({ type: 'SET_ENABLE_BROLL', value: false });
      reply = 'Fitur B-Roll telah dinonaktifkan sesuai permintaan Anda.';
    } else if (lower.includes('b-roll')) {
      actions.push({ type: 'SET_ENABLE_BROLL', value: true });
      actions.push({ type: 'TRIGGER_GENERATE_BROLL', force: true });
      reply = 'B-Roll telah diaktifkan dan saran klip visual pendukung sedang disiapkan!';
    } else if (lower.includes('render')) {
      actions.push({ type: 'TRIGGER_RENDER' });
      reply = 'Memulai proses render video dengan Remotion Engine!';
    } else if (lower.includes('hook')) {
      actions.push({ type: 'SET_HOOK_TEXT', text: '🔥 Rahasia Yang Jarang Diketahui Orang!' });
      actions.push({ type: 'SET_VISUAL_PRESET', preset: 'kinetic-punch' });
      reply = 'Hook intro telah diperbarui dengan headline provokatif dan visual preset Kinetic Punch untuk menghentikan scrolling penonton.';
    }

    return {
      reply,
      actions,
      appliedBadges: this.deriveBadgesFromActions(actions),
      suggestedQuestions: this.getDefaultSuggestedQuestions(context),
    };
  }
}
