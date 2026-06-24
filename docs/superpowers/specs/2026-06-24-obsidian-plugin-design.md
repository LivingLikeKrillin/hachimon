# Hachimon Obsidian 플러그인 — 설계 문서

> 작성일: 2026-06-24
> 상태: 승인됨
> ROADMAP 항목: 5-3 (Obsidian 플러그인)

## 배경 / 목적

Obsidian 안에서 명령(또는 리본 버튼) 한 번으로 현재 볼트를 `parseVault`로 파싱해 **설정된 절대 경로(예: repo의 `public/cards.json`)에 직접 작성**한다. "터미널 없는 CLI" — 노트를 쓰던 자리에서 곧장 repo에 파일을 떨군 뒤 `git push` → Cloudflare로 배포.

이미 존재하는 진입점과의 관계:
- **CLI(5-2)** — 빌드타임, 터미널. `npm run parse`.
- **인앱 가져오기** — 런타임, 브라우저에서 사용자가 파일 선택.
- **플러그인(이 문서)** — Obsidian 안의 편의. 셋 다 동일한 `parseVault`를 재사용한다.

## 핵심 결정

| 항목 | 결정 |
|------|------|
| 역할 | 내보내기 명령(MVP). 편집 UI/실시간 린트는 비목표. |
| 출력 위치 | 설정된 **절대 파일 경로**(Node `fs`). 데스크톱 전용(`isDesktopOnly: true`). |
| 파서 | `src/lib/obsidian.ts`의 `parseVault` 재사용(번들). 단일 진실원천. |
| 테스트 | 순수 직렬화는 vitest, Obsidian 라이프사이클은 수동 검증. |

### 비목표 (YAGNI)
카드 편집 UI, 실시간 검증/린트, 저장 시 자동 실행, 모바일 지원, 커뮤니티 플러그인 스토어 제출, 버전 문자열 설정(항상 ISO now).

## 아키텍처 — 순수 직렬화 + Obsidian/fs 글루 분리

별도 빌드(esbuild) 아티팩트. `obsidian-plugin/` 디렉토리:

```
obsidian-plugin/
  ├─ serialize.ts        # 순수: serializeCards(files, version) — 테스트 대상
  ├─ serialize.test.ts
  ├─ main.ts             # Obsidian 글루: Plugin 클래스(설정·명령·리본), vault 읽기 → fs 쓰기
  ├─ manifest.json       # 플러그인 메타
  ├─ versions.json       # { pluginVersion: minAppVersion }
  ├─ esbuild.config.mjs  # main.ts → main.js (CJS)
  └─ tsconfig.json       # types:["obsidian"], 독립 tsc -p 체크
```

### 유닛 책임

| 유닛 | 입력 → 출력 | 책임 | 테스트 |
|------|------------|------|--------|
| `serializeCards` | `(files: VaultFile[], version: string)` → `{ json: string; decks: number; cards: number; warnings: string[] }` | `parseVault` 호출 + `JSON.stringify(,2)+'\n'` + 카운트 + 중복 basename 경고 수집. **Obsidian 미의존** | vitest |
| `HachimonPlugin` (main.ts) | — | 설정 로드/저장, 명령·리본 등록, vault 읽기→serialize→fs 쓰기, Notice | 수동 |

`serialize.ts`는 절대 `obsidian` 모듈을 import하지 않는다(그래야 vitest에서 순수 import 가능). `main.ts`만 `obsidian`·`node:fs`를 import한다.

```ts
// serialize.ts (개요)
import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';

export interface SerializeResult {
  json: string;
  decks: number;
  cards: number;
  warnings: string[];
}

export function serializeCards(files: VaultFile[], version: string): SerializeResult;
```
- 중복 basename은 throw가 아니라 `warnings`에 수집(호출부가 Notice로 표시). (CLI의 `warnDuplicateBasenames`와 동일 규칙을 여기서 재구현 — "단일 진실원천"은 *파싱*(`parseVault`)에 한정하고, 경고는 각 진입점이 자체 보유한다. 수용 가능한 DRY 절충.)
- 카드 0장이면 throw(빈 배포 방지) — 호출부가 catch해 Notice.

## 파서 재사용

`serialize.ts`가 `../src/lib/obsidian.ts`의 `parseVault`를 import하고 esbuild가 번들에 포함한다. `obsidian.ts`의 유일한 import는 type-only `@/types`라 esbuild가 소거하므로 별칭 해석이 불필요하다. 결과적으로 CLI·인앱·플러그인 셋이 동일한 id·sourceHash·덱 집계를 산출한다(파싱 규칙 변경 시 `obsidian.ts` 한 곳만 수정).

## 데이터 흐름 (main.ts)

1. 명령(`Generate cards.json`) 또는 리본 클릭(아이콘 `download`) 실행.
2. 설정 `outputPath` 검증: 비어 있거나 `path.isAbsolute(outputPath)`가 false면 안내 `new Notice(...)` 에러 후 종료.
3. `this.app.vault.getMarkdownFiles()` → 각 `TFile`을 `await this.app.vault.read(file)`로 읽어 `{ name: file.name, content }`로 매핑. **`read`(디스크 최신) 사용** — `cachedRead`는 캐시라 방금 쓴 내용이 누락될 수 있어 export엔 부적합. `file.name`은 basename(예: `Spring.md`) — CLI/인앱과 동일한 slug/id 규칙.
4. `serializeCards(files, new Date().toISOString())`.
5. `warnings`가 있으면 각각 Notice/`console.warn`.
6. Node `fs`: `mkdirSync(path.dirname(outputPath), { recursive: true })` 후 `writeFileSync(outputPath, result.json)`. (기존 파일은 무조건 덮어쓴다 — 확인 대화 없음.)
7. `new Notice(\`✓ ${decks} decks / ${cards} cards → ${outputPath}\`)`.
8. 전체를 try-catch로 감싸 실패 시 `new Notice(\`✗ ${message}\`)`.

