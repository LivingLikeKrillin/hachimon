# anchor 감상 기록 (reflection kind) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** anchor 앱에 데스크톱 텍스트 우선 **감상 기록(reflection kind)**을 더한다 — 사용자가 친 러프 세션 메모를 Claude가 정리(정리+태깅, 사실 보강 없음)하고, 1초 확인 후 승격하면 vault에 세션 노트가 안착하며 같은 작품 세션이 **자동 허브(MOC)**로 모인다.

**Architecture:** 기존 anchor(capture kind: 릴레이·이미지·vision) 골격 위에 `kind` 판별자를 도입한다. reflection은 로컬 생성(id·createdAt 자체 발급, 이미지 없음)·텍스트 모드 변환·허브 upsert를 갖되, staging·트리아지·승격 골격은 분기로 공유한다. 순수 코어(`core/*`: 노트 조립/파싱·zod 스키마·허브·승격경로)는 부수효과(fs·SDK·Electron)와 분리해 단위 테스트한다.

**Tech Stack:** Electron + electron-vite + React 19 + TypeScript + `@anthropic-ai/sdk`(텍스트 `messages.parse`+`zodOutputFormat`, 모델 `claude-opus-4-8`), `zod`, `vitest`. 구현 repo: `C:/Users/Eisen/Desktop/Labs/[projects] trial/anchor`(별도 repo). 스펙: `hachimon/docs/superpowers/specs/2026-06-25-anchor-reflection-design.md`(단일 진실원천).

---

## 전제 / 시작 상태

- **구현은 `anchor` repo에서** 진행한다. 이 plan의 모든 경로는 `anchor/` 루트 기준. (스펙·플랜만 hachimon에 있음.)
- 시작 브랜치: anchor `master`에서 `feat/reflection-kind` 분기. 커밋 컨벤션 conventional commits, 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context)`.
- 기존 capture kind는 완성·테스트됨(29 vitest green). **모든 게이트에서 기존 capture 회귀 0**이 필수.
- claude-api 스킬 준거(텍스트 변환): `messages.parse` + `output_config.format: zodOutputFormat(...)` + `thinking:{type:'adaptive'}` + `claude-opus-4-8`. 기존 `transformCapture`(vision)와 동일 패턴, **이미지 블록만 없음**.
- 기존 코드 사실(확인됨): `core/note.ts`의 `shortId`/`union`/`frontmatter`/`embed`/`memoBlock`은 **모듈 비공개** → reflection 조립을 **같은 `note.ts`에 추가**하므로 직접 호출(=export 불필요). 세션 노트의 로컬 `id`는 기존 `captureId` 프론트매터 키에 실어 라운드트립한다(파서 재사용).

## File Structure

```
anchor/
├── src/shared/types.ts            [수정] REFLECTION_MEDIA·ReflectionMeta·ReflectionTransform·StagingKind, StagingItem→판별 유니온
├── src/core/
│   ├── note.ts                    [수정] slug·workKey·reflectionBaseName·hubBaseName·assembleReflection{Raw,Transformed}·parseReflectionNote·noteKind
│   ├── note.test.ts               [수정] reflection 케이스 추가
│   ├── reflection-schema.ts       [신규] zod ReflectionSchema
│   ├── reflection-schema.test.ts  [신규]
│   ├── hub.ts                     [신규] hubFrontmatter·assembleHub·upsertHub(순수)
│   ├── hub.test.ts                [신규]
│   ├── promote.ts                 [수정] reflectionPromoteTargets
│   └── promote.test.ts            [수정]
├── src/main/
│   ├── transform.ts               [수정] buildReflectionPrompt·transformReflection(텍스트, 이미지 블록 없음)
│   ├── transform.test.ts          [수정]
│   ├── staging-store.ts           [수정] writeReflection{Raw,Transformed}·scan 분기·removeItem(이미지 없음)·upsertHubFile·moveNoteOnly
│   ├── staging-store.test.ts      [수정]
│   ├── settings.ts                [수정] reflectionSubdir 기본 '감상'
│   └── ipc.ts                     [수정] reflection:create·reflection:works + transform/promote/save kind 분기
├── src/preload/index.ts           [수정] createReflection·listWorks 노출
└── src/renderer/
    ├── api.d.ts                   [수정] ReflectionMedium·works·createReflection·ReflectionSaveFields
    ├── App.tsx                    [수정] "새 감상" 버튼 + kind별 에디터 분기
    ├── hooks/useItems.ts          [수정 가능] (정렬 그대로; 필요 시 그대로 둠)
    └── components/
        ├── MediumBadge.tsx        [신규] 매체 뱃지
        ├── ReflectionForm.tsx     [신규] 새 감상 입력 + 최근작품 픽커
        ├── ReflectionEditor.tsx   [신규] reflection 에디터(디테일)
        ├── TriageList.tsx         [수정] kind 분기(썸네일/뱃지)
        └── ItemEditor.tsx         [수정] prop을 capture 항목으로 한정
```

원칙: `core/*`는 import만으로 부수효과 없음 → fs/네트워크/DOM 없이 단위 테스트. 새 reflection 로직도 같은 분리.

---

## Chunk 1: 타입 전환 + 순수 코어

`StagingItem` 판별 유니온 전환(기존 소비처를 capture 분기로 적응해 green 유지) + 네 순수 모듈(note reflection·schema·hub·promote)을 TDD로.

### Task 1: StagingItem 판별 유니온 전환 (회귀 0)

타입을 유니온으로 바꾸고 **기존 capture 소비처 전부를 `kind:'capture'`로 적응**시킨다. 런타임 동작 불변 → 기존 29 테스트 green 유지. reflection 전용 코드는 후속 태스크.

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/staging-store.ts`(scan/updateNote/moveToVault/removeItem 시그니처는 유지, scan이 `kind:'capture'` 스탬프)
- Modify: `src/main/ipc.ts`(narrowing)
- Modify: `src/renderer/components/TriageList.tsx`, `src/renderer/components/ItemEditor.tsx`, `src/renderer/App.tsx`, `src/renderer/api.d.ts`

- [ ] **Step 1: 타입 정의 (`src/shared/types.ts`)**

기존 `StagingItem` 인터페이스를 아래로 교체(+ reflection 타입 추가). `CaptureMeta`·`TransformResult`·`StagingStatus`는 그대로 둔다.

```ts
export const REFLECTION_MEDIA = ['book', 'movie', 'anime', 'manga'] as const;
export type ReflectionMedium = (typeof REFLECTION_MEDIA)[number];

/** 데스크톱 로컬 생성(릴레이 무관). CaptureMeta 미러 계약과 분리. */
export interface ReflectionMeta {
  id: string;          // 로컬 randomUUID
  createdAt: string;   // 로컬 ISO 8601(+09:00)
  medium: ReflectionMedium;
  workTitle: string;
  workKey: string;     // `${medium}-${slug(workTitle)}` — 같은 작품 세션이 공유
  progress: string;    // 자유텍스트(선택, '')
  note: string;        // 러프 세션 메모(사용자 원문)
  source: string;      // 선택
  tags: string[];      // 사용자 입력 태그(선택)
}

