import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { type VaultFile } from '../src/lib/obsidian.ts';
import type { CardsData } from '../src/types/index.ts';
import { StructureSchema, QuizSchema, type StructureResult, type QuizResult } from '../src/lib/forge/schema.ts';
import { buildStructurePrompt, buildQuizPrompt } from '../src/lib/forge/prompts.ts';
import { uniqueDeckPaths, decksFromVault } from '../src/lib/forge/decks.ts';
import { assembleNote, toSlug, uniqueSlug, validateDraft } from '../src/lib/forge/assemble.ts';
import { collectMarkdownFiles } from './parse-vault.ts'; // 재귀 .md 수집 재사용(부수효과 없는 export)

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

const MAX_TOKENS = 16000;

// 참고: 설치된 @anthropic-ai/sdk(0.105.x)의 zodOutputFormat은 인자 1개(스키마)만 받는다
// (helpers/zod가 zod/v4를 사용 — 설치된 zod ^4.4.3과 호환). 플랜 초안의 두 번째 name 인자는
// 이 버전 시그니처와 맞지 않아 생략했다. zod 스키마(StructureSchema/QuizSchema)가 여전히
// 단일 진실원천이며 .parse()가 parsed_output을 검증한다(플랜 폴백 불필요 — 시그니처 조정으로 충분).

/** 호출①: 노트 정리 + 덱 분류 (단순 추출 — thinking 미설정). */
async function structureAndClassify(
  client: Anthropic,
  model: string,
  raw: string,
  decks: string[],
): Promise<StructureResult> {
  const res = await client.messages.parse({
    model,
    max_tokens: MAX_TOKENS,
    output_config: { format: zodOutputFormat(StructureSchema) },
    messages: [{ role: 'user', content: buildStructurePrompt(raw, decks) }],
  });
  if (res.stop_reason === 'max_tokens') console.warn('⚠ structure: max_tokens 도달 — 출력이 잘렸을 수 있음');
  if (!res.parsed_output) throw new Error('structure 파싱 실패(stop_reason=' + res.stop_reason + ')');
  return res.parsed_output;
}

/** 호출②: 퀴즈 생성 (멀티 카드·루브릭 추론 — adaptive thinking). */
async function generateQuiz(
  client: Anthropic,
  model: string,
  structure: StructureResult,
): Promise<QuizResult> {
  const res = await client.messages.parse({
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(QuizSchema) },
    messages: [{ role: 'user', content: buildQuizPrompt(structure) }],
  });
  if (res.stop_reason === 'max_tokens') console.warn('⚠ quiz: max_tokens 도달 — 출력이 잘렸을 수 있음');
  if (!res.parsed_output) throw new Error('quiz 파싱 실패(stop_reason=' + res.stop_reason + ')');
  return res.parsed_output;
}

/** --deck-source: .json이면 cards.json 파싱, 아니면 vault 디렉토리로 간주. */
function loadDecks(source: string): string[] {
  if (!existsSync(source)) {
    console.warn(`⚠ 덱 소스 없음(${source}) — 빈 덱 목록으로 진행`);
    return [];
  }
  if (source.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(readFileSync(source, 'utf-8')) as CardsData;
    return uniqueDeckPaths(data);
  }
  // vault 디렉토리 → 재귀 수집(collectMarkdownFiles는 상단 import 블록에서 가져옴)
  const files = collectMarkdownFiles(source);
  return decksFromVault(files);
}

/** 인박스 디렉토리의 .md 파일을 읽는다(1단계, 비재귀 — 각 파일 = 1 노트). */
function readInboxFiles(dir: string): VaultFile[] {
  const out: VaultFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push({ name: entry.name, content: readFileSync(path.join(dir, entry.name), 'utf-8') });
    }
  }
  return out;
}

export interface RunResult {
  processed: number;
  drafted: number;
  held: number;
}

async function run(args: InboxArgs): Promise<RunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 필요합니다.');
  }
  if (!existsSync(args.inboxDir) || !statSync(args.inboxDir).isDirectory()) {
    throw new Error(USAGE);
  }
  const inboxFiles = readInboxFiles(args.inboxDir);
  if (inboxFiles.length === 0) throw new Error(`인박스에 .md 파일이 없습니다: ${args.inboxDir}`);

  const decks = loadDecks(args.deckSource);
  const client = new Anthropic();
  const takenSlugs = existingSlugs(args.outDir);

  let drafted = 0;
  let held = 0;

  for (const file of inboxFiles) {
    try {
      const structure = await structureAndClassify(client, args.model, file.content, decks);
      const quiz = await generateQuiz(client, args.model, structure);
      const created = new Date().toISOString();
      const md = assembleNote(
        { title: structure.title, body: structure.body, deck: structure.deck, quiz },
        created,
      );

      const v = validateDraft(md, quiz, created);
      if (!v.ok) {
        console.warn(`⚠ 보류(${v.reason}): ${file.name} — 인박스 원본 보존`);
        held++;
        continue;
      }

      const slug = uniqueSlug(toSlug(structure.title), takenSlugs);
      takenSlugs.add(slug);
      const outPath = path.join(args.outDir, structure.deck, `${slug}.md`);

      if (args.dryRun) {
        console.log(`\n— [dry-run] ${file.name} → ${outPath} (${v.cardCount} cards)\n${md}`);
      } else {
        mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        writeFileSync(outPath, md);
        if (!args.keep) rmSync(path.join(args.inboxDir, file.name));
      }
      drafted++;
    } catch (e) {
      // 노트 단위 격리: 한 건 실패가 전체를 막지 않음. SDK는 429/5xx를 자동 재시도(max_retries 기본 2).
      const hint = e instanceof Anthropic.RateLimitError ? ' (레이트 리밋 — 잠시 후 재실행 권장)' : '';
      console.warn(`⚠ 처리 실패(${file.name}): ${e instanceof Error ? e.message : String(e)}${hint} — 인박스 원본 보존`);
      held++;
    }
  }

  return { processed: inboxFiles.length, drafted, held };
}

/** 출력 폴더의 기존 draft slug(파일명 stem)를 수집해 충돌 회피에 사용. */
function existingSlugs(outDir: string): Set<string> {
  const set = new Set<string>();
  if (!existsSync(outDir)) return set;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.md')) set.add(entry.name.replace(/\.md$/i, ''));
    }
  };
  walk(outDir);
  return set;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const r = await run(args);
    console.log(`✓ ${r.processed}개 처리 / ${r.drafted}개 draft 생성 / ${r.held}개 보류`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
