# anchor 데스크톱 메모 인박스 (`memo` kind) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** anchor에 **세 번째 입력 종류 `memo`**를 더한다 — 데스크톱 메모장 `.txt`를 인박스 폴더에서 포커스 스캔으로 당겨 Claude가 정리(제목+본문+태그)하고, 1초 확인 후 승격하면 vault 일반 노트로 안착(작품 허브 없음).

**Architecture:** 기존 `capture`/`reflection` 두 kind 위에 `kind` 판별자를 확장한다. memo는 로컬 생성(랜덤 UUID·.txt mtime, 이미지 없음), reflection의 텍스트-모드 변환·텍스트 노트 골격을 재사용하되 **입구는 폴더 인입**(`ingestInbox`), **work/허브 없음**, 노트 포맷은 섹션 없는 일반 노트. 순수 코어(note·memo-schema·promote)는 부수효과(fs·SDK)와 분리.

**Tech Stack:** Electron + electron-vite + React 19 + TypeScript + `@anthropic-ai/sdk`(텍스트 `messages.parse`+`zodOutputFormat`, `claude-opus-4-8`), `zod`, `vitest`. 구현 repo: `C:/Users/Eisen/Desktop/Labs/[projects] trial/anchor`. 스펙: `hachimon/docs/superpowers/specs/2026-06-26-anchor-memo-design.md`.

---

## 전제 / 시작 상태

- **구현은 `anchor` repo에서**. 시작 브랜치: anchor `master`에서 `feat/memo-kind` 분기. 커밋은 conventional commits + 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 게이트: `npm run test`(vitest, 현재 58), `npm run typecheck`(tsc node+web, strict, **테스트 파일 포함**), `npm run lint`(eslint --max-warnings 0), `npm run build`(electron-vite). **기존 capture·reflection 회귀 0** 필수.
- 확인된 기존 코드(재사용 대상): `core/note.ts`의 `parseFrontmatter`·`union`·`shortId`·`memoBlock`·`sectionBody`(모듈 비공개), `noteKind`(정규식 `/^kind:\s*([\w-]+)/m`), `reflectionFrontmatter` 패턴; `core/promote.ts`의 `joinPosix`·`stripStagingFrontmatter`·`reflectionPromoteTargets`; `main/transform.ts`의 `transformReflection`(텍스트, 이미지 블록 없음); `main/staging-store.ts`의 `scan`(noteKind 분기)·`moveNoteOnly`·`removeItem`(둘 다 `kind==='capture'`로 이미지 가드); `main/ipc.ts`의 `auto()`(pull→transform)·`runTransform`·`item:promote`·`item:save`·`EMPTY_TITLE_REASON`·`nowIso`·`setTransformError`; `main/settings.ts`(`Settings`+`DEFAULT_SETTINGS`, `reflectionSubdir`); `src/shared/api.ts`(`AppSettings`·`AnchorApi`·`SaveFields`·`ReflectionSaveFields`).
- **AppSettings는 `src/shared/api.ts`에 산다**(렌더러 권위 미러). `api.d.ts`는 `window.api` 전역 보강만.

## File Structure

```
anchor/src/
├── shared/types.ts        [수정] MemoMeta·MemoTransform·MemoStagingItem, StagingKind+='memo', StagingItem 유니온 3-멤버
├── shared/api.ts          [수정] AppSettings에 inboxDir·memoSubdir; MemoSaveFields; save 필드 유니온 확장
├── core/
│   ├── note.ts            [수정] memoBaseName·assembleMemo{Raw,Transformed}·parseMemoNote·noteKind memo 분기
│   ├── note.test.ts       [수정] memo 케이스
│   ├── memo-schema.ts     [신규] zod MemoSchema
│   ├── memo-schema.test.ts[신규]
│   ├── promote.ts         [수정] memoPromoteTargets
│   └── promote.test.ts    [수정]
├── main/
│   ├── transform.ts       [수정] buildMemoPrompt·transformMemo(이미지 블록 없음)
│   ├── transform.test.ts  [수정]
│   ├── inbox.ts           [신규] ingestInbox(inboxDir, stagingDir) — .txt 스캔·MemoMeta 발급·_processed 이동
│   ├── inbox.test.ts      [신규]
│   ├── staging-store.ts   [수정] writeMemoRaw·writeMemoTransformed·scan memo 분기
│   ├── staging-store.test.ts [수정]
│   ├── settings.ts        [수정] inboxDir·memoSubdir(기본 '메모')
│   └── ipc.ts             [수정] auto()+=ingest; runTransform·item:promote·item:save memo 분기(Task1 임시가드 교체)
└── renderer/
    ├── components/MemoBadge.tsx   [신규] 메모 뱃지(MediumBadge 미러)
    ├── components/MemoEditor.tsx  [신규] 제목·본문·태그 에디터(ReflectionEditor 미러)
    ├── components/TriageList.tsx  [수정] 뱃지 섹션 3-way(memo 분기)
    ├── components/SettingsSheet.tsx [수정] inboxDir·memoSubdir 입력
    └── App.tsx                    [수정] 에디터 디스패치 3-way(memo→MemoEditor)
```

