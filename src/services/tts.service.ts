import { join } from 'node:path';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';
import type { ITTSProvider } from '../providers/tts/tts.provider.js';
import type { TTSSectionTiming, TTSSynthesisResult } from '../providers/tts/tts.types.js';
import type { IWordTimingService } from './word-timing.service.js';
import type { OriginalScript } from '../types/script.js';

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
}

export interface ITtsService {
  synthesizeScript(script: OriginalScript, workspaceDir: string): Promise<TTSSynthesisResult>;
}

/**
 * Facade over any TTS provider. Turns an original script into narration
 * audio, one file per section (kept for timeline mapping), plus a single
 * concatenated narration file. Never fails the pipeline: when synthesis
 * fails, it throws an AppError that callers can catch to degrade gracefully.
 */
export class TtsService implements ITtsService {
  constructor(
    private readonly provider: ITTSProvider,
    private readonly options: TtsServiceOptions,
    private readonly logger: Logger,
  ) {}

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
    const alignDir = join(voiceDir, '.align');
    let offset = 0;
    for (const section of narrationSections) {
      const safeName = section.type.replace(/[^a-z0-9]+/gi, '-');
      const outPath = join(voiceDir, `narration-${safeName}.mp3`);
      const result = await this.provider.synthesize({
        text: section.text,
        voice: this.options.voice,
        rate: this.options.rate,
        outputPath: outPath,
        language: this.options.language,
      });
      results.push(result);

      // When the provider does not expose word boundaries natively (OpenAI
      // tts-1), recover them by re-transcribing the audio with Whisper.
      let wordTimings = result.wordTimings ?? [];
      if (wordTimings.length === 0 && this.options.wordAligner) {
        await ensureDir(alignDir);
        wordTimings = await this.options.wordAligner.align(
          outPath,
          section.text,
          alignDir,
        );
        if (wordTimings.length > 0) {
          this.logger.info(
            { type: section.type, words: wordTimings.length },
            'Recovered narration word timings via Whisper alignment',
          );
        }
      }

      // Map each section's word boundaries onto the combined narration
      // timeline so the composition can highlight words in sync with the
      // voice instead of guessing with even distribution.
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

    await runCommand('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath,
    ], { logger: this.logger });
  }
}
