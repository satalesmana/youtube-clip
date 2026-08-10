import { runCommand } from './exec.js';
import { AppError } from './errors.js';
import type { Logger } from './logger.js';

export interface ExtractAudioOptions {
  binaryPath: string;
  inputPath: string;
  outputPath: string;
  sampleRateHz?: number;
  channels?: number;
  logger?: Logger;
}

/**
 * Extracts a mono, 16kHz WAV audio track from a video file using FFmpeg.
 * Overwrites the output file if it already exists.
 */
export async function extractAudio(options: ExtractAudioOptions): Promise<void> {
  const { binaryPath, inputPath, outputPath, sampleRateHz = 16_000, channels = 1, logger } = options;

  const args = [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-acodec',
    'pcm_s16le',
    '-ar',
    String(sampleRateHz),
    '-ac',
    String(channels),
    outputPath,
  ];

  try {
    await runCommand(binaryPath, args, { logger });
  } catch (error) {
    throw AppError.ffmpegFailed(
      `Failed to extract audio from "${inputPath}" using FFmpeg.`,
      error,
    );
  }
}

export interface ProbeDurationOptions {
  binaryPath: string;
  inputPath: string;
  logger?: Logger;
}

/** Reads the duration (in seconds) of a media file using `ffprobe`-style output from FFmpeg. */
export async function probeDurationSeconds({
  binaryPath,
  inputPath,
  logger,
}: ProbeDurationOptions): Promise<number> {
  try {
    // FFmpeg prints duration info to stderr when given no output; parse it from there.
    const { stderr } = await runCommand(binaryPath, ['-i', inputPath], { logger }).catch((error: Error) => ({
      stdout: '',
      stderr: error.message,
      exitCode: 1,
    }));

    const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    if (!match) return 0;

    const [, hours, minutes, seconds] = match as unknown as [string, string, string, string];
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  } catch {
    return 0;
  }
}

export interface VideoResolution {
  width: number;
  height: number;
}

/** Reads a video's frame resolution by parsing FFmpeg's own `-i` stderr banner. */
export async function probeResolution({
  binaryPath,
  inputPath,
}: ProbeDurationOptions): Promise<VideoResolution | null> {
  const { stderr } = await runCommand(binaryPath, ['-i', inputPath]).catch((error: Error) => ({
    stdout: '',
    stderr: error.message,
    exitCode: 1,
  }));

  const videoLine = stderr.split('\n').find((line) => line.includes('Video:'));
  if (!videoLine) return null;

  const match = /(\d{2,5})x(\d{2,5})/.exec(videoLine);
  if (!match) return null;

  const [, width, height] = match as unknown as [string, string, string];
  return { width: Number(width), height: Number(height) };
}

export interface SilenceInterval {
  start: number;
  end: number;
}

export interface DetectSilencesOptions {
  binaryPath: string;
  inputPath: string;
  noiseThresholdDb?: number;
  minDurationSeconds?: number;
}

/**
 * Detects silent intervals in a media file's audio track via FFmpeg's
 * `silencedetect` filter, used to find safe padding room around a clip
 * boundary without cutting into speech.
 */
export async function detectSilences({
  binaryPath,
  inputPath,
  noiseThresholdDb = -30,
  minDurationSeconds = 0.3,
}: DetectSilencesOptions): Promise<SilenceInterval[]> {
  const { stderr } = await runCommand(binaryPath, [
    '-i',
    inputPath,
    '-af',
    `silencedetect=noise=${noiseThresholdDb}dB:d=${minDurationSeconds}`,
    '-f',
    'null',
    '-',
  ]).catch((error: Error) => ({ stdout: '', stderr: error.message, exitCode: 1 }));

  const intervals: SilenceInterval[] = [];
  let pendingStart: number | null = null;

  for (const line of stderr.split('\n')) {
    const startMatch = /silence_start:\s*(-?\d+(?:\.\d+)?)/.exec(line);
    if (startMatch) {
      pendingStart = Number(startMatch[1]);
      continue;
    }

    const endMatch = /silence_end:\s*(-?\d+(?:\.\d+)?)/.exec(line);
    if (endMatch && pendingStart !== null) {
      intervals.push({ start: pendingStart, end: Number(endMatch[1]) });
      pendingStart = null;
    }
  }

  return intervals;
}

export interface ExtractFrameOptions {
  binaryPath: string;
  inputPath: string;
  timestampSeconds: number;
  outputPath: string;
  logger?: Logger;
}

/** Extracts a single frame at `timestampSeconds` as a JPEG. */
export async function extractFrame({
  binaryPath,
  inputPath,
  timestampSeconds,
  outputPath,
  logger,
}: ExtractFrameOptions): Promise<void> {
  try {
    await runCommand(
      binaryPath,
      [
        '-y',
        '-ss',
        timestampSeconds.toFixed(3),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outputPath,
      ],
      { logger },
    );
  } catch (error) {
    throw AppError.ffmpegFailed(`Failed to extract a frame from "${inputPath}".`, error);
  }
}

/**
 * Escapes a filesystem path for safe embedding inside an FFmpeg `-vf`
 * filtergraph argument (e.g. `ass='<escaped path>'`), where backslashes,
 * colons, and single quotes are otherwise interpreted by the filter parser.
 */
export function escapeFfmpegFilterPath(path: string): string {
  return path.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\\\''");
}