---

## Chunk 1: 타입 확장 + 순수 코어

세 번째 유니온 멤버 + 기존 이진 분기를 3-way로 전환(green 유지) + 순수 코어(note memo·schema·promote)를 TDD로.

### Task 1: StagingItem 3-멤버 유니온 + 이진→3-way 전환 (회귀 0)

`memo` 타입을 더하고 **기존 `capture`-vs-else 이진 분기 4곳을 명시적 3-way로 전환**한다(메모 전용 동작은 임시 가드/스텁; 실 구현은 후속). 런타임 capture·reflection 불변 → 58 테스트 green 유지.

**Files:** Modify `src/shared/types.ts`, `src/main/ipc.ts`, `src/renderer/App.tsx`, `src/renderer/components/TriageList.tsx`

- [ ] **Step 1: 타입 (`src/shared/types.ts`)**

`StagingKind`·`StagingItem`를 교체하고 memo 타입 추가(`CaptureMeta`/`Reflection*`은 불변):
```ts
/** 데스크톱 메모장 .txt에서 로컬 생성. work/medium/이미지 없음. */
export interface MemoMeta {
  id: string; // 로컬 randomUUID
  createdAt: string; // .txt mtime 기반 ISO
  note: string; // .txt 원문 본문
  source: string; // 원본 파일명
  tags: string[]; // v1 빈 배열(메모장엔 태그 없음)
}

/** Claude 텍스트 정리 출력(zod 강제). */
export interface MemoTransform {
  title: string;
  body: string; // 정리된 마크다운 본문
  tags: string[]; // AI 제안(원본). 합집합은 core/note 조립이 수행
}

export type StagingKind = 'capture' | 'reflection' | 'memo';

export interface MemoStagingItem {
  kind: 'memo';
  base: string;
  meta: MemoMeta;
  status: StagingStatus;
  transform?: MemoTransform;
  notePath: string;
  error?: string;
}

export type StagingItem = CaptureStagingItem | ReflectionStagingItem | MemoStagingItem;
```

- [ ] **Step 2: ipc 3-way 전환 + 임시 memo 가드 (`src/main/ipc.ts`)**

세 지점에서 memo가 capture 분기(imagePath 접근)로 떨어지지 않게 한다.
- `runTransform` 루프(현재 `if reflection {} else {capture}`)를 명시적으로:
```ts
if (item.kind === 'capture') {
  const buf = readFileSync(item.imagePath);
  const tr: TransformResult = await transformCapture(client, item.meta, buf, s.model);
  writeTransformed(s.stagingDir, item.meta, tr);
} else if (item.kind === 'reflection') {
  const tr = await transformReflection(client, item.meta, s.model);
  writeReflectionTransformed(s.stagingDir, item.meta, tr);
} else {
  // memo: Chunk 2/Task 9에서 transformMemo로 교체.
  continue;
}
```
- `item:promote`: reflection `if` 블록 뒤, capture fall-through **앞**에 임시 memo 가드 추가:
```ts
if (item.kind === 'memo') return { ok: false, reason: 'memo 승격 미지원(후속)' };
```
- `item:save`: reflection `if` 블록 뒤, capture 코드 **앞**에 임시 memo 가드:
```ts
if (item.kind === 'memo') return { ok: false, reason: 'memo 저장 미지원(후속)' };
```
(`readImageDataUrl`은 이미 `item.kind !== 'capture'` → null 이라 memo 안전. `scan`은 memo 항목을 아직 만들지 않으므로 무변경.)

- [ ] **Step 3: renderer 3-way 전환**

- `App.tsx` 에디터 디스패치(현재 `selected.kind === 'capture' ? <ItemEditor/> : <ReflectionEditor/>`)를:
```tsx
{selected.kind === 'capture' ? (
  <ItemEditor key={selected.base} item={selected} onChanged={reload} onRemoved={() => { setSelectedBase(null); void reload(); }} />
) : selected.kind === 'reflection' ? (
  <ReflectionEditor key={selected.base} item={selected} onChanged={reload} onRemoved={() => { setSelectedBase(null); void reload(); }} />
) : (
  <div className="flex h-full items-center justify-center text-[13px] text-[var(--t4)]">메모 에디터 준비 중</div>
)}
```
(Task 10에서 memo 분기를 `<MemoEditor/>`로 교체. 기존 props 보존.)
- `TriageList.tsx` 뱃지 섹션(현재 `item.kind === 'capture' ? <TypeBadge/> : (<MediumBadge medium={item.meta.medium}/> + workTitle)`)을 3-way로:
```tsx
{item.kind === 'capture' ? (
  <TypeBadge type={item.meta.type} />
) : item.kind === 'reflection' ? (
  <span className="inline-flex items-center gap-1.5">
    <MediumBadge medium={item.meta.medium} />
    <span className="truncate text-[11px] text-[var(--t3)]">{item.meta.workTitle}</span>
  </span>
) : (
  <span className="inline-flex items-center rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-[var(--t3)]">메모</span>
)}
```
(썸네일 셀의 `else`(BookOpen)는 memo에도 안전 — 필드 접근 없음 — 무변경. Task 10에서 memo 뱃지를 `<MemoBadge/>`로 교체.)

