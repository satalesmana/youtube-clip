import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';
import type { ITTSProvider } from '../providers/tts/tts.provider.js';
import type { TTSSectionTiming, TTSSynthesisResult } from '../providers/tts/tts.types.js';
import type { IWordTimingService } from './word-timing.service.js';
import type { OriginalScript } from '../types/script.js';
import { normalizeForSpeech } from '../utils/speech-normalizer.js';

export interface TtsServiceOptions {
  voice: string;
  rate?: string;
  outputDir: string;
  /** Optional language hint passed to the provider. */
  language?: string;
  /**
   * Optional aligner used to recover per-word timings from providers that do
   * not expose native word boundaries (e.g. OpenAI `tts-1`). Without it those
   * providers fall back to estimated caption timing in the planner.
   */
  wordAligner?: IWordTimingService;
  /** Directory where reusable per-section TTS audio cache is stored. */
  cacheDir?: string;
}

export interface ITtsService {
  synthesizeScript(script: OriginalScript, workspaceDir: string): Promise<TTSSynthesisResult>;
  synthesizeSection(
    section: { type: string; text: string; spokenText?: string },
    language?: string,
    outputPath?: string,
  ): Promise<TTSSynthesisResult>;
}

/**
 * Facade over any TTS provider. Turns an original script into narration
 * audio, with automatic per-section audio caching. Sections that haven't changed
 * are served from disk cache in milliseconds without calling TTS APIs.
 */
export class TtsService implements ITtsService {
  private readonly cacheDir: string;

  constructor(
    private readonly provider: ITTSProvider,
    private readonly options: TtsServiceOptions,
    private readonly logger: Logger,
  ) {
    this.cacheDir = options.cacheDir ?? join(options.outputDir, 'tts-cache');
  }