## 설정 (PluginSettingTab)

- 단일 필드 `outputPath`(절대 경로 텍스트). `loadData()`/`saveData()`로 영속.
- 기본값 빈 문자열 — 미설정 시 명령이 안내 Notice를 띄운다.
- 데이터 형태: `interface HachimonSettings { outputPath: string }`, `DEFAULT_SETTINGS = { outputPath: '' }`.

## manifest.json / versions.json

```json
// manifest.json
{
  "id": "hachimon",
  "name": "Hachimon",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "현재 볼트의 플래시카드를 Hachimon cards.json으로 내보냅니다.",
  "author": "LivingLikeKrillin",
  "isDesktopOnly": true
}
```
`versions.json`: `{ "0.1.0": "1.5.0" }`. (minAppVersion은 안전한 최근 값; 구현 시 확정.)

## 빌드 / 툴링

- **esbuild**로 `obsidian-plugin/main.ts` → `obsidian-plugin/main.js` 번들. format `cjs`, platform `node`, target `es2018`, `external: ['obsidian', 'electron', ...builtin-modules, ...node:* prefixes]`, `bundle: true`, sourcemap(개발). 공식 Obsidian 템플릿 방식.
- `esbuild.config.mjs` + npm script `"build:plugin": "node obsidian-plugin/esbuild.config.mjs"`.
- devDependency 추가: `obsidian`(타입), `builtin-modules`. `esbuild`는 현재 transitive(0.28.1)지만 **명시적 devDependency로 추가**(transitive 의존 금지).
- 플러그인 전용 `tsconfig.json`(types:["obsidian"], CJS/ES2018, DOM lib). 독립 체크 `"typecheck:plugin": "tsc -p obsidian-plugin/tsconfig.json"` (scripts와 동일하게 root references 밖, composite 충돌 회피). TS ~6.0.2의 `baseUrl` 사용 시 `ignoreDeprecations: "6.0"` 필요(별칭이 필요 없으면 baseUrl 자체를 안 써도 됨 — serialize.ts는 상대 import만 하므로 별칭 불필요).
- 앱 `vite build`와 무관. `main.js`는 빌드 산출물이지만 **repo에 커밋한다** — 개인 배포라 사용자가 빌드 단계 없이 `manifest.json` + `main.js`만 `.obsidian/plugins/hachimon/`로 복사해 설치할 수 있게. (코드 변경 시 `build:plugin` 후 재커밋.)

## 테스트 전략

### `obsidian-plugin/serialize.test.ts` (vitest)
- 유효 노트 1~2개(`## Self-Test Anchors`/`#flashcard/…`/`### Tier`/`Q::A`) → `decks`/`cards` 카운트와 `json`이 유효 스키마(parse 후 version/decks/cards).
- 카드 0장 → throw.
- 동일 basename 2개 → `warnings`에 항목 수집(throw 아님).
- **출력 parity**: `serializeCards(files, v).json`이 `JSON.stringify(parseVault(files, v), null, 2) + '\n'`와 동일함을 단언(CLI와 바이트 동일 보장, 회귀 가드).
- `serialize.ts`는 Obsidian 미의존이라 vitest 기본 include로 잡히고 그대로 통과.

### 수동 검증 (Obsidian 라이프사이클)
- 플러그인을 테스트 볼트의 `.obsidian/plugins/hachimon/`에 복사(manifest.json + main.js) 후 활성화.
- 설정에서 outputPath 지정 → 명령 실행 → Notice 확인 + 해당 경로의 cards.json 검증.
- 플러그인은 본질적으로 단위테스트가 어려우므로 글루를 얇게 유지하고 수동 확인한다.

## 영향 범위 (파일별)

| 파일 | 변경 |
|------|------|
| `obsidian-plugin/serialize.ts` | 신규 (순수) |
| `obsidian-plugin/serialize.test.ts` | 신규 |
| `obsidian-plugin/main.ts` | 신규 (Obsidian 글루) |
| `obsidian-plugin/manifest.json` | 신규 |
| `obsidian-plugin/versions.json` | 신규 |
| `obsidian-plugin/esbuild.config.mjs` | 신규 |
| `obsidian-plugin/tsconfig.json` | 신규 |
| `package.json` | `obsidian`·`builtin-modules`·`esbuild` devDep, `build:plugin`·`typecheck:plugin` 스크립트 |
| `obsidian-plugin/main.js` | 빌드 산출물 — 커밋(설치 편의) |
| `docs/` | 플러그인 설치·사용 가이드 |
| `ROADMAP.md` | 5-3 갱신 |
| `src/lib/obsidian.ts` | 변경 없음 (재사용) |

## 작업 진행 방식

- feature 브랜치 `feat/obsidian-plugin` → PR → merge. Conventional commits. TypeScript strict.