- [ ] **Step 4: 게이트 — 회귀 0**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: 58 PASS, typecheck/lint 0 에러. (런타임 capture·reflection 불변.) 실패하면 거의 항상 유니온 미narrow — `kind` 가드 추가.

- [ ] **Step 5: Commit** — `git commit -am "refactor(types): StagingItem 3-멤버 유니온(memo) + 이진→3-way 분기 전환(회귀 0)"`

### Task 2: memo 노트 조립·파싱 (`core/note.ts`, 순수)

**Files:** Modify `src/core/note.ts`, `src/core/note.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**

```ts
import { memoBaseName, assembleMemoRaw, assembleMemoTransformed, parseMemoNote, noteKind } from './note';
import type { MemoMeta, MemoTransform } from '@/shared/types';

const mmeta: MemoMeta = {
  id: 'c1d2e3f4-0000-0000-0000-000000000000',
  createdAt: '2026-06-26T14:30:00+09:00',
  note: '복리적 학습 루프를 만들자', source: '아이디어.txt', tags: [],
};
const mtr: MemoTransform = { title: '복리적 학습 루프', body: '정리된 본문.\n둘째 줄.', tags: ['학습', '설계'] };

describe('memoBaseName', () => {
  it('메모-날짜-shortid', () => expect(memoBaseName(mmeta)).toBe('메모-2026-06-26-c1d2e3f40000'));
});

describe('assembleMemoRaw', () => {
  const md = assembleMemoRaw(mmeta);
  it('kind:memo + status:raw + source + 원문 본문, 섹션·허브링크 없음', () => {
    expect(md).toContain('kind: memo');
    expect(md).toContain('status: raw');
    expect(md).toContain('source: 아이디어.txt');
    expect(md).toContain('복리적 학습 루프를 만들자');
    expect(md).not.toContain('## ');
    expect(md).not.toContain('[[');
  });
});

describe('assembleMemoTransformed', () => {
  const md = assembleMemoTransformed(mmeta, mtr);
  it('status:transformed + title + 정리 본문 + 태그 합집합, 섹션 없음', () => {
    expect(md).toContain('status: transformed');
    expect(md).toContain('title: 복리적 학습 루프');
    expect(md).toContain('정리된 본문.');
    expect(md).toContain('둘째 줄.');
    expect(md).toContain('tags: [학습, 설계]');
    expect(md).not.toContain('## ');
  });
});

describe('noteKind memo', () => {
  it('memo 노트', () => expect(noteKind(assembleMemoRaw(mmeta))).toBe('memo'));
});

