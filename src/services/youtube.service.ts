import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { runCommand, CommandError } from '../utils/exec.js';
import { retry } from '../utils/retry.js';
import { ensureDir } from '../utils/fs.js';
import { AppError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import type { DownloadResult } from '../types/media.js';
import type { JobWorkspace } from '../types/job.js';

// Unlikely to appear in a video title; used to delimit fields printed by yt-dlp.
const FIELD_SEPARATOR = '␟';

export interface YoutubeServiceOptions {
  binaryPath: string;
  downloadsDir: string;
  maxRetries: number;
  /** Extra CLI args passed straight through to yt-dlp, e.g. `--cookies-from-browser chrome`. */
  extraArgs?: string[];
}

/** Downloads YouTube videos to local disk. */
export interface IYoutubeService {
  downloadVideo(url: string, workspace?: Pick<JobWorkspace, 'downloads'>): Promise<DownloadResult>;
}

/** yt-dlp-backed implementation of {@link IYoutubeService}. */
export class YoutubeService implements IYoutubeService {
  constructor(
    private readonly options: YoutubeServiceOptions,
    private readonly logger: Logger,
  ) {}

  /**
   * Downloads the highest-quality available version of a YouTube video,
   * merging separate video/audio streams into a single file. Retries the
   * whole download (metadata + fetch) on transient failures.
   */
  async downloadVideo(url: string, workspace?: Pick<JobWorkspace, 'downloads'>): Promise<DownloadResult> {
    const downloadsDir = workspace?.downloads ?? this.options.downloadsDir;
    await ensureDir(downloadsDir);

    this.logger.info({ url }, 'Download started');

    const result = await retry(() => this.runDownload(url, downloadsDir), {
      attempts: this.options.maxRetries,
      onRetry: (error, attempt) => {
        this.logger.warn({ url, attempt, err: error }, 'Retrying video download');
      },
    });

    this.logger.info({ url, videoPath: result.videoPath }, 'Download completed');

    return result;
  }

  /**
   * Runs yt-dlp once, requesting the merged file's real on-disk path via
   * `--print after_move:filepath` so we never have to guess the final
   * container extension (which depends on whether merging happened at all).
   */
  private async runDownload(url: string, downloadsDir: string): Promise<DownloadResult> {
    try {
      const template = ['%(id)s', '%(title)s', '%(duration)s', '%(filepath)s'].join(
        FIELD_SEPARATOR,
      );

      const { stdout } = await runCommand(
        this.options.binaryPath,
        [
          '-f',
          'bestvideo*+bestaudio/best',
          '--merge-output-format',
          'mp4',
          '--no-playlist',
          '--no-warnings',
          '--continue',
          ...(this.options.extraArgs ?? []),
          '-o',
          join(downloadsDir, '%(id)s.%(ext)s'),
          '--print',
          `after_move:${template}`,
          url,
        ],
        { logger: this.logger },
      );

      const lastLine = stdout.trim().split('\n').at(-1) ?? '';
      const [videoId, title, duration, videoPath] = lastLine.split(FIELD_SEPARATOR);

      if (!videoId || !videoPath) {
        throw new Error(`Unexpected yt-dlp output, could not determine downloaded file: ${stdout}`);
      }

      // yt-dlp can report success and print the intended merged filepath even
      // when the merge postprocessor silently didn't run (e.g. no local
      // FFmpeg to merge separate video/audio streams). Fail fast here with a
      // clear message instead of surfacing a confusing error at a later stage.
      await access(videoPath).catch(() => {
        throw new Error(
          `yt-dlp reported "${videoPath}" but the file does not exist. This usually means ` +
            'FFmpeg is missing or failed while merging separate video/audio streams.',
        );
      });

      return {
        videoId,
        videoPath,
        title: title || videoId,
        durationSeconds: Number(duration) || 0,
      };
    } catch (error) {
      if (error instanceof CommandError && /sign in to confirm you.re not a bot/i.test(error.stderr)) {
        throw AppError.downloadFailed(
          `Failed to download video "${url}": YouTube is requiring bot-check authentication. ` +
            'Pass browser cookies via YT_DLP_EXTRA_ARGS in .env, e.g. ' +
            `YT_DLP_EXTRA_ARGS="--cookies-from-browser chrome" (see yt-dlp's cookies FAQ).`,
          error,
        );
      }

      throw AppError.downloadFailed(`Failed to download video "${url}".`, error);
    }
  }
}
