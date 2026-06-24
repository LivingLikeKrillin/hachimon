import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';
import { replaceImageRefs } from '../src/lib/images.ts';

const EXCLUDE_DIRS = new Set(['node_modules']);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** vault의 이미지 파일을 basename→절대경로로 인덱싱(첫 매치 우선, 중복 경고). */
export function collectImageFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(full);
      } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
        if (out.has(entry.name)) console.warn(`⚠ 중복 이미지 파일명: ${entry.name}`);
        else out.set(entry.name, full);
      }
    }
  };
  walk(dir);
  return out;
}

/** 이미지 파일 → 최적화 data URI. svg는 벡터 보존, 그 외는 sharp 리사이즈+WebP. */
async function optimizeToDataUri(absPath: string): Promise<string> {
  if (absPath.toLowerCase().endsWith('.svg')) {
    return `data:image/svg+xml;base64,${readFileSync(absPath).toString('base64')}`;
  }
  const buf = await sharp(absPath).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const b64 = buf.toString('base64');
  if (b64.length > 200_000) {
    console.warn(`⚠ 큰 이미지(${Math.round(b64.length / 1024)}KB): ${path.basename(absPath)}`);
  }
  return `data:image/webp;base64,${b64}`;
}

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

const USAGE = 'Usage: parse <vault-dir> [-o public/cards.json] [--version <str>]';

export function parseArgs(argv: string[]): CliArgs {
  let vaultDir: string | undefined;
  let outPath = 'public/cards.json';
  let version: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // 값을 요구하는 플래그: 뒤에 값이 없으면 명확한 usage 에러
    if (a === '-o' || a === '--out') {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      outPath = argv[++i];
    } else if (a === '--version') {
      if (i + 1 >= argv.length) throw new Error(USAGE);
      version = argv[++i];
    } else if (!a.startsWith('-')) {
      vaultDir ??= a;
    }
  }

  if (!vaultDir) throw new Error(USAGE);
  return { vaultDir, outPath, version: version ?? new Date().toISOString() };
}

function warnDuplicateBasenames(files: VaultFile[]): void {
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.name)) console.warn(`⚠ 중복 파일명 — id 충돌 가능: ${f.name}`);
    seen.add(f.name);
  }
}

export async function run(args: CliArgs): Promise<{ decks: number; cards: number }> {
  if (!existsSync(args.vaultDir) || !statSync(args.vaultDir).isDirectory()) {
    throw new Error(`Vault 디렉토리를 찾을 수 없습니다: ${args.vaultDir}`);
  }
  const files = collectMarkdownFiles(args.vaultDir);
  if (files.length === 0) throw new Error(`.md 파일이 없습니다: ${args.vaultDir}`);
  warnDuplicateBasenames(files);

  const data = parseVault(files, args.version);
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. ## Self-Test Anchors / #flashcard/… / ### Tier / 질문?::답변 포맷을 확인하세요.');
  }

  const images = collectImageFiles(args.vaultDir);
  for (const card of data.cards) {
    card.answer = await replaceImageRefs(card.answer, async (ref) => {
      const abs = images.get(path.basename(ref.target));
      if (!abs) {
        console.warn(`⚠ 이미지를 찾을 수 없음: ${ref.target}`);
        return null;
      }
      try {
        return `![${ref.alt}](${await optimizeToDataUri(abs)})`;
      } catch (e) {
        console.warn(`⚠ 이미지 처리 실패(${ref.target}): ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    });
  }

  mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
  writeFileSync(args.outPath, JSON.stringify(data, null, 2) + '\n');
  return { decks: data.decks.length, cards: data.cards.length };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const { decks, cards } = await run(args);
    console.log(`✓ ${decks} decks / ${cards} cards → ${args.outPath}`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
