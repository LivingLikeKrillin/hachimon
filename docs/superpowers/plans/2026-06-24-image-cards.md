# 이미지 카드 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLI가 Obsidian 이미지 임베드(`![[img]]`/`![](img)`)를 최적화(sharp 리사이즈+WebP, SVG passthrough)해 base64 data URI로 답변에 인라인하고, 앱이 복습에서 그 이미지를 렌더한다.

**Architecture:** 순수 모듈 `images.ts`(ref 탐지/치환, I/O·라이브러리 없음)와 `markdown.ts`(react-markdown urlTransform 래퍼)를 분리. CLI가 sharp 리졸버를 주입해 인라인(run() async). 앱은 ReviewSession의 `<Markdown>`에 urlTransform 적용. parseVault·스키마 불변.

**Tech Stack:** TypeScript(strict), Vitest, sharp(이미 devDep), react-markdown 10.

**Spec:** `docs/superpowers/specs/2026-06-24-image-cards-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/images.ts` (+test) | 순수: `findImageRefs`/`replaceImageRefs` | 신규 |
| `src/lib/markdown.ts` (+test) | 순수: `imageUrlTransform` | 신규 |
| `scripts/parse-vault.ts` | `collectImageFiles`·`optimizeToDataUri`(sharp)·run() async 인라인 | 수정 |
| `scripts/parse-vault.test.ts` | 기존 run 테스트 async화 + 이미지 인라인 통합 테스트 | 수정 |
| `src/pages/ReviewSession.tsx` | `<Markdown urlTransform + img 컴포넌트>` | 수정 |
| `docs/obsidian-guide.md`, `ROADMAP.md` | 이미지 작성법, 5-4 | 수정 |
| `src/lib/obsidian.ts` | 변경 없음 | — |

**가드:** `images.ts`는 `react-markdown`·`sharp`를 import하지 않는다(순수). CLI(`scripts/`)는 `markdown.ts`를 import하지 않는다(react-markdown이 CLI 번들에 들어가면 안 됨).

---

## Chunk 1: 구현

### Task 1: images.ts (순수 탐지/치환)

**Files:** Create `src/lib/images.ts`, `src/lib/images.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/lib/images.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { findImageRefs, replaceImageRefs } from './images.ts';

describe('findImageRefs', () => {
  it('Obsidian 임베드 ![[t]] / ![[t|alt]]', () => {
    const refs = findImageRefs('a ![[diagram.png]] b ![[x.png|도식]] c');
    expect(refs.map((r) => [r.target, r.alt])).toEqual([['diagram.png', ''], ['x.png', '도식']]);
  });
  it('표준 ![alt](t)', () => {
    const refs = findImageRefs('![cap](sub/p.png)');
    expect(refs[0].target).toBe('sub/p.png');
    expect(refs[0].alt).toBe('cap');
  });
  it('http(s)·data: target은 제외', () => {
    const refs = findImageRefs('![](https://e.com/a.png) ![](data:image/png;base64,xx)');
    expect(refs).toHaveLength(0);
  });
  it('이미지 없으면 빈 배열', () => {
    expect(findImageRefs('그냥 텍스트')).toEqual([]);
  });
});

describe('replaceImageRefs', () => {
  it('resolver 값으로 치환, null이면 원본 유지', async () => {
    const out = await replaceImageRefs('![[a.png]] 그리고 ![[b.png]]', async (ref) =>
      ref.target === 'a.png' ? `![](data:image/webp;base64,QQ==)` : null,
    );
    expect(out).toBe('![](data:image/webp;base64,QQ==) 그리고 ![[b.png]]');
  });
  it('치환 문자열의 $는 특수처리되지 않는다', async () => {
    const out = await replaceImageRefs('![[a.png]]', async () => '![x](u) $& $1 가격$5');
    expect(out).toBe('![x](u) $& $1 가격$5');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/images.test.ts` → FAIL.

