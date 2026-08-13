import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { extractAudio, probeDurationSeconds } from '../utils/ffmpeg.js';
import { ensureDir } from '../utils/fs.js';
import { estimateTokens } from '../utils/timestamp.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { AudioExtractionResult } from '../types/media.js';
import type { JobWorkspace } from '../types/job.js';
import type {
  TranscriptChunk,
  TranscriptDocument,
  TranscriptResult,
  TranscriptSegment,
} from '../types/transcript.js';

export interface TranscriptServiceOptions {
  ffmpegBinaryPath: string;
  tempDir: string;
  transcriptsDir: string;
  chunkMaxTokens: number;
  chunkOverlapSeconds: number;
}

/**
 * Handles audio extraction, transcript persistence, and splitting a full
 * transcript into LLM-sized chunks with time-based overlap.
 */
export interface ITranscriptService {
  loadTranscript(videoId: string): Promise<TranscriptDocument | null>;
  extractAudio(
    videoPath: string,
    videoId: string,
    workspace?: Pick<JobWorkspace, 'temp'>,
  ): Promise<AudioExtractionResult>;
  saveTranscript(
    document: TranscriptDocument,
    workspace?: Pick<JobWorkspace, 'transcripts'>,
  ): Promise<string>;
  chunkTranscript(result: TranscriptResult): TranscriptChunk[];
}

export class TranscriptService implements ITranscriptService {
  constructor(
    private readonly options: TranscriptServiceOptions,
    private readonly logger: Logger,
  ) {}

  /** Extracts a mono 16kHz WAV track from the given video file via FFmpeg. */
  async extractAudio(
    videoPath: string,
    videoId: string,
    workspace?: Pick<JobWorkspace, 'temp'>,
  ): Promise<AudioExtractionResult> {
    const tempDir = workspace?.temp ?? this.options.tempDir;
    await ensureDir(tempDir);

    const audioPath = join(tempDir, `${videoId}.wav`);
    this.logger.info({ videoPath, audioPath }, 'Extracting audio');

    await extractAudio({
      binaryPath: this.options.ffmpegBinaryPath,
      inputPath: videoPath,
      outputPath: audioPath,
      sampleRateHz: 16_000,
      channels: 1,
      logger: this.logger,
    });

    const durationSeconds = await probeDurationSeconds({
      binaryPath: this.options.ffmpegBinaryPath,
      inputPath: audioPath,
    });

    return { audioPath, durationSeconds };
  }

  /** Loads a saved transcript by video ID. */
  async loadTranscript(videoId: string): Promise<TranscriptDocument | null> {
    const transcriptPath = join(this.options.transcriptsDir, `${videoId}.json`);
    try {
      const data = await readFile(transcriptPath, 'utf-8');
      return JSON.parse(data) as TranscriptDocument;
    } catch {
      return null;
    }
  }

  /** Persists a transcript document as JSON under the transcripts directory. */
  async saveTranscript(
    document: TranscriptDocument,
    workspace?: Pick<JobWorkspace, 'transcripts'>,
  ): Promise<string> {
    const transcriptsDir = workspace?.transcripts ?? this.options.transcriptsDir;
    await ensureDir(transcriptsDir);

    const transcriptPath = join(transcriptsDir, `${document.videoId}.json`);

    try {
      await writeFile(transcriptPath, JSON.stringify(document, null, 2), 'utf-8');
    } catch (error) {
      throw AppError.filePermissionError(`Failed to write transcript to "${transcriptPath}".`, error);
    }

    return transcriptPath;
  }

  /**
   * Splits transcript segments into chunks of roughly `chunkMaxTokens` tokens,
   * carrying the trailing `chunkOverlapSeconds` of context into the next
   * chunk. Chunks always break on segment boundaries, never mid-sentence.
   */
  chunkTranscript(result: TranscriptResult): TranscriptChunk[] {
    const { chunkMaxTokens, chunkOverlapSeconds } = this.options;
    const chunks: TranscriptChunk[] = [];

    let current: TranscriptSegment[] = [];
    let currentTokens = 0;

    const flush = (): void => {
      if (current.length === 0) return;
      const first = current[0]!;
      const last = current[current.length - 1]!;
      chunks.push({
        index: chunks.length,
        startTime: first.start,
        endTime: last.end,
        text: current.map((segment) => segment.text).join(' '),
        segments: current,
        approxTokens: currentTokens,
      });
    };

    for (const segment of result.segments) {
      const segmentTokens = estimateTokens(segment.text);

      if (current.length > 0 && currentTokens + segmentTokens > chunkMaxTokens) {
        flush();

        const lastEnd = current[current.length - 1]!.end;
        const overlapSegments = current.filter((s) => s.end >= lastEnd - chunkOverlapSeconds);
        current = [...overlapSegments];
        currentTokens = overlapSegments.reduce((sum, s) => sum + estimateTokens(s.text), 0);
      }

      current.push(segment);
      currentTokens += segmentTokens;
    }

    flush();

    this.logger.info({ chunkCount: chunks.length }, 'Chunking transcript');
    return chunks;
  }
}
