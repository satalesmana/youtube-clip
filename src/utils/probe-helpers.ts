import { runCommand } from './exec.js';

/** Probe whether an audio track exists in the video file. */
export async function probeAudioPresent({
  binaryPath = 'ffprobe',
  inputPath,
}: {
  binaryPath?: string;
  inputPath: string;
}): Promise<boolean> {
  try {
    const { stdout } = await runCommand(binaryPath, [
      '-v', 'quiet',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      inputPath,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Probe whether a video track exists in the video file. */
export async function probeVideoPresent({
  binaryPath = 'ffprobe',
  inputPath,
}: {
  binaryPath?: string;
  inputPath: string;
}): Promise<boolean> {
  try {
    const { stdout } = await runCommand(binaryPath, [
      '-v', 'quiet',
      '-select_streams', 'v',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      inputPath,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}