- [ ] **Step 3: 구현** `src/lib/images.ts`:
```ts
export interface ImageRef {
  raw: string;
  target: string;
  alt: string;
}

const EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const STD_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternal(target: string): boolean {
  return /^(https?:|data:)/i.test(target);
}

/** 답변에서 인라인 대상 이미지 ref를 찾는다(http(s)·data: 제외). */
export function findImageRefs(answer: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const m of answer.matchAll(EMBED_RE)) {
    const target = m[1].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: (m[2] ?? '').trim() });
  }
  for (const m of answer.matchAll(STD_RE)) {
    const target = m[2].trim();
    if (!isExternal(target)) refs.push({ raw: m[0], target, alt: (m[1] ?? '').trim() });
  }
  return refs;
}

/** 각 ref를 resolver 반환값으로 치환(비동기 순차). null이면 원본 유지.
 *  replace는 함수형 치환을 써서 데이터 URI/alt 안의 `$`가 특수처리되지 않게 한다.
 *  전제: resolver 반환값은 ref.raw(예: `![[a.png]]`)를 포함하지 않아야 한다(포함 시 동일 raw 중복 치환이 어긋날 수 있음). CLI 리졸버는 `![alt](data:…)`를 반환하므로 안전. */
export async function replaceImageRefs(
  answer: string,
  resolver: (ref: ImageRef) => Promise<string | null>,
): Promise<string> {
  let result = answer;
  for (const ref of findImageRefs(answer)) {
    const replacement = await resolver(ref);
    if (replacement !== null) result = result.replace(ref.raw, () => replacement);
  }
  return result;
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/images.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/images.ts src/lib/images.test.ts && git commit -m "feat(images): pure image-ref detection and replacement"`

---

### Task 2: markdown.ts (imageUrlTransform)

**Files:** Create `src/lib/markdown.ts`, `src/lib/markdown.test.ts`

- [ ] **Step 1: 실패 테스트** `src/lib/markdown.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { imageUrlTransform } from './markdown.ts';

describe('imageUrlTransform', () => {
  it('data:image/* 는 통과', () => {
    const u = 'data:image/webp;base64,QQ==';
    expect(imageUrlTransform(u)).toBe(u);
  });
  it('https 는 통과', () => {
    expect(imageUrlTransform('https://e.com/a.png')).toBe('https://e.com/a.png');
  });
  it('javascript: 는 차단(빈 문자열)', () => {
    expect(imageUrlTransform('javascript:alert(1)')).toBe('');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/markdown.test.ts` → FAIL.

- [ ] **Step 3: 구현** `src/lib/markdown.ts`:
```ts
import { defaultUrlTransform } from 'react-markdown';

/** data:image/* 는 허용, 그 외는 react-markdown 기본 안전 변환(http/https/mailto 등). */
export function imageUrlTransform(url: string): string {
  if (/^data:image\//i.test(url)) return url;
  return defaultUrlTransform(url);
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/markdown.test.ts` → PASS. (참고: react-markdown import는 node vitest에서 정상 로드 — 렌더가 아니라 import이므로.)

- [ ] **Step 5: Commit** — `git add src/lib/markdown.ts src/lib/markdown.test.ts && git commit -m "feat(markdown): imageUrlTransform allowing data:image URIs"`

---

### Task 3: CLI 이미지 인라인 (run async + sharp)

**Files:** Modify `scripts/parse-vault.ts`, `scripts/parse-vault.test.ts`

- [ ] **Step 1: 기존 run 테스트 async화 + 신규 통합 테스트**

`scripts/parse-vault.test.ts`의 `describe('run', …)` 블록에서:
- 성공 테스트: `const res = run({...})` → `const res = await run({...})`, `it(... )` 콜백을 `async`로.
- throw 테스트 2개: `expect(() => run({...})).toThrow()` → `await expect(run({...})).rejects.toThrow()`, 콜백 `async`로.
그리고 신규 테스트 추가(같은 describe 안 또는 새 describe):
```ts
it('이미지 임베드를 base64 webp로 인라인한다', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
  try {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    writeFileSync(path.join(root, 'px.png'), png);
    writeFileSync(
      path.join(root, 'N.md'),
      ['## Self-Test Anchors', '#flashcard/x', '### Foundation', '그림?::![[px.png]]'].join('\n'),
    );
    const outPath = path.join(root, 'o.json');
    await run({ vaultDir: root, outPath, version: 'V' });
    const data = JSON.parse(readFileSync(outPath, 'utf-8'));
    expect(data.cards[0].answer).toContain('data:image/webp;base64,');
    expect(data.cards[0].answer).not.toContain('![[px.png]]');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('없는 이미지는 원본 ref를 유지한다', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
  try {
    writeFileSync(
      path.join(root, 'N.md'),
      ['## Self-Test Anchors', '#flashcard/x', '### Foundation', '그림?::![[missing.png]]'].join('\n'),
    );
    const outPath = path.join(root, 'o.json');
    await run({ vaultDir: root, outPath, version: 'V' });
    const data = JSON.parse(readFileSync(outPath, 'utf-8'));
    expect(data.cards[0].answer).toContain('![[missing.png]]');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run scripts/parse-vault.test.ts` → 새/변경 케이스 FAIL(run sync).

