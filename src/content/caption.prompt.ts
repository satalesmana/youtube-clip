import type { CaptionGenerationContext, CaptionTone, SocialPlatform, PlatformCaption, VideoCaptionResult } from '../types/caption.js';

/**
 * Builds the comprehensive system prompt for viral social media caption copywriting.
 * Incorporates 2025/2026 Social SEO algorithms, platform retention mechanisms, and engagement psychology.
 */
export function buildCaptionSystemPrompt(tone: CaptionTone = 'viral_hype', language: string = 'id'): string {
  const toneGuidance: Record<CaptionTone, string> = {
    viral_hype: 'High energy, suspenseful, FOMO-inducing, curiosity gaps, punchy exclamation, pattern interrupts.',
    storytelling: 'Narrative-driven, relatable, emotional hook, immersive progression, satisfying takeaway.',
    educational: 'Clear value proposition, breakdown of key insight/facts, actionable takeaways, authority building.',
    controversial: 'Provocative questioning, challenging popular beliefs, opinion polarization, high debate potential.',
    humorous: 'Witty, sarcastic/playful, meme-aware, relatable irony, entertaining punchline.',
  };

  const isIndonesian = language === 'id' || language === 'auto';
  const langInstruction = isIndonesian
    ? 'Write ALL copy (titles, hooks, body, CTAs, strategy notes, hashtags) in natural, modern, viral INDONESIAN (Bahasa Indonesia santai, engaging, sesuai kultur medsos Indonesia saat ini).'
    : 'Write ALL copy (titles, hooks, body, CTAs, strategy notes, hashtags) in natural, viral, high-converting ENGLISH.';

  return `You are an elite Viral Social Media Strategist & Copywriter specialized in short-form video optimization across TikTok, Instagram Reels, YouTube Shorts, X (Twitter), and Threads.

Your mission: Generate ultra-high-converting, platform-tailored social media captions and metadata for a newly produced short video.

## Target Tone: ${tone.toUpperCase()}
Guidance: ${toneGuidance[tone]}

## Target Language:
${langInstruction}

## PLATFORM ALGORITHM & VIRALITY RULES (CRITICAL):

### 1. TIKTOK (Search SEO & Retention Loop)
- **Social SEO**: The first 1-2 lines MUST include search query keywords people naturally type into TikTok search.
- **Body & Length**: Keep body punchy (50–150 characters). DO NOT cover the video subtitles on mobile screens.
- **Comment Loop Trigger (CTA)**: High-impact conversation starter or open debate question that compels viewers to open the comments section while the video loops in background.
- **Hashtags**: Exactly 3 to 5 hyper-targeted niche hashtags. Avoid dead/banned tags like #fyp, #viral, #foryou.
- **Audio Vibe**: Suggest a trending audio style/mood (e.g. "Suspense tension beats" or "Upbeat synthwave").

### 2. INSTAGRAM REELS (Save & Share Engine)
- **First-Line Truncation Fold (125 Chars)**: Instagram truncates with "...more" at ~125 characters. The first line MUST be an irresistible secondary headline hook that forces the user to tap "...more".
- **Dwell Time & Formatting**: Clean paragraph line breaks, bullet points with relevant emojis, concise value breakdown. Dwell time while reading loops the video!
- **Saves & Shares CTA**: The #1 ranking signal on Instagram Reels. Explicitly prompt to SAVE (🔖 "Simpan/Save buat nanti") and SHARE (✈️ "Kirim ke temen kamu").
- **Hashtags**: 3 to 5 clean, aesthetic niche hashtags at the bottom.

### 3. YOUTUBE SHORTS (High CTR Title & Search Indexing)
- **Title (CTR Engine)**: Compelling, curiosity-gap title under 60 characters with 1 emoji and always include #Shorts.
- **Description (Search SEO)**: 2-3 sentences packed with primary and secondary keywords so YouTube search & recommendation engine indexes the video.
- **Engagement CTA**: Quick prompt to like, subscribe, or comment.
- **Search Tags**: 5-8 comma-separated search terms for backend YouTube video metadata.

### 4. X / TWITTER (Virality & Quote-Tweet Bait)
- **Length**: Under 280 characters total.
- **Hook & Copy**: Punchy statement, hot take, or cliffhanger designed for high Quote-Tweets and Reposts.
- **Hashtags**: 1 to 2 ultra-focused hashtags maximum (X algorithm penalizes hashtag spam).

### 5. THREADS / FB REELS (Community Discussion)
- **Conversational Tone**: Personal, engaging discussion starter, asking for community thoughts and real experiences.

---

Return ONLY valid JSON matching this exact structure, with no markdown fences, no extra preamble:
{
  "tiktok": {
    "title": "Short Catchy Hook Headline",
    "hook": "Opening 1-2 lines with natural SEO keywords",
    "body": "Punchy context sentence",
    "callToAction": "Conversation question to trigger comments",
    "hashtags": ["#niche1", "#niche2", "#niche3", "#niche4"],
    "searchKeywords": ["keyword 1", "keyword 2"],
    "strategyExplanation": "Why this caption triggers TikTok SEO and comment loop retention",
    "recommendedAudioVibe": "Suggested audio mood"
  },
  "instagram": {
    "title": "Visual Headline",
    "hook": "Strong first line before the 125-char ...more fold",
    "body": "Formatted body with value breakdown",
    "callToAction": "Save and share call to action",
    "hashtags": ["#niche1", "#niche2", "#niche3", "#niche4"],
    "searchKeywords": ["keyword 1", "keyword 2"],
    "strategyExplanation": "Why this maximizes Instagram Saves, Shares, and Dwell Time"
  },
  "youtube_shorts": {
    "title": "Punchy CTR Title with Emoji #Shorts",
    "hook": "Strong opening sentence",
    "body": "Search-optimized 2-line description with keywords",
    "callToAction": "Subscribe/Like/Comment CTA",
    "hashtags": ["#Shorts", "#niche1", "#niche2", "#niche3"],
    "searchKeywords": ["keyword 1", "keyword 2"],
    "tags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5"],
    "strategyExplanation": "How this targets YouTube search and feed click-through rate"
  },
  "x": {
    "hook": "Bold one-liner",
    "body": "Short punchy observation under 220 chars",
    "callToAction": "Quote/Reply prompt",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "searchKeywords": ["keyword 1"],
    "strategyExplanation": "Optimized for quick reading and reposts on X"
  },
  "threads": {
    "hook": "Relatable discussion opener",
    "body": "Conversational perspective",
    "callToAction": "Open community question",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "searchKeywords": ["keyword 1"],
    "strategyExplanation": "Triggers genuine community discussion on Threads"
  }
}`;
}

