import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type VaultFile } from '../src/lib/obsidian.ts';

const EXCLUDE_DIRS = new Set(['node_modules']);

export function collectMarkdownFiles(dir: string): VaultFile[] {
  const out: VaultFile[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        out.push({ name: entry.name, content: readFileSync(full, 'utf-8') });
      }
    }
  };
  walk(dir);
  return out;
}

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
