# 재소환 PWA (echo, v1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안착된 prose 노트(reflection·memo·capture)를 폰에서 다시 읽고 **울림/흐릿/졸업** 1탭으로 가벼운 재소환을 하는 PWA(echo) 한 세트 — publish CLI(vault→notes.json) + 토큰 게이트 Worker + PWA(Leitner 스케줄, 폰 IndexedDB).

**Architecture:** Hachimon/capture 스택 미러. 정적 `notes.json`(vault에서 publish) → 토큰 게이트 Cloudflare Worker → PWA가 fetch·merge → IndexedDB(notes·recall·settings) → 재소환 세션이 Leitner stage 스케줄을 갱신. 순수 코어(schedule·merge·publish 조립)는 부수효과(idb·fetch·fs·Worker)와 분리해 단위 테스트.

**Tech Stack:** React 19 + Vite 8 + Tailwind 4(@tailwindcss/vite) + idb 8 + react-markdown 10 + rehype-highlight + vite-plugin-pwa 1.3 + zod 4 + vitest 4 + fake-indexeddb. Worker: Cloudflare Workers + R2 + `@cloudflare/vitest-pool-workers`(miniflare). CLI: tsx. 구현 repo: **새 repo** `C:/Users/Eisen/Desktop/Labs/[projects] trial/echo`. 스펙: `hachimon/docs/superpowers/specs/2026-06-26-echo-recall-design.md`.

---

## 전제 / 시작 상태

- **새 repo `echo`**(빈 디렉토리에서 시작). 시드 출처: **Hachimon**(PWA 셸·vite/PWA 설정·idb 래퍼·디자인 토큰 `src/index.css`·index.html·main.tsx·tsconfig·merge 패턴) + **capture**(Worker relay+Bearer·wrangler·miniflare vitest·sync CLI 패턴·queue-db idb 래퍼). 경로는 echo 루트 기준.
- 커밋: conventional commits, 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 첫 커밋부터 `git init`.
- 게이트: `npm run test`(vitest), `npm run test:workers`(miniflare worker), `npm run lint`, `npm run build`(tsc -b + vite build). typecheck는 build의 tsc -b.
- **실측 반영(스펙 §5):** 콘텐츠 선택 술어는 frontmatter **`captureId` 존재**(reflection·memo·capture 세 kind 모두 `captureId`를 씀). capture 노트는 `kind:` 라인이 없음 → kind 파생은 `fm.kind ?? 'capture'`(anchor `noteKind` 규칙 동일). 검증 픽스처는 anchor 실제 노트 포맷을 따른다(아래 Task 5에 명시).
- 보안: notes.json은 사적 감상 → Worker Bearer 게이트. R2 단일 오브젝트 `notes.json`(D1 불필요 — capture보다 단순).

## File Structure

```
echo/
├── package.json · vite.config.ts · tsconfig*.json · tailwind 설정 · index.html · vitest.config.ts · vitest.workers.config.ts
├── public/ (manifest·icons)
├── src/
│   ├── index.css · main.tsx · App.tsx
│   ├── shared/types.ts        FeedNote·NotesFeed·RecallState·RecallSignal
│   ├── lib/
│   │   ├── schedule.ts/.test  [순수] Leitner stage 전이·nextRecallAt·selectDue
│   │   ├── merge.ts/.test      [순수] notes.json↔IndexedDB 4상태 머지(recall 보존)
│   │   ├── feed-note.ts/.test  [순수] vault 노트 md → FeedNote(captureId 선택·kind 파생·prose 추출·sourceHash)
│   │   ├── markdown.tsx         react-markdown 렌더(Hachimon 재사용)
│   │   ├── db.ts               idb 래퍼(notes·recall·settings 스토어)
│   │   └── fetch-notes.ts/.test Bearer GET /notes
│   ├── hooks/useRecall.ts      세션 상태(due 로드·신호 적용·재로드)
│   ├── components/             NoteCard·SignalBar·SettingsSheet 등
│   └── pages/                  Home·RecallSession·Settings
├── worker/
│   ├── relay.ts/.test          GET /notes(Bearer)→R2; PUT /notes(Bearer)→R2
│   ├── wrangler.toml · test-setup.ts
├── scripts/publish-notes.ts/.test  vault 스캔 → FeedNote[] → notes.json → Worker PUT
└── docs/usage.md
```

