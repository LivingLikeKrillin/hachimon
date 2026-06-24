# Hachimon CLI 파서 — 설계 문서

> 작성일: 2026-06-24
> 상태: 승인됨
> ROADMAP 항목: 5-2 (CLI 파서)

## 배경 / 목적

maintainer가 자신의 Obsidian Vault를 주기적으로 `cards.json`으로 구워 hachimon.app에 배포하는 **빌드타임 파이프라인**을 제공한다. 배포된 앱이 15장 샘플이 아닌 실제 카드를 싣게 한다.

```
hachimon parse <vault-dir> -o public/cards.json  →  git push  →  Cloudflare
```

## 핵심 결정: Kotlin 미채택, Node/TS로 parseVault 재사용

ROADMAP/CLAUDE.md는 "Kotlin (GraalVM native)"을 명시하지만, 그 결정은 `src/lib/obsidian.ts`(인앱 vault 파서)가 생기기 *전*에 내려졌다. 현재 파싱 규칙(slugify, FNV-1a 해시, id 규칙, `## Self-Test Anchors`/`#flashcard/`/`### Tier`/`Q::A`)은 `parseVault()`에 구현·검증(10개 테스트)돼 있다.

**"Obsidian 운용 전제"에서 Kotlin은 부적합하다:**
1. Obsidian 생태계는 TS/JS다. ROADMAP 5-3 Obsidian 플러그인은 반드시 TypeScript로 작성된다. Kotlin으로 파서를 또 만들면 in-app(`obsidian.ts`) · CLI(Kotlin) · 플러그인(TS) **3중 중복**이 된다.
2. 파서가 두/세 언어로 갈라지면 규칙 변경 시 동기화 필수이고, FNV-1a 해시·slugify가 바이트 단위로 어긋나면 머지 로직이 sourceHash 불일치로 오작동한다.

따라서 **파서 단일 진실원천(`parseVault`)을 in-app·CLI·(향후)플러그인이 공유**한다. CLI는 Node/TS로 작성해 `parseVault`를 그대로 호출하는 얇은 fs/CLI 껍데기다.

### 비목표
- Kotlin/GraalVM 구현 (위 사유로 배제).
- 파싱 규칙의 재구현·확장 (규칙은 `obsidian.ts`가 유일한 출처).
- 워치 모드·증분 빌드·설정 파일 (YAGNI — 단발 실행으로 충분).
- 다중 vault 병합, frontmatter 파싱 (현 파싱 범위 밖).

## 아키텍처

파싱은 전부 `src/lib/obsidian.ts`의 `parseVault(files, version)`가 담당한다. CLI는 디스크 입출력과 인자 처리만 추가한다.

```
scripts/parse-vault.ts
  ├─ parseArgs(argv: string[]): CliArgs          # 순수 — 단위 테스트 대상
  ├─ collectMarkdownFiles(dir: string): VaultFile[]  # fs 재귀 수집 — 임시 디렉토리로 테스트
  └─ main(): void                                 # 조립 + try-catch + 콘솔 요약 + exit code
```

### 유닛 책임

| 유닛 | 입력 → 출력 | 책임 |
|------|------------|------|
| `parseArgs` | `argv` → `{ vaultDir, outPath, version }` | positional/flag 파싱, 기본값, 누락 검증 (순수) |
| `collectMarkdownFiles` | `dir` → `VaultFile[]` | 재귀 walk로 `.md` 수집, 제외 규칙 적용 |
| `main` | — | 위 둘 + `parseVault` + 파일 쓰기 조립, 에러/요약/exit |

```ts
interface CliArgs {
  vaultDir: string;
  outPath: string;   // 기본 'public/cards.json'
  version: string;   // 기본 ISO timestamp
}
```

## 데이터 흐름

1. `parseArgs(process.argv.slice(2))`:
   - positional `<vault-dir>` (필수)
   - `-o` / `--out` → outPath (기본 `public/cards.json`)
   - `--version` → version (기본 `new Date().toISOString()`)
