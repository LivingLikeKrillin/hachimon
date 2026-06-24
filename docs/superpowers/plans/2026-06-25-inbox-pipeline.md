# 인박스 → 노트 → 분류 → 퀴즈 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian 인박스의 raw 캡처(.md)를 Claude로 **정리된 노트 + 덱 분류 + 3-tier 퀴즈 카드**가 담긴 draft로 변환하는 Node/TS CLI(`npm run inbox`)를 만든다.

**Architecture:** 순수 로직(`src/lib/forge/*` — 스키마·프롬프트·덱추출·노트조립)과 부수효과(`scripts/inbox.ts` — fs I/O·Claude 호출·오케스트레이션)를 분리한다. 노트 조립 결과는 앱·CLI·플러그인과 동일한 단일 진실원천 파서 `parseVault`로 라운드트립 검증(카드 ≥1)한 뒤에만 draft로 쓴다. Claude 호출은 `@anthropic-ai/sdk`의 `messages.parse()` + zod 스키마로 구조화 출력을 강제한다.

**Tech Stack:** Node 22 (ESM), TypeScript(strict), tsx(실행), Vitest(테스트), zod(런타임 스키마), `@anthropic-ai/sdk`(CLI 전용). 파서 재사용: `src/lib/obsidian.ts`(`parseVault`). 모델: `claude-opus-4-8`(adaptive thinking).

**Spec:** `docs/superpowers/specs/2026-06-24-inbox-pipeline-design.md`

---

## File Structure

| 파일 | 책임 | 변경 | 의존 |
|------|------|------|------|
| `src/lib/forge/schema.ts` | zod 스키마 2종(`StructureSchema`/`QuizSchema`) + TS 타입 | 신규 | zod |
| `src/lib/forge/prompts.ts` | 프롬프트 빌더 2종(structure+classify, quiz). 덱 목록·티어 루브릭 주입 | 신규 | schema.ts(type) |
| `src/lib/forge/decks.ts` | 기존 덱 목록 추출(유니크·`flashcard/`접두 제거·정렬) | 신규 | obsidian.ts, types |
| `src/lib/forge/assemble.ts` | 노트 조립·slug 생성·중복 회피·parseVault 라운드트립 검증 | 신규 | obsidian.ts, schema.ts(type) |
| `scripts/inbox.ts` | CLI: 인자 파싱·fs·Claude 호출·오케스트레이션·draft 쓰기 | 신규 | 위 전부 + @anthropic-ai/sdk |
| `scripts/inbox.args.test.ts` | `parseArgs` 단위 테스트 | 신규 | — |
| `scripts/parse-vault.ts` | `EXCLUDE_DIRS`에 `_forge-drafts`·`inbox` 추가 | 수정 | — |
| `package.json` | `zod` dep, `@anthropic-ai/sdk` devDep, `inbox` script | 수정 | — |
| `README.md` / `ROADMAP.md` | 사용법·로드맵 갱신 | 수정 | — |

**부수효과 격리 원칙:** `src/lib/forge/*`는 **파일/네트워크 접근 없음**(순수 함수만). 모든 I/O와 Claude 호출은 `scripts/inbox.ts`에 격리한다. 이렇게 하면 forge 로직 전부를 네트워크 없이 단위 테스트할 수 있고, `inbox.ts`는 인자 파서만 테스트하면 된다.

**import 규칙(기존 `parse-vault.ts`와 동일):** 스크립트→`src/lib/*`는 **상대경로 + `.ts` 확장자**(`tsx`가 `@` 별칭을 런타임 해석하지 않으므로). 예: `import { parseVault, type VaultFile } from '../src/lib/obsidian.ts'`. `verbatimModuleSyntax`를 위해 타입은 inline `type` 수식어 사용. `src/lib/forge/*` 내부의 `@/types` import는 런타임 소거되고 타입체크는 `tsconfig.scripts.json`/`tsconfig.app.json`의 `@/*` 별칭으로 해석된다.

**의존성 배치 근거(스펙 §8):** `zod`는 **dependencies**(런타임 — `src/lib/forge/schema.ts`가 import하고 `tsconfig.app.json`의 `include:["src"]`가 타입체크 대상에 포함). `@anthropic-ai/sdk`는 **devDependencies**(`scripts/inbox.ts`만 import → app 번들 미포함). forge 파일은 앱 엔트리에서 import되지 않으므로 Vite 번들에 들어가지 않는다(타입체크만 됨).

---

## Chunk 1: 순수 로직 (schema · prompts · decks)

### Task 1: 의존성 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: zod(런타임) + SDK(개발) 설치**

