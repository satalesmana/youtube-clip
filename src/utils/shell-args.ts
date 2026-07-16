/**
 * Splits a raw shell-style argument string into an argv array, honoring
 * single/double-quoted segments (so paths or values containing spaces can be
 * quoted). Used for user-supplied extra CLI flags read from `.env`.
 */
export function parseShellArgs(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(trimmed)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3] ?? '');
  }

  return args;
}
