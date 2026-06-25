# 데스크톱 허브 (anchor v1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폰 캡처 PWA가 릴레이에 올린 짤·인사이트를 데스크톱으로 당겨 Claude vision으로 변환하고, 사람이 1초 확인 후 Obsidian에 안착시키는 Electron 앱(anchor) 한 세트를 만든다.

**Architecture:** Electron(main=Node, renderer=React). main이 릴레이 pull→vault-외 staging 기록→Claude vision 변환을 제로터치로 수행하고, renderer가 트리아지·편집·승격 UI를 제공한다. 순수 코어(노트 조립·zod 스키마·승격 경로)는 부수효과(fs·fetch·SDK·Electron)와 분리해 단위 테스트한다.

**Tech Stack:** Electron + electron-vite + React 19 + TypeScript + Tailwind/shadcn(Hachimon 토큰 시드), `@anthropic-ai/sdk`, `zod`, `vitest`, `lucide-react`. 빌드: electron-vite.

**Spec:** `docs/superpowers/specs/2026-06-25-desktop-hub-design.md` (단일 진실원천).

---

## 전제 / 시작 상태

- **새 repo** `anchor`를 Electron+Hachimon 스택으로 시드한다. 이 plan의 모든 경로는 **새 repo 루트** 기준.
- 가져오는 자산: Hachimon/capture의 디자인 토큰(`src/index.css`), Tailwind/shadcn 설정, `tsconfig` 골격, `forge` 순수/부수효과 분리 패턴, capture repo의 `baseName`/`assembleNote` 노트 규칙(미러).
- 릴레이는 capture repo의 기존 Cloudflare Worker를 그대로 소비(변경 없음). 계약: `GET /captures?consumed=0`→`(CaptureMeta&{imageKey})[]`, `GET /captures/:id/image`, `POST /captures/:id/consume`, Bearer.
- Claude API 키는 사용자 환경/앱 설정. 모델 `claude-opus-4-8`.

## File Structure

```
anchor/                              (새 repo 루트)
├── package.json                     deps + scripts(dev/build/test/typecheck/lint)
├── electron.vite.config.ts          main/preload/renderer 빌드
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── tailwind.config.ts / postcss.config.js / components.json
├── vitest.config.ts                 node 환경(core·main 어댑터 단위)
├── src/
│   ├── shared/types.ts              CaptureMeta(미러)·StagingItem·TransformResult
│   ├── core/                        [순수 — fs/네트워크/DOM 없음]
│   │   ├── note.ts  / note.test.ts            조립(raw/transformed)·파싱·baseName·태그합집합
│   │   ├── transform-schema.ts / .test.ts     zod TransformSchema
│   │   └── promote.ts / promote.test.ts       staging→vault 경로·frontmatter 정리
│   ├── main/                        [부수효과 — Node]
│   │   ├── index.ts                 BrowserWindow + 앱 수명 + 포커스 트리거
│   │   ├── ipc.ts                   IPC 핸들러(pull→store→transform, promote, discard)
│   │   ├── relay-client.ts / .test.ts   list/image/consume(fetch)
│   │   ├── staging-store.ts / .test.ts  스캔/읽기/쓰기/이동(fs, 임시디렉토리)
│   │   ├── transform.ts / .test.ts      Claude vision(SDK)
│   │   ├── mime.ts                  ext→media_type
│   │   └── settings.ts             릴레이/키/경로 영속(userData JSON)
│   ├── preload/index.ts            contextBridge window.api
│   └── renderer/
│       ├── api.d.ts                window.api 타입 선언(Task 10)
│       ├── index.html / main.tsx / App.tsx / index.css
│       ├── lib/utils.ts            cn 헬퍼
│       ├── hooks/useItems.ts       window.api ↔ React 상태
│       └── components/{TriageList,ItemEditor,SettingsSheet}.tsx + ui/*(shadcn)
└── docs/usage.md                   설정·운용(키·경로·동기)
```