Run:
```bash
npm install zod
npm install -D @anthropic-ai/sdk
```
Expected: `dependencies`에 `zod`, `devDependencies`에 `@anthropic-ai/sdk` 추가.

- [ ] **Step 2: 무회귀 확인**

Run: `npx tsc -b && npm run typecheck:scripts`
Expected: 통과(exit 0). 설치만으로 기존 빌드 영향 없음.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(forge): add zod (dep) + @anthropic-ai/sdk (devDep)"
```

---

### Task 2: schema.ts — zod 스키마 2종

**Files:**
- Create: `src/lib/forge/schema.ts`, `src/lib/forge/schema.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/forge/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { StructureSchema, QuizSchema } from './schema.ts';

describe('StructureSchema', () => {
  it('유효한 객체를 파싱한다', () => {
    const r = StructureSchema.safeParse({
      title: 'React Hooks',
      body: '본문...',
      deck: 'react/core',
      rationale: '이유',
    });
    expect(r.success).toBe(true);
  });

  it('필드 누락을 거부한다', () => {
    expect(StructureSchema.safeParse({ title: 'x', body: 'y', deck: 'z' }).success).toBe(false);
  });

  it('타입 오류를 거부한다', () => {
    expect(
      StructureSchema.safeParse({ title: 1, body: 'y', deck: 'z', rationale: 'r' }).success,
    ).toBe(false);
  });
});