/** Claude 텍스트 정리 출력(zod 강제). OCR 없음. */
export interface ReflectionTransform {
  title: string;
  reflection: string;  // 정리된 감상 본문
  takeaway: string;    // 핵심 한두 문장(빈 가능)
  tags: string[];      // AI 제안(원본). 합집합은 core/note 조립이 수행
}

export type StagingKind = 'capture' | 'reflection';

export interface CaptureStagingItem {
  kind: 'capture';
  base: string;
  meta: CaptureMeta;
  status: StagingStatus;
  transform?: TransformResult;
  notePath: string;
  imagePath: string;
  error?: string;
}

export interface ReflectionStagingItem {
  kind: 'reflection';
  base: string;
  meta: ReflectionMeta;
  status: StagingStatus;
  transform?: ReflectionTransform;
  notePath: string;
  error?: string;
}

export type StagingItem = CaptureStagingItem | ReflectionStagingItem;
```

- [ ] **Step 2: `scan`이 `kind:'capture'` 스탬프 (`src/main/staging-store.ts`)**

`scan`의 두 `items.push({...})`(정상 + catch)에 `kind: 'capture'`를 추가한다(정상 push의 객체 첫 필드로 `kind: 'capture',`, catch push에도 동일). 나머지 함수(`writeImage`/`writeRaw`/`writeTransformed`/`hasNote`/`updateNote`/`moveToVault`/`removeItem`)는 `CaptureMeta`/`StagingItem` 인자를 그대로 받되, `moveToVault`/`removeItem`은 `item.imagePath`를 읽으므로 **capture 항목 전제**로 둔다(reflection 분기는 Task 7·9에서). 시그니처 변경 없음.

- [ ] **Step 3: ipc narrowing (`src/main/ipc.ts`)**

`runTransform`의 루프는 capture만 처리하도록 `targets`에 `it.kind === 'capture'` 조건을 추가:
```ts
const targets = scan(s.stagingDir).filter((it) => it.kind === 'capture' && it.status === 'raw');
```
`item.imagePath`/`item.meta.imageExt` 접근이 capture로 narrow됨. `item:save`·`item:promote`·`readImageDataUrl`도 `findItem` 결과에 `if (item.kind !== 'capture') return {ok:false, reason:'reflection 미지원(후속)'}` 가드를 임시로 추가(Task 9에서 교체). 이로써 typecheck green.

- [ ] **Step 4: renderer narrowing**

- `ItemEditor.tsx`: prop 타입을 `item: CaptureStagingItem`으로 바꾼다(`import type { CaptureStagingItem } from '@/shared/types'`). 내부 `item.meta.type`/`item.transform?.ocr` 접근이 valid.
- `App.tsx`: 디테일 렌더를 분기 — `selected && selected.kind === 'capture' ? <ItemEditor item={selected} .../> : selected ? <div className="...">감상 에디터 준비 중</div> : <빈 상태/>`. (ReflectionEditor는 Task 12에서 연결.)
- `TriageList.tsx`: `<TypeBadge type={item.meta.type} />`를 `{item.kind === 'capture' ? <TypeBadge type={item.meta.type} /> : null}`로 가드. `rowTitle`은 `item.meta.note`·`item.transform?.title`만 쓰므로(양 kind 공통 필드) 그대로. `item.meta.source`도 공통이라 그대로.
- `api.d.ts`: `list: () => Promise<StagingItem[]>` 그대로(유니온 자동 반영). `SaveFields`는 capture용 그대로 유지(reflection은 Task 10에서 별도).

- [ ] **Step 5: 게이트 — 회귀 0 확인**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: 기존 29 테스트 PASS, typecheck/lint 에러 0. (런타임 불변, 타입만 유니온.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(types): StagingItem 판별 유니온 전환 + reflection 타입(회귀 0)"
```

### Task 2: reflection 노트 조립·파싱 (`core/note.ts`, 순수)

이름 파생(`slug`·`workKey`·`reflectionBaseName`·`hubBaseName`), 조립(`assembleReflectionRaw`/`assembleReflectionTransformed`), 파싱(`parseReflectionNote`), 종류 판별(`noteKind`)을 같은 `note.ts`에 추가. 기존 함수는 불변.

**Files:** Modify `src/core/note.ts`, `src/core/note.test.ts`

- [ ] **Step 1: 실패 테스트 (`note.test.ts`에 추가)**