  /**
   * Synthesizes audio for a single section with persistent disk caching.
   * If an identical section (text, voice, rate, language, provider) has already
   * been synthesized, returns the cached audio and word timings instantly.
   */
  async synthesizeSection(
    section: { type: string; text: string; spokenText?: string },
    language?: string,
    outputPath?: string,
  ): Promise<TTSSynthesisResult> {
    const textToSynthesize = section.spokenText?.trim()
      ? section.spokenText.trim()
      : normalizeForSpeech(section.text.trim(), language ?? this.options.language ?? 'id');

    await ensureDir(this.cacheDir);

    const sectionHash = createHash('sha256')
      .update(
        JSON.stringify([
          this.provider.kind,
          this.options.voice,
          this.options.rate ?? '+0%',
          this.options.language ?? language ?? 'id',
          textToSynthesize,
        ]),
      )
      .digest('hex');

    const cachedAudioPath = join(this.cacheDir, `${sectionHash}.mp3`);
    const cachedMetaPath = join(this.cacheDir, `${sectionHash}.json`);
    const finalOutPath = outputPath ?? cachedAudioPath;

    // Check disk cache
    try {
      const [audioStat, metaStat] = await Promise.all([
        stat(cachedAudioPath),
        stat(cachedMetaPath),
      ]);
      if (audioStat.isFile() && audioStat.size > 0 && metaStat.isFile() && metaStat.size > 0) {
        const raw = await readFile(cachedMetaPath, 'utf8');
        const meta = JSON.parse(raw) as {
          durationSeconds: number;
          wordTimings?: Array<{ word: string; start: number; end: number }>;
          provider?: string;
        };

        if (finalOutPath !== cachedAudioPath) {
          await copyFile(cachedAudioPath, finalOutPath);
        }

        this.logger.debug(
          { type: section.type, hash: sectionHash.slice(0, 8), duration: meta.durationSeconds },
          'TTS section served from cache',
        );

        return {
          outputPath: finalOutPath,
          durationSeconds: meta.durationSeconds,
          wordTimings: meta.wordTimings ?? [],
          provider: meta.provider ?? this.provider.kind,
        };
      }
    } catch {
      // Miss or invalid cache
    }

    // Cache miss: synthesize with provider
    this.logger.info(
      { provider: this.provider.kind, voice: this.options.voice, type: section.type, hash: sectionHash.slice(0, 8) },
      'Synthesizing TTS section via provider (cache miss)',
    );

    const tempDir = join(this.cacheDir, '.tmp');
    await ensureDir(tempDir);
    const tempAudio = join(tempDir, `${sectionHash}-${Date.now()}.mp3`);

    const result = await this.provider.synthesize({
      text: textToSynthesize,
      voice: this.options.voice,
      rate: this.options.rate,
      outputPath: tempAudio,
      language: this.options.language ?? language,
    });

    // Word alignment if needed
    let wordTimings = result.wordTimings ?? [];
    if (wordTimings.length === 0 && this.options.wordAligner) {
      const alignDir = join(this.cacheDir, '.align');
      await ensureDir(alignDir);
      wordTimings = await this.options.wordAligner.align(
        tempAudio,
        textToSynthesize,
        alignDir,
      );
      if (wordTimings.length > 0) {
        this.logger.info(
          { type: section.type, words: wordTimings.length },
          'Recovered narration word timings via Whisper alignment',
        );
      }
    }

    // Save to permanent cache
    await copyFile(tempAudio, cachedAudioPath);
    await writeFile(
      cachedMetaPath,
      JSON.stringify(
        {
          durationSeconds: result.durationSeconds,
          wordTimings,
          provider: result.provider ?? this.provider.kind,
          text: textToSynthesize,
          voice: this.options.voice,
          savedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );

    if (finalOutPath !== cachedAudioPath) {
      await copyFile(cachedAudioPath, finalOutPath);
    }

    return {
      outputPath: finalOutPath,
      durationSeconds: result.durationSeconds,
      wordTimings,
      provider: result.provider ?? this.provider.kind,
    };
  }

  async synthesizeScript(script: OriginalScript, workspaceDir: string): Promise<TTSSynthesisResult> {
    const voiceDir = join(workspaceDir, 'voice');
    await ensureDir(voiceDir);

    const narrationSections = script.sections.filter((s) => s.text.trim().length > 0);
    if (narrationSections.length === 0) {
      throw new Error('Script has no narration text to synthesize.');
    }

    this.logger.info(
      { provider: this.provider.kind, voice: this.options.voice, sectionCount: narrationSections.length },
      'Synthesizing script narration',
    );

    const results: TTSSynthesisResult[] = [];
    const sectionTimings: TTSSectionTiming[] = [];
    let offset = 0;
    for (let index = 0; index < narrationSections.length; index += 1) {
      const section = narrationSections[index]!;
      const safeName = section.type.replace(/[^a-z0-9]+/gi, '-');
      const outPath = join(voiceDir, `narration-${String(index).padStart(2, '0')}-${safeName}.mp3`);

      const result = await this.synthesizeSection(section, script.language, outPath);
      results.push(result);

      const wordTimings = result.wordTimings ?? [];
      const absoluteTimings = wordTimings.map((w) => ({
        word: w.word,
        start: Number((offset + w.start).toFixed(3)),
        end: Number((offset + w.end).toFixed(3)),
      }));
      sectionTimings.push({
        type: section.type,
        durationSeconds: result.durationSeconds,
        wordTimings: absoluteTimings,
      });
      offset += result.durationSeconds;
    }

    // Concatenate all sections into a single narration file.
    const combinedPath = join(voiceDir, 'narration.mp3');
    await this.concatenate(results.map((r) => r.outputPath), combinedPath);

    const totalDuration = results.reduce((sum, r) => sum + r.durationSeconds, 0);

    this.logger.info(
      { sectionCount: results.length, totalDurationSeconds: totalDuration, combinedPath },
      'Narration synthesis complete',
    );

    return {
      outputPath: combinedPath,
      durationSeconds: totalDuration,
      provider: this.provider.kind,
      sections: sectionTimings,
    };
  }

  private async concatenate(inputs: string[], outputPath: string): Promise<void> {
    const { runCommand } = await import('../utils/exec.js');
    const listPath = `${outputPath}.list.txt`;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(listPath, inputs.map((p) => `file '${p}'`).join('\n'));

    try {
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', listPath,
          '-c', 'copy',
          outputPath,
        ],
        { logger: this.logger },
      );
    } catch (copyErr) {
      this.logger.warn({ err: copyErr }, 'FFmpeg concat -c copy failed, falling back to re-encoding');
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', listPath,
          '-c:a', 'libmp3lame',
          '-q:a', '2',
          outputPath,
        ],
        { logger: this.logger },
      );
    }
  }
}