---

## Chunk 1: 스캐폴드 + 순수 코어 (schedule · merge · feed-note)

새 repo 골격 + 세 순수 모듈. 끝나면 네트워크·UI·Worker 없이 재소환 도메인이 검증된다.

### Task 1: 프로젝트 스캐폴드

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`/`tsconfig.app.json`/`tsconfig.node.json`/`tsconfig.scripts.json`, `vitest.config.ts`, `index.html`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `components` config as needed.

- [ ] **Step 1: package.json + 설정 시드**

Hachimon `package.json`을 베이스로 echo용으로 조정: `name: "echo"`, deps = `react`,`react-dom`,`idb`,`react-markdown`,`rehype-highlight`,`highlight.js`,`clsx`,`tailwind-merge`,`lucide-react`,`zod`,`@tailwindcss/vite`,`tailwindcss`,`@fontsource-variable/geist`; devDeps = `vite`,`@vitejs/plugin-react`,`vite-plugin-pwa`,`vitest`,`fake-indexeddb`,`typescript`,`@types/*`,`eslint`(+ts-eslint),`tsx`,`wrangler`,`@cloudflare/workers-types`,`@cloudflare/vitest-pool-workers`. scripts:
```json
{
  "dev": "vite", "build": "tsc -b && tsc -p tsconfig.scripts.json && vite build",
  "preview": "vite preview", "lint": "eslint .",
  "test": "vitest run", "test:workers": "vitest run -c vitest.workers.config.ts",
  "publish-notes": "tsx scripts/publish-notes.ts"
}
```
`vite.config.ts`·`tsconfig*`·`tailwind`·`index.html`·`src/index.css`(디자인 토큰)·`src/main.tsx`는 Hachimon에서 복사하되: index.html title/manifest "echo", vite PWA manifest name "echo", 런타임 캐시 대상 `cards.json`→불필요(echo는 토큰 fetch라 SW 런타임 캐시 대신 IndexedDB 캐시 — vite PWA는 앱셸 precache만). `vitest.config.ts`: `environment: 'node'`(순수 lib) + `setupFiles`에 fake-indexeddb(db 테스트용; Hachimon 패턴), `exclude` worker 테스트. `src/App.tsx`는 임시 `<h1>echo</h1>`.

Run: `npm install` → 성공.

- [ ] **Step 2: 부팅 확인** — Run: `npm run dev`(수동 1회) → "echo" 렌더. 종료.
- [ ] **Step 3: Commit** — `git init && git add -A && git commit -m "chore: scaffold echo (Hachimon PWA stack 시드)"`

### Task 2: 공유 타입 (`src/shared/types.ts`)

**Files:** Create `src/shared/types.ts`

- [ ] **Step 1: 타입 작성**
```ts
export type RecallKind = 'reflection' | 'memo' | 'capture';
export type RecallSignal = 'resonates' | 'faded' | 'done';

/** 정적 피드(notes.json) 1건. */
export interface FeedNote {
  id: string;        // captureId(안정 키)
  kind: RecallKind;  // fm.kind ?? 'capture'
  title: string;
  body: string;      // frontmatter·임베드 제거한 prose 마크다운
  source: string;
  tags: string[];
  createdAt: string;
  sourceHash: string;
}
export interface NotesFeed { version: string; notes: FeedNote[]; }

/** 폰 IndexedDB recall 스토어 1건. */
export interface RecallState {
  id: string;
  stage: number;            // Leitner stage(0부터)
  nextRecallAt: string;     // ISO
  lastRecalledAt: string | null;
  retiredAt: string | null; // 졸업 시각(있으면 풀 제외)
}
```
- [ ] **Step 2: 타입체크** — Run: `npx tsc -p tsconfig.app.json --noEmit` → 에러 없음.
- [ ] **Step 3: Commit** — `git commit -am "feat: shared types (FeedNote·NotesFeed·RecallState)"`

### Task 3: 재소환 스케줄 (`lib/schedule.ts`, 순수)

**Files:** Create `src/lib/schedule.ts`, `src/lib/schedule.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest';
import { INTERVALS_DAYS, initRecall, applySignal, selectDue } from './schedule';
import type { RecallState } from '@/shared/types';