원칙: `src/core/*`는 import만으로 부수효과 없음 → 단위 테스트가 fs/네트워크/DOM 없이 돈다. `src/main/*`는 얇은 어댑터. renderer는 `window.api`(preload)로만 main 호출.

---

## Chunk 1: 스캐폴드 + 공유 도메인 + 순수 코어

새 repo 골격과 데이터 모델, 세 순수 모듈(note·transform-schema·promote)을 TDD로 만든다. 끝나면 네트워크·UI·Electron 없이 도메인 로직이 검증된다.

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `vitest.config.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/index.css`, `src/renderer/lib/utils.ts`, `src/main/index.ts`, `src/preload/index.ts`

- [ ] **Step 1: electron-vite 스캐폴드 + 의존성**

`package.json` 작성. dependencies: `react`,`react-dom`,`@anthropic-ai/sdk`,`zod`,`lucide-react`,`clsx`,`tailwind-merge`(+ 사용할 `@radix-ui/*`). devDependencies: `electron`,`electron-vite`,`vite`,`@vitejs/plugin-react`,`typescript`,`@types/react`,`@types/react-dom`,`@types/node`,`vitest`,`tailwindcss`,`postcss`,`autoprefixer`,`eslint`(+ ts-eslint). scripts:
```json
{
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "test": "vitest run",
  "typecheck": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit",
  "lint": "eslint . --max-warnings 0"
}
```
`electron.vite.config.ts`: main(`src/main/index.ts`)·preload(`src/preload/index.ts`)·renderer(root `src/renderer`) 3개 빌드, alias `@` → `src`. `vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`, alias `@`→`src`.

Run: `npm install`
Expected: 설치 성공, `node_modules` 생성.

- [ ] **Step 2: 디자인 토큰·셸 시드**

Hachimon `src/index.css`(zinc/gold 토큰)·`tailwind.config.ts`·`components.json`·`lib/utils.ts`(cn)를 복사. `src/main/index.ts`에 최소 `BrowserWindow`(보안: `contextIsolation:true`,`nodeIntegration:false`,`sandbox:true`, preload 지정), `src/preload/index.ts`에 빈 `contextBridge.exposeInMainWorld('api', {})`, `src/renderer/App.tsx`에 임시 `<h1>anchor</h1>`.

- [ ] **Step 3: 부팅 확인**

Run: `npm run dev` (수동 확인 후 종료)
Expected: Electron 창에 "anchor" 렌더.

- [ ] **Step 4: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold anchor (electron-vite + Hachimon tokens)"
```

### Task 2: 공유 도메인 타입

**Files:** Create `src/shared/types.ts`

- [ ] **Step 1: 타입 작성**

```ts
// src/shared/types.ts
export const CAPTURE_TYPES = ['insight', 'quote', 'lesson', 'misc'] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

/** capture repo와 공유(미러). 릴레이가 GET /captures?consumed=0 으로 반환(+imageKey). */
export interface CaptureMeta {
  id: string;
  createdAt: string;
  type: CaptureType;
  note: string;
  source: string;
  tags: string[];
  imageExt: string;
}

/** Claude vision 변환 출력. */
export interface TransformResult {
  title: string;
  insight: string;
  ocr: string;
  tags: string[]; // AI 제안(원본). 합집합은 core/note가 수행.
}

export type StagingStatus = 'raw' | 'transformed';