2. `collectMarkdownFiles(vaultDir)`: 디렉토리 재귀 walk → 각 `.md`를 `{ name: basename, content: utf-8 }`로.
   - **basename 사용**(경로 아님) — 인앱 import와 동일한 slug/id 규칙 유지(단일 진실원천).
   - 제외: `.obsidian/`, `.trash/`, `node_modules/`, 그리고 `.`로 시작하는 숨김 디렉토리.
3. `parseVault(files, version)` → `CardsData`.
4. outPath 부모 디렉토리가 없으면 `fs.mkdirSync(dir, { recursive: true })`로 생성한 뒤 `fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n')`로 표준 2-스페이스 pretty JSON을 쓴다.
5. 콘솔 요약: `✓ N decks / M cards → <outPath>`.

> **출력 포맷 주의:** 현재 `public/cards.json`은 손으로 작성한 compact 포맷(덱/카드 한 줄, 인라인 배열)이다. CLI는 **표준 `JSON.stringify(…, 2)`**를 쓰므로 공백 레이아웃은 기존 샘플과 다르다. 이는 무해하다 — 앱은 `fetch` 후 `JSON.parse`만 하므로 공백은 기능에 영향이 없다. CLI를 실제 vault에 처음 돌리면 샘플이 표준 포맷으로 덮어써진다. (줄바꿈은 repo의 `core.autocrlf`로 정규화되므로 파일 바이트 비교 대상이 아니다.)

## 인앱 import와의 일치성 (핵심 불변식)

CLI와 인앱 import가 **동일한 `parseVault`**를 쓰므로 파싱 결과 *데이터* — id·sourceHash·덱 집계 — 가 동일하다. (불변식은 파싱된 객체의 동일성이지 파일 공백 포맷이 아니다. 머지 로직은 `JSON.parse`된 객체만 보므로 포맷 차이는 무관하다.) CLI로 구운 cards.json과 인앱 import 결과가 충돌 없이 머지된다. 파싱 규칙 변경 시 `obsidian.ts` 한 곳만 고치면 양쪽 + 향후 플러그인까지 반영된다.

### 알려진 한계 (인앱과 공유)
- 서로 다른 폴더의 동일 basename 파일은 slug가 같아 id가 충돌할 수 있다. 인앱 import도 동일하게 동작하므로 새로 생기는 문제는 아니다. 스펙·문서에 명시한다.

## 에러 핸들링 (CLAUDE.md: fs 호출 try-catch 필수)

| 상황 | 동작 |
|------|------|
| vault 디렉토리 미존재/접근 불가 | stderr 메시지 + `process.exit(1)` |
| positional 인자 누락 | usage 출력 + `exit(1)` |
| `.md` 0개 또는 카드 0장 | 경고 + `exit(1)` (빈 cards.json 배포 방지) |
| 파일 읽기 실패 | 해당 파일 경로와 함께 에러 + `exit(1)` |
| outPath 부모 디렉토리 없음 | `mkdirSync(recursive)`로 생성 (에러 아님) |
| 동일 basename 중복 파일 | **경고 출력**(실패는 아님) — id가 충돌할 수 있음을 알림. vault 재귀 walk에선 인앱보다 발생 가능성이 높다 |

`--version` 값은 검증 없이 그대로 전달된다(자유 문자열, 배포 마커 용도).

`main`은 전체를 try-catch로 감싸 예기치 못한 오류도 비정상 종료 코드로 보고한다.

## 실행 / 패키징

- 실행기: `tsx`(devDependency 추가)로 TS 직접 실행.
- npm script: `"parse": "tsx scripts/parse-vault.ts"`. 사용 예: `npm run parse -- /path/to/vault -o public/cards.json`.
- `obsidian.ts`의 유일한 import는 `import type ... from '@/types'`(런타임 소거)이므로 런타임 별칭 해석은 불필요하다.
- 스크립트는 `../src/lib/obsidian.ts`를 상대경로로 import한다.