const T0 = '2026-06-26T00:00:00.000Z';
const at = (days: number) => new Date(Date.parse(T0) + days * 864e5).toISOString();

describe('initRecall', () => {
  it('stage 0, 즉시 due', () => {
    const r = initRecall('a', T0);
    expect(r).toMatchObject({ id: 'a', stage: 0, nextRecallAt: T0, lastRecalledAt: null, retiredAt: null });
  });
});

describe('applySignal', () => {
  const base: RecallState = { id: 'a', stage: 1, nextRecallAt: T0, lastRecalledAt: null, retiredAt: null };
  it('울림 → stage+1, 간격 늘림', () => {
    const r = applySignal(base, 'resonates', T0);
    expect(r.stage).toBe(2);
    expect(r.nextRecallAt).toBe(at(INTERVALS_DAYS[2])); // T0 + 12d
    expect(r.lastRecalledAt).toBe(T0);
  });
  it('흐릿 → stage-1, 곧 재등장', () => {
    const r = applySignal(base, 'faded', T0);
    expect(r.stage).toBe(0);
    expect(r.nextRecallAt).toBe(at(INTERVALS_DAYS[0])); // T0 + 2d
  });
  it('울림 상한 유지', () => {
    const top: RecallState = { ...base, stage: INTERVALS_DAYS.length - 1 };
    expect(applySignal(top, 'resonates', T0).stage).toBe(INTERVALS_DAYS.length - 1);
  });
  it('흐릿 하한 0', () => {
    const r = applySignal({ ...base, stage: 0 }, 'faded', T0);
    expect(r.stage).toBe(0);
  });
  it('졸업 → retiredAt 설정', () => {
    expect(applySignal(base, 'done', T0).retiredAt).toBe(T0);
  });
});