/** staging 파일에서 파생되는 앱 내부 표현. */
export interface StagingItem {
  base: string;        // 짤-YYYY-MM-DD-<shortid>
  meta: CaptureMeta;
  status: StagingStatus;
  transform?: TransformResult;
  notePath: string;
  imagePath: string;
  error?: string;
}
```

- [ ] **Step 2: 타입체크** — Run: `npx tsc -p tsconfig.node.json --noEmit` → 에러 없음.
- [ ] **Step 3: Commit** — `git commit -am "feat: shared domain types (CaptureMeta·TransformResult·StagingItem)"`

### Task 3: 노트 조립·파싱 (`core/note.ts`, 순수)

**Files:** Create `src/core/note.ts`, `src/core/note.test.ts`

`baseName`(capture repo 규칙 재사용), `assembleRaw`(status:raw, 메모+임베드), `assembleTransformed`(status:transformed, 제목/핵심/원문 + 태그합집합), `parseNote`(frontmatter+status+transform 파생).

- [ ] **Step 1: 실패 테스트**

```ts
// src/core/note.test.ts
import { describe, it, expect } from 'vitest';
import { baseName, assembleRaw, assembleTransformed, parseNote } from './note';
import type { CaptureMeta, TransformResult } from '@/shared/types';

const meta: CaptureMeta = {
  id: 'a3f2c1d4-0000-0000-0000-000000000000',
  createdAt: '2026-06-25T14:30:00+09:00',
  type: 'insight', note: '복리는 시간의 함수', source: 'https://x/p/1',
  tags: ['투자'], imageExt: 'webp',
};
const tr: TransformResult = { title: '복리는 시간의 함수다', insight: '핵심문장.', ocr: '원문텍스트', tags: ['투자', '복리'] };

describe('baseName', () => {
  it('짤-날짜-shortid(앞12)', () => expect(baseName(meta)).toBe('짤-2026-06-25-a3f2c1d40000'));
});

describe('assembleRaw', () => {
  const md = assembleRaw(meta);
  it('status:raw + captureId + 임베드 + 메모', () => {
    expect(md).toContain('status: raw');
    expect(md).toContain('captureId: a3f2c1d4-0000-0000-0000-000000000000');
    expect(md).toContain('![[짤-2026-06-25-a3f2c1d40000.webp]]');
    expect(md).toContain('복리는 시간의 함수');
  });
});

describe('assembleTransformed', () => {
  const md = assembleTransformed(meta, tr);
  it('status:transformed + title + 핵심/원문 섹션', () => {
    expect(md).toContain('status: transformed');
    expect(md).toContain('title: 복리는 시간의 함수다');
    expect(md).toContain('## 핵심');
    expect(md).toContain('핵심문장.');
    expect(md).toContain('## 원문');
    expect(md).toContain('원문텍스트');
  });
  it('태그 합집합(순서보존·중복제거)', () => expect(md).toContain('tags: [투자, 복리]'));
  it('OCR 비면 원문 섹션 생략', () => {
    const md2 = assembleTransformed(meta, { ...tr, ocr: '' });
    expect(md2).not.toContain('## 원문');
  });
});