### 타입체크 통합

- `scripts/`는 이미 존재한다(`generate-icons.mjs` — `.mjs`라 타입체크 대상 아님). 새 `.ts` 스크립트만 타입체크에 편입한다.
- `tsconfig.node.json`(node 컨텍스트, `types: ["node"]`)의 `include`를 `["vite.config.ts", "scripts/**/*.ts"]`로 확장.
- `tsconfig.node.json`에 `@/*` 별칭 추가(`baseUrl: "."`, `paths: { "@/*": ["./src/*"] }`) — 스크립트가 import하는 `obsidian.ts`의 `import type ... from '@/types'`를 `tsc`가 해석하도록.
- 테스트 파일(`scripts/parse-vault.test.ts`)도 include에 걸리지만, `obsidian.test.ts`와 동일하게 `import { describe, it, expect } from 'vitest'`로 명시 import하므로 vitest 전역 타입 없이도 `tsc`가 통과한다.
- **다중 프로젝트 충돌 대비:** `tsc -b`에서 `obsidian.ts`가 app·node 두 프로젝트에 동시에 끌려와 충돌하면(예: "file is in multiple projects"), `scripts/`용 별도 `tsconfig.scripts.json`을 만들어 root에서 참조하는 방식으로 분리한다. 구현 시 `tsc -b` 결과로 판단한다.
- `npm run build`(=`tsc -b && vite build`)와 `tsc -b`가 스크립트를 타입체크하게 된다.

## 테스트 전략

기존 `obsidian.test.ts`가 파싱 자체를 커버하므로 CLI 테스트는 새 글루 코드(인자·수집·조립)에 집중한다.

### `scripts/parse-vault.test.ts`
- `parseArgs`: 기본값(out/version), `-o`/`--out`/`--version` 플래그, positional 누락 시 처리.
- `collectMarkdownFiles`: `node:fs`/`node:os`의 임시 디렉토리에 fixture(.md, 하위폴더, `.obsidian/`, 숨김 파일)를 만들어 재귀 수집·제외 규칙 검증. basename으로 `name`이 채워지는지 확인.
- 엔드투엔드(선택): 임시 vault → `collectMarkdownFiles` → `parseVault` → 산출물이 유효 스키마(`version`/`decks`/`cards`)인지.
- 테스트는 vitest(기존)로 작성. vitest 기본 include가 `scripts/`도 잡고, `@` 별칭은 vite.config의 resolve.alias로 해석된다.

## 문서 / ROADMAP

- `docs/obsidian-guide.md` 또는 README에 "빌드타임 파이프라인" 절 추가: `npm run parse -- <vault> -o public/cards.json` 사용법, 인앱 import와의 관계(동일 결과).
- `ROADMAP.md` 5-2를 "Node/TS CLI(parseVault 재사용)"로 갱신, Kotlin 미채택 사유와 `scripts/`(원래 `cli/` 예정) 배치 사유 기록.

## 영향 범위 (파일별)

| 파일 | 변경 |
|------|------|
| `scripts/parse-vault.ts` | **신규** (CLI 엔트리 + parseArgs + collectMarkdownFiles) |
| `scripts/parse-vault.test.ts` | **신규** |
| `tsconfig.node.json` | scripts include + `@/*` 별칭 |
| `package.json` | `tsx` devDependency, `parse` script |
| `docs/obsidian-guide.md` 또는 `README.md` | 빌드타임 파이프라인 사용법 |
| `ROADMAP.md` | 5-2 갱신 + 결정 기록 |
| `src/lib/obsidian.ts` | 변경 없음 (재사용만) |

## 작업 진행 방식

- feature 브랜치 `feat/cli-parser` → PR → merge. Conventional commits. TypeScript strict.
