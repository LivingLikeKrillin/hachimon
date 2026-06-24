# Hachimon CLI 파서 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian Vault 디렉토리를 재귀로 읽어 기존 `parseVault()`로 `public/cards.json`을 생성하는 빌드타임 Node/TS CLI를 만든다.

**Architecture:** 파싱은 전부 검증된 `src/lib/obsidian.ts`의 `parseVault`가 담당하고, CLI는 인자 파싱(`parseArgs`)·디스크 수집(`collectMarkdownFiles`)·조립(`run`/`main`)만 추가하는 얇은 껍데기다. 순수 로직은 단위 테스트하고, `process.exit`만 하는 `main`은 얇게 둔다.

**Tech Stack:** Node 22 (ESM), TypeScript(strict), tsx(실행), Vitest(테스트). 파서 재사용: `src/lib/obsidian.ts`.

**Spec:** `docs/superpowers/specs/2026-06-24-cli-parser-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `scripts/parse-vault.ts` | CLI: `parseArgs`(순수)·`collectMarkdownFiles`(fs)·`run`(조립)·`main`(얇은 셸) | 신규 |
| `scripts/parse-vault.test.ts` | parseArgs·collectMarkdownFiles·run 단위/통합 테스트 | 신규 |
| `tsconfig.scripts.json` | scripts 전용 타입체크(독립 `tsc -p`, 참조 그래프 밖) | 신규 |
| `package.json` | `tsx` devDep, `parse`·`typecheck:scripts` script | 수정 |
| `README.md` | 빌드타임 파이프라인 사용법 | 수정 |
| `ROADMAP.md` | 5-2 갱신 + Kotlin 미채택 사유 | 수정 |
| `src/lib/obsidian.ts` | 변경 없음 (재사용) | — |

**import 규칙:** 스크립트는 `obsidian.ts`를 **상대경로 + `.ts` 확장자**로 import한다(`tsx` 런타임이 `@` 별칭을 해석하지 않으므로). `verbatimModuleSyntax`를 위해 타입은 inline `type` 수식어로: `import { parseVault, type VaultFile } from '../src/lib/obsidian.ts'`. `obsidian.ts` 내부의 `import type ... from '@/types'`는 런타임 소거되고, 타입체크는 `tsconfig.scripts.json`의 `@/*` 별칭으로 해석된다.

**tsconfig 전략(스펙 정제):** `obsidian.ts`는 이미 `tsconfig.app.json`(`include:["src"]`)이 소유한다. 이를 composite 참조 그래프(root `tsc -b`)에 끌어들이면 "file in multiple projects" 위험이 있다. 따라서 `tsconfig.scripts.json`은 **root references에 넣지 않고** 독립 실행(`tsc -p tsconfig.scripts.json --noEmit`)으로 타입체크한다. `tsc -p`는 빌드모드가 아니라 단일 프로그램 체크라 import된 `obsidian.ts`를 그냥 함께 검사할 뿐 소유권 충돌이 없다.

---

## Chunk 1: CLI 구현

### Task 1: parseArgs (순수 인자 파싱)

**Files:**
- Create: `scripts/parse-vault.ts`, `scripts/parse-vault.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/parse-vault.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseArgs } from './parse-vault.ts';

describe('parseArgs', () => {
  it('positional vault-dir와 기본 outPath/version', () => {
    const a = parseArgs(['/my/vault']);
    expect(a.vaultDir).toBe('/my/vault');
    expect(a.outPath).toBe('public/cards.json');
    expect(a.version).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 기본값
  });

  it('-o / --out 로 출력 경로 지정', () => {
    expect(parseArgs(['/v', '-o', 'out/x.json']).outPath).toBe('out/x.json');
    expect(parseArgs(['/v', '--out', 'y.json']).outPath).toBe('y.json');
  });

  it('--version 으로 버전 문자열 지정', () => {
    expect(parseArgs(['/v', '--version', 'V1']).version).toBe('V1');
  });

  it('vault-dir 누락 시 throw', () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(['-o', 'x.json'])).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: FAIL — `parse-vault.ts` / `parseArgs` 미존재.

- [ ] **Step 3: parse-vault.ts에 parseArgs 구현**

`scripts/parse-vault.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-vault.ts scripts/parse-vault.test.ts
git commit -m "feat(cli): parseArgs for vault parser CLI"
```

---

### Task 2: collectMarkdownFiles (fs 재귀 수집)

**Files:**
- Modify: `scripts/parse-vault.ts`, `scripts/parse-vault.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (임시 디렉토리 픽스처)**

`scripts/parse-vault.test.ts`에 추가:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectMarkdownFiles } from './parse-vault.ts';

describe('collectMarkdownFiles', () => {
  it('하위폴더 .md만 재귀 수집, 숨김/제외 디렉토리·비-md 무시, basename 사용', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'a.md'), 'A');
      mkdirSync(path.join(root, 'sub'));
      writeFileSync(path.join(root, 'sub', 'b.md'), 'B');
      writeFileSync(path.join(root, 'note.txt'), 'X');     // 비-md → 무시
      writeFileSync(path.join(root, '.hidden.md'), 'H');   // 숨김 파일 → 무시
      mkdirSync(path.join(root, '.obsidian'));
      writeFileSync(path.join(root, '.obsidian', 'c.md'), 'C'); // 숨김 디렉토리 → 무시

      const files = collectMarkdownFiles(root);
      const names = files.map((f) => f.name).sort();
      expect(names).toEqual(['a.md', 'b.md']);
      expect(files.find((f) => f.name === 'b.md')!.content).toBe('B');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: FAIL — `collectMarkdownFiles` 미존재.

- [ ] **Step 3: 구현 추가**

`scripts/parse-vault.ts` 상단에 import 추가하고 함수 추가:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type VaultFile } from '../src/lib/obsidian.ts';

const EXCLUDE_DIRS = new Set(['node_modules']);

/** vault 디렉토리를 재귀 walk 해 .md 파일을 VaultFile[]로 수집한다.
 *  숨김(.) 디렉토리·파일과 node_modules는 건너뛴다. name은 basename. */