```ts
import {
  slug, workKey, reflectionBaseName, hubBaseName,
  assembleReflectionRaw, assembleReflectionTransformed, parseReflectionNote, noteKind,
} from './note';
import type { ReflectionMeta, ReflectionTransform } from '@/shared/types';

const rmeta: ReflectionMeta = {
  id: 'b4c3d2e1-0000-0000-0000-000000000000',
  createdAt: '2026-06-25T14:30:00+09:00',
  medium: 'book', workTitle: '사피엔스', workKey: 'book-사피엔스',
  progress: 'p.40-60', note: '허구가 협력을 낳는다는 대목', source: '', tags: ['역사'],
};
const rtr: ReflectionTransform = { title: '허구가 협력을 낳는다', reflection: '정리된 감상 본문.', takeaway: '핵심 한 줄.', tags: ['역사', '협력'] };

describe('slug / workKey', () => {
  it('영문 소문자화·공백→하이픈', () => expect(slug('The Matrix')).toBe('the-matrix'));
  it('한글 보존', () => expect(slug('사피엔스')).toBe('사피엔스'));
  it('workKey = medium-slug', () => expect(workKey('book', '사피엔스')).toBe('book-사피엔스'));
});

describe('reflectionBaseName / hubBaseName', () => {
  it('매체 접두사-날짜-shortid', () => expect(reflectionBaseName(rmeta)).toBe('책-2026-06-25-b4c3d2e10000'));
  it('허브 베이스명', () => expect(hubBaseName(rmeta)).toBe('책-사피엔스 (감상)'));
});

describe('assembleReflectionRaw', () => {
  const md = assembleReflectionRaw(rmeta);
  it('kind:reflection + status:raw + 허브링크 + 메모', () => {
    expect(md).toContain('kind: reflection');
    expect(md).toContain('status: raw');
    expect(md).toContain('medium: book');
    expect(md).toContain('work: 사피엔스');
    expect(md).toContain('workKey: book-사피엔스');
    expect(md).toContain('progress: p.40-60');
    expect(md).toContain('[[책-사피엔스 (감상)]]');
    expect(md).toContain('> 메모: 허구가 협력을 낳는다는 대목');
    expect(md).not.toContain('## 감상');
  });
});

describe('assembleReflectionTransformed', () => {
  const md = assembleReflectionTransformed(rmeta, rtr);
  it('status:transformed + title + 감상/핵심 + 태그 합집합 + 허브링크', () => {
    expect(md).toContain('status: transformed');
    expect(md).toContain('title: 허구가 협력을 낳는다');
    expect(md).toContain('[[책-사피엔스 (감상)]]');
    expect(md).toContain('## 감상');
    expect(md).toContain('정리된 감상 본문.');
    expect(md).toContain('## 핵심');
    expect(md).toContain('핵심 한 줄.');
    expect(md).toContain('tags: [역사, 협력]');
    expect(md).not.toContain('> 메모:'); // 정리본이 대체(이중저장 안 함)
  });
  it('takeaway 비면 ## 핵심 생략', () => {
    const md2 = assembleReflectionTransformed(rmeta, { ...rtr, takeaway: '' });
    expect(md2).not.toContain('## 핵심');
  });
});

describe('noteKind', () => {
  it('reflection 노트', () => expect(noteKind(assembleReflectionRaw(rmeta))).toBe('reflection'));
  it('kind 부재면 capture', () => expect(noteKind('---\ntype: insight\n---\n')).toBe('capture'));
});

describe('parseReflectionNote', () => {
  it('transformed 라운드트립', () => {
    const p = parseReflectionNote(assembleReflectionTransformed(rmeta, rtr));
    expect(p.status).toBe('transformed');
    expect(p.meta.medium).toBe('book');
    expect(p.meta.workTitle).toBe('사피엔스');
    expect(p.meta.workKey).toBe('book-사피엔스');
    expect(p.meta.progress).toBe('p.40-60');
    expect(p.meta.id).toBe('b4c3d2e1-0000-0000-0000-000000000000');
    expect(p.transform?.title).toBe('허구가 협력을 낳는다');
    expect(p.transform?.reflection).toContain('정리된 감상');
    expect(p.transform?.takeaway).toContain('핵심 한 줄');
  });
  it('raw 라운드트립: status raw, transform 없음, note 복원', () => {
    const p = parseReflectionNote(assembleReflectionRaw(rmeta));
    expect(p.status).toBe('raw');
    expect(p.transform).toBeUndefined();
    expect(p.meta.note).toBe('허구가 협력을 낳는다는 대목');
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/core/note.test.ts` → FAIL(미구현 export).

- [ ] **Step 3: 구현 (`src/core/note.ts`에 추가)**

```ts
import type { ReflectionMeta, ReflectionTransform, ReflectionMedium, StagingKind } from '@/shared/types';

const MEDIUM_PREFIX: Record<ReflectionMedium, string> = { book: '책', movie: '영화', anime: '애니', manga: '만화' };

export function slug(s: string): string {
  return s.trim().toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
export function workKey(medium: ReflectionMedium, workTitle: string): string {
  return `${medium}-${slug(workTitle)}`;
}
export function reflectionBaseName(meta: ReflectionMeta): string {
  return `${MEDIUM_PREFIX[meta.medium]}-${meta.createdAt.slice(0, 10)}-${shortId(meta.id)}`;
}
export function hubBaseName(meta: Pick<ReflectionMeta, 'medium' | 'workTitle'>): string {
  return `${MEDIUM_PREFIX[meta.medium]}-${meta.workTitle} (감상)`;
}

function reflectionFrontmatter(meta: ReflectionMeta, opts: { status: StagingStatus; tags: string[]; title?: string }): string {
  const lines = [
    '---',
    `created: ${meta.createdAt}`,
    'kind: reflection',
    `medium: ${meta.medium}`,
    `work: ${meta.workTitle}`,
    `workKey: ${meta.workKey}`,
    `progress: ${meta.progress}`,
    `source: ${meta.source}`,
    `tags: [${opts.tags.join(', ')}]`,
    `captureId: ${meta.id}`,
  ];
  if (opts.title !== undefined) lines.push(`title: ${opts.title}`);
  lines.push(`status: ${opts.status}`);
  lines.push('---');
  return lines.join('\n');
}

function hubLink(meta: ReflectionMeta): string {
  return `[[${hubBaseName(meta)}]]`;
}

export function assembleReflectionRaw(meta: ReflectionMeta): string {
  const fm = reflectionFrontmatter(meta, { status: 'raw', tags: meta.tags });
  return `${fm}\n${hubLink(meta)}${memoBlock(meta)}\n`;
}

export function assembleReflectionTransformed(meta: ReflectionMeta, tr: ReflectionTransform): string {
  const fm = reflectionFrontmatter(meta, { status: 'transformed', tags: union(meta.tags, tr.tags), title: tr.title });
  const sections = [`## 감상\n${tr.reflection}`];
  if (tr.takeaway.trim()) sections.push(`## 핵심\n${tr.takeaway}`);
  return `${fm}\n${hubLink(meta)}\n\n${sections.join('\n\n')}\n`;
}
```

> `shortId`·`union`·`memoBlock`은 같은 파일 비공개 함수라 직접 호출. `memoBlock(meta)`는 `meta.note`만 읽으므로 시그니처를 `function memoBlock(meta: { note: string })`로 **넓힌다**(capture·reflection 공용). `StagingStatus`는 파일 상단 기존 import에 이미 있음.

`noteKind` + `parseReflectionNote`(기존 `parseNote`의 frontmatter 라인 파서·`sectionBody` 재사용):

```ts
export function noteKind(md: string): StagingKind {
  const m = md.match(/^kind:\s*(\w+)/m);
  return m && m[1] === 'reflection' ? 'reflection' : 'capture';
}

export interface ParsedReflection {
  status: StagingStatus;
  meta: ReflectionMeta;
  transform?: ReflectionTransform;
  transformError?: string;
}

