# 캡처 PWA (v1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폰에서 짤·인사이트를 캡처해 Cloudflare 릴레이를 거쳐 데스크톱 동기 도구가 Obsidian vault 인박스에 노트로 안착시키는 PWA + Worker + CLI 한 세트를 만든다.

**Architecture:** 3컴포넌트. (1) React/Vite PWA — 갤러리 이미지 + 메타를 IndexedDB 큐에 담아 릴레이로 업로드. (2) Cloudflare Worker + R2 + D1 릴레이 — 폰↔PC 임시 보관소(토큰 인증). (3) Node/TS 데스크톱 동기 CLI — 미소비 캡처를 당겨 이미지+마크다운 노트를 vault에 기록 후 consume. 순수 로직(도메인 타입·노트 조립·검증)은 부수효과(IndexedDB·fetch·R2·D1·fs)와 분리해 단위 테스트한다.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind/shadcn(Hachimon 시드), `idb`, `zod`, Cloudflare Workers(`wrangler`) + R2 + D1, `vitest` + `@cloudflare/vitest-pool-workers`, `tsx`(데스크톱 스크립트).

**Spec:** `docs/superpowers/specs/2026-06-25-capture-pwa-design.md` (이 plan은 그 스펙을 단일 진실원천으로 삼는다).

---

## 전제 / 시작 상태

- **새 repo**를 Hachimon 스택으로 시드한다(별도 배포). 이 plan의 모든 경로는 그 **새 repo 루트** 기준이다.
- Hachimon에서 가져오는 자산: Tailwind/shadcn 설정, 디자인 토큰(`src/index.css`), `src/lib/imageOptimize.ts`(Canvas 최적화), `tsconfig*`, `vite.config.ts` 골격, `scripts/*` + `tsx` 패턴.
- Cloudflare 계정·`wrangler` CLI 로그인은 사전 준비(릴레이 배포에 필요). 로컬 개발은 `wrangler dev`(R2/D1 로컬 에뮬레이션).

## File Structure

```
capture/                              (새 repo 루트)
├── package.json                      한 package(앱+worker+scripts), npm scripts
├── vite.config.ts                    PWA 빌드(+vite-plugin-pwa)
├── tailwind.config.ts / src/index.css  Hachimon 디자인 토큰 재사용
├── tsconfig.app.json / tsconfig.scripts.json / tsconfig.worker.json
├── vitest.config.ts                  기본 + worker 프로젝트(pool-workers)
├── src/                              [PWA]
│   ├── shared/types.ts               CaptureMeta·CaptureType (worker·scripts와 공유)
│   ├── lib/capture.ts                순수: 메타 빌드, 큐 리듀서
│   ├── lib/capture.test.ts
│   ├── lib/queue-db.ts               idb 래퍼(대기 캡처 영속)
│   ├── lib/upload.ts                 릴레이 업로드 클라이언트(멀티파트·재시도)
│   ├── lib/upload.test.ts
│   ├── lib/imageOptimize.ts          Hachimon 재사용(Canvas 리사이즈+WebP)
│   ├── components/CaptureForm.tsx     스샷 선택+메모+타입+태그 → 큐
│   ├── components/QueueList.tsx       대기 큐 + 전송
│   ├── components/SettingsSheet.tsx   릴레이 URL·토큰 입력
│   ├── App.tsx / main.tsx
│   └── hooks/useQueue.ts             queue-db ↔ React 상태
├── worker/                          [릴레이]
│   ├── relay.ts                      fetch 핸들러(엔드포인트 4종) + cron
│   ├── schema.ts                     순수: zod 메타 검증 + D1 row 매핑
│   ├── schema.test.ts
│   ├── relay.test.ts                 @cloudflare/vitest-pool-workers
│   ├── wrangler.toml                 R2/D1 바인딩·cron
│   └── migrations/0001_init.sql      D1 스키마
├── scripts/                         [데스크톱 동기]
│   ├── sync-captures.ts             부수효과: 폴링·다운로드·fs 기록·consume
│   ├── sync-captures.args.test.ts   인자/설정 파서 단위 테스트
│   └── note.ts                      순수: CaptureMeta → 안착 마크다운
│   └── note.test.ts
└── docs/
    └── desktop-scheduler.md          Windows 작업 스케줄러 등록 절차
```

원칙: `src/shared/types.ts`가 세 컴포넌트의 데이터 모델 단일 정의. 순수 모듈(`capture.ts`·`schema.ts`·`note.ts`)은 import만으로 부수효과 없음 — 단위 테스트가 네트워크/fs/DOM 없이 돈다.

---

## Chunk 1: 스캐폴드 + 공유 도메인 (순수 로직)

새 repo 골격과 데이터 모델, 그리고 두 순수 모듈(`capture.ts` 큐 리듀서, `note.ts` 노트 조립)을 TDD로 만든다. 이 청크가 끝나면 네트워크·UI 없이도 도메인 로직이 검증된다.

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `capture/package.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `src/index.css`, `tsconfig.app.json`, `tsconfig.scripts.json`, `tsconfig.worker.json`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `components.json`(shadcn), `src/lib/utils.ts`(cn 헬퍼)

- [ ] **Step 1: Hachimon 스택 시드**

Hachimon repo에서 다음을 새 `capture/` repo로 복사 후 이름/내용 정리: `package.json`(의존성 베이스), `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `src/index.css`(디자인 토큰), `tsconfig*.json`, `eslint.config.js`, `components.json`, `src/lib/utils.ts`, `src/components/ui/*`(쓸 shadcn 컴포넌트). `package.json`의 `name`을 `capture`로, Hachimon 전용 스크립트(`parse`·`inbox`·`build:plugin`)는 제거. `tsconfig.worker.json`을 새로 추가(worker/ 대상, `types: ["@cloudflare/workers-types"]`).

