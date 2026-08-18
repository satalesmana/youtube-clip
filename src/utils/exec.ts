import { spawn } from 'node:child_process';
import type { Logger } from './logger.js';

export interface RunCommandOptions {
  cwd?: string;
  /** Environment overrides for the spawned process. */
  env?: Record<string, string | undefined>;
  logger?: Logger;
  /** Called with each stdout/stderr line as the process runs, for progress logging. */
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Thrown when a spawned command exits non-zero; carries its raw stdout/stderr for callers that need them structurally. */
export class CommandError extends Error {
  constructor(
    message: string,
    readonly stdout: string,
    readonly stderr: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/**
 * Runs an external binary as a child process without buffering its full
 * output in memory beyond what's needed for the final result, and streams
 * output line-by-line to the logger/callback as it arrives.
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const { cwd, env, logger, onLine } = options;

  const argsLog = args.join(' ')
  logger?.info({ command, argsLog }, 'runCommand');

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env });

    let stdout = '';
    let stderr = '';

    const handleChunk = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      if (stream === 'stdout') stdout += text;
      else stderr += text;

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        logger?.debug({ stream }, trimmed);
        onLine?.(trimmed, stream);
      }
    };

    child.stdout.on('data', handleChunk('stdout'));
    child.stderr.on('data', handleChunk('stderr'));

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn "${command}": ${error.message}`, { cause: error }));
    });

    child.on('close', (exitCode) => {
      const code = exitCode ?? -1;
      if (code !== 0) {
        reject(
          new CommandError(
            `Command "${command} ${args.join(' ')}" exited with code ${code}:\n${stderr || stdout}`,
            stdout,
            stderr,
            code,
          ),
        );
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

/** Checks whether a binary is available on PATH by attempting to run `<command> --version`. */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await runCommand(command, ['--version']);
    return true;
  } catch {
    return false;
  }
}