describe('parseMemoNote', () => {
  it('transformed 라운드트립', () => {
    const p = parseMemoNote(assembleMemoTransformed(mmeta, mtr));
    expect(p.status).toBe('transformed');
    expect(p.meta.source).toBe('아이디어.txt');
    expect(p.meta.id).toBe('c1d2e3f4-0000-0000-0000-000000000000');
    expect(p.transform?.title).toBe('복리적 학습 루프');
    expect(p.transform?.body).toContain('둘째 줄.');
  });
  it('raw 라운드트립: note=본문, transform 없음', () => {
    const p = parseMemoNote(assembleMemoRaw(mmeta));
    expect(p.status).toBe('raw');
    expect(p.transform).toBeUndefined();
    expect(p.meta.note).toBe('복리적 학습 루프를 만들자');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/core/note.test.ts` → FAIL.

- [ ] **Step 3: 구현 (`src/core/note.ts`에 추가)**

```ts
import type { /* 기존 */ MemoMeta, MemoTransform } from '@/shared/types';

export function memoBaseName(meta: MemoMeta): string {
  return `메모-${meta.createdAt.slice(0, 10)}-${shortId(meta.id)}`;
}

function memoFrontmatter(meta: MemoMeta, opts: { status: StagingStatus; tags: string[]; title?: string }): string {
  const lines = [
    '---',
    `created: ${meta.createdAt}`,
    'kind: memo',
    `source: ${meta.source}`,
    `tags: [${opts.tags.join(', ')}]`,
    `captureId: ${meta.id}`,
  ];
  if (opts.title !== undefined) lines.push(`title: ${opts.title}`);
  lines.push(`status: ${opts.status}`);
  lines.push('---');
  return lines.join('\n');
}

/** status: raw — frontmatter + 원문 .txt 본문. 섹션·임베드·허브 없음. */
export function assembleMemoRaw(meta: MemoMeta): string {
  return `${memoFrontmatter(meta, { status: 'raw', tags: meta.tags })}\n${meta.note}\n`;
}

/** status: transformed — frontmatter(title·합집합 태그) + 정리 본문. */
export function assembleMemoTransformed(meta: MemoMeta, tr: MemoTransform): string {
  const fm = memoFrontmatter(meta, { status: 'transformed', tags: union(meta.tags, tr.tags), title: tr.title });
  return `${fm}\n${tr.body}\n`;
}

export interface ParsedMemo {
  status: StagingStatus;
  meta: MemoMeta;
  transform?: MemoTransform;
  transformError?: string;
}

export function parseMemoNote(md: string): ParsedMemo {
  const fm = parseFrontmatter(md);
  const status: StagingStatus = fm.map['status'] === 'transformed' ? 'transformed' : 'raw';
  const body = fm.body.trim();
  const meta: MemoMeta = {
    id: fm.map['captureId'] ?? '',
    createdAt: fm.map['created'] ?? '',
    note: status === 'transformed' ? '' : body, // raw면 본문=원문 메모
    source: fm.map['source'] ?? '',
    tags: parseTagList(fm.map['tags'] ?? ''),
  };
  const transformError = fm.map['transformError'] || undefined;
  if (status !== 'transformed') return { status, meta, transformError };
  const transform: MemoTransform = { title: fm.map['title'] ?? '', body, tags: meta.tags };
  return { status, meta, transform };
}
```
`noteKind` 갱신(memo 분기 추가):
```ts
export function noteKind(md: string): StagingKind {
  const m = md.match(/^kind:\s*([\w-]+)/m);
  if (m?.[1] === 'reflection') return 'reflection';
  if (m?.[1] === 'memo') return 'memo';
  return 'capture';
}
```
(`shortId`·`union`·`parseFrontmatter`·`parseTagList`은 같은 파일 비공개 — 직접 호출.)

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/core/note.test.ts` → PASS(기존+신규).
- [ ] **Step 5: Commit** — `git commit -am "feat(core): memo 노트 조립·파싱 + noteKind memo 분기(순수)"`

### Task 3: memo 스키마 (`core/memo-schema.ts`, 순수)

**Files:** Create `src/core/memo-schema.ts`, `src/core/memo-schema.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest';
import { MemoSchema } from './memo-schema';

describe('MemoSchema', () => {
  it('정상 통과', () => expect(MemoSchema.parse({ title: 't', body: 'b', tags: ['a'] }).title).toBe('t'));
  it('title 누락 거부', () => expect(() => MemoSchema.parse({ body: 'b', tags: [] })).toThrow());
  it('tags 비배열 거부', () => expect(() => MemoSchema.parse({ title: 't', body: 'b', tags: 'x' })).toThrow());
});
```
- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**
```ts
import { z } from 'zod';
export const MemoSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  tags: z.array(z.string()),
});
export type MemoParsed = z.infer<typeof MemoSchema>;
```
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): zod MemoSchema(순수)"`

### Task 4: memo 승격 경로 (`core/promote.ts`, 순수)

**Files:** Modify `src/core/promote.ts`, `src/core/promote.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**
```ts
import { memoPromoteTargets } from './promote';
describe('memoPromoteTargets', () => {
  it('노트 경로만(이미지·허브 없음)', () => {
    expect(memoPromoteTargets('메모-2026-06-26-abc', { notesDir: '/v/메모' }).notePath).toBe('/v/메모/메모-2026-06-26-abc.md');
  });
});
```
- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
export function memoPromoteTargets(base: string, dirs: { notesDir: string }): { notePath: string } {
  return { notePath: joinPosix(dirs.notesDir, `${base}.md`) };
}
```
(`joinPosix` 재사용. reflection과 동일 형태 — 후속 공통화는 YAGNI.)
- [ ] **Step 5: Commit** — `git commit -am "feat(core): memo 승격 경로(순수)"`

### Chunk 1 게이트
Run: `npm run test && npm run typecheck && npm run lint` → 전부 green(58 + 신규).

---

## Chunk 2: main 어댑터 (transform · staging · inbox · settings · ipc)

### Task 5: 텍스트 변환 (`main/transform.ts`)

**Files:** Modify `src/main/transform.ts`, `src/main/transform.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**
```ts
import { transformMemo } from './transform';
import type { MemoMeta } from '@/shared/types';
const mmeta: MemoMeta = { id: 'x', createdAt: '2026-06-26T00:00:00Z', note: '복리적 학습 루프를 만들자', source: '아이디어.txt', tags: [] };

describe('transformMemo', () => {
  it('텍스트 블록만(이미지 없음) + 메모 주입 + 스키마 강제', async () => {
    const parse = vi.fn(async () => ({ parsed_output: { title: 'T', body: 'B', tags: ['a'] }, stop_reason: 'end_turn' }));
    const client = { messages: { parse } } as any;
    const out = await transformMemo(client, mmeta, 'claude-opus-4-8');
    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content.every((b: any) => b.type === 'text')).toBe(true);
    expect(JSON.stringify(content)).toContain('복리적 학습 루프');
    expect(JSON.stringify(content)).toContain('지어내지 마라');
    expect(out.title).toBe('T');
  });
  it('parsed_output 없으면 throw', async () => {
    const client = { messages: { parse: vi.fn(async () => ({ parsed_output: null, stop_reason: 'max_tokens' })) } } as any;
    await expect(transformMemo(client, mmeta, 'claude-opus-4-8')).rejects.toThrow();
  });
});
```
- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
import { MemoSchema } from '@/core/memo-schema';
import type { MemoMeta, MemoTransform } from '@/shared/types';

export function buildMemoPrompt(meta: MemoMeta): string {
  const parts = [
    '아래는 사용자가 메모장에 친 러프 메모다. 이를 Obsidian 노트용으로 정리하라.',
    `원본 파일: ${meta.source}`,
    '제약: 사용자 메모 범위 안에서만 정리하라. 외부 사실을 지어내지 마라. 사용자의 표현과 관점(voice)을 보존하라.',
    `메모: ${meta.note.trim()}`,
    '출력 규격:',
    '- title: 노트 제목(간결·핵심).',
    '- body: 정리된 마크다운 본문(한국어, 메모를 매끄럽게 구조화).',
    '- tags: 분류 태그(소문자, 공백 없음).',
  ];
  return parts.join('\n');
}

export async function transformMemo(client: Anthropic, meta: MemoMeta, model: string): Promise<MemoTransform> {
  const res = await client.messages.parse({
    model, max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(MemoSchema) },
    messages: [{ role: 'user', content: [{ type: 'text', text: buildMemoPrompt(meta) }] }],
  });
  if (!res.parsed_output) throw new Error('memo transform parse 실패(stop_reason=' + res.stop_reason + ')');
  return res.parsed_output;
}
```
(`Anthropic`·`zodOutputFormat`·`MAX_TOKENS`은 이미 import/정의됨 — `transformReflection`과 동일.)
- [ ] **Step 5: Commit** — `git commit -am "feat(main): Claude 텍스트 변환(transformMemo)"`

### Task 6: staging-store memo (`main/staging-store.ts`)

**Files:** Modify `src/main/staging-store.ts`, `src/main/staging-store.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**
```ts
import { writeMemoRaw, writeMemoTransformed, scan, removeItem } from './staging-store';
import type { MemoMeta, MemoTransform, MemoStagingItem } from '@/shared/types';
const mmeta: MemoMeta = { id: 'c1d2e3f4-0000-0000-0000-000000000000', createdAt: '2026-06-26T14:30:00+09:00', note: '본문', source: '아이디어.txt', tags: [] };
const mtr: MemoTransform = { title: 'T', body: 'B', tags: ['x'] };

describe('staging-store memo', () => {
  it('writeMemoRaw + scan: kind memo, 이미지 없음', () => {
    writeMemoRaw(dir, mmeta);
    const items = scan(dir);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('memo');
    expect(items[0].status).toBe('raw');
    expect((items[0] as MemoStagingItem).meta.source).toBe('아이디어.txt');
  });
  it('writeMemoTransformed: transformed 갱신', () => {
    writeMemoRaw(dir, mmeta); writeMemoTransformed(dir, mmeta, mtr);
    const it = scan(dir)[0] as MemoStagingItem;
    expect(it.status).toBe('transformed');
    expect(it.transform?.title).toBe('T');
  });
  it('removeItem: 노트 삭제', () => {
    writeMemoRaw(dir, mmeta); removeItem(dir, scan(dir)[0]);
    expect(scan(dir)).toHaveLength(0);
  });
});
```
- [ ] **Step 2~4: 실패 → 구현 → 통과**

`scan` 루프에 memo 분기(reflection 분기 다음, capture 앞):
```ts
if (noteKind(md) === 'memo') {
  const parsed = parseMemoNote(md);
  items.push({ kind: 'memo', base, meta: parsed.meta, status: parsed.status, transform: parsed.transform, notePath, error: parsed.transformError });
  continue;
}
```
write 함수(import `memoBaseName`, `assembleMemoRaw`, `assembleMemoTransformed`, `parseMemoNote` from `@/core/note`):
```ts
export function writeMemoRaw(dir: string, meta: MemoMeta): void {
  ensureDir(dir);
  writeFileSync(notePathFor(dir, memoBaseName(meta)), assembleMemoRaw(meta));
}
export function writeMemoTransformed(dir: string, meta: MemoMeta, tr: MemoTransform): void {
  ensureDir(dir);
  writeFileSync(notePathFor(dir, memoBaseName(meta)), assembleMemoTransformed(meta, tr));
}
```
(`moveNoteOnly`·`removeItem`은 memo에도 그대로 동작 — 이미 `kind==='capture'`로만 이미지 처리.)
- [ ] **Step 5: Commit** — `git commit -am "feat(main): staging-store memo 쓰기/스캔"`

### Task 7: 인박스 인입 (`main/inbox.ts`)

**Files:** Create `src/main/inbox.ts`, `src/main/inbox.test.ts`

- [ ] **Step 1: 실패 테스트(tmpdir 통합)**
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ingestInbox } from './inbox';
import { scan } from './staging-store';
import type { MemoStagingItem } from '@/shared/types';

let inboxDir: string, stagingDir: string;
beforeEach(() => {
  inboxDir = mkdtempSync(path.join(tmpdir(), 'anchor-inbox-'));
  stagingDir = mkdtempSync(path.join(tmpdir(), 'anchor-staging-'));
});

describe('ingestInbox', () => {
  it('.txt → staging raw memo + 원본 _processed 이동', () => {
    writeFileSync(path.join(inboxDir, '아이디어.txt'), '복리적 학습 루프');
    const r = ingestInbox(inboxDir, stagingDir);
    expect(r.ingested).toBe(1);
    const items = scan(stagingDir);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('memo');
    expect((items[0] as MemoStagingItem).meta.note).toBe('복리적 학습 루프');
    expect((items[0] as MemoStagingItem).meta.source).toBe('아이디어.txt');
    expect(existsSync(path.join(inboxDir, '아이디어.txt'))).toBe(false);
    expect(existsSync(path.join(inboxDir, '_processed', '아이디어.txt'))).toBe(true);
  });
  it('멱등: 두 번째 인입은 0(이미 _processed)', () => {
    writeFileSync(path.join(inboxDir, 'a.txt'), 'x');
    ingestInbox(inboxDir, stagingDir);
    expect(ingestInbox(inboxDir, stagingDir).ingested).toBe(0);
  });
  it('공백-only .txt는 스킵(인입·이동 안 함)', () => {
    writeFileSync(path.join(inboxDir, 'empty.txt'), '   \n  ');
    expect(ingestInbox(inboxDir, stagingDir).ingested).toBe(0);
    expect(existsSync(path.join(inboxDir, 'empty.txt'))).toBe(true);
    expect(scan(stagingDir)).toHaveLength(0);
  });
  it('_processed 이름 충돌은 -2 접미', () => {
    mkdirSync(path.join(inboxDir, '_processed'), { recursive: true });
    writeFileSync(path.join(inboxDir, '_processed', 'a.txt'), 'old');
    writeFileSync(path.join(inboxDir, 'a.txt'), 'new');
    ingestInbox(inboxDir, stagingDir);
    expect(existsSync(path.join(inboxDir, '_processed', 'a-2.txt'))).toBe(true);
  });
  it('inboxDir 미존재/빈문자열 → no-op', () => {
    expect(ingestInbox('', stagingDir).ingested).toBe(0);
  });
});
```
- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
import { readdirSync, readFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeMemoRaw } from './staging-store';
import type { MemoMeta } from '@/shared/types';

const PROCESSED = '_processed';

/** 인박스 .txt를 staging raw memo로 인입하고 원본을 _processed/로 이동. 멱등·파일단위 격리. */
export function ingestInbox(inboxDir: string, stagingDir: string): { ingested: number; failed: number } {
  if (!inboxDir || !existsSync(inboxDir)) return { ingested: 0, failed: 0 };
  let ingested = 0, failed = 0;
  for (const entry of readdirSync(inboxDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue; // 최상위 .txt만(_processed는 디렉토리라 제외)
    const filePath = path.join(inboxDir, entry.name);
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (!content.trim()) continue; // 공백-only 스킵(이동도 안 함)
      const meta: MemoMeta = {
        id: randomUUID(),
        createdAt: statSync(filePath).mtime.toISOString(),
        note: content,
        source: entry.name,
        tags: [],
      };
      writeMemoRaw(stagingDir, meta);
      moveToProcessed(inboxDir, entry.name, filePath);
      ingested++;
    } catch {
      failed++; // 원본 인박스 잔류 → 다음 포커스 재시도.
    }
  }
  return { ingested, failed };
}

function moveToProcessed(inboxDir: string, name: string, filePath: string): void {
  const dir = path.join(inboxDir, PROCESSED);
  mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, name);
  if (existsSync(dest)) {
    const ext = path.extname(name), stem = path.basename(name, ext);
    let n = 2;
    while (existsSync(path.join(dir, `${stem}-${n}${ext}`))) n++;
    dest = path.join(dir, `${stem}-${n}${ext}`);
  }
  renameSync(filePath, dest);
}
```
- [ ] **Step 5: Commit** — `git commit -am "feat(main): 인박스 .txt 인입(ingestInbox) + _processed 이동(멱등)"`

### Task 8: 설정 + AppSettings·SaveFields 미러

**Files:** Modify `src/main/settings.ts`, `src/shared/api.ts`

- [ ] **Step 1: settings** — `Settings`+`DEFAULT_SETTINGS`에 `inboxDir: string`(기본 `''`)·`memoSubdir: string`(기본 `'메모'`) 추가.
- [ ] **Step 2: shared/api.ts** — `AppSettings`에 `inboxDir`·`memoSubdir` 추가(미러). `MemoSaveFields` 추가 + `save` 필드 유니온 확장:
```ts
export type MemoSaveFields = Partial<{ title: string; body: string; tags: string[] }>;
// AnchorApi.save:
save: (base: string, fields: SaveFields | ReflectionSaveFields | MemoSaveFields) => Promise<ActionResult>;
```
- [ ] **Step 3: 타입체크** — Run: `npm run typecheck` → 0 에러.
- [ ] **Step 4: Commit** — `git commit -am "feat(main): inboxDir·memoSubdir 설정 + MemoSaveFields 미러"`

### Task 9: IPC memo 분기 (`main/ipc.ts`) — Task 1 임시가드 교체

**Files:** Modify `src/main/ipc.ts`

- [ ] **Step 1: auto()에 인입 추가** — `runPull()`와 `runTransform()` 사이에 인입 삽입:
```ts
try { const s = readSettings(); if (s.inboxDir && s.stagingDir) ingestInbox(s.inboxDir, s.stagingDir); } catch { /* 인입 실패 비침습 */ }
```
(import `ingestInbox` from `./inbox`. `do/while` 루프 안, pull 다음·transform 앞.)
- [ ] **Step 2: runTransform memo 분기** — Task 1의 `else { continue; }`를 교체:
```ts
} else {
  const tr = await transformMemo(client, item.meta, s.model);
  writeMemoTransformed(s.stagingDir, item.meta, tr);
}
```
(import `transformMemo` from `./transform`, `writeMemoTransformed` from `./staging-store`. catch 격리(setTransformError)는 공통이라 그대로 — `item.notePath` 사용.)
- [ ] **Step 3: item:promote memo 분기** — Task 1 임시 가드를 실 구현으로(reflection 블록과 평행, 허브 없음):
```ts
if (item.kind === 'memo') {
  const notesDir = path.join(s.vaultNotesDir, s.memoSubdir || '');
  const target = memoPromoteTargets(item.base, { notesDir });
  if (existsSync(target.notePath)) return { ok: false, reason: 'vault에 같은 이름이 이미 존재' };
  const cleaned = stripStagingFrontmatter(readFileSync(item.notePath, 'utf-8'));
  try { moveNoteOnly(item, target, cleaned); } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
  removeItem(s.stagingDir, item);
  return { ok: true };
}
```
(import `memoPromoteTargets` from `@/core/promote`. `moveNoteOnly`·`removeItem`·`stripStagingFrontmatter` 재사용.)
- [ ] **Step 4: item:save memo 분기** — Task 1 임시 가드를 실 구현으로:
```ts
if (item.kind === 'memo') {
  const f = fields as Partial<MemoMeta & MemoTransform>;
  const meta: MemoMeta = { ...item.meta, tags: f.tags ?? item.meta.tags };
  const title = f.title ?? item.transform?.title ?? '';
  if (!title.trim()) return { ok: false, reason: EMPTY_TITLE_REASON };
  const tr: MemoTransform = { title, body: f.body ?? item.transform?.body ?? '', tags: f.tags ?? item.transform?.tags ?? meta.tags };
  writeMemoTransformed(s.stagingDir, meta, tr);
  return { ok: true };
}
```
(`MemoMeta`/`MemoTransform` import 추가. `EMPTY_TITLE_REASON` 재사용.)
- [ ] **Step 5: 게이트** — Run: `npm run test && npm run typecheck && npm run lint` → green.
- [ ] **Step 6: Commit** — `git commit -am "feat(main): IPC memo 분기(인입 auto·transform·promote·save)"`

### Chunk 2 게이트
Run: `npm run test && npm run typecheck && npm run lint` → 전부 green.

---

## Chunk 3: renderer + 문서 + e2e

### Task 10: MemoBadge + MemoEditor + 분기 교체 + 설정

**Files:** Create `src/renderer/components/MemoBadge.tsx`, `src/renderer/components/MemoEditor.tsx`; Modify `src/renderer/App.tsx`, `src/renderer/components/TriageList.tsx`, `src/renderer/components/SettingsSheet.tsx`

- [ ] **Step 1: MemoBadge** — `MediumBadge` 구조 미러. 고정 라벨 `메모` + 중립 토큰:
```tsx
import { cn } from '@/renderer/lib/utils';
export default function MemoBadge() {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', 'bg-white/8 text-[var(--t3)]')}>메모</span>;
}
```
- [ ] **Step 2: MemoEditor** — `ReflectionEditor.tsx`를 미러하되 필드는 제목·본문·태그(작품/진행/감상 제거). prop `item: MemoStagingItem`. `toForm`: `{ title: item.transform?.title ?? '', body: item.transform?.body ?? item.meta.note ?? '', tags: (item.transform?.tags ?? item.meta.tags).join(', ') }`. 좌 패널: source·원문 미리보기(`item.meta.note`)·base·error. `fields()`: `{ title, body, tags: split }` (타입 `MemoSaveFields`). Save 버튼 `disabled={busy !== null || form.title.trim() === ''}`. 변환다시/승격/버리기는 `window.api.transform/promote/discard` 공유(ReflectionEditor와 동일).
- [ ] **Step 3: App memo 분기 교체** — Task 1의 "메모 에디터 준비 중" 자리를 `<MemoEditor key={selected.base} item={selected} onChanged={reload} onRemoved={() => { setSelectedBase(null); void reload(); }} />`로.
- [ ] **Step 4: TriageList memo 뱃지 교체** — Task 1의 memo 인라인 span을 `<MemoBadge />`로(import 추가).
- [ ] **Step 5: SettingsSheet** — `inboxDir`(폴더 선택 `pickDir`)·`memoSubdir`(텍스트) 입력 추가. 기존 `reflectionSubdir`/경로 입력 패턴 미러.
- [ ] **Step 6: 게이트** — Run: `npm run test && npm run typecheck && npm run lint && npm run build` → 전부 green.
- [ ] **Step 7: Commit** — `git commit -am "feat(renderer): MemoBadge·MemoEditor + 트리아지/App memo 분기 + 설정(inboxDir)"`

### Task 11: 빌드 + 문서 + 수동 e2e(사용자)

**Files:** Modify `docs/usage.md`

- [ ] **Step 1: 빌드** — Run: `npm run build` → 번들 성공.
- [ ] **Step 2: usage.md** — §4.6 "메모 인박스(memo kind)" 추가: `inboxDir`·`memoSubdir` 설정, 흐름(.txt 저장→앱 포커스 자동 인입+정리→트리아지→승격→vault `메모/`), `_processed` 이동 동작. **수동 e2e 체크리스트(사용자용)**: 메모장 .txt 저장 → 앱 포커스 → 트리아지 등장(transformed) → 수정·승격 → vault `메모/메모-….md` + 인박스 `_processed/` 확인.
- [ ] **Step 3: (사용자) 수동 GUI e2e** — 헤드리스 불가. usage 체크리스트로 사용자가 실행.
- [ ] **Step 4: Commit** — `git commit -am "docs: usage 메모 인박스 + build"`

### Chunk 3 게이트
Run: `npm run test && npm run typecheck && npm run lint && npm run build` → 전부 green.

---

## 완료 기준 (스펙 §12 동기화)

- [ ] `inboxDir`의 `.txt`가 앱 포커스 시 staging raw memo로 인입 + 원본 `_processed/` 이동(재픽업 0).
- [ ] raw memo 자동 텍스트 정리(transformed), Claude 정리·태깅만(사실 미생성).
- [ ] 트리아지·에디터에서 capture·reflection·memo 공존, memo 스침·수정.
- [ ] "승격" 1회로 memo 노트가 vault(`memoSubdir`) 정본(status 제거) 안착·staging 제거(허브 없음).
- [ ] 순수 코어(note·memo-schema·promote) + 어댑터(transform·inbox·staging) 테스트 + **기존 capture·reflection 회귀 0** + typecheck·lint·build green.

## 비고

- 1 `.txt` = 1 메모. 파일 분할·.md·영속watch는 후속.
- `createdAt`=mtime(작성 근사). 공백-only는 스킵(이동 안 함).
- memo 승격은 reflection에서 허브 단계만 뺀 평행 구조 — promote 공통화는 입력 타입 더 늘면 검토(YAGNI).