export function parseReflectionNote(md: string): ParsedReflection {
  const fm = parseFrontmatter(md); // 아래 헬퍼 추출(Step 3b)
  const body = fm.body;
  const status: StagingStatus = fm.map['status'] === 'transformed' ? 'transformed' : 'raw';
  const memoMatch = body.match(/^> 메모: (.*)$/m);
  const meta: ReflectionMeta = {
    id: fm.map['captureId'] ?? '',
    createdAt: fm.map['created'] ?? '',
    medium: (fm.map['medium'] ?? 'book') as ReflectionMedium,
    workTitle: fm.map['work'] ?? '',
    workKey: fm.map['workKey'] ?? '',
    progress: fm.map['progress'] ?? '',
    note: memoMatch ? memoMatch[1].trim() : '',
    source: fm.map['source'] ?? '',
    tags: parseTagList(fm.map['tags'] ?? ''),
  };
  const transformError = fm.map['transformError'] || undefined;
  if (status !== 'transformed') return { status, meta, transformError };
  const transform: ReflectionTransform = {
    title: fm.map['title'] ?? '',
    reflection: sectionBody(body, '감상'),
    takeaway: sectionBody(body, '핵심'),
    tags: meta.tags,
  };
  return { status, meta, transform };
}
```

- [ ] **Step 3b: frontmatter 파서 추출(중복 제거, 선택적 리팩터)**

기존 `parseNote` 내부의 frontmatter 블록 추출 로직을 작은 헬퍼 `function parseFrontmatter(md): { map: Record<string,string>; body: string }`로 빼고 `parseNote`·`parseReflectionNote` 둘 다 사용. `parseNote` 동작은 불변(기존 테스트가 회귀 가드). 추출이 부담되면 `parseReflectionNote`에 동일 로직을 인라인해도 무방(중복 허용, DRY는 후속).

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/core/note.test.ts` → PASS(신규 + 기존 전부).
- [ ] **Step 5: Commit** — `git commit -am "feat(core): reflection 노트 조립·파싱 + 이름 파생(순수)"`

### Task 3: 변환 스키마 (`core/reflection-schema.ts`, 순수)

**Files:** Create `src/core/reflection-schema.ts`, `src/core/reflection-schema.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { ReflectionSchema } from './reflection-schema';

describe('ReflectionSchema', () => {
  it('정상 통과', () => {
    const r = ReflectionSchema.parse({ title: 't', reflection: 'r', takeaway: '', tags: ['a'] });
    expect(r.title).toBe('t');
  });
  it('title 누락 거부', () => expect(() => ReflectionSchema.parse({ reflection: 'r', takeaway: '', tags: [] })).toThrow());
  it('tags 비배열 거부', () => expect(() => ReflectionSchema.parse({ title: 't', reflection: 'r', takeaway: '', tags: 'x' })).toThrow());
});
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**

```ts
import { z } from 'zod';
export const ReflectionSchema = z.object({
  title: z.string().min(1),
  reflection: z.string(),
  takeaway: z.string(),
  tags: z.array(z.string()),
});
export type ReflectionParsed = z.infer<typeof ReflectionSchema>;
```

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): zod ReflectionSchema(순수)"`

### Task 4: 작품 허브 MOC (`core/hub.ts`, 순수)

작품당 허브 노트 조립 + **멱등 upsert**(생성/append/중복무시). 순수 문자열 in/out.

**Files:** Create `src/core/hub.ts`, `src/core/hub.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { assembleHub, upsertHub } from './hub';
import type { ReflectionMeta } from '@/shared/types';

const meta: ReflectionMeta = {
  id: 'x', createdAt: '2026-06-25T14:30:00+09:00', medium: 'book',
  workTitle: '사피엔스', workKey: 'book-사피엔스', progress: '', note: '', source: '', tags: [],
};

describe('upsertHub', () => {
  it('null → 새 허브 생성(헤더 + 첫 세션 링크)', () => {
    const md = upsertHub(null, meta, '책-2026-06-25-aaaa');
    expect(md).toContain('kind: reflection-hub');
    expect(md).toContain('workKey: book-사피엔스');
    expect(md).toContain('# 사피엔스 — 감상 로그');
    expect(md).toContain('## 세션');
    expect(md).toContain('- [[책-2026-06-25-aaaa]]');
  });
  it('기존 허브 → 세션 링크 append', () => {
    const first = upsertHub(null, meta, '책-2026-06-25-aaaa');
    const second = upsertHub(first, meta, '책-2026-06-26-bbbb');
    expect(second).toContain('- [[책-2026-06-25-aaaa]]');
    expect(second).toContain('- [[책-2026-06-26-bbbb]]');
  });
  it('중복 세션 링크는 멱등(재추가 안 함)', () => {
    const first = upsertHub(null, meta, '책-2026-06-25-aaaa');
    const again = upsertHub(first, meta, '책-2026-06-25-aaaa');
    expect(again.match(/- \[\[책-2026-06-25-aaaa\]\]/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**

```ts
import type { ReflectionMeta } from '@/shared/types';

function hubFrontmatter(meta: ReflectionMeta): string {
  return [
    '---', 'kind: reflection-hub', `medium: ${meta.medium}`,
    `work: ${meta.workTitle}`, `workKey: ${meta.workKey}`, 'tags: [감상허브]', '---',
  ].join('\n');
}

export function assembleHub(meta: ReflectionMeta, sessionBases: string[]): string {
  const links = sessionBases.map((b) => `- [[${b}]]`).join('\n');
  return `${hubFrontmatter(meta)}\n# ${meta.workTitle} — 감상 로그\n\n## 세션\n${links}\n`;
}

/** existing이 null이면 새 허브, 아니면 세션 링크 멱등 append. */
export function upsertHub(existing: string | null, meta: ReflectionMeta, sessionBase: string): string {
  const link = `- [[${sessionBase}]]`;
  if (!existing) return assembleHub(meta, [sessionBase]);
  if (existing.includes(link)) return existing; // 멱등
  // '## 세션' 블록 끝(파일 끝)에 링크 추가. 트레일링 개행 정규화.
  const trimmed = existing.replace(/\s*$/, '');
  return `${trimmed}\n${link}\n`;
}
```

> v1은 `## 세션`이 허브의 마지막 섹션이므로 파일 끝 append로 충분(스펙 §7.2). 사용자가 허브에 다른 섹션을 더해도 링크는 끝에 붙는다(허용).

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): 작품 허브 MOC upsert(멱등, 순수)"`

### Task 5: reflection 승격 경로 (`core/promote.ts`, 순수)

**Files:** Modify `src/core/promote.ts`, `src/core/promote.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**

```ts
import { reflectionPromoteTargets } from './promote';