describe('QuizSchema', () => {
  it('3티어 카드 배열을 파싱한다', () => {
    const r = QuizSchema.safeParse({
      foundation: [{ q: 'Q1?', a: 'A1' }],
      mechanism: [],
      diagnosis: [{ q: 'Q3?', a: 'A3' }],
    });
    expect(r.success).toBe(true);
  });

  it('카드 필드(q/a) 누락을 거부한다', () => {
    expect(
      QuizSchema.safeParse({ foundation: [{ q: 'Q?' }], mechanism: [], diagnosis: [] }).success,
    ).toBe(false);
  });

  it('티어 키 누락을 거부한다', () => {
    expect(QuizSchema.safeParse({ foundation: [], mechanism: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/forge/schema.test.ts`
Expected: FAIL — `schema.ts` 미존재.

- [ ] **Step 3: schema.ts 구현**

`src/lib/forge/schema.ts`:

```ts
import { z } from 'zod';

/** Claude 호출①(노트정리+분류) 출력 */
export const StructureSchema = z.object({
  title: z.string(),
  body: z.string(),
  deck: z.string(),
  rationale: z.string(),
});
export type StructureResult = z.infer<typeof StructureSchema>;

const QuizCardSchema = z.object({ q: z.string(), a: z.string() });

/** Claude 호출②(퀴즈 생성) 출력. 티어별 0개 이상. */
export const QuizSchema = z.object({
  foundation: z.array(QuizCardSchema),
  mechanism: z.array(QuizCardSchema),
  diagnosis: z.array(QuizCardSchema),
});
export type QuizResult = z.infer<typeof QuizSchema>;
export type QuizCard = z.infer<typeof QuizCardSchema>;
```

> 구조화 출력 제약(claude-api 스킬): 객체는 `additionalProperties:false` 필요 — `messages.parse` + `zodOutputFormat`가 자동 처리. `.min()`/`.max()` 등 수치/길이 제약은 구조화 출력이 미지원하므로 **쓰지 않는다**. 위 스키마는 단순 타입만 사용해 안전하다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/forge/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forge/schema.ts src/lib/forge/schema.test.ts
git commit -m "feat(forge): zod schemas for structure + quiz results"
```

---

### Task 3: prompts.ts — 프롬프트 빌더 2종

**Files:**
- Create: `src/lib/forge/prompts.ts`, `src/lib/forge/prompts.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/forge/prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildStructurePrompt, buildQuizPrompt } from './prompts.ts';

describe('buildStructurePrompt', () => {
  it('덱 목록과 raw 노트를 프롬프트에 포함한다', () => {
    const p = buildStructurePrompt('raw 캡처 내용', ['spring/core', 'react/hooks']);
    expect(p).toContain('raw 캡처 내용');
    expect(p).toContain('spring/core');
    expect(p).toContain('react/hooks');
  });

  it('덱 목록이 비면 새 덱 제안 지시를 포함한다', () => {
    const p = buildStructurePrompt('내용', []);
    expect(p.toLowerCase()).toContain('deck');
  });
});

describe('buildQuizPrompt', () => {
  it('정리된 본문과 3티어 루브릭을 포함한다', () => {
    const p = buildQuizPrompt({
      title: 'T',
      body: '정리된 본문',
      deck: 'spring/core',
      rationale: 'r',
    });
    expect(p).toContain('정리된 본문');
    expect(p).toContain('Foundation');
    expect(p).toContain('Mechanism');
    expect(p).toContain('Diagnosis');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/forge/prompts.test.ts`
Expected: FAIL — `prompts.ts` 미존재.

- [ ] **Step 3: prompts.ts 구현**

`src/lib/forge/prompts.ts`:

```ts
import type { StructureResult } from './schema.ts';

/** 호출①: raw 캡처를 정리된 노트 + 덱 분류로 변환하는 프롬프트. */
export function buildStructurePrompt(rawNote: string, decks: string[]): string {
  const deckList =
    decks.length > 0
      ? decks.map((d) => `- ${d}`).join('\n')
      : '(기존 덱 없음)';
  return `당신은 개인 지식관리 시스템의 노트 정리 도우미다. 아래 raw 캡처를 정리된 노트로 변환하고 가장 적합한 덱을 고른다.

# 기존 덱 목록 (슬래시 경로)
${deckList}

# 지시
- title: 노트의 핵심을 담은 간결한 제목.
- body: 캡처 내용을 정돈한 마크다운 본문(코드블록·강조 보존). 사실을 추가 날조하지 말 것.
- deck: 위 목록에서 **가장 적합한 기존 덱**을 슬래시 경로(예: spring/core)로 고른다. 명백히 새 주제면 같은 스타일의 새 경로를 제안한다.
- rationale: 덱 선택 이유 한 문장.

# raw 캡처
${rawNote}`;
}

const TIER_RUBRIC = `- Foundation: 개념 확인 — 정의·용어. (예: "X란 무엇인가?")
- Mechanism: 동작 원리 — 내부 구현·비교. (예: "X는 내부적으로 어떻게 동작하는가?")
- Diagnosis: 실전 진단 — 트러블슈팅·설계 판단. (예: "X 상황에서 무엇을 의심하고 어떻게 해결하는가?")`;

/** 호출②: 정리된 노트로 3-tier 퀴즈 카드를 생성하는 프롬프트. */
export function buildQuizPrompt(structure: StructureResult): string {
  return `당신은 간격 반복 학습용 플래시카드 저자다. 아래 노트로 3-tier 퀴즈 카드를 만든다.

# 3-tier 난이도 루브릭
${TIER_RUBRIC}

# 지시
- 티어별 1~3개 카드를 권장한다. 본문이 빈약한 티어는 0개여도 된다.
- q: '?'로 끝나는 질문. a: 멀티라인 마크다운 가능, 노트 근거에 충실할 것.
- 노트에 없는 사실을 날조하지 말 것.

# 노트 제목
${structure.title}

# 노트 본문
${structure.body}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/forge/prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forge/prompts.ts src/lib/forge/prompts.test.ts
git commit -m "feat(forge): structure + quiz prompt builders with deck list and tier rubric"
```

---

### Task 4: decks.ts — 기존 덱 목록 추출

**Files:**
- Create: `src/lib/forge/decks.ts`, `src/lib/forge/decks.test.ts`

> 설계: `parseVault`가 만드는 덱 id는 `flashcard/spring/core`(태그 `#flashcard/...`에서 `#`만 제거). 한편 모델이 출력하고 `assemble`이 재조립하는 deck은 `spring/core`(접두 `flashcard/` 없음). 두 표현을 같은 네임스페이스로 맞추기 위해 추출 시 **`flashcard/` 접두를 제거**한다. 이렇게 하면 프롬프트에 주입된 기존 덱 목록과 모델 출력이 일관된다.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/forge/decks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { CardsData } from '@/types';
import { uniqueDeckPaths, decksFromVault } from './decks.ts';

const cardsData: CardsData = {
  version: 'V1',
  decks: [
    { id: 'flashcard/spring/core', name: 'core', path: ['flashcard', 'spring', 'core'], cardCount: 2 },
    { id: 'flashcard/react/hooks', name: 'hooks', path: ['flashcard', 'react', 'hooks'], cardCount: 1 },
  ],
  cards: [],
};

describe('uniqueDeckPaths', () => {
  it('flashcard/ 접두를 제거하고 정렬한다', () => {
    expect(uniqueDeckPaths(cardsData)).toEqual(['react/hooks', 'spring/core']);
  });

  it('빈 덱이면 빈 배열', () => {
    expect(uniqueDeckPaths({ version: 'V', decks: [], cards: [] })).toEqual([]);
  });
});

describe('decksFromVault', () => {
  it('vault 파일을 parseVault로 파싱해 덱 경로를 추출한다', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/spring/tx',
      '### Foundation',
      '전파란?::규칙.',
    ].join('\n');
    expect(decksFromVault([{ name: 'Spring.md', content }])).toEqual(['spring/tx']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/forge/decks.test.ts`
Expected: FAIL — `decks.ts` 미존재.

- [ ] **Step 3: decks.ts 구현**

`src/lib/forge/decks.ts`:

```ts
import type { CardsData } from '@/types';
import { parseVault, type VaultFile } from '../obsidian.ts';

/** 덱 id에서 `flashcard/` 접두를 제거(있으면). */
function stripFlashcardPrefix(deckId: string): string {
  return deckId.replace(/^flashcard\//, '');
}

/** CardsData에서 유니크 덱 경로(접두 제거·정렬)를 추출한다. */
export function uniqueDeckPaths(data: CardsData): string[] {
  const set = new Set<string>();
  for (const d of data.decks) set.add(stripFlashcardPrefix(d.id));
  return Array.from(set).sort();
}

/** vault 파일들을 parseVault로 파싱해 유니크 덱 경로를 추출한다. */
export function decksFromVault(files: VaultFile[]): string[] {
  return uniqueDeckPaths(parseVault(files));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/forge/decks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forge/decks.ts src/lib/forge/decks.test.ts
git commit -m "feat(forge): extract unique deck paths from cards.json or vault"
```

---

### Chunk 1 검증 게이트

- [ ] Run: `npx vitest run src/lib/forge/ && npm run typecheck:scripts && npx tsc -b`
- [ ] Expected: forge 단위 테스트 전부 PASS, 스크립트·앱 타입체크 통과.
- [ ] **플랜 리뷰:** plan-document-reviewer 서브에이전트로 Chunk 1 리뷰 → 이슈 수정 → 재리뷰 → ✅.

---

## Chunk 2: 노트 조립 + 검증 게이트 (assemble)

### Task 5: assemble.ts — slug · 중복 회피 · 조립 · 라운드트립 검증

**Files:**
- Create: `src/lib/forge/assemble.ts`, `src/lib/forge/assemble.test.ts`

> 핵심 게이트: 조립 결과를 **실제 `parseVault`(스텁 아님)** 로 라운드트립해 카드가 추출되는지 확인한다. 이것이 "draft를 vault로 옮겼을 때 실제로 카드가 빌드되는가"를 보증하는 단일 진실원천 검증이다.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/forge/assemble.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseVault } from '../obsidian.ts';
import { toSlug, uniqueSlug, assembleNote, countParsedCards } from './assemble.ts';
import type { QuizResult } from './schema.ts';

const CREATED = '2026-06-25T00:00:00.000Z';

const quiz: QuizResult = {
  foundation: [{ q: '트랜잭션 전파란', a: '경계 동작 규칙.' }], // '?' 없음 → 자동 부여 확인
  mechanism: [{ q: 'PROPAGATION_REQUIRED는 어떻게 동작하는가?', a: '기존 트랜잭션에 참여.' }],
  diagnosis: [],
};

describe('toSlug', () => {
  it('공백/언더스코어를 하이픈으로, 소문자화', () => {
    expect(toSlug('Spring Transaction')).toBe('spring-transaction');
  });
  it('파일시스템 위험 문자를 제거하고 한글은 보존', () => {
    expect(toSlug('리액트: 훅/상태?')).toBe('리액트-훅상태');
  });
  it('전부 제거되면 fallback', () => {
    expect(toSlug('  /  ')).toBe('note');
  });
});

describe('uniqueSlug', () => {
  it('충돌 시 -2, -3 접미사', () => {
    const taken = new Set(['x', 'x-2']);
    expect(uniqueSlug('x', taken)).toBe('x-3');
    expect(uniqueSlug('y', taken)).toBe('y');
  });
});

describe('assembleNote', () => {
  const md = assembleNote(
    { title: 'Spring Transaction', body: '본문 텍스트.', deck: 'spring/core', quiz },
    CREATED,
  );

  it('draft frontmatter와 Self-Test Anchors 블록을 포함한다', () => {
    expect(md).toContain('hachimon: draft');
    expect(md).toContain('deck: spring/core');
    expect(md).toContain(`created: ${CREATED}`);
    expect(md).toContain('## Self-Test Anchors');
    expect(md).toContain('#flashcard/spring/core');
  });

  it("질문에 '?'가 없으면 1개 부여하고, 있으면 중복 추가 안 함", () => {
    expect(md).toContain('트랜잭션 전파란?::경계 동작 규칙.');
    expect(md).toContain('PROPAGATION_REQUIRED는 어떻게 동작하는가?::기존 트랜잭션에 참여.');
    expect(md).not.toContain('??');
  });

  it('빈 티어(diagnosis) 헤딩을 생략한다', () => {
    expect(md).toContain('### Foundation');
    expect(md).toContain('### Mechanism');
    expect(md).not.toContain('### Diagnosis');
  });

  it('parseVault 라운드트립으로 카드가 추출된다 (핵심 게이트)', () => {
    const data = parseVault([{ name: 'Spring-Transaction.md', content: md }]);
    expect(data.cards.length).toBe(2);
    expect(data.cards[0].deck).toBe('flashcard/spring/core');
    expect(data.cards.map((c) => c.tier).sort()).toEqual(['foundation', 'mechanism']);
  });
});

describe('countParsedCards', () => {
  it('조립 문자열에서 카드 수를 센다', () => {
    const md = assembleNote(
      { title: 'T', body: 'b', deck: 'd/e', quiz: { foundation: [{ q: 'Q?', a: 'A' }], mechanism: [], diagnosis: [] } },
      CREATED,
    );
    expect(countParsedCards(md)).toBe(1);
  });

  it('카드가 없으면 0', () => {
    const md = assembleNote(
      { title: 'T', body: 'b', deck: 'd/e', quiz: { foundation: [], mechanism: [], diagnosis: [] } },
      CREATED,
    );
    expect(countParsedCards(md)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/forge/assemble.test.ts`
Expected: FAIL — `assemble.ts` 미존재.

- [ ] **Step 3: assemble.ts 구현**

`src/lib/forge/assemble.ts`:

```ts
import { parseVault } from '../obsidian.ts';
import type { QuizCard, QuizResult } from './schema.ts';
import type { Tier } from '@/types';

export interface AssembleInput {
  title: string;
  body: string;
  deck: string;
  quiz: QuizResult;
}

/** 제목 → 파일시스템 안전 slug. 한글 등 유니코드는 보존, 경로/특수문자는 제거. */
export function toSlug(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[\\/:*?"<>|#]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'note';
}

/** drafts 디렉토리 내 유일성 보장: 충돌 시 -2, -3 … 접미사. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const TIER_ORDER: { tier: Tier; heading: string; cards: (q: QuizResult) => QuizCard[] }[] = [
  { tier: 'foundation', heading: 'Foundation', cards: (q) => q.foundation },
  { tier: 'mechanism', heading: 'Mechanism', cards: (q) => q.mechanism },
  { tier: 'diagnosis', heading: 'Diagnosis', cards: (q) => q.diagnosis },
];

/** 질문 끝에 '?'가 없으면 1개 부여(중복 추가 금지). */
function ensureQuestionMark(q: string): string {
  const t = q.trimEnd();
  return t.endsWith('?') ? t : `${t}?`;
}

/** 정리된 노트 + 3-tier 퀴즈를 draft 마크다운으로 조립한다. created는 결정성을 위해 주입. */
export function assembleNote(input: AssembleInput, created: string): string {
  const lines: string[] = [
    '---',
    'hachimon: draft',
    `deck: ${input.deck}`,
    `created: ${created}`,
    '---',
    `# ${input.title}`,
    '',
    input.body.trim(),
    '',
    '## Self-Test Anchors',
    `#flashcard/${input.deck}`,
  ];

  for (const { heading, cards } of TIER_ORDER) {
    const list = cards(input.quiz);
    if (list.length === 0) continue; // 빈 티어 헤딩 생략(파싱 노이즈 방지)
    lines.push('', `### ${heading}`);
    for (const c of list) {
      lines.push(`${ensureQuestionMark(c.q)}::${c.a}`);
    }
  }

  return lines.join('\n') + '\n';
}

/** 조립 문자열을 단일 진실원천 파서로 라운드트립해 추출되는 카드 수를 센다(검증 게이트). */
export function countParsedCards(content: string, version = 'forge-validate'): number {
  return parseVault([{ name: 'draft.md', content }], version).cards.length;
}
```

> 멀티라인 답변 주의: `c.a`에 개행이 있으면 그대로 `${q}::${a}`에 들어가고, 파서는 다음 카드/티어/헤딩 전까지 이어붙인다(파서 규칙 호환). 답변 중간 줄에 `::`가 있으면 파서가 새 질문으로 오인할 수 있으나, 이는 기존 파서의 알려진 한계이며 검증 게이트가 0-카드는 잡는다(스펙 §4.3, 범위 외).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/forge/assemble.test.ts`
Expected: PASS (전체 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/lib/forge/assemble.ts src/lib/forge/assemble.test.ts
git commit -m "feat(forge): assemble draft note + parseVault roundtrip validation gate"
```

---

### Chunk 2 검증 게이트

- [ ] Run: `npx vitest run src/lib/forge/ && npm run typecheck:scripts && npx tsc -b`
- [ ] Expected: 전부 PASS/통과.
- [ ] **플랜 리뷰:** plan-document-reviewer 서브에이전트로 Chunk 2 리뷰 → 수정 → ✅.

---

## Chunk 3: CLI (`scripts/inbox.ts`) + 배선 + 문서

### Task 6: parseArgs — 인자 파서 (순수)

**Files:**
- Create: `scripts/inbox.ts`, `scripts/inbox.args.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/inbox.args.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseArgs } from './inbox.ts';

describe('parseArgs', () => {
  it('positional inbox-dir와 기본값', () => {
    const a = parseArgs(['./inbox']);
    expect(a.inboxDir).toBe('./inbox');
    expect(a.outDir).toBe('_forge-drafts');
    expect(a.deckSource).toBe('public/cards.json');
    expect(a.model).toBe('claude-opus-4-8');
    expect(a.dryRun).toBe(false);
    expect(a.keep).toBe(false);
  });

  it('-o / --out, --deck-source, --model 값 지정', () => {
    const a = parseArgs(['./in', '-o', 'drafts', '--deck-source', '/v', '--model', 'claude-opus-4-7']);
    expect(a.outDir).toBe('drafts');
    expect(a.deckSource).toBe('/v');
    expect(a.model).toBe('claude-opus-4-7');
  });

  it('--dry-run, --keep 플래그', () => {
    const a = parseArgs(['./in', '--dry-run', '--keep']);
    expect(a.dryRun).toBe(true);
    expect(a.keep).toBe(true);
  });

  it('inbox-dir 누락 시 throw', () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(['--dry-run'])).toThrow();
  });

  it('값 요구 플래그에 값이 없으면 throw', () => {
    expect(() => parseArgs(['./in', '-o'])).toThrow();
    expect(() => parseArgs(['./in', '--model'])).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run scripts/inbox.args.test.ts`
Expected: FAIL — `inbox.ts` / `parseArgs` 미존재.

- [ ] **Step 3: inbox.ts에 parseArgs 구현 (파일 상단)**

`scripts/inbox.ts` (우선 인자 파서만; 기존 `parse-vault.ts`의 "값 요구 플래그는 USAGE throw" 패턴 재사용):

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run scripts/inbox.args.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/inbox.ts scripts/inbox.args.test.ts
git commit -m "feat(inbox): CLI arg parser"
```

---

### Task 7: Claude 호출 + 오케스트레이션 + main

**Files:**
- Modify: `scripts/inbox.ts`

> 이 Task는 fs·네트워크를 포함하므로 단위 테스트하지 않는다(스펙 §9). 검증은 Task 9의 `--dry-run` 수동 실행. Claude 호출은 두 async resolver(`structureAndClassify`, `generateQuiz`)로 격리하고, 조립·검증은 forge 순수 함수에 위임한다.

- [ ] **Step 1: import + Claude resolver 추가 (파일 상단에 import, parseArgs 아래에 함수)**

`scripts/inbox.ts` 상단 import:

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';
import type { CardsData } from '../src/types/index.ts';
import { StructureSchema, QuizSchema, type StructureResult, type QuizResult } from '../src/lib/forge/schema.ts';
import { buildStructurePrompt, buildQuizPrompt } from '../src/lib/forge/prompts.ts';
import { uniqueDeckPaths, decksFromVault } from '../src/lib/forge/decks.ts';
import { assembleNote, toSlug, uniqueSlug, validateDraft } from '../src/lib/forge/assemble.ts';
import { collectMarkdownFiles } from './parse-vault.ts'; // 재귀 .md 수집 재사용(부수효과 없는 export)
```

> 이 8~9줄을 **파일 상단 단일 import 블록**으로 둔다(중간 import 금지). 아래 Step 2의 함수 본문에는 import를 넣지 않는다 — 전부 이 블록에서 해결된다.

Claude 호출 함수:

```ts
const MAX_TOKENS = 16000;

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
    output_config: { format: zodOutputFormat(StructureSchema, 'structure') },
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
    output_config: { format: zodOutputFormat(QuizSchema, 'quiz') },
    messages: [{ role: 'user', content: buildQuizPrompt(structure) }],
  });
  if (res.stop_reason === 'max_tokens') console.warn('⚠ quiz: max_tokens 도달 — 출력이 잘렸을 수 있음');
  if (!res.parsed_output) throw new Error('quiz 파싱 실패(stop_reason=' + res.stop_reason + ')');
  return res.parsed_output;
}
```

> claude-api 스킬 준거: 모델 `claude-opus-4-8`(날짜 접미사 금지). `temperature`/`top_p`/`top_k`·assistant prefill·`budget_tokens` 금지(400). 구조화 출력은 `messages.parse()` + `zodOutputFormat`. quiz는 adaptive thinking. `max_tokens 16000`은 비스트리밍 SDK 타임아웃 안전 범위.
>
> **zodOutputFormat 버전 폴백:** `@anthropic-ai/sdk/helpers/zod`가 설치된 zod 버전과 마찰을 일으키면(타입/런타임 오류), `output_config.format`을 명시적 JSON 스키마로 대체하고(`{ type: 'json_schema', name, schema }`) `messages.create()` 응답 텍스트를 우리 zod 스키마(`StructureSchema`/`QuizSchema`)로 `parse`한다. schema.ts가 단일 진실원천이므로 이 폴백도 동일 검증을 거친다.

- [ ] **Step 2: 덱 소스 로더 + 인박스 읽기 + 오케스트레이션 + main 추가**

```ts
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

export interface RunResult { processed: number; drafted: number; held: number; }

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

      const v = validateDraft(md, quiz);
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
```

> 주의: 모든 import는 Step 1의 **파일 상단 단일 블록**에 있다(함수 본문에 import 금지). `verbatimModuleSyntax`를 위해 타입은 `type` 수식어로.
>
> `parse-vault.ts` import 시 부수효과 주의: `parse-vault.ts`는 `if (process.argv[1] === …) main()` 가드가 있어 import만으로 실행되지 않는다. `collectMarkdownFiles`는 부수효과 없는 export이므로 안전.
>
> **`@/types` 런타임 불변식(load-bearing):** forge 파일·테스트의 `@/types` import는 **반드시 `import type`** 로 유지한다. tsx는 `@` 별칭을 런타임 해석하지 않으므로, 값(value)을 `@/types`에서 import하면 런타임에 깨진다(타입은 `verbatimModuleSyntax`로 소거됨). 향후 편집에서도 이 규칙을 지킬 것. (Vitest는 Vite config의 `@` 별칭으로 해석하므로 테스트의 `import type`는 무해.)

- [ ] **Step 2-b: import 정리 + 타입체크**

`scripts/inbox.ts`의 모든 import를 파일 상단 단일 블록으로 모은다(중복/중간 import 제거).

Run: `npm run typecheck:scripts`
Expected: 통과. `@anthropic-ai/sdk` 타입 해석 확인. 만약 `messages.parse`/`zodOutputFormat` 시그니처 불일치면 Step 1의 폴백 노트대로 `messages.create` + 명시적 JSON 스키마로 전환.

- [ ] **Step 3: 인자 파서 무회귀 + 전체 단위 테스트**

Run: `npx vitest run`
Expected: 신규 forge·inbox.args 테스트 포함 전부 PASS(네트워크 호출 없음).

- [ ] **Step 4: Commit**

```bash
git add scripts/inbox.ts
git commit -m "feat(inbox): Claude calls + orchestration + draft writing"
```

---

### Task 8: 배선 — package.json script + EXCLUDE_DIRS

**Files:**
- Modify: `package.json`, `scripts/parse-vault.ts`

- [ ] **Step 1: npm script 추가**

`package.json`의 `scripts`에 추가:
```json
    "inbox": "tsx scripts/inbox.ts",
```

- [ ] **Step 2: parse-vault.ts EXCLUDE_DIRS 갱신**

`scripts/parse-vault.ts:8`:
```ts
const EXCLUDE_DIRS = new Set(['node_modules', '_forge-drafts', 'inbox']);
```
이유: vault 빌드 시 raw 인박스(`inbox`)와 미검수 draft(`_forge-drafts`)가 `cards.json`으로 빌드되지 않도록 제외(스펙 §4.5, §8).

- [ ] **Step 3: EXCLUDE 무회귀 확인**

Run: `npx vitest run scripts/parse-vault.test.ts && npm run typecheck:scripts`
Expected: 기존 parse-vault 테스트 PASS(제외 디렉토리 추가가 기존 케이스에 영향 없음).

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/parse-vault.ts
git commit -m "build(inbox): npm run inbox + exclude _forge-drafts/inbox from vault build"
```

---

### Task 9: 수동 스모크 (--dry-run) · 문서 · ROADMAP · PR

**Files:**
- Modify: `README.md`, `ROADMAP.md`

- [ ] **Step 1: --dry-run 스모크 (인자/에러 경로 — 키 불필요)**

> 아래는 **Bash 툴(Git Bash)** 기준. PowerShell만 쓰면 `$env:TEMP`·PowerShell 문법으로 변환.

키 없이 에러 경로부터 확인:
```bash
npm run inbox --                      # inbox-dir 누락 → usage + exit 1
mkdir -p /tmp/hinbox-empty && npm run inbox -- /tmp/hinbox-empty ; echo "exit=$?"  # 빈 폴더(.md 없음) → exit 1
unset ANTHROPIC_API_KEY; mkdir -p /tmp/hinbox && printf '리액트 훅 useState 메모\n상태를 함수형 컴포넌트에서 관리.\n' > /tmp/hinbox/note.md
npm run inbox -- /tmp/hinbox --dry-run ; echo "exit=$?"   # 키 없음 → exit 1
```
Expected: 각각 명확한 에러 + `exit=1`.

- [ ] **Step 2: 실제 Claude --dry-run (키 필요 — 사용자 환경)**

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # 사용자 환경
npm run inbox -- /tmp/hinbox --dry-run --deck-source public/cards.json
```
Expected: 콘솔에 조립된 draft 마크다운 출력(frontmatter + `## Self-Test Anchors` + 3-tier 카드), 인박스 파일 미삭제, 요약 `✓ 1개 처리 / 1개 draft 생성 / 0개 보류`. 출력 draft를 눈으로 확인해 카드가 실제로 추출 가능한 형식인지 검증.

> 키가 없는 환경이면 이 Step은 사용자에게 위임하고, Step 1의 에러 경로 스모크 + 단위 테스트(특히 assemble 라운드트립)로 대체 검증한다.

- [ ] **Step 3: README에 인박스 파이프라인 절 추가**

`README.md`에 추가:
- `npm run inbox -- <inbox-dir> [--dry-run]` 사용법, 옵션 표(`-o`/`--deck-source`/`--model`/`--dry-run`/`--keep`).
- `ANTHROPIC_API_KEY` 필요.
- 흐름: 인박스 raw `.md` → Claude 2회 호출(정리·분류 / 퀴즈) → `_forge-drafts/<deck>/<slug>.md` → 사용자가 Obsidian에서 검토·승격(이동) → `npm run parse`로 `cards.json` 빌드.
- 덱은 **태그로 결정**되므로 draft를 vault 어디로 옮겨도 분류 보존.

- [ ] **Step 4: ROADMAP 갱신**

`ROADMAP.md`에 인박스 파이프라인 항목을 완료로 기록(Node/TS CLI, parseVault 라운드트립 게이트, 하이브리드 2회 호출, 사람 검수 draft→승격 유지).

- [ ] **Step 5: 최종 게이트 + PR**

Run: `npx tsc -b && npm run typecheck:scripts && npm run lint && npx vitest run && npm run build`
Expected: 전부 통과.

```bash
git add README.md ROADMAP.md
git commit -m "docs(inbox): pipeline usage + ROADMAP"
git push -u origin feat/inbox-pipeline
gh pr create --title "feat: 인박스 → 노트 → 분류 → 퀴즈 생성 파이프라인 CLI" --body "..."
```

> 머지 전 승인은 사용자 몫(메모리: master 직접 커밋 금지, PR→merge). PR 본문에 스펙 링크와 검증 방법(단위 테스트 + --dry-run) 명시.

---

### Chunk 3 검증 게이트

- [ ] Run: `npx tsc -b && npm run typecheck:scripts && npm run lint && npx vitest run`
- [ ] Expected: 전부 통과(신규 테스트 포함).
- [ ] **플랜 리뷰:** plan-document-reviewer 서브에이전트로 Chunk 3 리뷰 → 수정 → ✅.

---

## 검증 게이트 요약

| 단계 | 검증 |
|------|------|
| 각 Task | 해당 테스트 `npx vitest run <file>` (TDD red→green) |
| Chunk 1·2 | forge 단위 테스트 + `typecheck:scripts` + `tsc -b` |
| Chunk 3 | `parse-vault.test` 무회귀 + 인자 테스트 + `--dry-run` 수동 스모크 |
| 최종 | `tsc -b` + `typecheck:scripts` + `lint` + `vitest run` + `build` |

**핵심 게이트:** `assemble.ts`의 `validateDraft` — 조립 결과를 실제 `parseVault`로 라운드트립해 **의도한 카드(개수·질문)가 그대로 추출되는지** 확인한다. 단순 카드≥1 카운트로는 못 잡던 묵시적 손상(답변/질문 내 `::`·`###`·`#flashcard` 같은 구조 문자로 카드가 잘리거나 분리되는 경우)을 잡아 해당 노트를 보류시킨다. 이것이 "draft가 vault에서 의도대로 카드로 빌드되는가"를 단일 진실원천으로 보증한다. 네트워크/Claude 호출은 단위 테스트하지 않고 `--dry-run` 수동 검증으로 대체한다(스펙 §9).