describe('parseNote', () => {
  it('transformed 라운드트립: status·meta·transform 복원', () => {
    const p = parseNote(assembleTransformed(meta, tr));
    expect(p.status).toBe('transformed');
    expect(p.meta.captureId ?? p.meta.id).toBeTruthy();
    expect(p.meta.type).toBe('insight');
    expect(p.transform?.title).toBe('복리는 시간의 함수다');
    expect(p.transform?.insight).toContain('핵심문장');
  });
  it('raw 라운드트립: status raw, transform 없음', () => {
    const p = parseNote(assembleRaw(meta));
    expect(p.status).toBe('raw');
    expect(p.transform).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/core/note.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현** — `src/core/note.ts`:
  - `shortId(id)`= 하이픈 제거 앞 12자; `baseName(meta)`= `짤-${createdAt.slice(0,10)}-${shortId}`.
  - frontmatter 헬퍼: `created/type/source/tags:[..]/captureId/status`(+transformed면 `title`). 태그 합집합은 `union(meta.tags, tr.tags)`(순서보존·중복제거).
  - `assembleRaw`: frontmatter(status:raw) + `![[base.ext]]` + (메모 있으면 `\n\n> 메모: ...`).
  - `assembleTransformed`: frontmatter(status:transformed, title, 합집합 태그) + 임베드 + `> 메모:`(있으면) + `## 핵심\n{insight}` + (ocr 있으면 `## 원문\n{ocr}`).
  - `parseNote(md)`: frontmatter 파싱(간단 라인 파서, capture repo 포맷 한정 — YAML 라이브러리 불필요), `status`·`meta`(captureId→id 매핑) 복원, transformed면 `## 핵심`/`## 원문`/`title`에서 `transform` 파생.
  - 결정성·단순 포맷 유지(앱이 쓰고 앱이 읽는 닫힌 포맷).

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/core/note.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/core/note.* && git commit -m "feat: staging note assembly + parse (pure)"`

### Task 4: 변환 스키마 (`core/transform-schema.ts`, 순수)

**Files:** Create `src/core/transform-schema.ts`, `src/core/transform-schema.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// src/core/transform-schema.test.ts
import { describe, it, expect } from 'vitest';
import { TransformSchema } from './transform-schema';

describe('TransformSchema', () => {
  it('정상 통과', () => {
    const r = TransformSchema.parse({ title: 't', insight: 'i', ocr: '', tags: ['a'] });
    expect(r.title).toBe('t');
  });
  it('title 누락 거부', () => expect(() => TransformSchema.parse({ insight: 'i', ocr: '', tags: [] })).toThrow());
  it('tags 비배열 거부', () => expect(() => TransformSchema.parse({ title: 't', insight: 'i', ocr: '', tags: 'x' })).toThrow());
});
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**

```ts
// src/core/transform-schema.ts
import { z } from 'zod';
export const TransformSchema = z.object({
  title: z.string().min(1),
  insight: z.string(),
  ocr: z.string(),
  tags: z.array(z.string()),
});
export type TransformParsed = z.infer<typeof TransformSchema>;
```

- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: zod TransformSchema (pure)"`

### Task 5: 승격 경로·정리 (`core/promote.ts`, 순수)

**Files:** Create `src/core/promote.ts`, `src/core/promote.test.ts`

승격 시 vault 경로 결정 + staging 전용 frontmatter(`status`) 제거(나머지 보존).

- [ ] **Step 1: 실패 테스트**

```ts
// src/core/promote.test.ts
import { describe, it, expect } from 'vitest';
import { promoteTargets, stripStagingFrontmatter } from './promote';

describe('promoteTargets', () => {
  it('노트/이미지 vault 대상 경로', () => {
    const t = promoteTargets('짤-2026-06-25-abc', 'webp', { notesDir: '/v/짤', attachDir: '/v/_attach' });
    expect(t.notePath).toBe('/v/짤/짤-2026-06-25-abc.md');
    expect(t.imagePath).toBe('/v/_attach/짤-2026-06-25-abc.webp');
  });
  it('attachDir 미설정이면 notesDir 사용', () => {
    const t = promoteTargets('b', 'webp', { notesDir: '/v', attachDir: '' });
    expect(t.imagePath).toBe('/v/b.webp');
  });
});

describe('stripStagingFrontmatter', () => {
  it('status 라인 제거, 나머지 보존', () => {
    const md = '---\ncreated: x\nstatus: transformed\ntitle: t\n---\nbody';
    const out = stripStagingFrontmatter(md);
    expect(out).not.toContain('status:');
    expect(out).toContain('title: t');
    expect(out).toContain('body');
  });
});
```

- [ ] **Step 2~4: 실패확인 → 구현 → 통과**

`promoteTargets(base, ext, {notesDir, attachDir})` = `{notePath: join(notesDir, base+'.md'), imagePath: join(attachDir||notesDir, base+'.'+ext)}` (POSIX join; main에서 `path`로 감싸도 무방하나 순수 유지 위해 문자열 결합 + 정규화). `stripStagingFrontmatter(md)` = frontmatter 블록에서 `status:` 라인만 삭제.

- [ ] **Step 5: Commit** — `git add src/core/promote.* && git commit -m "feat: promote path + frontmatter cleanup (pure)"`

### Chunk 1 게이트
Run: `npm run test && npm run typecheck` → 전부 green. 아니면 다음 청크 진입 금지.

---

## Chunk 2: main 어댑터 (relay-client · staging-store · transform · settings)

릴레이·fs·Claude SDK 얇은 어댑터. 순수 코어를 부수효과에 잇는다.

### Task 6: 릴레이 클라이언트 (`main/relay-client.ts`)

**Files:** Create `src/main/relay-client.ts`, `src/main/relay-client.test.ts`

- [ ] **Step 1: 실패 테스트(fetch 모킹: 인증·list·image·consume)**

```ts
// src/main/relay-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { listUnconsumed, fetchImage, consume } from './relay-client';
const cfg = { baseUrl: 'https://r', token: 'T' };

describe('relay-client', () => {
  it('list: Bearer + ?consumed=0', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([{ id: 'a', imageExt: 'webp' }]), { status: 200 }));
    const out = await listUnconsumed(cfg, f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://r/captures?consumed=0');
    expect((init.headers as any).Authorization).toBe('Bearer T');
    expect(out[0].id).toBe('a');
  });
  it('image: 바이트 반환', async () => {
    const f = vi.fn(async () => new Response(new Uint8Array([1,2,3]), { status: 200 }));
    const buf = await fetchImage(cfg, 'a', f);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1,2,3]));
  });
  it('image 비2xx면 throw', async () => {
    const f = vi.fn(async () => new Response('x', { status: 500 }));
    await expect(fetchImage(cfg, 'a', f)).rejects.toThrow();
  });
  it('consume: POST', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    await consume(cfg, 'a', f);
    expect(f.mock.calls[0][1].method).toBe('POST');
  });
});
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**

`RelayConfig={baseUrl,token}`. `authH=(t)=>({Authorization:`Bearer ${t}`})`. `listUnconsumed(cfg,fetchImpl=fetch)`→ GET `?consumed=0` JSON `(CaptureMeta&{imageKey})[]`. `fetchImage(cfg,id,f)`→ GET `/captures/:id/image`, `!res.ok` throw, `arrayBuffer()`. `consume(cfg,id,f)`→ POST `/captures/:id/consume`. (capture `sync-captures.ts` 계승.)

- [ ] **Step 5: Commit** — `git add src/main/relay-client.* && git commit -m "feat: relay client (list/image/consume)"`

### Task 7: staging 스토어 (`main/staging-store.ts`)

**Files:** Create `src/main/staging-store.ts`, `src/main/staging-store.test.ts`, `src/main/mime.ts`

fs: staging 폴더 스캔→`StagingItem[]`, 항목 쓰기(raw/transformed), 이미지 쓰기, 승격 이동, 삭제. 멱등(`<base>.md` 존재 판정). `mime.ts`: ext→media_type.

- [ ] **Step 1: 실패 테스트(임시 디렉토리 통합)**

```ts
// src/main/staging-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeRaw, scan, hasNote, writeImage, removeItem } from './staging-store';
import type { CaptureMeta } from '@/shared/types';

const meta: CaptureMeta = { id: 'a3f2c1d4-0000-0000-0000-000000000000', createdAt: '2026-06-25T14:30:00+09:00', type: 'insight', note: 'm', source: '', tags: [], imageExt: 'webp' };
let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'anchor-')); });