/**
 * Builds the user prompt summarizing video context for the LLM.
 */
export function buildCaptionUserPrompt(context: CaptionGenerationContext): string {
  const lines: string[] = [
    '## VIDEO CONTEXT FOR CAPTION GENERATION:',
    `- Video Title: ${context.sourceTitle}`,
    context.sourceChannel ? `- Source Channel / Creator: ${context.sourceChannel}` : '',
    context.genre ? `- Content Genre: ${context.genre}` : '',
    context.targetLanguage ? `- Language: ${context.targetLanguage}` : '',
    context.durationSeconds ? `- Output Duration: ${context.durationSeconds}s` : '',
  ];

  if (context.angle) {
    lines.push(
      '',
      '## EDITORIAL ANGLE & HOOK:',
      `- Editorial Angle: ${context.angle.title}`,
      context.angle.hook ? `- Video Opening Hook: ${context.angle.hook}` : '',
      context.angle.angleType ? `- Angle Type: ${context.angle.angleType}` : '',
    );
  }

  if (context.story?.concept || context.story?.premise) {
    lines.push(
      '',
      '## STORY ARC:',
      context.story.concept ? `- Concept: ${context.story.concept}` : '',
      context.story.premise ? `- Premise: ${context.story.premise}` : '',
    );
  }

  if (context.script?.sections && context.script.sections.length > 0) {
    lines.push(
      '',
      '## VIDEO SCRIPT NARRATION (What the viewer hears):',
      ...context.script.sections.map((s) => `[${s.type.toUpperCase()}]: ${s.text}`),
    );
  }

  if (context.clips && context.clips.length > 0) {
    lines.push(
      '',
      '## SELECTED VIRAL CLIPS / MOMENTS:',
      ...context.clips.map((c, i) => `Clip ${i + 1} (${c.start.toFixed(1)}s - ${c.end.toFixed(1)}s): ${c.title || 'Highlight'}`),
    );
  }

  if (context.transcriptSummary) {
    lines.push(
      '',
      '## TRANSCRIPT SUMMARY:',
      context.transcriptSummary,
    );
  }

  lines.push(
    '',
    'TASK: Generate platform-optimized viral captions for TikTok, Instagram Reels, YouTube Shorts, X, and Threads following the strict platform guidelines.',
  );

  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Formats a raw platform caption into a complete copy-paste ready string.
 */
export function assembleFormattedCaption(platform: SocialPlatform, item: {
  title?: string;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}): string {
  const cleanTags = (item.hashtags || [])
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');

  switch (platform) {
    case 'tiktok': {
      // Short & punchy, hook -> body -> CTA -> hashtags
      const parts = [
        item.hook,
        item.body,
        item.callToAction,
        cleanTags,
      ].filter(Boolean);
      return parts.join('\n\n');
    }

    case 'instagram': {
      // First line hook (before fold) -> body with line breaks -> CTA (save/share) -> hashtags
      const parts = [
        item.hook,
        item.body,
        `👉 ${item.callToAction}`,
        '---',
        cleanTags,
      ].filter(Boolean);
      return parts.join('\n\n');
    }

    case 'youtube_shorts': {
      // Title on top if present -> description body -> CTA -> hashtags
      const descParts = [
        item.hook,
        item.body,
        item.callToAction,
        cleanTags,
      ].filter(Boolean);
      return descParts.join('\n\n');
    }

    case 'x': {
      // Tight 280-char tweet
      const parts = [
        item.hook,
        item.body,
        item.callToAction,
        cleanTags,
      ].filter(Boolean);
      return parts.join('\n\n');
    }

    case 'threads': {
      // Conversational flow
      const parts = [
        item.hook,
        item.body,
        item.callToAction,
        cleanTags,
      ].filter(Boolean);
      return parts.join('\n\n');
    }

    default:
      return `${item.hook}\n\n${item.body}\n\n${item.callToAction}\n\n${cleanTags}`;
  }
}

/**
 * Builds standard fallback captions when LLM is unavailable or times out.
 */
export function generateFallbackCaptions(context: CaptionGenerationContext): VideoCaptionResult {
  const isIndo = context.targetLanguage === 'id' || context.targetLanguage === 'auto' || !context.targetLanguage;
  const rawTitle = context.angle?.title || context.sourceTitle || 'Momen Viral';
  const hookText = context.angle?.hook || (isIndo ? 'Gak nyangka banget kejadian ini beneran terjadi! 😱' : 'You won’t believe what happened here! 😱');
  const cleanTitle = rawTitle.slice(0, 50);

  const fallbackTiktok: PlatformCaption = {
    platform: 'tiktok',
    title: cleanTitle,
    hook: isIndo ? `${hookText} Simak sampai habis!` : `${hookText} Watch till the end!`,
    body: isIndo ? 'Momen krusial yang wajib kamu tahu.' : 'A crucial moment you need to see.',
    callToAction: isIndo ? 'Menurut kalian gimana? Tulis di kolom komentar! 👇' : 'What do you think? Let me know in the comments! 👇',
    hashtags: isIndo ? ['#fypindonesia', '#viral', '#trending', '#serunyabelajar'] : ['#trending', '#viral', '#mustwatch', '#learnontiktok'],
    formattedCaption: '',
    searchKeywords: [cleanTitle, 'video viral'],
    characterCount: 0,
    strategyExplanation: isIndo
      ? 'TikTok SEO: Menggunakan kata kunci pencarian di awal kalimat dan memancing komentar agar penonton berdiskusi saat video looping.'
      : 'TikTok SEO: Keyword-rich opening hook with a comment-trigger CTA to maximize watch time loop.',
    recommendedAudioVibe: 'Trending Suspense Beat',
  };
  fallbackTiktok.formattedCaption = assembleFormattedCaption('tiktok', fallbackTiktok);
  fallbackTiktok.characterCount = fallbackTiktok.formattedCaption.length;

  const fallbackInstagram: PlatformCaption = {
    platform: 'instagram',
    title: cleanTitle,
    hook: isIndo ? `🔥 ${hookText} (BACA CAPTION 👇)` : `🔥 ${hookText} (READ BELOW 👇)`,
    body: isIndo
      ? `Ringkasan penting dari video ini:\n• Momen: ${cleanTitle}\n• Insight: Fakta menarik yang patut dicermati.`
      : `Key takeaway from this video:\n• Moment: ${cleanTitle}\n• Insight: A fascinating fact worth noting.`,
    callToAction: isIndo
      ? '🔖 Simpan postingan ini buat nanti & share ke temen kamu yang butuh tahu ini!'
      : '🔖 Save this reel for later and share it with someone who needs to see this!',
    hashtags: isIndo ? ['#reelsindonesia', '#kontenviral', '#insight', '#faktamenarik'] : ['#reelsviral', '#trendingreels', '#dailyinsights', '#explorepage'],
    formattedCaption: '',
    searchKeywords: [cleanTitle, 'reels trending'],
    characterCount: 0,
    strategyExplanation: isIndo
      ? 'Instagram Reels: Hook 125 karakter pertama memancing klik "...more" untuk meningkatkan Dwell Time, dengan CTA khusus Save & Share.'
      : 'Instagram Reels: First line designed for fold click, emoji spacing for dwell time, and Save/Share ranking signals.',
  };
  fallbackInstagram.formattedCaption = assembleFormattedCaption('instagram', fallbackInstagram);
  fallbackInstagram.characterCount = fallbackInstagram.formattedCaption.length;

  const ytTitle = isIndo ? `${cleanTitle} 😱 #Shorts` : `${cleanTitle} 😱 #Shorts`;
  const fallbackShorts: PlatformCaption = {
    platform: 'youtube_shorts',
    title: ytTitle.length > 60 ? ytTitle.slice(0, 57) + '...' : ytTitle,
    hook: hookText,
    body: isIndo
      ? `Cuplikan viral seputar ${cleanTitle}. Tonton sampai habis untuk melihat momen terbaiknya.`
      : `Viral highlight regarding ${cleanTitle}. Watch until the end for the best moment.`,
    callToAction: isIndo ? 'Jangan lupa Like & Subscribe untuk update konten menarik lainnya! 👍' : 'Don’t forget to Like & Subscribe for more daily shorts! 👍',
    hashtags: ['#Shorts', '#YouTubeShorts', '#ViralShorts', '#Trending'],
    formattedCaption: '',
    searchKeywords: [cleanTitle, 'shorts viral', 'youtube shorts'],
    characterCount: 0,
    tags: [cleanTitle, 'shorts', 'viral', 'trending', 'highlight'],
    strategyExplanation: isIndo
      ? 'YouTube Shorts: Judul ber-CTR tinggi dilengkapi tag #Shorts, deskripsi ramah algoritma pencarian YouTube, dan CTA Subscribe.'
      : 'YouTube Shorts: High CTR title with #Shorts tag, searchable description for YouTube indexing, and subscription CTA.',
  };
  fallbackShorts.formattedCaption = assembleFormattedCaption('youtube_shorts', fallbackShorts);
  fallbackShorts.characterCount = fallbackShorts.formattedCaption.length;

  const fallbackX: PlatformCaption = {
    platform: 'x',
    hook: hookText,
    body: isIndo ? `Momen ini beneran bikin kaget: ${cleanTitle}` : `This moment was totally unexpected: ${cleanTitle}`,
    callToAction: isIndo ? 'Setuju gak sama ini? RT & share pendapat kalian.' : 'Agree or disagree? Quote/RT with your thoughts.',
    hashtags: isIndo ? ['#ViralID', '#Trending'] : ['#Viral', '#Trending'],
    formattedCaption: '',
    searchKeywords: [cleanTitle],
    characterCount: 0,
    strategyExplanation: isIndo
      ? 'X (Twitter): Kalimat lugas di bawah 280 karakter dengan pemicu Retweet/Quote diskusi.'
      : 'X (Twitter): Snappy under 280 chars with debate/quote prompt for high viral distribution.',
  };
  fallbackX.formattedCaption = assembleFormattedCaption('x', fallbackX);
  fallbackX.characterCount = fallbackX.formattedCaption.length;

  const fallbackThreads: PlatformCaption = {
    platform: 'threads',
    hook: isIndo ? `Jujur kaget banget pas liat ini... 😳` : `Honestly didn’t expect this at all... 😳`,
    body: isIndo
      ? `Tentang ${cleanTitle}. Menurut kalian hal kayak gini wajar atau gak?`
      : `Regarding ${cleanTitle}. Do you think something like this is common or not?`,
    callToAction: isIndo ? 'Drop pendapat kalian di bawah yuk! 👇' : 'Drop your thoughts below! 👇',
    hashtags: isIndo ? ['#ceritahariini', '#viral'] : ['#trending', '#discussion'],
    formattedCaption: '',
    searchKeywords: [cleanTitle],
    characterCount: 0,
    strategyExplanation: isIndo
      ? 'Threads: Gaya obrolan personal dan santai yang memicu thread balasan panjang.'
      : 'Threads: Conversational community tone to drive deep reply chains.',
  };
  fallbackThreads.formattedCaption = assembleFormattedCaption('threads', fallbackThreads);
  fallbackThreads.characterCount = fallbackThreads.formattedCaption.length;

  return {
    videoId: context.videoId,
    jobId: context.jobId,
    sourceTitle: context.sourceTitle,
    channelName: context.sourceChannel,
    language: isIndo ? 'id' : 'en',
    tone: context.tone || 'viral_hype',
    captions: {
      tiktok: fallbackTiktok,
      instagram: fallbackInstagram,
      youtube_shorts: fallbackShorts,
      x: fallbackX,
      threads: fallbackThreads,
    },
    generatedAt: new Date().toISOString(),
  };
}