describe('selectDue', () => {
  const mk = (id: string, due: number, retired = false): RecallState =>
    ({ id, stage: 0, nextRecallAt: at(due), lastRecalledAt: null, retiredAt: retired ? T0 : null });
  it('미은퇴 due만, overdue·오래된 우선, N개', () => {
    const states = [mk('new', 5), mk('overdue1', -3), mk('overdue2', -1), mk('retired', -10, true)];
    const now = at(0);
    const ids = selectDue(states, now, 2);
    expect(ids).toEqual(['overdue1', 'overdue2']); // 가장 overdue 먼저, retired·미래 due 제외
  });
  it('due 부족 시 있는 만큼', () => {
    expect(selectDue([mk('a', -1)], at(0), 5)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/schedule.test.ts` → FAIL.
- [ ] **Step 3: 구현**
```ts
import type { RecallState, RecallSignal } from '@/shared/types';

export const INTERVALS_DAYS = [2, 5, 12, 30, 90, 180];
const MAX_STAGE = INTERVALS_DAYS.length - 1;

function dueFrom(stage: number, from: string): string {
  return new Date(Date.parse(from) + INTERVALS_DAYS[stage] * 864e5).toISOString();
}

export function initRecall(id: string, now: string): RecallState {
  return { id, stage: 0, nextRecallAt: now, lastRecalledAt: null, retiredAt: null };
}

export function applySignal(s: RecallState, signal: RecallSignal, now: string): RecallState {
  if (signal === 'done') return { ...s, retiredAt: now, lastRecalledAt: now };
  const stage = signal === 'resonates' ? Math.min(s.stage + 1, MAX_STAGE) : Math.max(s.stage - 1, 0);
  return { ...s, stage, nextRecallAt: dueFrom(stage, now), lastRecalledAt: now };
}

/** 미은퇴 + due(nextRecallAt<=now) 중 overdue·오래된 우선 N개 id. 결정적. */
export function selectDue(states: RecallState[], now: string, n: number): string[] {
  const t = Date.parse(now);
  return states
    .filter((s) => !s.retiredAt && Date.parse(s.nextRecallAt) <= t)
    .sort((a, b) => Date.parse(a.nextRecallAt) - Date.parse(b.nextRecallAt) || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((s) => s.id);
}
```
> serendipity(스펙 §6, 선택)는 v1 제외 — 결정적 overdue-first로 출하. 후속에 seed 주입 추가.

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: Leitner 재소환 스케줄(순수)"`

### Task 4: 머지 (`lib/merge.ts`, 순수)

`notes.json` 피드 + 로컬 notes/recall → 적용할 변경 집합 산출(부수효과는 db 어댑터). Hachimon `mergeCards` 4상태 미러하되 순수(반환값).

**Files:** Create `src/lib/merge.ts`, `src/lib/merge.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest';
import { planMerge } from './merge';
import type { FeedNote, RecallState } from '@/shared/types';

const fn = (id: string, hash: string): FeedNote =>
  ({ id, kind: 'memo', title: id, body: 'b', source: 's', tags: [], createdAt: '2026-06-26T00:00:00Z', sourceHash: hash });
const T = '2026-06-26T00:00:00Z';

describe('planMerge', () => {
  it('피드 신규 → upsert + recall init', () => {
    const p = planMerge([fn('a', 'h1')], [], [], T);
    expect(p.notesUpserts.map((n) => n.id)).toEqual(['a']);
    expect(p.recallInits.map((r) => r.id)).toEqual(['a']);
    expect(p.notesDeletes).toEqual([]);
  });
  it('내용 변경(hash 다름) → upsert, recall init 없음(스케줄 보존)', () => {
    const local = [fn('a', 'h1')];
    const recall: RecallState[] = [{ id: 'a', stage: 3, nextRecallAt: T, lastRecalledAt: null, retiredAt: null }];
    const p = planMerge([fn('a', 'h2')], local, recall, T);
    expect(p.notesUpserts.map((n) => n.sourceHash)).toEqual(['h2']);
    expect(p.recallInits).toEqual([]); // 기존 stage 3 유지
  });
  it('hash 동일 → no-op', () => {
    const p = planMerge([fn('a', 'h1')], [fn('a', 'h1')], [{ id: 'a', stage: 0, nextRecallAt: T, lastRecalledAt: null, retiredAt: null }], T);
    expect(p.notesUpserts).toEqual([]);
    expect(p.notesDeletes).toEqual([]);
  });
  it('피드에서 사라짐 → 삭제', () => {
    const p = planMerge([], [fn('a', 'h1')], [], T);
    expect(p.notesDeletes).toEqual(['a']);
  });
});
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
import type { FeedNote, RecallState } from '@/shared/types';
import { initRecall } from './schedule';

export interface MergePlan {
  notesUpserts: FeedNote[]; // 신규 + 내용변경
  notesDeletes: string[];   // 피드에서 사라진 id
  recallInits: RecallState[]; // 신규 노트 초기 recall
}

export function planMerge(
  feed: FeedNote[], localNotes: FeedNote[], localRecall: RecallState[], now: string,
): MergePlan {
  const feedIds = new Set(feed.map((n) => n.id));
  const localById = new Map(localNotes.map((n) => [n.id, n]));
  const hasRecall = new Set(localRecall.map((r) => r.id));
  const notesUpserts: FeedNote[] = [];
  const recallInits: RecallState[] = [];
  for (const n of feed) {
    const local = localById.get(n.id);
    if (!local) { notesUpserts.push(n); if (!hasRecall.has(n.id)) recallInits.push(initRecall(n.id, now)); }
    else if (local.sourceHash !== n.sourceHash) notesUpserts.push(n); // 스케줄 보존
  }
  const notesDeletes = localNotes.filter((n) => !feedIds.has(n.id)).map((n) => n.id);
  return { notesUpserts, notesDeletes, recallInits };
}
```

- [ ] **Step 5: Commit** — `git commit -am "feat: notes.json↔IndexedDB 머지 plan(순수)"`

### Task 5: 피드 노트 조립 (`lib/feed-note.ts`, 순수)

vault 노트 md → `FeedNote`. **captureId 선택 술어 + kind 파생 + prose 추출 + sourceHash.** publish CLI(Task 9)가 fs로 래핑.

**Files:** Create `src/lib/feed-note.ts`, `src/lib/feed-note.test.ts`

- [ ] **Step 1: 실패 테스트(anchor 실제 노트 포맷 픽스처)**
```ts
import { describe, it, expect } from 'vitest';
import { parseFeedNote } from './feed-note';

// anchor memo transformed 노트(kind: memo + captureId)
const memoMd = `---
created: 2026-06-26T14:30:00+09:00
kind: memo
source: 아이디어.txt
tags: [학습, 설계]
captureId: c1d2e3f4-0000-0000-0000-000000000000
title: 복리적 학습 루프
status: transformed
---
정리된 본문.
둘째 줄.
`;
// anchor capture transformed 노트(kind 없음 → capture, type·임베드·captureId)
const captureMd = `---
created: 2026-06-25T14:30:00+09:00
type: insight
source: https://x/p/1
tags: [투자, 복리]
captureId: a3f2c1d4-0000-0000-0000-000000000000
title: 복리는 시간의 함수다
status: transformed
---
![[짤-2026-06-25-a3f2c1d40000.webp]]

## 핵심
핵심문장.

## 원문
원문텍스트
`;
// captureId 없는 노트(Hachimon 기술노트 등) → 선택 제외
const techMd = `---\ntype: note\n---\n## Self-Test Anchors\n`;

describe('parseFeedNote', () => {
  it('memo: kind 파생·prose 본문·태그·captureId 키', () => {
    const n = parseFeedNote('메모-2026-06-26-x.md', memoMd)!;
    expect(n.id).toBe('c1d2e3f4-0000-0000-0000-000000000000');
    expect(n.kind).toBe('memo');
    expect(n.title).toBe('복리적 학습 루프');
    expect(n.body).toContain('둘째 줄.');
    expect(n.tags).toEqual(['학습', '설계']);
  });
  it('capture: kind 부재 → capture, 임베드 제거, 섹션 본문 유지', () => {
    const n = parseFeedNote('짤-x.md', captureMd)!;
    expect(n.kind).toBe('capture');
    expect(n.id).toBe('a3f2c1d4-0000-0000-0000-000000000000');
    expect(n.body).not.toContain('![['); // 임베드 라인 제거
    expect(n.body).toContain('## 핵심');
    expect(n.body).toContain('원문텍스트');
  });
  it('captureId 없으면 null(선택 제외)', () => {
    expect(parseFeedNote('tech.md', techMd)).toBeNull();
  });
  it('sourceHash는 본문 결정적', () => {
    const a = parseFeedNote('x.md', memoMd)!;
    const b = parseFeedNote('y.md', memoMd)!;
    expect(a.sourceHash).toBe(b.sourceHash);
  });
});
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
import type { FeedNote, RecallKind } from '@/shared/types';

function parseFrontmatter(md: string): { map: Record<string, string>; body: string } {
  const lines = md.split('\n');
  const map: Record<string, string> = {};
  let start = 0;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { start = i + 1; break; }
      const idx = lines[i].indexOf(':');
      if (idx === -1) continue;
      map[lines[i].slice(0, idx).trim()] = lines[i].slice(idx + 1).trim();
    }
  }
  return { map, body: lines.slice(start).join('\n') };
}
function parseTags(raw: string): string[] {
  const s = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  return s ? s.split(',').map((t) => t.trim()).filter(Boolean) : [];
}
/** djb2 결정적 해시(16진). */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** vault 노트 md → FeedNote. captureId 없으면 null(선택 제외). */
export function parseFeedNote(_filename: string, md: string): FeedNote | null {
  const { map, body } = parseFrontmatter(md);
  const id = map['captureId'];
  if (!id) return null;
  const kind: RecallKind = map['kind'] === 'reflection' || map['kind'] === 'memo' ? map['kind'] : 'capture';
  // prose: 임베드(![[...]]) 라인 제거, 앞뒤 공백 정리.
  const prose = body
    .split('\n')
    .filter((l) => !/^\s*!\[\[.*\]\]\s*$/.test(l))
    .join('\n')
    .trim();
  const title = map['title'] || map['source'] || prose.split('\n')[0]?.slice(0, 60) || '(제목 없음)';
  return {
    id, kind, title, body: prose,
    source: map['source'] ?? '',
    tags: parseTags(map['tags'] ?? ''),
    createdAt: map['created'] ?? '',
    sourceHash: hash(prose),
  };
}
```

- [ ] **Step 5: Commit** — `git commit -am "feat: vault 노트 → FeedNote 조립(captureId 선택·kind 파생·순수)"`

### Chunk 1 게이트
Run: `npm run test && npm run build` → green(빌드 tsc -b 포함). 아니면 다음 청크 금지.

---

## Chunk 2: 어댑터 + Worker + publish CLI

순수 코어를 부수효과(idb·fetch·Worker·fs)에 잇는다.

### Task 6: IndexedDB 래퍼 (`lib/db.ts`)

capture `queue-db`·Hachimon `db` 패턴. 스토어 `notes`(key id)·`recall`(key id)·`settings`(key). fake-indexeddb로 테스트.

**Files:** Create `src/lib/db.ts`, `src/lib/db.test.ts`

- [ ] **Step 1: 실패 테스트(fake-indexeddb)** — `applyMergePlan`(plan을 db에 반영: upsert notes·delete notes+recall·put recall inits)·`allNotes`·`allRecall`·`putRecall`(신호 적용 저장)·`getSetting`/`setSetting` 라운드트립. (setupFiles fake-indexeddb 전제.)
- [ ] **Step 2~4: 실패 → 구현 → 통과**

idb `openDB<EchoDB>('echo', 1, { upgrade })` — 스토어 3개(keyPath: notes.id, recall.id, settings.key). `applyMergePlan(plan)`: 트랜잭션으로 upserts put·deletes(notes+recall 양쪽)·recallInits put. `allNotes`/`allRecall` getAll. `putRecall(state)` put. `getSetting/setSetting`. (직접 IDBTransaction 금지 — idb 래퍼.)

- [ ] **Step 5: Commit** — `git commit -am "feat: IndexedDB 래퍼(notes·recall·settings)"`

### Task 7: 피드 fetch (`lib/fetch-notes.ts`)

**Files:** Create `src/lib/fetch-notes.ts`, `src/lib/fetch-notes.test.ts`

- [ ] **Step 1: 실패 테스트(fetch 모킹)** — `fetchNotes({baseUrl, token}, fetchImpl)`: GET `{baseUrl}/notes` + `Authorization: Bearer <token>`; 비2xx throw; JSON 파싱 실패 throw(스펙 §10); `NotesFeed` 반환. (capture `upload`/`sync` Bearer 패턴 미러.)
- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
import type { NotesFeed } from '@/shared/types';
export interface FeedConfig { baseUrl: string; token: string; }
export async function fetchNotes(cfg: FeedConfig, fetchImpl: typeof fetch = fetch): Promise<NotesFeed> {
  const res = await fetchImpl(`${cfg.baseUrl.replace(/\/+$/, '')}/notes`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) throw new Error(`notes fetch 실패: ${res.status}`);
  return (await res.json()) as NotesFeed; // 파싱 실패는 throw(호출부가 캐시 유지)
}
```
- [ ] **Step 5: Commit** — `git commit -am "feat: Bearer 피드 fetch"`

### Task 8: Worker relay (`worker/relay.ts`)

capture `relay.ts`+`wrangler.toml`+`vitest.workers.config.ts` 미러하되 **R2 단일 오브젝트 `notes.json`**, 엔드포인트 2개.

**Files:** Create `worker/relay.ts`, `worker/relay.test.ts`, `worker/wrangler.toml`, `worker/test-setup.ts`, `vitest.workers.config.ts`

- [ ] **Step 1: 실패 테스트(miniflare, R2 바인딩)** — `GET /notes` 무토큰 401 / Bearer 200+본문; `PUT /notes` Bearer로 저장 후 `GET`이 반영; 비인증 PUT 401. (capture worker 테스트 + `@cloudflare/vitest-pool-workers` 설정 미러.)
- [ ] **Step 2~4: 실패 → 구현 → 통과**
```ts
interface Env { NOTES: R2Bucket; RELAY_TOKEN: string; }
const authed = (req: Request, env: Env) => req.headers.get('Authorization') === `Bearer ${env.RELAY_TOKEN}`;
const KEY = 'notes.json';
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!authed(req, env)) return new Response('unauthorized', { status: 401 });
    const { pathname } = new URL(req.url);
    if (pathname === '/notes' && req.method === 'GET') {
      const obj = await env.NOTES.get(KEY);
      if (!obj) return new Response(JSON.stringify({ version: '', notes: [] }), { headers: { 'content-type': 'application/json' } });
      return new Response(obj.body, { headers: { 'content-type': 'application/json' } });
    }
    if (pathname === '/notes' && req.method === 'PUT') {
      await env.NOTES.put(KEY, await req.arrayBuffer(), { httpMetadata: { contentType: 'application/json' } });
      return new Response(null, { status: 204 });
    }
    return new Response('not found', { status: 404 });
  },
};
```
`wrangler.toml`: `name = "echo-relay"`, R2 바인딩 `NOTES`(bucket `echo-notes`), secret `RELAY_TOKEN`. `vitest.workers.config.ts`: capture 미러(R2 바인딩, `worker/**/*.test.ts`).

- [ ] **Step 5: Commit** — `git commit -am "feat: Worker relay(notes GET/PUT, Bearer 게이트, R2)"`

### Task 9: publish CLI (`scripts/publish-notes.ts`)

capture `sync-captures` 패턴(env config·Bearer·`run()` counts·exit). vault 스캔 → `parseFeedNote`(Task 5) → `NotesFeed` → Worker PUT.

**Files:** Create `scripts/publish-notes.ts`, `scripts/publish-notes.test.ts`

- [ ] **Step 1: 실패 테스트(vault 픽스처 + fetch 모킹)** — `parseConfig(env)`: `RELAY_URL`·`RELAY_TOKEN`·`VAULT_DIR`(필수, 누락 throw). `buildFeed(vaultDir, version)`: 디렉토리 재귀 스캔 `*.md` → `parseFeedNote` non-null만 → `NotesFeed`(임시 디렉토리 픽스처: memo·capture 노트 + captureId 없는 노트 → 후자 제외). `run(cfg, version, fetchImpl)`: `buildFeed` → PUT `{baseUrl}/notes` Bearer body=JSON → `{ published: n }`.
- [ ] **Step 2~4: 실패 → 구현 → 통과** — `buildFeed`는 fs 스캔(재귀 `readdirSync`)·`parseFeedNote` 순수 재사용. `run`은 PUT. `main()`: `parseConfig(process.env)`→`run`→exit 0/1. 엔트리 가드 `if (process.argv[1] === fileURLToPath(import.meta.url)) main()`. version=ISO(인자 또는 `new Date().toISOString()`).
- [ ] **Step 5: Commit** — `git commit -am "feat: publish CLI(vault→notes.json→Worker PUT)"`

### Chunk 2 게이트
Run: `npm run test && npm run test:workers && npm run lint && npm run build` → 전부 green.

---

## Chunk 3: PWA UI + 문서 + e2e

### Task 10: 마크다운 + 앱 셸 + Home

**Files:** Create `src/lib/markdown.tsx`, `src/hooks/useRecall.ts`, `src/pages/Home.tsx`; Modify `src/App.tsx`

- [ ] **Step 1: markdown.tsx** — Hachimon `markdown` 재사용(react-markdown + rehype-highlight, 코드블록 렌더). 
- [ ] **Step 2: useRecall 훅** — 마운트 시 `allNotes`+`allRecall` 로드; `refresh()`=`fetchNotes`→`planMerge`→`applyMergePlan`→재로드(실패는 캐시 유지·비침습); `due` = `selectDue(recall, now, sessionSize)` → 해당 notes; `signal(id, sig)`=`applySignal`+`putRecall`+다음 due.
- [ ] **Step 3: App + Home** — App: Home/RecallSession 화면 전환(Hachimon App 패턴, 단순). Home: due 카운트 + "재소환 시작"(원탭) + 설정 진입. (선택) 연속일·총수는 후속.
- [ ] **Step 4: 수동 확인** — `npm run dev`: 더미 설정으로 Home 렌더.
- [ ] **Step 5: Commit** — `git commit -am "feat: 마크다운·useRecall·Home"`

### Task 11: 재소환 세션 (`pages/RecallSession.tsx`)

**Files:** Create `src/pages/RecallSession.tsx`, `src/components/NoteCard.tsx`, `src/components/SignalBar.tsx`

- [ ] **Step 1: NoteCard** — 제목 + 렌더 본문(markdown) + kind/출처 뱃지. 모바일 카드(Hachimon 토큰).
- [ ] **Step 2: SignalBar** — 하단 고정 3버튼 **울림 / 흐릿 / 졸업**(Hachimon 레이팅 버튼 패턴: 그래디언트 페이드·min-h-44). 탭 → `signal` → 다음 노트.
- [ ] **Step 3: RecallSession** — 진행 바 + 현재 노트 + SignalBar. due 소진 시 완료/홈.
- [ ] **Step 4: 수동 확인** — `npm run dev`: 더미 데이터로 세션 1회(신호 → 다음·due 감소).
- [ ] **Step 5: Commit** — `git commit -am "feat: 재소환 세션(NoteCard·SignalBar)"`

### Task 12: 설정 (`pages/Settings.tsx`)

**Files:** Create `src/pages/Settings.tsx`, `src/components/SettingsSheet.tsx`

- [ ] **Step 1: SettingsSheet** — 피드 URL·토큰(capture SettingsSheet 패턴), 세션 크기 슬라이더, 수동 새로고침(`refresh`), 데이터 리셋. `setSetting`으로 영속.
- [ ] **Step 2: 수동 확인** — 설정 저장→재시작 유지, 새로고침으로 fetch+merge.
- [ ] **Step 3: Commit** — `git commit -am "feat: 설정 시트(피드 URL·토큰·세션 크기)"`

### Task 13: 빌드 + manifest + 문서 + e2e

**Files:** Create `public/manifest`·icons, `docs/usage.md`

- [ ] **Step 1: 빌드** — Run: `npm run build` → PWA 번들 성공.
- [ ] **Step 2: manifest/icons** — echo PWA manifest(name·아이콘·standalone), A2HS 메타(Hachimon index.html 패턴).
- [ ] **Step 3: usage.md** — Worker 배포(`wrangler deploy`·`wrangler secret put RELAY_TOKEN`·R2 버킷)·publish CLI(env·작업 스케줄러)·PWA 설정(피드 URL·토큰)·재소환 흐름. **수동 e2e 체크리스트(사용자)**: publish(vault→Worker) → 폰 fetch → 세션 → 신호 후 due 변화·재방문 확인.
- [ ] **Step 4: (사용자) 수동 GUI e2e** — 헤드리스 불가. 체크리스트로 사용자 실행.
- [ ] **Step 5: Commit** — `git commit -am "docs: usage + manifest + build"`

### Chunk 3 게이트
Run: `npm run test && npm run test:workers && npm run lint && npm run build` → 전부 green.

---

## 완료 기준 (스펙 §12 동기화)

- [ ] publish CLI가 vault의 `captureId` 보유 안착 노트(3 kind)를 notes.json으로 조립해 Worker에 PUT.
- [ ] echo PWA가 Bearer로 fetch → merge(신규·내용갱신·삭제, recall 보존).
- [ ] 재소환 세션에서 재읽기 + 울림/흐릿/졸업 1탭 → stage 전이로 다음 due 변화(울림 멀리·흐릿 가까이·졸업 은퇴).
- [ ] 오프라인 캐시로 재소환 지속.
- [ ] 순수 코어(schedule·merge·feed-note) + 어댑터(db·fetch·worker·publish) 테스트 + lint·build green.
- [ ] 토큰 없이 notes 노출 안 됨(Worker 401).

## 비고

- 스케줄 Leitner stage. serendipity·FSRS-lite·write-back·데스크톱 면·opt-out·풍부한 통계는 후속.
- notes.json은 R2 단일 오브젝트(capture의 D1+R2보다 단순 — echo는 읽기 위주).
- `id=captureId`라 재배포 간 recall 보존. captureId 없는 손수 노트는 v1 비대상.