- [ ] **Step 3: parse-vault.ts 수정**

상단 import에 추가: `sharp` 기본 import, images에서 `replaceImageRefs`. (`readdirSync`/`readFileSync`/`path`는 이미 import됨.)
```ts
import sharp from 'sharp';
import { replaceImageRefs } from '../src/lib/images.ts';
```
헬퍼 추가(파일 상단부, `collectMarkdownFiles` 근처):
```ts
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** vault의 이미지 파일을 basename→절대경로로 인덱싱(첫 매치 우선, 중복 경고). */
export function collectImageFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(full);
      } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
        if (out.has(entry.name)) console.warn(`⚠ 중복 이미지 파일명: ${entry.name}`);
        else out.set(entry.name, full);
      }
    }
  };
  walk(dir);
  return out;
}

/** 이미지 파일 → 최적화된 data URI. svg는 벡터 보존(base64 그대로), 그 외는 sharp 리사이즈+WebP. */
async function optimizeToDataUri(absPath: string): Promise<string> {
  if (absPath.toLowerCase().endsWith('.svg')) {
    return `data:image/svg+xml;base64,${readFileSync(absPath).toString('base64')}`;
  }
  const buf = await sharp(absPath).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const b64 = buf.toString('base64');
  if (b64.length > 200_000) {
    console.warn(`⚠ 큰 이미지(${Math.round(b64.length / 1024)}KB): ${path.basename(absPath)}`);
  }
  return `data:image/webp;base64,${b64}`;
}
```
`run`을 async로 바꾸고 이미지 인라인 패스 추가(0-card 체크 뒤, write 전):
```ts
export async function run(args: CliArgs): Promise<{ decks: number; cards: number }> {
  if (!existsSync(args.vaultDir) || !statSync(args.vaultDir).isDirectory()) {
    throw new Error(`Vault 디렉토리를 찾을 수 없습니다: ${args.vaultDir}`);
  }
  const files = collectMarkdownFiles(args.vaultDir);
  if (files.length === 0) throw new Error(`.md 파일이 없습니다: ${args.vaultDir}`);
  warnDuplicateBasenames(files);

  const data = parseVault(files, args.version);
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. ## Self-Test Anchors / #flashcard/… / ### Tier / 질문?::답변 포맷을 확인하세요.');
  }

  const images = collectImageFiles(args.vaultDir);
  for (const card of data.cards) {
    card.answer = await replaceImageRefs(card.answer, async (ref) => {
      const abs = images.get(path.basename(ref.target));
      if (!abs) {
        console.warn(`⚠ 이미지를 찾을 수 없음: ${ref.target}`);
        return null;
      }
      try {
        return `![${ref.alt}](${await optimizeToDataUri(abs)})`;
      } catch (e) {
        console.warn(`⚠ 이미지 처리 실패(${ref.target}): ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    });
  }

  mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
  writeFileSync(args.outPath, JSON.stringify(data, null, 2) + '\n');
  return { decks: data.decks.length, cards: data.cards.length };
}
```
`main`을 async로 + await:
```ts
async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const { decks, cards } = await run(args);
    console.log(`✓ ${decks} decks / ${cards} cards → ${args.outPath}`);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