describe('staging-store', () => {
  it('writeRaw + scan: raw 항목 1개', () => {
    writeImage(dir, meta, Buffer.from([1,2,3]));
    writeRaw(dir, meta);
    const items = scan(dir);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('raw');
    expect(existsSync(items[0].imagePath)).toBe(true);
  });
  it('hasNote: 멱등 판정', () => {
    expect(hasNote(dir, meta)).toBe(false);
    writeRaw(dir, meta);
    expect(hasNote(dir, meta)).toBe(true);
  });
  it('removeItem: 노트+이미지 삭제', () => {
    writeImage(dir, meta, Buffer.from([1])); writeRaw(dir, meta);
    removeItem(dir, scan(dir)[0]);
    expect(scan(dir)).toHaveLength(0);
  });
});
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**

`baseName`(core/note 재사용)으로 경로 계산. `writeImage(dir,meta,buf)`, `writeRaw(dir,meta)`=`assembleRaw`→`<base>.md`, `writeTransformed(dir,meta,tr)`=`assembleTransformed`, `hasNote(dir,meta)`=`existsSync(<base>.md)`(=capture `shouldSkip` 술어), `scan(dir)`= `*.md` 읽어 `parseNote`→`StagingItem`(imagePath= 같은 base + meta.imageExt), `updateNote(dir,item,md)`(에디터 저장), `moveToVault(item,targets)`(이미지·노트 이동), `removeItem(dir,item)`. `mime.ts`: `{webp:'image/webp',png:'image/png',jpg/jpeg:'image/jpeg',gif:'image/gif'}`(svg는 변환 비대상).