- [ ] **Step 2: 의존성 확정**

`package.json` dependencies: `react`,`react-dom`,`idb`,`zod`,`lucide-react`,`clsx`,`tailwind-merge`(+ 사용하는 `@radix-ui/*` shadcn 의존성). devDependencies: `vite`,`@vitejs/plugin-react`,`vite-plugin-pwa`,`typescript`,`@types/react`,`@types/react-dom`,`@types/node`,`vitest`,`tsx`,`wrangler`,`@cloudflare/vitest-pool-workers`,`@cloudflare/workers-types`,`tailwindcss`,`postcss`,`autoprefixer`. 설치:

Run: `cd capture && npm install`
Expected: 설치 성공, `node_modules` 생성.

- [ ] **Step 3: 최소 App 렌더 확인**

`src/App.tsx`에 임시 `<h1>Capture</h1>` 두고 `npm run dev`로 부팅 확인 후 종료.

Run: `npm run dev` (수동 확인 후 Ctrl-C)
Expected: Vite dev 서버 부팅, 페이지 렌더.

- [ ] **Step 4: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold capture PWA from Hachimon stack"
```

### Task 2: 공유 도메인 타입

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: 타입 정의 작성**

```ts
// src/shared/types.ts
export const CAPTURE_TYPES = ['insight', 'quote', 'lesson', 'misc'] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

