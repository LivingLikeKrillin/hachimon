# Hachimon Obsidian 플러그인 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian 명령/리본으로 현재 볼트를 `parseVault`로 파싱해 설정된 절대 경로에 `cards.json`을 쓰는 데스크톱 전용 플러그인을 만든다.

**Architecture:** 순수 직렬화(`serialize.ts`, vitest)와 Obsidian/fs 글루(`main.ts`, 수동 검증)를 분리한다. 파싱은 기존 `src/lib/obsidian.ts`의 `parseVault`를 재사용(esbuild 번들)한다. 별도 esbuild 빌드 아티팩트(`main.js`)를 repo에 커밋해 빌드 없이 설치 가능하게 한다.

**Tech Stack:** Obsidian Plugin API, TypeScript(strict), esbuild(번들), Node fs, Vitest. 파서 재사용: `src/lib/obsidian.ts`.

**Spec:** `docs/superpowers/specs/2026-06-24-obsidian-plugin-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `obsidian-plugin/serialize.ts` | 순수: `serializeCards(files, version)` → json/카운트/경고 | 신규 |
| `obsidian-plugin/serialize.test.ts` | serializeCards 테스트 (parity 포함) | 신규 |
| `obsidian-plugin/main.ts` | Obsidian Plugin: 설정·명령·리본, vault read → fs write | 신규 |
| `obsidian-plugin/manifest.json` | 플러그인 메타 (`isDesktopOnly: true`) | 신규 |
| `obsidian-plugin/versions.json` | `{ "0.1.0": "1.5.0" }` | 신규 |
| `obsidian-plugin/esbuild.config.mjs` | main.ts → main.js (CJS) | 신규 |
| `obsidian-plugin/tsconfig.json` | 플러그인 전용 (types node+obsidian, `@/*` 별칭, 독립 tsc -p) | 신규 |
| `obsidian-plugin/main.js` | 빌드 산출물 — 커밋(설치 편의) | 신규(빌드) |
| `package.json` | `obsidian`·`builtin-modules`·`esbuild` devDep, `build:plugin`·`typecheck:plugin` | 수정 |
| `docs/obsidian-plugin.md` | 설치·사용 가이드 | 신규 |
| `ROADMAP.md` | 5-3 갱신 | 수정 |
| `src/lib/obsidian.ts` | 변경 없음 (재사용) | — |

**중요 — tsconfig 별칭:** `serialize.ts`는 `../src/lib/obsidian.ts`를 import하고, 그 `obsidian.ts`는 type-only `import ... from '@/types'`를 가진다. `tsc`(typecheck:plugin)는 프로그램에 끌려온 `obsidian.ts`의 `@/types`를 해석해야 하므로 **플러그인 tsconfig에 `baseUrl` + `paths {@/*}`가 필요**하다(런타임이 아닌 타입체크용). TS ~6.0.2는 `baseUrl`에 TS5101을 내므로 `ignoreDeprecations: "6.0"`도 필요(기존 `tsconfig.scripts.json`·`tsconfig.app.json`과 동일 관례). `tsc -p`(비-빌드모드)라 `obsidian.ts` 다중소유 충돌은 없다.

**검증 한계(정직하게):** 이 환경엔 Obsidian이 없다. 자동 게이트는 ① `serialize.test.ts`(vitest) ② `typecheck:plugin`(tsc) ③ `build:plugin`(main.js 산출)까지 커버한다. Obsidian 라이프사이클(명령 실행·vault read·fs write)은 **사용자 수동 검증**(플러그인 로드 후 실행)으로 확인한다 — Task 4에 절차를 문서화한다.

---

## Chunk 1: 플러그인 구현

### Task 1: serialize.ts (순수 직렬화)

**Files:**
- Create: `obsidian-plugin/serialize.ts`, `obsidian-plugin/serialize.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`obsidian-plugin/serialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseVault } from '../src/lib/obsidian.ts';
import { serializeCards } from './serialize.ts';

const note = (deck: string, tier: string, qa: string) =>
  ['## Self-Test Anchors', `#flashcard/${deck}`, `### ${tier}`, qa].join('\n');

describe('serializeCards', () => {
  it('유효 노트 → json/decks/cards 카운트', () => {
    const files = [{ name: 'Spring.md', content: note('spring/core', 'Foundation', '전파란?::규칙.') }];
    const r = serializeCards(files, 'V1');
    expect(r.decks).toBe(1);
    expect(r.cards).toBe(1);
    const data = JSON.parse(r.json);
    expect(data.version).toBe('V1');
    expect(data.cards[0].deck).toBe('flashcard/spring/core');
    expect(r.warnings).toEqual([]);
  });

  it('카드 0장이면 throw', () => {
    const files = [{ name: 'empty.md', content: '# 본문만' }];
    expect(() => serializeCards(files, 'V1')).toThrow();
  });

  it('동일 basename은 warnings에 수집 (throw 아님)', () => {
    const files = [
      { name: 'Dup.md', content: note('a/x', 'Foundation', 'q1?::a1') },
      { name: 'Dup.md', content: note('b/y', 'Foundation', 'q2?::a2') },
    ];
    const r = serializeCards(files, 'V1');
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain('Dup.md');
  });

  it('출력이 CLI와 동일 (parseVault + JSON.stringify(,2)+\\n)', () => {
    const files = [{ name: 'Spring.md', content: note('spring/core', 'Foundation', '전파란?::규칙.') }];
    expect(serializeCards(files, 'V1').json).toBe(
      JSON.stringify(parseVault(files, 'V1'), null, 2) + '\n',
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run obsidian-plugin/serialize.test.ts`
Expected: FAIL — `serialize.ts` 미존재.

- [ ] **Step 3: 구현**

`obsidian-plugin/serialize.ts`:

```ts
import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';

export interface SerializeResult {
  json: string;
  decks: number;
  cards: number;
  warnings: string[];
}

/** 볼트 파일들을 cards.json 문자열로 직렬화한다 (순수). 카드 0장이면 throw. */
export function serializeCards(files: VaultFile[], version: string): SerializeResult {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.name)) warnings.push(`중복 파일명 — id 충돌 가능: ${f.name}`);
    seen.add(f.name);
  }

  const data = parseVault(files, version);
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. ## Self-Test Anchors / #flashcard/… / ### Tier / 질문?::답변 포맷을 확인하세요.');
  }

  return {
    json: JSON.stringify(data, null, 2) + '\n',
    decks: data.decks.length,
    cards: data.cards.length,
    warnings,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run obsidian-plugin/serialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add obsidian-plugin/serialize.ts obsidian-plugin/serialize.test.ts
git commit -m "feat(plugin): pure serializeCards reusing parseVault"
```

---

### Task 2: 플러그인 스캐폴드 + main.ts + 빌드 구성

**Files:**
- Create: `obsidian-plugin/main.ts`, `obsidian-plugin/manifest.json`, `obsidian-plugin/versions.json`, `obsidian-plugin/tsconfig.json`, `obsidian-plugin/esbuild.config.mjs`
- Modify: `package.json`

- [ ] **Step 1: 의존성 설치**

Run: `npm install -D obsidian builtin-modules esbuild`
Expected: 세 패키지가 devDependencies에 추가. (esbuild는 현재 transitive지만 명시 고정.)

- [ ] **Step 2: manifest.json + versions.json 생성**

`obsidian-plugin/manifest.json`:
```json
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
`obsidian-plugin/versions.json`:
```json
{ "0.1.0": "1.5.0" }
```

- [ ] **Step 3: tsconfig.json 생성 (전용, 독립 tsc -p)**

`obsidian-plugin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "ignoreDeprecations": "6.0",
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.plugin.tsbuildinfo",
    "target": "es2022",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node", "obsidian"],
    "skipLibCheck": true,
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
    "paths": { "@/*": ["../src/*"] }
  },
  "include": ["**/*.ts"]
}
```

> **경로 주의(중요):** 이 tsconfig는 `obsidian-plugin/`에 위치하므로 `include`/`paths`/`baseUrl`이 **그 디렉토리 기준**이다.
> - `include`는 `["**/*.ts"]` (NOT `["obsidian-plugin/**/*.ts"]` — 그러면 `obsidian-plugin/obsidian-plugin/**`로 해석돼 입력 0개, TS18003).
> - `paths`는 `["../src/*"]` (NOT `["./src/*"]` — repo-root `src/`는 한 단계 위). `tsconfig.scripts.json`이 `./src/*`인 건 그 파일이 repo 루트라서이며, 여기선 다르다.

- [ ] **Step 4: main.ts 생성 (Obsidian 글루)**

`obsidian-plugin/main.ts`:
```ts
import { Plugin, PluginSettingTab, Setting, Notice, type App } from 'obsidian';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { serializeCards } from './serialize.ts';

interface HachimonSettings {
  outputPath: string;
}
const DEFAULT_SETTINGS: HachimonSettings = { outputPath: '' };

export default class HachimonPlugin extends Plugin {
  settings: HachimonSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addRibbonIcon('download', 'Generate Hachimon cards.json', () => {
      void this.exportCards();
    });
    this.addCommand({
      id: 'export-cards',
      name: 'Generate cards.json',
      callback: () => {
        void this.exportCards();
      },
    });
    this.addSettingTab(new HachimonSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async exportCards(): Promise<void> {
    try {
      const out = this.settings.outputPath.trim();
      if (!out || !path.isAbsolute(out)) {
        new Notice('Hachimon: 설정에서 출력 절대 경로를 지정하세요.');
        return;
      }
      const tfiles = this.app.vault.getMarkdownFiles();
      const files = await Promise.all(
        tfiles.map(async (f) => ({ name: f.name, content: await this.app.vault.read(f) })),
      );
      const result = serializeCards(files, new Date().toISOString());
      for (const w of result.warnings) new Notice(`⚠ ${w}`);
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, result.json);
      new Notice(`✓ ${result.decks} decks / ${result.cards} cards → ${out}`);
    } catch (e) {
      new Notice(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

class HachimonSettingTab extends PluginSettingTab {
  plugin: HachimonPlugin;

  constructor(app: App, plugin: HachimonPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('출력 경로 (절대)')
      .setDesc('cards.json을 쓸 절대 경로. 예: C:/Users/you/hachimon/public/cards.json')
      .addText((t) =>
        t
          .setPlaceholder('/abs/path/to/public/cards.json')
          .setValue(this.plugin.settings.outputPath)
          .onChange(async (v) => {
            this.plugin.settings.outputPath = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
```

- [ ] **Step 5: esbuild.config.mjs 생성**

`obsidian-plugin/esbuild.config.mjs`:
```js
import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv.includes('production');

await esbuild.build({
  entryPoints: [path.join(dir, 'main.ts')],
  outfile: path.join(dir, 'main.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  external: ['obsidian', 'electron', ...builtins],
  sourcemap: prod ? false : 'inline',
  logLevel: 'info',
});
```

- [ ] **Step 6: package.json scripts 추가**

`scripts`에 추가:
```json
    "build:plugin": "node obsidian-plugin/esbuild.config.mjs production",
    "typecheck:plugin": "tsc -p obsidian-plugin/tsconfig.json"
```

- [ ] **Step 7: 타입체크 + 빌드 검증**

Run: `npm run typecheck:plugin`
Expected: 통과(exit 0). (`@/types` 미해석이면 tsconfig의 baseUrl/paths/ignoreDeprecations 확인. `obsidian` 타입 미설치면 Step 1 확인.)

Run: `npm run build:plugin`
Expected: `obsidian-plugin/main.js` 생성, esbuild "done" 로그.

- [ ] **Step 8: lint 선제 정리 + 무회귀 확인**

생성물 `obsidian-plugin/main.js`를 eslint에서 선제 제외: `eslint.config.js`의 `globalIgnores(['dist'])`를 `globalIgnores(['dist', 'obsidian-plugin/main.js'])`로 변경. (`.mjs`·`main.js`는 `**/*.{ts,tsx}` 스코프에 안 걸리지만, 커밋되는 생성물이라 명시 제외가 깔끔.)

Run: `npx tsc -b && npx vitest run && npm run lint`
Expected: 전부 통과. 만약 `obsidian-plugin/*.ts`가 `react-refresh/only-export-components`(비-컴포넌트 export)로 걸리면, `eslint.config.js`에 `{ files: ['obsidian-plugin/**/*.ts'], rules: { 'react-refresh/only-export-components': 'off' } }` 오버라이드를 추가한다(플러그인은 React가 아니므로 무의미한 규칙).

- [ ] **Step 9: Commit**

```bash
git add obsidian-plugin/main.ts obsidian-plugin/manifest.json obsidian-plugin/versions.json obsidian-plugin/tsconfig.json obsidian-plugin/esbuild.config.mjs package.json package-lock.json eslint.config.js
git commit -m "feat(plugin): Obsidian export command + build config"
```
(eslint.config.js는 Step 8에서 ignore/override를 바꿨을 때만 포함.)

---

### Task 3: main.js 산출물 커밋

**Files:**
- Create (build output): `obsidian-plugin/main.js`

- [ ] **Step 1: 프로덕션 빌드**

Run: `npm run build:plugin`
Expected: `obsidian-plugin/main.js`가 최신 소스로 생성(sourcemap 없음, prod).

- [ ] **Step 2: 산출물 커밋**

```bash
git add obsidian-plugin/main.js
git commit -m "build(plugin): commit bundled main.js for no-build install"
```

> main.js를 커밋하는 이유: 사용자가 빌드 단계 없이 `manifest.json` + `main.js`만 복사해 설치할 수 있게(개인 배포). 소스 변경 시 `npm run build:plugin` 후 재커밋한다.

---

### Task 4: 문서 · 수동 검증 절차 · ROADMAP · PR

**Files:**
- Create: `docs/obsidian-plugin.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: 설치·사용 가이드 작성**

`docs/obsidian-plugin.md` — 다음을 포함:
- 설치: `obsidian-plugin/`의 `manifest.json` + `main.js`를 `<vault>/.obsidian/plugins/hachimon/`에 복사 → Obsidian 설정 → 커뮤니티 플러그인에서 Hachimon 활성화. (데스크톱 전용.)
- 설정: 플러그인 설정 탭에서 **출력 경로(절대)** 지정 (예: repo의 `.../public/cards.json`).
- 사용: 리본 아이콘 또는 명령 팔레트 `Generate cards.json` 실행 → Notice로 `N decks / M cards` 확인 → `git push`로 배포.
- 관계: CLI(`npm run parse`)·인앱 가져오기와 **동일한 `parseVault`**를 써서 결과가 동일.

- [ ] **Step 2: 수동 검증 (사용자 환경, Obsidian 필요)**

> 이 환경엔 Obsidian이 없어 자동화 불가. 사용자가 다음을 확인:
> 1. 플러그인 로드/활성화 → 설정에 출력 경로 지정
> 2. 명령 실행 → Notice `✓ N decks / M cards` + 해당 경로에 유효한 cards.json 생성
> 3. 출력 경로 미설정/상대경로 → 안내 Notice, 쓰지 않음
> 4. 카드 없는 볼트 → 에러 Notice
>
> 계획서에는 이 절차만 기록하고, PR 본문에 "수동 검증 필요" 명시.

- [ ] **Step 3: ROADMAP 5-3 갱신**

`ROADMAP.md` 5-3 항목을 완료로:
```
### 5-3. Obsidian 플러그인 (완료 — 내보내기 명령)
- [x] `obsidian-plugin/` — 명령/리본으로 볼트 → cards.json (절대 경로, 데스크톱 전용)
- [x] `parseVault` 재사용 (in-app·CLI·플러그인 단일 진실원천)
- [~] 카드 편집 UI — 비목표(마크다운 직접 편집과 중복). 내보내기 MVP로 한정.
```

- [ ] **Step 4: 최종 게이트 + Commit + PR**

Run: `npx tsc -b && npm run typecheck:scripts && npm run typecheck:plugin && npm run lint && npx vitest run && npm run build && npm run build:plugin`
Expected: 전부 통과.

```bash
git add docs/obsidian-plugin.md ROADMAP.md
git commit -m "docs(plugin): install/usage guide + ROADMAP 5-3 done"
git push -u origin feat/obsidian-plugin
gh pr create --title "feat: Hachimon Obsidian 플러그인 (cards.json 내보내기 명령)" --body "..."
```

PR 본문에 요약·parseVault 재사용·**수동 검증 필요** 명시.

---

## 검증 게이트 요약

각 Task: 관련 vitest. Task 2·4는 `typecheck:plugin` + `build:plugin`(main.js 산출) + 기존 `tsc -b`/`lint`/`vitest` 무회귀. Obsidian 라이프사이클은 사용자 수동 검증(자동화 불가, PR에 명시).