```
(말단 `if (process.argv[1] === fileURLToPath(import.meta.url)) main();`는 그대로 — main 본문이 전부 try-catch라 reject 없음.)

- [ ] **Step 4: 통과 확인** — `npx vitest run scripts/parse-vault.test.ts` → 전부 PASS(기존 async화 + 신규 2개). sharp 실제 인코딩 동작 확인.

- [ ] **Step 5: typecheck:scripts** — `npm run typecheck:scripts` → exit 0.

- [ ] **Step 6: Commit** — `git add scripts/parse-vault.ts scripts/parse-vault.test.ts && git commit -m "feat(cli): inline vault images as optimized base64 (sharp)"`

---

### Task 4: ReviewSession 이미지 렌더

**Files:** Modify `src/pages/ReviewSession.tsx`

- [ ] **Step 1: urlTransform + img 컴포넌트 적용**

`import { imageUrlTransform } from '@/lib/markdown';` 추가. line 137의 `<Markdown rehypePlugins={[rehypeHighlight]}>{currentCard.answer}</Markdown>`을 교체:
```tsx
<Markdown
  rehypePlugins={[rehypeHighlight]}
  urlTransform={imageUrlTransform}
  components={{
    img: ({ node: _node, ...props }) => (
      <img {...props} className="max-w-full rounded-md my-2" />
    ),
  }}
>
  {currentCard.answer}
</Markdown>
```
(`node`를 구조분해로 제거해 DOM `<img>`에 넘어가지 않게 한다.)

- [ ] **Step 2: 타입체크 + 빌드** — `npx tsc -b && npm run build` → 성공. (img 컴포넌트 props 타입 에러 시 `import type { Components } from 'react-markdown'` 활용하거나 props를 `React.ComponentProps<'img'>`로.)

- [ ] **Step 3: Commit** — `git add src/pages/ReviewSession.tsx && git commit -m "feat(review): render data:image answers (urlTransform + img styling)"`

---

### Task 5: 문서 · ROADMAP · 최종 게이트 · PR

**Files:** Modify `docs/obsidian-guide.md`, `ROADMAP.md`

- [ ] **Step 1: obsidian-guide 이미지 작성법**

`docs/obsidian-guide.md`에 이미지 절 추가: 답변에 `![[diagram.png]]`(또는 `![](path)`)로 임베드 → **CLI(`npm run parse`)로 구워야 이미지가 base64로 인라인**됨(인앱 가져오기·플러그인은 아직 이미지 미지원, 후속). 지원 확장자(png/jpg/jpeg/gif/webp/svg), 최적화(가로 800px·WebP) 안내.

- [ ] **Step 2: ROADMAP 5-4**

```
### 5-4. 이미지 카드 (완료 — CLI 인라인)
- [x] CLI가 `![[img]]`/`![](img)`를 sharp 최적화(리사이즈+WebP, SVG passthrough) → base64 data URI 인라인
- [x] 앱 렌더(react-markdown urlTransform로 data:image 허용)
- [~] 플러그인/인앱 인라인 — 후속(공유 `images.ts` 재사용)
```

- [ ] **Step 3: 최종 게이트** — `npx tsc -b && npm run typecheck:scripts && npm run typecheck:plugin && npm run lint && npx vitest run && npm run build && npm run build:plugin` → 전부 통과.

- [ ] **Step 4: 수동 확인 안내(선택)** — `npm run dev`로 이미지가 포함된 답변이 복습에서 렌더되는지 확인(자동화 불가, PR에 명시).

- [ ] **Step 5: Commit + PR**
```bash
git add docs/obsidian-guide.md ROADMAP.md
git commit -m "docs(images): authoring guide + ROADMAP 5-4"
git push -u origin feat/image-cards
gh pr create --title "feat: 이미지 카드 (CLI base64 인라인 + 앱 렌더)" --body "..."
```
PR 본문: 요약·CLI 전용 MVP·base64 인라인·앱 urlTransform·수동 확인 필요·플러그인/인앱 후속 명시.

---

## 검증 게이트 요약

각 Task: 관련 vitest. Task 3은 `typecheck:scripts`(sharp 실인코딩 통합 포함). Task 4는 `tsc -b`+`build`. Task 5는 전체 게이트(typecheck:scripts/plugin·lint·vitest·build·build:plugin) + PR. 회귀 1순위: 기존 parseVault·CLI·plugin 테스트 유지.