- [ ] **Step 5: Commit** — `git add src/main/staging-store.* src/main/mime.ts && git commit -m "feat: staging store (fs) + mime"`

### Task 8: 변환 (`main/transform.ts`, Claude vision)

**Files:** Create `src/main/transform.ts`, `src/main/transform.test.ts`

claude-api 준거: 이미지 base64 블록(텍스트 앞) + `messages.parse`+`zodOutputFormat(TransformSchema)` + `thinking:{type:'adaptive'}` + `claude-opus-4-8`.

- [ ] **Step 1: 실패 테스트(SDK 주입 모킹)**

```ts
// src/main/transform.test.ts
import { describe, it, expect, vi } from 'vitest';
import { transformCapture } from './transform';
import type { CaptureMeta } from '@/shared/types';

const meta: CaptureMeta = { id: 'x', createdAt: '2026-06-25T00:00:00Z', type: 'insight', note: 'm', source: '', tags: ['t'], imageExt: 'webp' };

describe('transformCapture', () => {
  it('이미지 base64 블록 + 스키마 강제, parsed 반환', async () => {
    const parse = vi.fn(async () => ({ parsed_output: { title: 'T', insight: 'I', ocr: 'O', tags: ['a'] }, stop_reason: 'end_turn' }));
    const client = { messages: { parse } } as any;
    const out = await transformCapture(client, meta, Buffer.from([1,2,3]), 'claude-opus-4-8');
    const arg = parse.mock.calls[0][0];
    const content = arg.messages[0].content;
    expect(content[0].type).toBe('image');
    expect(content[0].source.media_type).toBe('image/webp');
    expect(out.title).toBe('T');
  });
  it('parsed_output 없으면 throw', async () => {
    const client = { messages: { parse: vi.fn(async () => ({ parsed_output: null, stop_reason: 'max_tokens' })) } } as any;
    await expect(transformCapture(client, meta, Buffer.from([1]), 'claude-opus-4-8')).rejects.toThrow();
  });
});
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**

`buildTransformPrompt(meta)`: type별 추출 관점 + 메모/출처 주입 + 출력 규격(제목/핵심/원문/태그) 지시. `transformCapture(client, meta, imageBuf, model)`:
```ts
const res = await client.messages.parse({
  model, max_tokens: 8000, thinking: { type: 'adaptive' },
  output_config: { format: zodOutputFormat(TransformSchema) },
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: mimeFor(meta.imageExt), data: imageBuf.toString('base64') } },
    { type: 'text', text: buildTransformPrompt(meta) },
  ] }],
});
if (!res.parsed_output) throw new Error('transform parse 실패(stop_reason='+res.stop_reason+')');
return res.parsed_output;
```
(클라이언트는 호출부에서 `new Anthropic({apiKey})` 주입 — 테스트는 모킹.)

- [ ] **Step 5: Commit** — `git add src/main/transform.* && git commit -m "feat: Claude vision transform"`

### Task 9: 설정 (`main/settings.ts`)

**Files:** Create `src/main/settings.ts`

- [ ] **Step 1: 구현(얇음)** — `app.getPath('userData')/settings.json` 읽기/쓰기. 필드: `relayUrl`,`relayToken`,`anthropicKey`,`stagingDir`,`vaultNotesDir`,`vaultAttachDir`,`model`(기본 `claude-opus-4-8`). 누락 안전 기본값.
- [ ] **Step 2: 타입체크** — Run: `npm run typecheck` → 에러 없음.
- [ ] **Step 3: Commit** — `git add src/main/settings.ts && git commit -m "feat: settings persistence (userData json)"`

### Chunk 2 게이트
Run: `npm run test && npm run typecheck && npm run lint` → 전부 green.

---

## Chunk 3: Electron 셸 + IPC + renderer UI

main 오케스트레이션·IPC·preload·React UI. 제로터치 자동 pull+변환, 트리아지·편집·승격.

### Task 10: IPC 오케스트레이션 + preload

**Files:** Modify `src/main/index.ts`; Create `src/main/ipc.ts`; Modify `src/preload/index.ts`

- [ ] **Step 1: ipc.ts 핸들러**

`registerIpc()`가 `ipcMain.handle` 등록:
- `items:list` → `scan(settings.stagingDir)`.
- `sync:pull` → `listUnconsumed` 루프: `hasNote`면 스킵, 아니면 `fetchImage`(실패 시 consume 보류·continue)→`writeImage`+`writeRaw`→`consume`. 결과 카운트 반환.
- `transform:run` → staging의 `status:raw`(error 포함) 각각: 이미지 읽기→`transformCapture`(client= `new Anthropic({apiKey:settings.anthropicKey})`)→`writeTransformed`. 노트 단위 try/catch(실패는 error 표식·계속). 키 없으면 no-op+사유.
- `item:save`(편집 저장) → `updateNote`.
- `item:promote` → `parseNote`로 확인→`promoteTargets`→대상 중복 검사→`moveToVault`(노트는 `stripStagingFrontmatter` 적용)→`removeItem`.
- `item:discard` → `removeItem`.
- `settings:get`/`settings:set`.

`auto()`= `sync:pull` 후 `transform:run`. `app.whenReady`/`browser-window-focus`에서 `auto()` 호출(제로터치). 디바운스(중복 방지).

- [ ] **Step 2: preload 노출**

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('items:list'),
  pull: () => ipcRenderer.invoke('sync:pull'),
  transform: () => ipcRenderer.invoke('transform:run'),
  save: (notePath: string, md: string) => ipcRenderer.invoke('item:save', notePath, md),
  promote: (base: string) => ipcRenderer.invoke('item:promote', base),
  discard: (base: string) => ipcRenderer.invoke('item:discard', base),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s: unknown) => ipcRenderer.invoke('settings:set', s),
  onAuto: (cb: () => void) => ipcRenderer.on('auto:done', cb),
});
```
renderer 타입: `src/renderer/api.d.ts`에 `window.api` 선언.

