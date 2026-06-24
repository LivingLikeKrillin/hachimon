export interface InboxArgs {
  inboxDir: string;
  outDir: string;
  deckSource: string;
  model: string;
  dryRun: boolean;
  keep: boolean;
}

const USAGE =
  'Usage: inbox <inbox-dir> [-o _forge-drafts] [--deck-source public/cards.json] [--model claude-opus-4-8] [--dry-run] [--keep]';

export function parseArgs(argv: string[]): InboxArgs {
  let inboxDir: string | undefined;
  let outDir = '_forge-drafts';
  let deckSource = 'public/cards.json';
  let model = 'claude-opus-4-8';
  let dryRun = false;
  let keep = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      outDir = argv[++i];
    } else if (a === '--deck-source') {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      deckSource = argv[++i];
    } else if (a === '--model') {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      model = argv[++i];
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--keep') {
      keep = true;
    } else if (!a.startsWith('-')) {
      inboxDir ??= a;
    }
  }

  if (!inboxDir) throw new Error(USAGE);
  return { inboxDir, outDir, deckSource, model, dryRun, keep };
}