export function collectMarkdownFiles(dir: string): VaultFile[] {
  const out: VaultFile[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue; // .obsidian/.trash/숨김
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-vault.ts scripts/parse-vault.test.ts
git commit -m "feat(cli): recursive markdown collection for vault parser"
```

---

### Task 3: run() 조립 + main() 셸

**Files:**
- Modify: `scripts/parse-vault.ts`, `scripts/parse-vault.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (엔드투엔드, 임시 vault → cards.json)**

`scripts/parse-vault.test.ts`에 추가:

```ts
import { readFileSync } from 'node:fs';
import { run } from './parse-vault.ts';

describe('run', () => {
  const VALID = [
    '## Self-Test Anchors',
    '#flashcard/spring/core',
    '### Foundation',
    '트랜잭션 전파란?::경계 동작 규칙.',
  ].join('\n');

  it('vault를 파싱해 cards.json을 쓰고 카운트를 반환한다', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'Spring.md'), VALID);
      const outPath = path.join(root, 'out', 'cards.json'); // 부모 디렉토리 없음 → mkdir 필요
      const res = run({ vaultDir: root, outPath, version: 'V1' });
      expect(res).toEqual({ decks: 1, cards: 1 });

      const data = JSON.parse(readFileSync(outPath, 'utf-8'));
      expect(data.version).toBe('V1');
      expect(data.cards).toHaveLength(1);
      expect(data.cards[0].deck).toBe('flashcard/spring/core');
      expect(data.decks[0].cardCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('vault 디렉토리가 없으면 throw', () => {
    expect(() => run({ vaultDir: '/no/such/dir', outPath: 'x.json', version: 'V' })).toThrow();
  });

  it('카드가 0장이면 throw (빈 배포 방지)', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'empty.md'), '# 본문만 있고 카드 없음');
      expect(() => run({ vaultDir: root, outPath: path.join(root, 'o.json'), version: 'V' })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: FAIL — `run` 미존재.

- [ ] **Step 3: run() + main() 구현**

`scripts/parse-vault.ts`: import를 보강하고 함수 추가. 최종 import 블록:

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';
```

함수 추가:

```ts
function warnDuplicateBasenames(files: VaultFile[]): void {
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.name)) {
      console.warn(`⚠ 중복 파일명 — id 충돌 가능: ${f.name}`);
    }
    seen.add(f.name);
  }
}

/** vault → cards.json 작성. 검증 실패 시 throw. 쓰여진 덱/카드 수를 반환. */
export function run(args: CliArgs): { decks: number; cards: number } {
  if (!existsSync(args.vaultDir) || !statSync(args.vaultDir).isDirectory()) {
    throw new Error(`Vault 디렉토리를 찾을 수 없습니다: ${args.vaultDir}`);
  }
  const files = collectMarkdownFiles(args.vaultDir);
  if (files.length === 0) {
    throw new Error(`.md 파일이 없습니다: ${args.vaultDir}`);
  }
  warnDuplicateBasenames(files);

  const data = parseVault(files, args.version);
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. ## Self-Test Anchors / #flashcard/… / ### Tier / 질문?::답변 포맷을 확인하세요.');
  }

  mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
  writeFileSync(args.outPath, JSON.stringify(data, null, 2) + '\n');
  return { decks: data.decks.length, cards: data.cards.length };
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    const { decks, cards } = run(args);
    console.log(`✓ ${decks} decks / ${cards} cards → ${args.outPath}`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

// 직접 실행될 때만 main() (테스트 import 시에는 실행 안 됨)
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

> 주의: `parseVault`는 값 import, `VaultFile`은 type import. `verbatimModuleSyntax`를 위해 `import { parseVault, type VaultFile }` 형태 유지. Task 2에서 넣은 `type VaultFile` 단독 import 줄은 이 통합 import로 합친다(중복 import 금지).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run scripts/parse-vault.test.ts`
Expected: PASS (전체 케이스).

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-vault.ts scripts/parse-vault.test.ts
git commit -m "feat(cli): run() assembly + main() shell for vault parser"
```

---

### Task 4: 툴링 — tsx · npm scripts · tsconfig.scripts.json

**Files:**
- Create: `tsconfig.scripts.json`
- Modify: `package.json`

- [ ] **Step 1: tsx 설치**

Run: `npm install -D tsx`
Expected: devDependencies에 `tsx` 추가.

- [ ] **Step 2: tsconfig.scripts.json 생성**

`tsconfig.node.json`을 본떠 만들되 include를 scripts로 바꾸고 `@/*` 별칭을 추가한다(독립 `tsc -p`용, root references에는 넣지 않음):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.scripts.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["scripts/**/*.ts"]
}
```

- [ ] **Step 3: package.json scripts 추가/수정**

`scripts`에 추가:
```json
    "parse": "tsx scripts/parse-vault.ts",
    "typecheck:scripts": "tsc -p tsconfig.scripts.json"
```
그리고 드리프트 방지를 위해 기존 `build`를 확장(스크립트 타입체크를 빌드에 포함):
```json
    "build": "tsc -b && tsc -p tsconfig.scripts.json && vite build"
```
(기존 build는 `"tsc -b && vite build"`. 현재 정확한 값을 읽어 가운데에 `tsc -p tsconfig.scripts.json &&`만 삽입한다.)

- [ ] **Step 4: 스크립트 타입체크**

Run: `npm run typecheck:scripts`
Expected: 통과(exit 0). 만약 `@/types` 미해석 에러면 `tsconfig.scripts.json`의 `baseUrl`/`paths`를 확인. `obsidian.ts` 다중소유 류 에러는 `tsc -p`(비-빌드모드)에서는 발생하지 않아야 한다.

- [ ] **Step 5: 기존 게이트 무회귀 확인**

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: 전부 통과(앱 빌드그래프 영향 없음, 신규 테스트 포함 통과).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.scripts.json
git commit -m "build(cli): tsx runner + scripts typecheck config"
```

---

### Task 5: 실제 실행 스모크 · 문서 · ROADMAP · PR

**Files:**
- Modify: `README.md`, `ROADMAP.md`

- [ ] **Step 1: 실제 실행 스모크 (임시 vault)**

> 아래 셸 명령은 **Bash 툴(Git Bash)**에서 실행한다(win32/PowerShell에서는 `mkdir -p`·`/tmp`·`$?`가 다름). PowerShell만 쓸 경우 `$env:TEMP` 경로와 PowerShell 문법으로 바꾼다.

임시 vault를 만들어 CLI를 직접 돌려본다:
```bash
mkdir -p /tmp/hvault && printf '## Self-Test Anchors\n#flashcard/spring/core\n### Foundation\n전파란?::규칙.\n' > /tmp/hvault/Spring.md
npm run parse -- /tmp/hvault -o /tmp/out.json
cat /tmp/out.json
```
Expected: `✓ 1 decks / 1 cards → /tmp/out.json` 출력, `/tmp/out.json`이 유효한 cards.json(version/decks/cards).

- [ ] **Step 2: 인자 누락/빈 vault 에러 스모크**

```bash
npm run parse -- ; echo "exit=$?"          # vault 누락 → usage + exit 1
mkdir -p /tmp/empty && npm run parse -- /tmp/empty ; echo "exit=$?"  # .md 없음 → exit 1
```
Expected: 각각 에러 메시지 + `exit=1`.

- [ ] **Step 3: README에 빌드타임 파이프라인 절 추가**

`README.md`에 CLI 사용법 섹션 추가:
- `npm run parse -- <vault-dir> -o public/cards.json` 사용법
- 인앱 import와 동일한 `parseVault`를 써서 결과가 동일함(빌드타임 vs 런타임 경로)
- 배포 흐름: parse → git commit `public/cards.json` → Cloudflare Pages

- [ ] **Step 4: ROADMAP 5-2 갱신**

`ROADMAP.md` 5-2 항목을 완료로 갱신하고 결정 기록:
```
### 5-2. CLI 파서 (완료 — Node/TS, parseVault 재사용)
- [x] `scripts/parse-vault.ts` — vault 재귀 파싱 → cards.json
- [x] `npm run parse -- <vault> -o public/cards.json`
- [~] Kotlin/GraalVM — 미채택. obsidian.ts(parseVault)가 이미 단일 진실원천이라 3중 중복(in-app·CLI·플러그인) 방지 위해 Node/TS 채택.
```

- [ ] **Step 5: 최종 게이트 + Commit + PR**

Run: `npx tsc -b && npm run typecheck:scripts && npm run lint && npx vitest run && npm run build`
Expected: 전부 통과.

```bash
git add README.md ROADMAP.md
git commit -m "docs(cli): build-time pipeline usage + ROADMAP 5-2 done"
git push -u origin feat/cli-parser
gh pr create --title "feat: Obsidian Vault → cards.json CLI 파서 (Node/TS)" --body "..."
```

---

## 검증 게이트 요약

각 Task 종료 시 `npx vitest run scripts/parse-vault.test.ts`. Task 4·5는 `npm run typecheck:scripts` + 기존 `tsc -b`/`lint`/`build` 무회귀까지. 최종 Task 5는 실제 CLI 실행 스모크 포함.