- [ ] **Step 3: 타입체크** — Run: `npm run typecheck` → 에러 없음.
- [ ] **Step 4: Commit** — `git add src/main/ipc.ts src/main/index.ts src/preload && git commit -m "feat: IPC orchestration (pull→store→transform, promote) + preload"`

### Task 11: 트리아지 목록 + useItems

**Files:** Create `src/renderer/hooks/useItems.ts`, `src/renderer/components/TriageList.tsx`; Modify `src/renderer/App.tsx`

- [ ] **Step 1: useItems** — 마운트 시 `window.api.list()`; `window.api.onAuto`로 재로드; `refresh()`=`pull`+`transform`+`list`; `transformed` 위·`raw` 아래 정렬.
- [ ] **Step 2: TriageList** — 행: 썸네일(`file://imagePath` 또는 IPC 이미지 로드)·제목/메모·타입 뱃지(Hachimon TierBadge 풍)·status·source. 빈 상태. 상단 "새로고침"(refresh). 행 클릭→선택.
- [ ] **Step 3: 수동 확인** — `npm run dev`, staging에 더미 항목 두고 목록 표시 확인.
- [ ] **Step 4: Commit** — `git add src/renderer/hooks src/renderer/components/TriageList.tsx src/renderer/App.tsx && git commit -m "feat: triage list + useItems"`