describe('reflectionPromoteTargets', () => {
  it('노트 경로만(이미지 없음)', () => {
    const t = reflectionPromoteTargets('책-2026-06-25-aaaa', { notesDir: '/v/감상' });
    expect(t.notePath).toBe('/v/감상/책-2026-06-25-aaaa.md');
  });
});
```
(기존 `promoteTargets`·`stripStagingFrontmatter` 테스트는 그대로 — reflection도 `stripStagingFrontmatter` 재사용해 `status`만 제거.)

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현(추가)**

```ts
export function reflectionPromoteTargets(base: string, dirs: { notesDir: string }): { notePath: string } {
  return { notePath: joinPosix(dirs.notesDir, `${base}.md`) };
}
```

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(core): reflection 승격 경로(순수)"`

### Chunk 1 게이트
Run: `npm run test && npm run typecheck && npm run lint` → 전부 green(기존 29 + 신규). 아니면 다음 청크 진입 금지.

---

## Chunk 2: main 어댑터 (transform · staging-store · settings · ipc)

순수 코어를 부수효과(SDK·fs·Electron)에 잇는다.

### Task 6: 텍스트 변환 (`main/transform.ts`)

이미지 블록 **없는** 텍스트 변환. 기존 `transformCapture`는 불변.

**Files:** Modify `src/main/transform.ts`, `src/main/transform.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**

```ts
import { transformReflection } from './transform';
import type { ReflectionMeta } from '@/shared/types';

const rmeta: ReflectionMeta = {
  id: 'x', createdAt: '2026-06-25T00:00:00Z', medium: 'book',
  workTitle: '사피엔스', workKey: 'book-사피엔스', progress: 'p.40-60',
  note: '허구가 협력을 낳는다', source: '', tags: ['역사'],
};