/** PWA·릴레이·데스크톱이 공유하는 캡처 메타데이터. */
export interface CaptureMeta {
  id: string;          // 클라이언트 생성 UUID (멱등 키)
  createdAt: string;   // ISO 8601
  type: CaptureType;
  note: string;        // 빈 문자열 허용
  source: string;      // 빈 문자열 허용
  tags: string[];
  imageExt: string;    // 'webp' | 'png' | 'jpg' ...
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts && git commit -m "feat: shared CaptureMeta domain types"
```

### Task 3: 큐 리듀서 (`capture.ts`, 순수)

**Files:**
- Create: `src/lib/capture.ts`, `src/lib/capture.test.ts`

큐 항목 = `CaptureMeta` + 로컬 상태(`imageBlob`,`uploadState`,`attempts`). 리듀서는 추가/전송시작/성공/실패를 순수 함수로 처리.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/lib/capture.test.ts
import { describe, it, expect } from 'vitest';
import { newCapture, queueReducer, type QueueItem } from './capture';

describe('newCapture', () => {
  it('빈 메모/출처/태그 허용하고 id·createdAt 채운다', () => {
    const item = newCapture({ type: 'insight', note: '', source: '', tags: [], imageExt: 'webp' }, new Blob(), 'id-1', '2026-06-25T00:00:00Z');
    expect(item.id).toBe('id-1');
    expect(item.uploadState).toBe('queued');
    expect(item.attempts).toBe(0);
  });
});

describe('queueReducer', () => {
  const base: QueueItem = newCapture({ type: 'misc', note: '', source: '', tags: [], imageExt: 'webp' }, new Blob(), 'a', '2026-06-25T00:00:00Z');
  it('uploading은 attempts를 올린다', () => {
    const next = queueReducer([base], { kind: 'uploading', id: 'a' });
    expect(next[0].uploadState).toBe('uploading');
    expect(next[0].attempts).toBe(1);
  });
  it('sent는 큐에서 제거', () => {
    expect(queueReducer([base], { kind: 'sent', id: 'a' })).toHaveLength(0);
  });
  it('failed는 상태만 바꾸고 유지', () => {
    const next = queueReducer([base], { kind: 'failed', id: 'a' });
    expect(next[0].uploadState).toBe('failed');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/capture.test.ts`
Expected: FAIL ("./capture" 없음).

- [ ] **Step 3: 구현**

```ts
// src/lib/capture.ts
import type { CaptureMeta } from '@/shared/types';

export interface QueueItem extends CaptureMeta {
  imageBlob: Blob;
  uploadState: 'queued' | 'uploading' | 'failed' | 'sent';
  attempts: number;
}

export function newCapture(meta: CaptureMeta, imageBlob: Blob, id: string, createdAt: string): QueueItem {
  return { ...meta, id, createdAt, imageBlob, uploadState: 'queued', attempts: 0 };
}

export type QueueAction =
  | { kind: 'uploading'; id: string }
  | { kind: 'sent'; id: string }
  | { kind: 'failed'; id: string };

export function queueReducer(items: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.kind) {
    case 'sent':
      return items.filter((i) => i.id !== action.id);
    case 'uploading':
      return items.map((i) => (i.id === action.id ? { ...i, uploadState: 'uploading', attempts: i.attempts + 1 } : i));
    case 'failed':
      return items.map((i) => (i.id === action.id ? { ...i, uploadState: 'failed' } : i));
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/capture.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/capture.ts src/lib/capture.test.ts && git commit -m "feat: capture queue reducer (pure)"
```

### Task 4: 안착 노트 조립 (`note.ts`, 순수)

**Files:**
- Create: `scripts/note.ts`, `scripts/note.test.ts`

`CaptureMeta` → 안착 마크다운(frontmatter + 이미지 임베드 + 메모). 파일명 규칙: `<shortid>` = `id`(UUID) 하이픈 제거 후 앞 **12자**(48비트, 충돌 무시 가능 → 카운터 없음, 스펙 §6). 베이스명 `짤-YYYY-MM-DD-<shortid>`를 노트·이미지가 공유.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// scripts/note.test.ts
import { describe, it, expect } from 'vitest';
import { baseName, assembleNote } from './note';
import type { CaptureMeta } from '../src/shared/types';

const meta: CaptureMeta = {
  id: 'a3f2c1d4-0000-0000-0000-000000000000',
  createdAt: '2026-06-25T14:30:00+09:00',
  type: 'insight', note: '복리는 시간의 함수', source: 'https://x.com/p/1', tags: ['투자'], imageExt: 'webp',
};

describe('baseName', () => {
  it('짤-날짜-shortid(앞12자)', () => {
    expect(baseName(meta)).toBe('짤-2026-06-25-a3f2c1d40000');
  });
});

describe('assembleNote', () => {
  const md = assembleNote(meta);
  it('frontmatter에 captureId와 status:raw', () => {
    expect(md).toContain('captureId: a3f2c1d4-0000-0000-0000-000000000000');
    expect(md).toContain('status: raw');
    expect(md).toContain('type: insight');
  });
  it('이미지 임베드 + 메모', () => {
    expect(md).toContain('![[짤-2026-06-25-a3f2c1d40000.webp]]');
    expect(md).toContain('복리는 시간의 함수');
  });
  it('빈 메모도 안전(임베드만)', () => {
    const m2 = assembleNote({ ...meta, note: '' });
    expect(m2).toContain('![[짤-2026-06-25-a3f2c1d40000.webp]]');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run scripts/note.test.ts`
Expected: FAIL ("./note" 없음).

- [ ] **Step 3: 구현**

```ts
// scripts/note.ts
import type { CaptureMeta } from '../src/shared/types';

/** UUID 하이픈 제거 후 앞 12자(48비트, 충돌 무시 가능 → 카운터 불필요). */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

/** 노트·이미지 공유 베이스명: 짤-YYYY-MM-DD-<shortid>. */
export function baseName(meta: CaptureMeta): string {
  const date = meta.createdAt.slice(0, 10); // ISO 앞 10자 = YYYY-MM-DD
  return `짤-${date}-${shortId(meta.id)}`;
}

export function assembleNote(meta: CaptureMeta): string {
  const fm = [
    '---',
    `created: ${meta.createdAt}`,
    `type: ${meta.type}`,
    `source: ${meta.source}`,
    `tags: [${meta.tags.join(', ')}]`,
    `captureId: ${meta.id}`,
    'status: raw',
    '---',
  ].join('\n');
  const body = `![[${baseName(meta)}.${meta.imageExt}]]`;
  const note = meta.note.trim() ? `\n\n${meta.note.trim()}\n` : '\n';
  return `${fm}\n${body}${note}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run scripts/note.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/note.ts scripts/note.test.ts && git commit -m "feat: landing note assembly (pure)"
```

---

## Chunk 2: 릴레이 (Cloudflare Worker + R2 + D1)

토큰 인증 엔드포인트 4종 + 업로드 원자성 + cron purge. 순수 검증(`schema.ts`)부터 TDD, 엔드포인트는 `@cloudflare/vitest-pool-workers`로 검증.

### Task 5: D1 스키마 + wrangler 설정

**Files:**
- Create: `worker/migrations/0001_init.sql`, `worker/wrangler.toml`, `tsconfig.worker.json`

- [ ] **Step 1: D1 마이그레이션 작성**

```sql
-- worker/migrations/0001_init.sql
CREATE TABLE captures (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  type        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON 배열 문자열
  image_ext   TEXT NOT NULL,
  image_key   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | ready
  consumed    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX idx_captures_unconsumed ON captures (consumed, status, created_at);
```

- [ ] **Step 2: wrangler.toml 작성**

```toml
# worker/wrangler.toml
name = "capture-relay"
main = "relay.ts"
compatibility_date = "2026-01-01"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "capture-images"

[[d1_databases]]
binding = "DB"
database_name = "capture"
database_id = "<wrangler d1 create 후 채움>"
migrations_dir = "migrations"

[triggers]
crons = ["0 3 * * *"]   # 매일 03:00 purge
```

토큰은 `wrangler secret put RELAY_TOKEN`으로 주입(파일에 두지 않음).

- [ ] **Step 3: D1/R2 생성 + 마이그레이션**

Run:
```bash
cd worker
wrangler d1 create capture            # database_id 출력 → wrangler.toml에 반영
wrangler r2 bucket create capture-images
wrangler d1 migrations apply capture --local
```
Expected: D1·R2 생성, 로컬 마이그레이션 적용 성공.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations worker/wrangler.toml tsconfig.worker.json && git commit -m "feat: relay D1 schema + wrangler config"
```

### Task 6: 메타 검증 + row 매핑 (`schema.ts`, 순수)

**Files:**
- Create: `worker/schema.ts`, `worker/schema.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// worker/schema.test.ts
import { describe, it, expect } from 'vitest';
import { parseMeta, rowToMeta, type CaptureRow } from './schema';

describe('parseMeta', () => {
  it('정상 메타 통과', () => {
    const m = parseMeta(JSON.stringify({ id: 'x', createdAt: '2026-06-25T00:00:00Z', type: 'insight', note: '', source: '', tags: [], imageExt: 'webp' }));
    expect(m.type).toBe('insight');
  });
  it('알 수 없는 type 거부', () => {
    expect(() => parseMeta(JSON.stringify({ id: 'x', createdAt: '2026-06-25T00:00:00Z', type: 'bogus', note: '', source: '', tags: [], imageExt: 'webp' }))).toThrow();
  });
  it('id 누락 거부', () => {
    expect(() => parseMeta(JSON.stringify({ type: 'misc' }))).toThrow();
  });
});

describe('rowToMeta', () => {
  it('tags JSON 문자열을 배열로 복원', () => {
    const row: CaptureRow = { id: 'x', created_at: '2026-06-25T00:00:00Z', type: 'misc', note: '', source: '', tags: '["a","b"]', image_ext: 'webp', image_key: 'x.webp', status: 'ready', consumed: 0, consumed_at: null };
    expect(rowToMeta(row).tags).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run worker/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// worker/schema.ts
import { z } from 'zod';
import { CAPTURE_TYPES, type CaptureMeta } from '../src/shared/types';

export const MetaSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  type: z.enum(CAPTURE_TYPES),
  note: z.string(),
  source: z.string(),
  tags: z.array(z.string()),
  imageExt: z.string().min(1),
});

export function parseMeta(json: string): CaptureMeta {
  return MetaSchema.parse(JSON.parse(json));
}

export interface CaptureRow {
  id: string; created_at: string; type: string; note: string; source: string;
  tags: string; image_ext: string; image_key: string;
  status: string; consumed: number; consumed_at: string | null;
}

export function rowToMeta(row: CaptureRow): CaptureMeta & { imageKey: string } {
  return {
    id: row.id, createdAt: row.created_at, type: row.type as CaptureMeta['type'],
    note: row.note, source: row.source, tags: JSON.parse(row.tags),
    imageExt: row.image_ext, imageKey: row.image_key,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run worker/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/schema.ts worker/schema.test.ts && git commit -m "feat: relay meta validation + row mapping"
```

### Task 7: 엔드포인트 핸들러 (`relay.ts`)

**Files:**
- Create: `worker/relay.ts`, `worker/relay.test.ts`, `worker/test-setup.ts`
- Config: `vitest.config.ts` (worker 프로젝트 추가)

- [ ] **Step 1: vitest worker 프로젝트 + 테스트 env(토큰·D1 마이그레이션) 설정**

`worker/**`는 workerd 환경(pool-workers), 나머지(`src/**`,`scripts/**`)는 node 환경으로 분리한다. `RELAY_TOKEN`을 테스트 바인딩으로 주입하고, D1 마이그레이션을 셋업에서 적용한다(둘 다 누락 시 모든 authed 테스트가 401/테이블없음으로 실패하므로 필수).

```ts
// vitest.workers.config.ts — worker 전용(workerd 환경). 마이그레이션을 읽어 바인딩으로 주입.
import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersProject(async () => {
  const migrations = await readD1Migrations('./worker/migrations'); // 0001_init.sql 로드
  return {
    test: {
      include: ['worker/**/*.test.ts'],
      setupFiles: ['./worker/test-setup.ts'],
      poolOptions: {
        workers: {
          main: './worker/relay.ts',
          miniflare: {
            compatibilityDate: '2026-01-01',
            bindings: { RELAY_TOKEN: 'test-token', TEST_MIGRATIONS: migrations }, // 토큰 + 마이그레이션 주입
            r2Buckets: ['BUCKET'],
            d1Databases: ['DB'],
          },
          wrangler: { configPath: './worker/wrangler.toml' },
        },
      },
    },
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  };
});
```

```ts
// worker/test-setup.ts — 각 테스트 전 D1 스키마 적용
import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll } from 'vitest';
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); // 위 config의 readD1Migrations 결과
});

// cloudflare:test 환경 타입 보강
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    RELAY_TOKEN: string;
    BUCKET: R2Bucket;
    DB: D1Database;
    TEST_MIGRATIONS: import('@cloudflare/vitest-pool-workers/config').D1Migration[];
  }
}
```

> 순수 node 테스트(`src/**`,`scripts/**`)는 기본 `vitest.config.ts`(node 환경)에서, worker 테스트는 위 `vitest.workers.config.ts`에서 분리 실행한다. `package.json` scripts: `"test": "vitest run && vitest run -c vitest.workers.config.ts"`. `wrangler.toml`의 `migrations_dir = "migrations"`(Task 5)와 `readD1Migrations` 경로가 일치해야 한다.

- [ ] **Step 2: 실패 테스트 작성 (인증·업로드·조회·consume·멱등)**

```ts
// worker/relay.test.ts
import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from './relay';

const TOKEN = 'test-token'; // env.RELAY_TOKEN 을 테스트 셋업에서 주입
function auth(extra: RequestInit = {}): RequestInit {
  return { ...extra, headers: { Authorization: `Bearer ${TOKEN}`, ...(extra.headers || {}) } };
}
async function call(req: Request) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
function uploadReq(id: string) {
  const fd = new FormData();
  fd.set('meta', JSON.stringify({ id, createdAt: '2026-06-25T00:00:00Z', type: 'insight', note: 'n', source: '', tags: [], imageExt: 'webp' }));
  fd.set('image', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }), `${id}.webp`);
  return new Request('https://r/captures', auth({ method: 'POST', body: fd }));
}

describe('relay', () => {
  it('토큰 없으면 401', async () => {
    const res = await call(new Request('https://r/captures'));
    expect(res.status).toBe(401);
  });
  it('잘못된 메타(알 수 없는 type)는 400', async () => {
    const fd = new FormData();
    fd.set('meta', JSON.stringify({ id: 'bad', createdAt: '2026-06-25T00:00:00Z', type: 'bogus', note: '', source: '', tags: [], imageExt: 'webp' }));
    fd.set('image', new Blob([new Uint8Array([1])], { type: 'image/webp' }), 'bad.webp');
    const res = await call(new Request('https://r/captures', auth({ method: 'POST', body: fd })));
    expect(res.status).toBe(400);
  });
  it('이미지 누락은 400', async () => {
    const fd = new FormData();
    fd.set('meta', JSON.stringify({ id: 'noimg', createdAt: '2026-06-25T00:00:00Z', type: 'misc', note: '', source: '', tags: [], imageExt: 'webp' }));
    const res = await call(new Request('https://r/captures', auth({ method: 'POST', body: fd })));
    expect(res.status).toBe(400);
  });
  it('업로드 → 미소비 조회에 ready로 등장', async () => {
    await call(uploadReq('cap-1'));
    const list = await (await call(new Request('https://r/captures?consumed=0', auth()))).json();
    expect(list.map((c: any) => c.id)).toContain('cap-1');
    expect(list.find((c: any) => c.id === 'cap-1').imageExt).toBe('webp');
  });
  it('같은 id 재업로드는 멱등(중복 없음)', async () => {
    await call(uploadReq('cap-2'));
    await call(uploadReq('cap-2'));
    const list = await (await call(new Request('https://r/captures?consumed=0', auth()))).json();
    expect(list.filter((c: any) => c.id === 'cap-2')).toHaveLength(1);
  });
  it('consume 후 미소비 목록에서 사라짐(멱등)', async () => {
    await call(uploadReq('cap-3'));
    await call(new Request('https://r/captures/cap-3/consume', auth({ method: 'POST' })));
    await call(new Request('https://r/captures/cap-3/consume', auth({ method: 'POST' }))); // 두 번 호출 안전
    const list = await (await call(new Request('https://r/captures?consumed=0', auth()))).json();
    expect(list.map((c: any) => c.id)).not.toContain('cap-3');
  });
  it('이미지 스트림 반환', async () => {
    await call(uploadReq('cap-4'));
    const res = await call(new Request('https://r/captures/cap-4/image', auth()));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run worker/relay.test.ts`
Expected: FAIL ("./relay" 없음).

- [ ] **Step 4: 구현**

```ts
// worker/relay.ts
import { parseMeta, rowToMeta, type CaptureRow } from './schema';

interface Env { BUCKET: R2Bucket; DB: D1Database; RELAY_TOKEN: string; }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function authed(req: Request, env: Env): boolean {
  return req.headers.get('Authorization') === `Bearer ${env.RELAY_TOKEN}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!authed(req, env)) return new Response('unauthorized', { status: 401 });
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['captures', ':id', 'image'|'consume']

    // POST /captures
    if (req.method === 'POST' && parts.length === 1 && parts[0] === 'captures') {
      const fd = await req.formData();
      let meta;
      try {
        meta = parseMeta(String(fd.get('meta')));   // ZodError/JSON 오류 → 400
      } catch {
        return new Response('invalid meta', { status: 400 });
      }
      const image = fd.get('image');
      if (!(image instanceof Blob)) return new Response('image required', { status: 400 });
      const existing = await env.DB.prepare('SELECT id FROM captures WHERE id=?').bind(meta.id).first();
      if (existing) return json({ id: meta.id }); // 멱등
      const imageKey = `${meta.id}.${meta.imageExt}`;
      await env.DB.prepare(
        'INSERT INTO captures (id,created_at,type,note,source,tags,image_ext,image_key,status) VALUES (?,?,?,?,?,?,?,?,?)',
      ).bind(meta.id, meta.createdAt, meta.type, meta.note, meta.source, JSON.stringify(meta.tags), meta.imageExt, imageKey, 'pending').run();
      await env.BUCKET.put(imageKey, await image.arrayBuffer());
      await env.DB.prepare('UPDATE captures SET status=? WHERE id=?').bind('ready', meta.id).run();
      return json({ id: meta.id });
    }

    // GET /captures?consumed=0
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'captures') {
      const { results } = await env.DB.prepare(
        "SELECT * FROM captures WHERE consumed=0 AND status='ready' ORDER BY created_at",
      ).all<CaptureRow>();
      return json(results.map(rowToMeta));
    }

    // GET /captures/:id/image
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'captures' && parts[2] === 'image') {
      const row = await env.DB.prepare('SELECT image_key FROM captures WHERE id=?').bind(parts[1]).first<{ image_key: string }>();
      if (!row) return new Response('not found', { status: 404 });
      const obj = await env.BUCKET.get(row.image_key);
      if (!obj) return new Response('not found', { status: 404 });
      return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream' } });
    }

    // POST /captures/:id/consume
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'captures' && parts[2] === 'consume') {
      await env.DB.prepare('UPDATE captures SET consumed=1, consumed_at=? WHERE id=?')
        .bind(new Date().toISOString(), parts[1]).run();
      return json({ ok: true });
    }

    return new Response('not found', { status: 404 });
  },

  // cron: 소비+7일 경과 purge, 고아 pending(1h) 정리
  async scheduled(_c: ScheduledController, env: Env): Promise<void> {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const stale = await env.DB.prepare("SELECT image_key FROM captures WHERE consumed=1 AND consumed_at < ?").bind(weekAgo).all<{ image_key: string }>();
    for (const r of stale.results) await env.BUCKET.delete(r.image_key);
    await env.DB.prepare("DELETE FROM captures WHERE consumed=1 AND consumed_at < ?").bind(weekAgo).run();
    const hourAgo = new Date(Date.now() - 36e5).toISOString();
    await env.DB.prepare("DELETE FROM captures WHERE status='pending' AND created_at < ?").bind(hourAgo).run();
  },
};
```

> 참고: `scheduled`에서 `Date.now()`/`new Date()`는 실제 Worker 런타임에서 정상(이 제약은 workflow 스크립트 한정). 테스트는 `fetch` 경로만 검증하고 cron은 수동/통합으로 확인.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run worker/relay.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add worker/relay.ts worker/relay.test.ts vitest.config.ts && git commit -m "feat: relay endpoints (upload/list/image/consume) + cron purge"
```

---

## Chunk 3: PWA (캡처 UI + 큐 + 업로드)

IndexedDB 큐 영속, 릴레이 업로드 클라이언트, 캡처 폼·큐 화면. 디자인 시스템은 Hachimon 토큰 재사용.

### Task 8: 업로드 클라이언트 (`upload.ts`)

**Files:**
- Create: `src/lib/upload.ts`, `src/lib/upload.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (멀티파트 구성·인증·에러)**

```ts
// src/lib/upload.test.ts
import { describe, it, expect, vi } from 'vitest';
import { uploadCapture } from './upload';
import { newCapture } from './capture';

const item = newCapture({ type: 'insight', note: 'n', source: '', tags: ['t'], imageExt: 'webp' }, new Blob([new Uint8Array([1])], { type: 'image/webp' }), 'id-1', '2026-06-25T00:00:00Z');

describe('uploadCapture', () => {
  it('Bearer 토큰과 meta/image 파트로 POST', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'id-1' }), { status: 200 }));
    await uploadCapture(item, { baseUrl: 'https://r', token: 'T' }, fetchMock);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://r/captures');
    expect((init.headers as any).Authorization).toBe('Bearer T');
    expect(init.body).toBeInstanceOf(FormData);
  });
  it('비2xx면 throw', async () => {
    const fetchMock = vi.fn(async () => new Response('no', { status: 401 }));
    await expect(uploadCapture(item, { baseUrl: 'https://r', token: 'T' }, fetchMock)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/upload.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```ts
// src/lib/upload.ts
import type { QueueItem } from './capture';

export interface RelayConfig { baseUrl: string; token: string; }
type FetchLike = typeof fetch;

export async function uploadCapture(item: QueueItem, cfg: RelayConfig, fetchImpl: FetchLike = fetch): Promise<void> {
  const { imageBlob, uploadState, attempts, ...meta } = item;
  void uploadState; void attempts;
  const fd = new FormData();
  fd.set('meta', JSON.stringify(meta));
  fd.set('image', imageBlob, `${meta.id}.${meta.imageExt}`);
  const res = await fetchImpl(`${cfg.baseUrl}/captures`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload.ts src/lib/upload.test.ts && git commit -m "feat: relay upload client"
```

### Task 9: IndexedDB 큐 (`queue-db.ts`) + imageOptimize 재사용

**Files:**
- Create: `src/lib/queue-db.ts`
- Copy/Modify: `src/lib/imageOptimize.ts` (Hachimon에서 + Blob 반환 헬퍼 추가)

- [ ] **Step 1: imageOptimize 이식 + Blob 반환 헬퍼(필수)**

Hachimon `src/lib/imageOptimize.ts`를 복사한다. 기존 `optimizeImageToDataUri`는 **data URI 문자열**을 반환하지만, 캡처 파이프(큐·업로드)는 **Blob**과 **결과 확장자**가 필요하다. 내부 Canvas 단계(`canvasToBlob`)를 공유해 다음을 **추가**한다:

```ts
// src/lib/imageOptimize.ts (추가 — 기존 canvas 리사이즈 로직 재사용)
export interface OptimizedImage { blob: Blob; ext: string; }

/** 래스터: 가로 상한 리사이즈 + WebP(q80) → {blob, ext:'webp'}. SVG: 원본 passthrough → {blob, ext:'svg'}. */
export async function optimizeImageToBlob(file: File): Promise<OptimizedImage> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return { blob: file, ext: 'svg' };
  }
  const blob = await resizeToWebpBlob(file, 800); // 기존 canvas 리사이즈 + canvasToBlob('image/webp', 0.8)
  return { blob, ext: 'webp' };
}
```

(`resizeToWebpBlob`은 기존 data-URI 경로가 쓰던 canvas 리사이즈 + `canvas.toBlob` 단계를 그대로 추출한 것 — DRY. `optimizeImageToDataUri`도 이 헬퍼 위에 재구성 가능하나 v1 캡처는 Blob 경로만 사용.)

- [ ] **Step 1b: 최적화 출력 ext 단위 검증(가능 범위)**

SVG passthrough가 `ext:'svg'`, 그 외가 `ext:'webp'`를 반환하는지 단위 테스트(Canvas는 jsdom 한계로 모킹하거나 분기 로직만 검증). 핵심은 **`imageExt`가 폼 입력이 아니라 이 출력에서 온다**는 계약을 고정하는 것.

- [ ] **Step 2: queue-db 구현 (idb 래퍼)**

```ts
// src/lib/queue-db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QueueItem } from './capture';

