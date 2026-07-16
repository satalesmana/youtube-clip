import { defineNitroConfig } from 'nitropack/config';

export default defineNitroConfig({
  compatibilityDate: '2025-01-01',
  srcDir: 'server',
  imports: {
    autoImport: false,
  },
  alias: {
    '~': './src',
  },
  runtimeConfig: {
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:14b',
      temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.2),
      timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000),
      maxRetries: Number(process.env.OLLAMA_MAX_RETRIES ?? 3),
    },
    whisper: {
      provider: process.env.WHISPER_PROVIDER || 'faster-whisper',
      binaryPath: process.env.WHISPER_BINARY_PATH || 'whisper',
      model: process.env.WHISPER_MODEL || 'base',
      language: process.env.WHISPER_LANGUAGE || 'auto',
    },
    ytDlp: {
      binaryPath: process.env.YT_DLP_BINARY_PATH || 'yt-dlp',
      maxRetries: Number(process.env.YT_DLP_MAX_RETRIES ?? 3),
    },
    ffmpeg: {
      binaryPath: process.env.FFMPEG_BINARY_PATH || 'ffmpeg',
    },
    paths: {
      downloads: process.env.DOWNLOADS_DIR || 'downloads',
      transcripts: process.env.TRANSCRIPTS_DIR || 'transcripts',
      outputs: process.env.OUTPUTS_DIR || 'outputs',
      temp: process.env.TEMP_DIR || 'temp',
    },
    chunking: {
      maxTokensPerChunk: Number(process.env.CHUNK_MAX_TOKENS ?? 2500),
      overlapSeconds: Number(process.env.CHUNK_OVERLAP_SECONDS ?? 18),
    },
    highlight: {
      minClipSeconds: Number(process.env.HIGHLIGHT_MIN_SECONDS ?? 20),
      maxClipSeconds: Number(process.env.HIGHLIGHT_MAX_SECONDS ?? 60),
      topN: Number(process.env.HIGHLIGHT_TOP_N ?? 10),
    },
    logLevel: process.env.LOG_LEVEL || 'info',
    public: {},
  },
});