### Task 12: 항목 에디터 (디테일)

**Files:** Create `src/renderer/components/ItemEditor.tsx`; Modify `src/renderer/App.tsx`(마스터-디테일)

- [ ] **Step 1: ItemEditor** — 좌: 큰 이미지. 우: 편집 필드(제목·핵심·원문·태그·source·type). 변경 시 `assembleTransformed`로 md 만들어 `window.api.save`(또는 핸들러가 필드→md). 버튼: "변환 다시"(`window.api.transform` 후 재로드)·"승격"(`window.api.promote(base)`→목록에서 제거)·"버리기"(`discard`).
- [ ] **Step 2: 수동 확인** — `npm run dev`: 항목 선택→편집→저장 반영 확인.
- [ ] **Step 3: Commit** — `git commit -am "feat: item editor (detail) + promote/discard"`

### Task 13: 설정 시트

**Files:** Create `src/renderer/components/SettingsSheet.tsx`

- [ ] **Step 1: SettingsSheet** — 릴레이 URL·토큰, Claude 키, staging 폴더, vault 노트/첨부 폴더 입력(폴더 선택 다이얼로그 IPC `dialog:pickDir`) → `window.api.setSettings`. 미설정 시 안내(pull/transform 비활성 사유).
- [ ] **Step 2: 수동 확인** — 설정 저장→재시작 후 유지 확인.
- [ ] **Step 3: Commit** — `git commit -am "feat: settings sheet"`

### Task 14: 빌드 + 운용 문서 + e2e

**Files:** Create `docs/usage.md`

- [ ] **Step 1: 빌드** — Run: `npm run build` → main/preload/renderer 번들 생성 성공.
- [ ] **Step 2: usage.md** — 키·릴레이·경로 설정 절차, 동기(앱 열기=자동), 승격 흐름, capture repo `sync-captures.ts` 은퇴 안내(중복 가동 회피).
- [ ] **Step 3: 수동 e2e(1회)** — 실폰 캡처(또는 릴레이에 더미 업로드) → 앱 열기(자동 pull+변환) → 검토·수정 → 승격 → vault에 정본 노트+이미지 확인. 스크린샷 1장.
- [ ] **Step 4: Commit** — `git add docs/usage.md && git commit -m "docs: usage + build"`

### Chunk 3 게이트
Run: `npm run test && npm run typecheck && npm run lint && npm run build` → 전부 green.

---

## 완료 기준 (스펙 §13 동기화)

- [ ] 앱 열면 릴레이 자동 pull → vault-외 staging raw 저장 → consume(터미널 0회).
- [ ] raw가 Claude vision으로 자동 변환(OCR+추출+규격)→ transformed·검토대기(실패는 raw+error 격리·재시도).
- [ ] 트리아지 목록 + 에디터에서 스침·수정.
- [ ] "승격" 1회로 staging 노트+이미지가 vault 정본(status 제거)으로 안착·staging에서 제거. 재실행 멱등.
- [ ] vault 내부엔 정본만, raw는 staging에만.
- [ ] 순수 코어 + 어댑터 테스트 + typecheck + lint + build 전부 green.
- [ ] 수동 e2e 1회로 파이프 관통.

## 비고

- 변환은 캡처당 vision 1회(opus-4-8). 개인용 저volume. 배치/비용 최적화 후속.
- electron-builder 패키징(설치 파일)·자동업데이트는 v1 비목표(로컬 `npm run dev`/`build`로 운용). 후속.
- capture repo `sync-captures.ts` 은퇴는 별도 작업(이 앱 배포 후, 중복 pull 회피).