interface CaptureDB extends DBSchema {
  queue: { key: string; value: QueueItem };
}

let dbp: Promise<IDBPDatabase<CaptureDB>> | null = null;
function db() {
  if (!dbp) dbp = openDB<CaptureDB>('capture', 1, {
    upgrade(d) { d.createObjectStore('queue', { keyPath: 'id' }); },
  });
  return dbp;
}

export async function putItem(item: QueueItem): Promise<void> { await (await db()).put('queue', item); }
export async function allItems(): Promise<QueueItem[]> { return (await db()).getAll('queue'); }
export async function deleteItem(id: string): Promise<void> { await (await db()).delete('queue', id); }
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: 에러 없음. (IndexedDB는 단위 테스트 대신 통합/수동 검증 — 부수효과 얇은 어댑터.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/queue-db.ts src/lib/imageOptimize.ts && git commit -m "feat: IndexedDB queue + reuse image optimization"
```

### Task 10: 캡처 폼 · 큐 화면 · 설정

**Files:**
- Create: `src/hooks/useQueue.ts`, `src/components/CaptureForm.tsx`, `src/components/QueueList.tsx`, `src/components/SettingsSheet.tsx`, `src/App.tsx`(교체)

- [ ] **Step 1: useQueue 훅**

`queue-db`와 React 상태를 잇는다:
- 마운트 시 `allItems()` 로드.
- `add(file, fields)`: ① `optimizeImageToBlob(file)` → `{blob, ext}` ② **`imageExt = ext`로 세팅**(폼 입력이 아니라 최적화 출력 ext를 써야 노트 임베드가 실제 파일과 일치 — 핵심 버그 방지) ③ `crypto.randomUUID()`로 id ④ `newCapture(meta, blob, id, new Date().toISOString())` ⑤ `putItem` + 상태 반영.
- `sendAll()`: 각 `queued`/`failed`에 `uploadCapture`; 성공 시 `deleteItem`+`queueReducer('sent')`, 실패 시 `queueReducer('failed')`.
- 설정(릴레이 URL·토큰)은 `localStorage`. 미설정 시 `sendAll` 비활성.

- [ ] **Step 2: CaptureForm 컴포넌트**

스샷 파일 입력(`<input type="file" accept="image/*">`, iOS 갤러리 피커), 메모 텍스트, 타입 select(`CAPTURE_TYPES`), 태그 입력 → `add()` 호출. 디자인 토큰(zinc/gold) 재사용, 터치 타깃 ≥44px.

- [ ] **Step 3: QueueList 컴포넌트**

대기 항목 리스트(타입·메모 미리보기·이미지 썸네일·`uploadState` 뱃지, 메모 없으면 ⚠). 하단 "전송 ↑ N" 버튼 → `sendAll()`.

- [ ] **Step 4: SettingsSheet**

릴레이 URL·토큰 입력 → `localStorage` 저장. 미설정 시 전송 비활성 + 안내.

- [ ] **Step 5: 수동 확인 (Playwright/브라우저)**

Run: `npm run dev` 후 모바일 뷰포트(393px)에서 스샷 추가 → 큐 표시 → (릴레이 dev 가동 시) 전송 확인. 스크린샷 1장.
Expected: 캡처가 큐에 담기고, 설정된 릴레이로 전송 시 큐에서 사라짐.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQueue.ts src/components/*.tsx src/App.tsx && git commit -m "feat: capture form + queue UI + relay settings"
```

### Task 11: PWA 매니페스트 + 오프라인

**Files:**
- Modify: `vite.config.ts` (vite-plugin-pwa)
- Create: `public/manifest` 아이콘

- [ ] **Step 1: vite-plugin-pwa 설정**

`registerType: 'autoUpdate'`, manifest(이름·아이콘·`display: standalone`·theme-color). 앱 셸은 CacheFirst. 캡처는 IndexedDB에 있으므로 오프라인에서도 담기고, 온라인 복귀 시 `sendAll`.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, `dist/sw.js`·매니페스트 생성.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts public && git commit -m "feat: PWA manifest + offline shell"
```

---

## Chunk 4: 데스크톱 동기 CLI

미소비 캡처를 당겨 vault에 이미지+노트 기록 후 consume. 멱등·부분실패 복구. Windows 작업 스케줄러 운용 문서.

### Task 12: 인자/설정 파서

**Files:**
- Create: `scripts/sync-captures.ts`(부분), `scripts/sync-captures.args.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// scripts/sync-captures.args.test.ts
import { describe, it, expect } from 'vitest';
import { parseConfig } from './sync-captures';

describe('parseConfig', () => {
  it('환경변수에서 릴레이·토큰·경로 읽기', () => {
    const cfg = parseConfig({ RELAY_URL: 'https://r', RELAY_TOKEN: 'T', VAULT_INBOX: '/v/인박스/짤', VAULT_ATTACH: '/v/인박스/짤' });
    expect(cfg.baseUrl).toBe('https://r');
    expect(cfg.inboxDir).toBe('/v/인박스/짤');
  });
  it('필수값 누락 시 throw', () => {
    expect(() => parseConfig({})).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현 → 통과**

`parseConfig(env)`: `RELAY_URL`·`RELAY_TOKEN`·`VAULT_INBOX`(노트)·`VAULT_ATTACH`(이미지, 기본 = inbox) 검증.

Run: `npx vitest run scripts/sync-captures.args.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-captures.ts scripts/sync-captures.args.test.ts && git commit -m "feat: desktop sync config parser"
```

### Task 13: 동기 루프 (다운로드·기록·consume·멱등)

**Files:**
- Modify: `scripts/sync-captures.ts`
- Modify: `package.json` (`"sync": "tsx scripts/sync-captures.ts"`)

- [ ] **Step 1: 멱등 헬퍼 테스트 (순수 부분)**

`note.ts`의 `baseName`/`assembleNote`는 이미 테스트됨. 동기 루프의 순수 판단(`shouldSkip(existsFn, baseName)`)을 분리해 테스트:

```ts
// scripts/sync-captures.args.test.ts (추가)
import { shouldSkip } from './sync-captures';
it('노트가 이미 있으면 스킵', () => {
  expect(shouldSkip((p) => p.endsWith('.md'), '/v/짤-2026-06-25-a3f2c1d40000')).toBe(true);
  expect(shouldSkip(() => false, '/v/x')).toBe(false);
});
```

- [ ] **Step 2: 동기 루프 구현**

```ts
// scripts/sync-captures.ts (핵심)
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { assembleNote, baseName } from './note';
import type { CaptureMeta } from '../src/shared/types';

export interface SyncConfig { baseUrl: string; token: string; inboxDir: string; attachDir: string; }

export function parseConfig(env: Record<string, string | undefined>): SyncConfig {
  const baseUrl = env.RELAY_URL, token = env.RELAY_TOKEN, inboxDir = env.VAULT_INBOX;
  if (!baseUrl || !token || !inboxDir) throw new Error('RELAY_URL, RELAY_TOKEN, VAULT_INBOX 필요');
  return { baseUrl, token, inboxDir, attachDir: env.VAULT_ATTACH || inboxDir };
}

export function shouldSkip(exists: (p: string) => boolean, baseAbsNoExt: string): boolean {
  return exists(`${baseAbsNoExt}.md`);
}

const authH = (t: string) => ({ Authorization: `Bearer ${t}` });

export async function run(cfg: SyncConfig, fetchImpl: typeof fetch = fetch): Promise<{ filed: number; skipped: number }> {
  const list = (await (await fetchImpl(`${cfg.baseUrl}/captures?consumed=0`, { headers: authH(cfg.token) })).json()) as (CaptureMeta & { imageKey: string })[];
  mkdirSync(cfg.inboxDir, { recursive: true });
  mkdirSync(cfg.attachDir, { recursive: true });
  let filed = 0, skipped = 0;
  for (const meta of list) {
    const base = baseName(meta);
    const noteBaseNoExt = path.join(cfg.inboxDir, base);
    if (!shouldSkip(existsSync, noteBaseNoExt)) {
      const imgRes = await fetchImpl(`${cfg.baseUrl}/captures/${meta.id}/image`, { headers: authH(cfg.token) });
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(path.join(cfg.attachDir, `${base}.${meta.imageExt}`), buf);
      writeFileSync(`${noteBaseNoExt}.md`, assembleNote(meta));
      filed++;
    } else skipped++;
    await fetchImpl(`${cfg.baseUrl}/captures/${meta.id}/consume`, { method: 'POST', headers: authH(cfg.token) });
  }
  return { filed, skipped };
}

async function main(): Promise<void> {
  try {
    const r = await run(parseConfig(process.env));
    console.log(`✓ ${r.filed} filed / ${r.skipped} skipped`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

부분 실패: 이미지/노트 기록 중 throw 시 consume 미도달 → 다음 실행이 dedup로 복구. 노트 존재 시에도 consume은 보장(중복 안착 없음).

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run scripts/sync-captures.args.test.ts`
Expected: PASS.

- [ ] **Step 4: 수동 e2e**

릴레이 dev + 테스트 캡처 1건 업로드 후:
Run: `RELAY_URL=... RELAY_TOKEN=... VAULT_INBOX=/tmp/inbox npx tsx scripts/sync-captures.ts`
Expected: `/tmp/inbox`에 `짤-*.md` + 이미지 생성, 재실행 시 `skipped`.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-captures.ts package.json && git commit -m "feat: desktop sync loop (idempotent fetch→file→consume)"
```

### Task 14: 운용 문서 (Windows 작업 스케줄러)

**Files:**
- Create: `docs/desktop-scheduler.md`

- [ ] **Step 1: 절차 문서 작성**

`npm run sync`를 Windows 작업 스케줄러에 로그온/주기(예: 15분) 트리거로 등록하는 절차(환경변수 주입 포함), 수동 실행 폴백, 토큰 회전 시 갱신 지점. → 캡처가 Obsidian에 *저절로 나타나는* 마찰 0 운용.

- [ ] **Step 2: Commit**

```bash
git add docs/desktop-scheduler.md && git commit -m "docs: desktop sync via Windows Task Scheduler"
```

---

## 완료 기준 (v1 Definition of Done)

- [ ] 폰 PWA에서 스샷+메모+타입으로 캡처 → IndexedDB 큐 → 전송이 릴레이에 업로드된다(오프라인 시 잔류·재시도).
- [ ] 릴레이가 토큰 인증·업로드 원자성·미소비 조회·멱등 consume·cron purge를 만족한다(worker 테스트 통과).
- [ ] `npm run sync`(또는 작업 스케줄러)가 미소비 캡처를 vault 인박스에 이미지+노트로 안착시키고 consume 한다. 재실행이 멱등이다.
- [ ] 순수 로직(`capture`·`note`·`schema`) 단위 테스트 + worker 엔드포인트 테스트가 전부 green.
- [ ] 수동 e2e 1회(실폰 캡처 → Obsidian 안착)로 파이프 관통 확인.

## 비고

- 변환(이미지→텍스트)·재소환·책/영화 타입·iOS 공유시트는 v1 비목표(스펙 §1·§10). 각자 별도 plan.
- 보안: R2 비공개·강한 토큰·HTTPS. 토큰은 PWA localStorage·CLI 환경변수.