describe('transformReflection', () => {
  it('텍스트 블록만(이미지 없음) + 스키마 강제, parsed 반환', async () => {
    const parse = vi.fn(async () => ({ parsed_output: { title: 'T', reflection: 'R', takeaway: 'K', tags: ['a'] }, stop_reason: 'end_turn' }));
    const client = { messages: { parse } } as any;
    const out = await transformReflection(client, rmeta, 'claude-opus-4-8');
    const arg = parse.mock.calls[0][0];
    const content = arg.messages[0].content;
    expect(content.every((b: any) => b.type === 'text')).toBe(true); // 이미지 블록 없음
    expect(JSON.stringify(content)).toContain('사피엔스'); // 작품 주입
    expect(out.title).toBe('T');
  });
  it('parsed_output 없으면 throw', async () => {
    const client = { messages: { parse: vi.fn(async () => ({ parsed_output: null, stop_reason: 'max_tokens' })) } } as any;
    await expect(transformReflection(client, rmeta, 'claude-opus-4-8')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현(추가)**

```ts
import { ReflectionSchema } from '@/core/reflection-schema';
import type { ReflectionMeta, ReflectionTransform } from '@/shared/types';

const REFLECTION_GUIDANCE: Record<string, string> = {
  book: '책 일부를 읽고 든 생각이다. 논지·인상 깊은 구절·사용자 자신의 해석을 구분해 정리하라.',
  movie: '영화 감상이다. 인상 장면·주제·사용자의 느낌을 정리하라.',
  anime: '애니 감상이다. 전개·연출·사용자의 느낌을 정리하라.',
  manga: '만화 감상이다. 전개·연출·사용자의 느낌을 정리하라.',
};

export function buildReflectionPrompt(meta: ReflectionMeta): string {
  const guidance = REFLECTION_GUIDANCE[meta.medium] ?? REFLECTION_GUIDANCE.book;
  const parts = [
    '아래는 사용자가 작품을 감상하며 친 러프한 세션 메모다. 이를 Obsidian 노트용으로 정리하라.',
    `매체: ${meta.medium}. 작품: ${meta.workTitle}. ${guidance}`,
  ];
  if (meta.progress.trim()) parts.push(`진행: ${meta.progress.trim()}`);
  if (meta.source.trim()) parts.push(`출처: ${meta.source.trim()}`);
  parts.push(`세션 메모: ${meta.note.trim()}`);
  parts.push(
    '제약: 사용자 메모의 범위 안에서만 정리하라. 작품의 저자·연도·줄거리 등 외부 사실을 지어내지 마라. 사용자의 표현과 관점(voice)을 보존하라.',
    '출력 규격:',
    '- title: 노트 제목(간결·핵심).',
    '- reflection: 정리된 감상 본문(한국어, 사용자 메모를 매끄럽게 구조화).',
    '- takeaway: 핵심 한두 문장(없으면 빈 문자열).',
    '- tags: 분류 태그(소문자, 공백 없음). 작품·주제 맥락 반영.',
  );
  return parts.join('\n');
}

export async function transformReflection(
  client: Anthropic, meta: ReflectionMeta, model: string,
): Promise<ReflectionTransform> {
  const res = await client.messages.parse({
    model, max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(ReflectionSchema) },
    messages: [{ role: 'user', content: [{ type: 'text', text: buildReflectionPrompt(meta) }] }],
  });
  if (!res.parsed_output) throw new Error('reflection transform parse 실패(stop_reason=' + res.stop_reason + ')');
  return res.parsed_output;
}
```

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(main): Claude 텍스트 변환(transformReflection)"`

### Task 7: staging-store reflection (`main/staging-store.ts`)

reflection 쓰기/스캔 분기/제거 + 허브 fs upsert. capture 함수는 불변.

**Files:** Modify `src/main/staging-store.ts`, `src/main/staging-store.test.ts`

- [ ] **Step 1: 실패 테스트(추가)**

```ts
import { writeReflectionRaw, writeReflectionTransformed, scan, removeItem, upsertHubFile } from './staging-store';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import type { ReflectionMeta, ReflectionTransform, ReflectionStagingItem } from '@/shared/types';

const rmeta: ReflectionMeta = {
  id: 'b4c3d2e1-0000-0000-0000-000000000000', createdAt: '2026-06-25T14:30:00+09:00',
  medium: 'book', workTitle: '사피엔스', workKey: 'book-사피엔스', progress: 'p.40-60',
  note: '메모', source: '', tags: ['역사'],
};
const rtr: ReflectionTransform = { title: 'T', reflection: 'R', takeaway: 'K', tags: ['협력'] };

describe('staging-store reflection', () => {
  it('writeReflectionRaw + scan: kind reflection, 이미지 없음', () => {
    writeReflectionRaw(dir, rmeta);
    const items = scan(dir);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('reflection');
    expect(items[0].status).toBe('raw');
    const it = items[0] as ReflectionStagingItem;
    expect(it.meta.workKey).toBe('book-사피엔스');
  });
  it('writeReflectionTransformed: transformed로 갱신', () => {
    writeReflectionRaw(dir, rmeta);
    writeReflectionTransformed(dir, rmeta, rtr);
    const it = scan(dir)[0] as ReflectionStagingItem;
    expect(it.status).toBe('transformed');
    expect(it.transform?.title).toBe('T');
  });
  it('removeItem: 노트 삭제(이미지 없어도 무해)', () => {
    writeReflectionRaw(dir, rmeta);
    removeItem(dir, scan(dir)[0]);
    expect(scan(dir)).toHaveLength(0);
  });
  it('upsertHubFile: 생성 후 append 멱등', () => {
    const hubPath = upsertHubFile(dir, rmeta, '책-2026-06-25-aaaa');
    expect(existsSync(hubPath)).toBe(true);
    upsertHubFile(dir, rmeta, '책-2026-06-26-bbbb');
    upsertHubFile(dir, rmeta, '책-2026-06-26-bbbb'); // 멱등
    const md = readFileSync(hubPath, 'utf-8');
    expect(md.match(/- \[\[책-2026-06-26-bbbb\]\]/g)).toHaveLength(1);
    expect(md).toContain('- [[책-2026-06-25-aaaa]]');
  });
});
```
(기존 capture 테스트의 `scan(dir)[0]`은 이제 union; capture 케이스는 `items[0].imagePath` 등 capture 필드 접근 시 `as CaptureStagingItem` 또는 `items[0].kind === 'capture'` 가드 추가. 기존 테스트가 깨지면 그 라인만 narrow.)

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**

`scan`을 kind 분기로:
```ts
import { /* 기존 */ baseName, assembleRaw, assembleTransformed, parseNote,
  reflectionBaseName, assembleReflectionRaw, assembleReflectionTransformed, parseReflectionNote, noteKind } from '@/core/note';
import { upsertHub } from '@/core/hub';
import type { /* 기존 */ ReflectionMeta, ReflectionTransform, StagingItem } from '@/shared/types';

export function writeReflectionRaw(dir: string, meta: ReflectionMeta): void {
  ensureDir(dir);
  writeFileSync(notePathFor(dir, reflectionBaseName(meta)), assembleReflectionRaw(meta));
}
export function writeReflectionTransformed(dir: string, meta: ReflectionMeta, tr: ReflectionTransform): void {
  ensureDir(dir);
  writeFileSync(notePathFor(dir, reflectionBaseName(meta)), assembleReflectionTransformed(meta, tr));
}
export function hasReflectionNote(dir: string, meta: ReflectionMeta): boolean {
  return existsSync(notePathFor(dir, reflectionBaseName(meta)));
}
```

`scan`의 루프 본문에서, `readFileSync` 후 `noteKind(md)`로 분기:
```ts
const md = readFileSync(notePath, 'utf-8');
if (noteKind(md) === 'reflection') {
  const parsed = parseReflectionNote(md);
  items.push({ kind: 'reflection', base, meta: parsed.meta, status: parsed.status,
    transform: parsed.transform, notePath, error: parsed.transformError });
  continue;
}
// (기존 capture 경로 — kind:'capture' 스탬프 포함)
```
catch 블록은 capture 폴백 그대로(`kind:'capture'`).

`removeItem`은 이미 `if (item.imagePath)` 가드가 있어 reflection(imagePath 없음)에도 안전 — 단 `item.imagePath` 접근이 union에서 capture-only이므로 `'imagePath' in item && item.imagePath` 또는 `item.kind === 'capture' && item.imagePath`로 가드. `updateNote`는 `item.notePath`만 쓰므로 양 kind 공통(OK).

`upsertHubFile`(fs 래퍼, `core/hub.upsertHub` + `core/note.hubBaseName` 사용):
```ts
import { hubBaseName } from '@/core/note';
export function upsertHubFile(notesDir: string, meta: ReflectionMeta, sessionBase: string): string {
  ensureDir(notesDir);
  const hubPath = path.join(notesDir, `${hubBaseName(meta)}.md`);
  const existing = existsSync(hubPath) ? readFileSync(hubPath, 'utf-8') : null;
  writeFileSync(hubPath, upsertHub(existing, meta, sessionBase));
  return hubPath;
}
```
reflection 노트 이동(이미지 없음): `moveToVault`는 이미지 전제라 별도 함수:
```ts
export function moveNoteOnly(item: StagingItem, target: { notePath: string }, noteMd: string): void {
  mkdirSync(path.dirname(target.notePath), { recursive: true });
  writeFileSync(target.notePath, noteMd);
  rmSync(item.notePath, { force: true });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/main/staging-store.test.ts` → PASS(기존 + 신규).
- [ ] **Step 5: Commit** — `git commit -am "feat(main): staging-store reflection 쓰기/스캔/제거 + 허브 upsert(fs)"`

### Task 8: 설정 (`main/settings.ts`) + AppSettings 미러

**Files:** Modify `src/main/settings.ts`, `src/renderer/api.d.ts`

- [ ] **Step 1: 구현** — `Settings` 인터페이스와 `DEFAULT_SETTINGS`에 `reflectionSubdir: string` 추가(기본 `'감상'`). renderer `api.d.ts`의 `AppSettings`에도 동일 필드 추가(미러 유지).
- [ ] **Step 2: 타입체크** — Run: `npm run typecheck` → 에러 없음.
- [ ] **Step 3: Commit** — `git commit -am "feat(main): reflectionSubdir 설정(기본 감상)"`

### Task 9: IPC 분기 + reflection 입구 (`main/ipc.ts`)

reflection 생성·works 픽커 + transform/promote/save kind 분기. Task 1의 임시 가드를 교체.

**Files:** Modify `src/main/ipc.ts`

- [ ] **Step 1: reflection:create 핸들러**

```ts
import { randomUUID } from 'node:crypto';
import { writeReflectionRaw, writeReflectionTransformed, hasReflectionNote, upsertHubFile, moveNoteOnly } from './staging-store';
import { transformReflection } from './transform';
import { reflectionBaseName, workKey, parseReflectionNote } from '@/core/note';
import { reflectionPromoteTargets } from '@/core/promote';
import type { ReflectionMedium, ReflectionMeta } from '@/shared/types';

interface CreateReflectionInput { medium: ReflectionMedium; workTitle: string; progress: string; note: string; source: string; tags: string[]; }

ipcMain.handle('reflection:create', (_e, input: CreateReflectionInput): { ok: boolean; reason?: string } => {
  const s = readSettings();
  if (!s.stagingDir) return { ok: false, reason: 'staging 폴더 미설정' };
  if (!input.workTitle?.trim() || !input.note?.trim()) return { ok: false, reason: '작품·메모는 필수' };
  const meta: ReflectionMeta = {
    id: randomUUID(),
    createdAt: nowIso(), // 아래 헬퍼: +09:00 ISO
    medium: input.medium, workTitle: input.workTitle.trim(),
    workKey: workKey(input.medium, input.workTitle),
    progress: input.progress ?? '', note: input.note.trim(),
    source: input.source ?? '', tags: input.tags ?? [],
  };
  writeReflectionRaw(s.stagingDir, meta);
  return { ok: true };
});
```
`nowIso()` 헬퍼: `new Date().toISOString()` 기반(또는 KST 오프셋 부여). v1은 `new Date().toISOString()`로 충분(파서가 앞 10자만 날짜로 사용). `auto()`가 곧 변환하므로 create 후 renderer가 `transform`+`reload` 호출(또는 create가 직접 `void auto(getWindow())`).

> 구현 노트: create 직후 자동 변환을 위해 `reflection:create` 끝에 `triggerAuto(getWindow())`를 호출하거나, renderer가 create 후 `window.api.transform()`+`reload()`를 부른다(Task 11에서 후자 채택 — 단순).

- [ ] **Step 2: reflection:works 핸들러(픽커 소스)**

```ts
ipcMain.handle('reflection:works', (): { workKey: string; workTitle: string; medium: string }[] => {
  const s = readSettings();
  const seen = new Map<string, { workKey: string; workTitle: string; medium: string }>();
  const collect = (dir: string) => {
    for (const it of scan(dir)) {
      if (it.kind !== 'reflection') continue;
      if (!seen.has(it.meta.workKey)) seen.set(it.meta.workKey, { workKey: it.meta.workKey, workTitle: it.meta.workTitle, medium: it.meta.medium });
    }
  };
  if (s.stagingDir) collect(s.stagingDir);
  // vault의 reflection 세션도 포함(승격되어 staging엔 없는 작품).
  if (s.vaultNotesDir) collect(path.join(s.vaultNotesDir, s.reflectionSubdir || ''));
  return [...seen.values()];
});
```
(`scan`이 vault 디렉토리도 동일하게 reflection 세션을 파싱 — 허브 노트는 `kind: reflection-hub`라 `noteKind`가 'capture'로 떨어져 무시되거나, `noteKind`에 hub 분기 추가해 제외. 간단히: scan에서 `noteKind`가 reflection이 아닌 것은 capture 취급되며 capture 파싱이 실패하면 error 항목이 됨 → works 수집엔 `it.kind==='reflection'`만 보므로 무해.)

- [ ] **Step 3: runTransform 분기**

`runTransform`의 루프를 kind 분기:
```ts
const targets = scan(s.stagingDir).filter((it) => it.status === 'raw'); // capture 전용 필터 제거
for (const item of targets) {
  try {
    if (item.kind === 'reflection') {
      const tr = await transformReflection(client, item.meta, s.model);
      writeReflectionTransformed(s.stagingDir, item.meta, tr);
    } else {
      const buf = readFileSync(item.imagePath);
      const tr = await transformCapture(client, item.meta, buf, s.model);
      writeTransformed(s.stagingDir, item.meta, tr);
    }
    transformed++;
  } catch (e) { /* 기존 setTransformError 격리 로직 그대로 */ failed++; }
}
```

- [ ] **Step 4: item:promote 분기**

`findItem` 후:
```ts
if (item.kind === 'reflection') {
  if (!s.vaultNotesDir) return { ok: false, reason: 'vault 노트 폴더 미설정' };
  const notesDir = path.join(s.vaultNotesDir, s.reflectionSubdir || '');
  const target = reflectionPromoteTargets(item.base, { notesDir });
  if (existsSync(target.notePath)) return { ok: false, reason: 'vault에 같은 이름이 이미 존재' };
  const cleaned = stripStagingFrontmatter(readFileSync(item.notePath, 'utf-8'));
  try {
    moveNoteOnly(item, target, cleaned);
    upsertHubFile(notesDir, item.meta, item.base); // 허브 갱신(멱등)
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
  removeItem(s.stagingDir, item);
  return { ok: true };
}
// (기존 capture promote 그대로)
```

- [ ] **Step 5: item:save 분기**

reflection 편집 저장:
```ts
if (item.kind === 'reflection') {
  const f = fields as Partial<ReflectionMeta & ReflectionTransform>;
  const meta: ReflectionMeta = { ...item.meta, source: f.source ?? item.meta.source, progress: f.progress ?? item.meta.progress, tags: f.tags ?? item.meta.tags };
  const tr: ReflectionTransform = {
    title: f.title ?? item.transform?.title ?? '',
    reflection: f.reflection ?? item.transform?.reflection ?? '',
    takeaway: f.takeaway ?? item.transform?.takeaway ?? '',
    tags: f.tags ?? item.transform?.tags ?? meta.tags,
  };
  writeReflectionTransformed(s.stagingDir, meta, tr);
  return { ok: true };
}
// (기존 capture save 그대로)
```
`item:image`(readImageDataUrl)는 reflection이면 `findItem` 결과가 reflection → 이미 `item.kind!=='capture'` 가드로 null 반환(Task 1 가드를 정식화).

- [ ] **Step 6: 게이트** — Run: `npm run test && npm run typecheck && npm run lint` → green.
- [ ] **Step 7: Commit** — `git commit -am "feat(main): IPC reflection 입구(create/works) + transform/promote/save kind 분기"`

### Chunk 2 게이트
Run: `npm run test && npm run typecheck && npm run lint` → 전부 green.

---

## Chunk 3: renderer UI + 문서 + e2e

새 감상 입력·트리아지/에디터 kind 분기. preload 표면 확장.

### Task 10: preload + api.d.ts 표면

**Files:** Modify `src/preload/index.ts`, `src/renderer/api.d.ts`

- [ ] **Step 1: preload 노출(추가)**

```ts
createReflection: (input: unknown) => ipcRenderer.invoke('reflection:create', input),
listWorks: () => ipcRenderer.invoke('reflection:works'),
```

- [ ] **Step 2: api.d.ts 타입(추가)**

```ts
import type { /* 기존 */ ReflectionMedium } from '@/shared/types';

export interface CreateReflectionInput { medium: ReflectionMedium; workTitle: string; progress: string; note: string; source: string; tags: string[]; }
export interface WorkRef { workKey: string; workTitle: string; medium: ReflectionMedium; }
export type ReflectionSaveFields = Partial<{ title: string; reflection: string; takeaway: string; tags: string[]; source: string; progress: string }>;
```
`AnchorApi`에 `createReflection: (input: CreateReflectionInput) => Promise<ActionResult>; listWorks: () => Promise<WorkRef[]>;` 추가. `save`의 fields 타입을 `SaveFields | ReflectionSaveFields`로 넓힘.

- [ ] **Step 3: 타입체크** — `npm run typecheck` → 에러 없음.
- [ ] **Step 4: Commit** — `git commit -am "feat(preload): createReflection·listWorks 표면"`

### Task 11: 매체 뱃지 + 새 감상 폼

**Files:** Create `src/renderer/components/MediumBadge.tsx`, `src/renderer/components/ReflectionForm.tsx`; Modify `src/renderer/App.tsx`

- [ ] **Step 1: MediumBadge** — `TypeBadge` 패턴 미러. `book/movie/anime/manga` → 라벨(책/영화/애니/만화) + 색( `--tier-foundation/mechanism/diagnosis` + ok 등 재사용).
- [ ] **Step 2: ReflectionForm** — 시트/모달. 필드: 매체 칩(REFLECTION_MEDIA), **작품 입력 + 최근작품 픽커**(`window.api.listWorks()`로 자동완성 — 기존 선택 시 workTitle 채움), 진행(선택), 세션 메모(textarea, 필수), source·tags(선택). "추가" → `window.api.createReflection({...})` → 성공 시 `onCreated()`(App이 `refresh()`로 변환+재로드). 검증: workTitle·note 필수.
- [ ] **Step 3: App 통합** — 헤더에 "+ 새 감상" 버튼 → `setReflectionFormOpen(true)`. `<ReflectionForm onClose=... onCreated={() => { void refresh(); }} />`. (`refresh`는 pull+transform+list — reflection 변환도 transform이 처리.)
- [ ] **Step 4: 수동 확인** — `npm run dev`: 새 감상 추가 → 트리아지에 raw→transformed 등장(키 설정 시).
- [ ] **Step 5: Commit** — `git commit -am "feat(renderer): 매체 뱃지 + 새 감상 폼(최근작품 픽커)"`

### Task 12: 트리아지/에디터 kind 분기

**Files:** Modify `src/renderer/components/TriageList.tsx`, `src/renderer/App.tsx`; Create `src/renderer/components/ReflectionEditor.tsx`

- [ ] **Step 1: TriageList 분기** — reflection 행: 썸네일 숨김(또는 매체 아이콘), `MediumBadge` + 작품명 표시. `item.kind === 'capture' ? <Thumbnail/> + <TypeBadge/> : <매체아이콘> + <MediumBadge/>`. rowTitle/상태/source 공통.
- [ ] **Step 2: ReflectionEditor** — `ItemEditor` 구조 미러, prop `item: ReflectionStagingItem`. 좌: 텍스트(작품·진행·메모) / 우: 필드(제목·감상·핵심·태그·진행·source). 버튼: "변환 다시"(`transform`)·"승격"(`promote`)·"버리기"(`discard`) — 기존 IPC 공유. 저장은 `window.api.save(base, {title, reflection, takeaway, tags, source, progress})`.
- [ ] **Step 3: App 분기** — `selected.kind === 'capture' ? <ItemEditor/> : <ReflectionEditor item={selected}/>`(Task 1의 "준비 중" 자리 교체).
- [ ] **Step 4: 수동 확인** — `npm run dev`: reflection 선택→편집→저장·승격, 같은 작품 2세션→vault 허브에 링크 2개.
- [ ] **Step 5: Commit** — `git commit -am "feat(renderer): 트리아지/에디터 reflection 분기 + ReflectionEditor"`

### Task 13: 빌드 + 문서 + 수동 e2e

**Files:** Modify `docs/usage.md`(anchor repo)

- [ ] **Step 1: 빌드** — Run: `npm run build` → main/preload/renderer 번들 성공.
- [ ] **Step 2: usage.md** — 감상 기록 사용법 추가(새 감상 입력 → 자동 정리 → 승격 → vault 세션 노트 + 작품 허브), `reflectionSubdir` 설정, 매체 4종.
- [ ] **Step 3: 수동 e2e(1회)** — 키·경로 설정 후: 책 세션 입력 → 자동 정리 → 트리아지 수정 → 승격 → vault `감상/책-...md`(status 제거) + `책-사피엔스 (감상).md`(세션 링크) 확인. 같은 작품 2번째 세션 승격 → 허브에 링크 append 확인.
- [ ] **Step 4: Commit** — `git commit -am "docs: usage 감상 기록 + build"`

### Chunk 3 게이트
Run: `npm run test && npm run typecheck && npm run lint && npm run build` → 전부 green.

---

## 완료 기준 (스펙 §12 동기화)

- [ ] 새 감상 폼에서 매체·작품·진행·메모 입력 → staging raw reflection(이미지 없음) → 자동 텍스트 정리(transformed).
- [ ] Claude는 정리·태깅만(작품 외부 사실 미생성 — 프롬프트 가드).
- [ ] 트리아지·에디터에서 capture·reflection 공존, reflection 스침·수정.
- [ ] "승격" 1회로 세션 노트가 vault 정본(status 제거) 안착 + 작품 허브 없으면 생성/있으면 세션 링크 멱등 append. staging에서 제거.
- [ ] 같은 작품 여러 세션이 독립 노트로 남으며 허브 하나로 모임.
- [ ] 순수 코어(note·reflection-schema·hub·promote) + 어댑터(transform·staging) 테스트 + **기존 capture 회귀 0** + typecheck·lint·build green.
- [ ] 수동 e2e 1회 관통.

## 비고

- 매체 추가(유튜브 등)는 `REFLECTION_MEDIA` + `MEDIUM_PREFIX` + `REFLECTION_GUIDANCE` + `MediumBadge` CFG 한 줄씩.
- 이미지 첨부·평점·원메모 이중저장·허브 자동요약은 v1 비목표(후속).
- `nowIso()`는 v1 `new Date().toISOString()`로 충분(날짜는 앞 10자만 사용). KST 오프셋 표기는 후속 폴리시.
- 윈도우 메모장 .txt 인박스(LogOS 모듈 4)는 이 reflection 골격에 또 다른 입구(폴더 watch)를 더하는 후속 — 본 증분이 텍스트-모드 변환·노트 포맷을 닦아둠.
