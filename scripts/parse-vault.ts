export interface CliArgs {
  vaultDir: string;
  outPath: string;
  version: string;
}

export function parseArgs(argv: string[]): CliArgs {
  let vaultDir: string | undefined;
  let outPath = 'public/cards.json';
  let version: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') outPath = argv[++i];
    else if (a === '--version') version = argv[++i];
    else if (!a.startsWith('-')) vaultDir ??= a;
  }

  if (!vaultDir) {
    throw new Error('Usage: parse <vault-dir> [-o public/cards.json] [--version <str>]');
  }
  return { vaultDir, outPath, version: version ?? new Date().toISOString() };
}
