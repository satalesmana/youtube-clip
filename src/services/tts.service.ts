import { join } from 'node:path';
import { ensureDir } from '../utils/fs.js';
import type { Logger } from '../utils/logger.js';
import type { ITTSProvider } from '../providers/tts/tts.provider.js';
import type { TTSSynthesisResult } from '../providers/tts/tts.types.js';
import type { OriginalScript } from '../types/script.js';

export interface TtsServiceOptions {
  voice: string;
  rate?: string;
  outputDir: string;
  /** Optional language hint passed to the provider. */
  language?: string;
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

    const sections = script.sections.filter((s) => s.text.trim().length > 0);
    if (sections.length === 0) {
      throw new Error('Script has no narration text to synthesize.');
    }

    this.logger.info(
      { provider: this.provider.kind, voice: this.options.voice, sectionCount: sections.length },
      'Synthesizing script narration',
    );

    const results: TTSSynthesisResult[] = [];
    for (const section of sections) {
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
