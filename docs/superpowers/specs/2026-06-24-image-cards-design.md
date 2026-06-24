# 이미지 카드 — 설계 문서

> 작성일: 2026-06-24
> 상태: 승인됨
> ROADMAP 항목: 5-4 (이미지 카드)

## 배경 / 목적

답변에 이미지(다이어그램·스크린샷)를 담을 수 있게 한다. Obsidian 노트에 `![[diagram.png]]`(또는 표준 `![](path)`)로 임베드한 이미지를 **CLI가 최적화(리사이즈+WebP)해 base64 데이터 URI로 답변에 인라인**하고, 앱이 복습 화면에서 렌더한다. "서버 없는 정적 PWA" 원칙을 지키며 cards.json 하나로 자기완결.

멀티라인 답변 파서(5-5) 위에서 자연스럽게 확장된다 — 이미지 임베드는 답변 본문의 한 줄/인라인일 뿐이고 `parseVault`는 이미 그 텍스트를 보존한다.

## 핵심 결정

| 항목 | 결정 |
|------|------|
| 저장 방식 | base64 데이터 URI를 답변 마크다운에 인라인 (스키마 변경 없음) |
| 인라인 진입점(MVP) | **CLI만**. 플러그인/인앱은 후속(같은 공유 모듈 재사용) |
| 최적화 | 래스터: sharp 리사이즈(maxWidth 800)+WebP(q80). SVG: 벡터 보존, 리사이즈 없이 base64 |
| 앱 렌더 | react-markdown `urlTransform`로 `data:image/` 허용 |
| `parseVault` | 변경 없음 (답변 텍스트에 ref가 그대로 남음) |

### 비목표 (YAGNI)
플러그인/인앱 이미지 인라인(후속), 이미지 편집, 캡션(alt 외), 외부 http(s) 이미지 다운로드(기존대로 직접 렌더), Card/cards.json 스키마 변경, 중첩/복잡 임베드 옵션(크기 지정 `![[img|100]]`의 100은 alt로 처리).

## 아키텍처 — 공유 순수 탐지/치환 + 진입점별 주입 최적화

이미지 바이트 읽기·최적화는 환경 의존(CLI=sharp). 참조 탐지·치환은 순수. 둘을 분리한다.

```
src/lib/images.ts            # 순수: 이미지 ref 탐지 + 비동기 치환(리졸버 주입). I/O 없음
src/lib/images.test.ts
scripts/parse-vault.ts       # CLI: vault 이미지 인덱싱 + sharp 최적화 리졸버 + run() async화
scripts/parse-vault.test.ts  # 이미지 인라인 통합 테스트(작은 PNG 픽스처) 추가
src/lib/markdown.ts          # 순수: imageUrlTransform(url) — data:image 허용 래퍼
src/lib/markdown.test.ts
src/pages/ReviewSession.tsx  # <Markdown urlTransform={imageUrlTransform}> + 이미지 스타일
```

### `src/lib/images.ts` (순수)

```ts
export interface ImageRef {
  raw: string;     // 원본 매치 전체 (예: '![[diagram.png|도식]]')
  target: string;  // 파일 참조 (예: 'diagram.png')
  alt: string;     // 대체 텍스트 (없으면 target 또는 '')
}

/** 답변에서 이미지 임베드를 찾는다 — Obsidian `![[t|alt]]`/`![[t]]` + 표준 `![alt](t)`. */
export function findImageRefs(answer: string): ImageRef[];

/** 각 ref를 resolver가 반환한 문자열로 치환(비동기, 순차). resolver가 null 반환 시 원본 유지. */
export async function replaceImageRefs(
  answer: string,
  resolver: (ref: ImageRef) => Promise<string | null>,
): Promise<string>;
```
- Obsidian 임베드 정규식: `!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]`. target=그룹1(trim), alt=그룹2 또는 ''. (Obsidian의 `|` 뒤는 보통 크기/별칭 — alt로 취급.)
- 표준 이미지 정규식: `!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)`. alt=그룹1, target=그룹2. (이 정규식은 `![[...]]`를 매치하지 않음 — 겹침 없음.)
- **http(s)·data: target 제외는 `findImageRefs` 로직에서 처리**(정규식이 아님): target이 `/^(https?:|data:)/i`면 `ImageRef`로 만들지 않는다(외부/이미 인라인이므로 resolver까지 가지 않음).
- **펜스/인라인코드 스킵은 하지 않는다(YAGNI).** SM-2 답변의 코드블록에 `![[...]]`/`![](...)` 텍스트가 들어갈 일은 사실상 없다. 코드블록 안에 이미지 문법을 예시로 적는 드문 경우만 오인되며, 이는 문서화된 수용 제약으로 둔다. (불필요한 코드영역 마스킹 회피 → images.ts를 진짜 단순하게 유지.)
- 순수: 파일·라이브러리 접근 없음. **`images.ts`는 `react-markdown`·`sharp`를 import하지 않는다.** 치환 문자열(데이터 URI 등)은 주입된 resolver가 만든다.

### `src/lib/markdown.ts` (순수)

```ts
import { defaultUrlTransform } from 'react-markdown';

/** data:image/* 는 허용, 그 외는 react-markdown 기본 안전 변환. */
export function imageUrlTransform(url: string): string {
  if (/^data:image\//i.test(url)) return url;
  return defaultUrlTransform(url);
}
```

### CLI 인라인 (`scripts/parse-vault.ts`)

- `collectImageFiles(vaultDir)`: png/jpg/jpeg/gif/webp/svg를 재귀 수집 → basename→절대경로 맵(+상대경로 키). (`collectMarkdownFiles`와 동형, 확장자만 다름.)
- `optimizeToDataUri(absPath)`:
  - svg → `data:image/svg+xml;base64,<파일 base64>` (리사이즈 없음)
  - 그 외 → `sharp(abs).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()` → `data:image/webp;base64,<b64>`
- per-card: `card.answer = await replaceImageRefs(card.answer, async (ref) => { 파일 해석; 없으면 경고+ null(원본 유지); 있으면 optimizeToDataUri })`.
- 결과 데이터 URI가 임계(예 200KB) 초과 시 경고(여전히 인라인).
- `run()`을 **async로 전환**: 현재 `run`은 sync. parseVault(sync) → 카드별 이미지 인라인(await) → write. 호출부 정정:
  - 현재 `main`은 `function main(): void`이고 `const { decks, cards } = run(args)`로 동기 호출 + 파일 끝 `if (...) main()`.
  - 변경: `run`을 `async function run(...): Promise<{decks,cards}>`로, `main`을 `async function main(): Promise<void>`로, `const { decks, cards } = await run(args)`로. `main` 본문 전체가 try-catch라 reject되지 않음(말단 `main()` 호출은 그대로 둬도 안전).
  - **기존 `run` 동기 테스트(`scripts/parse-vault.test.ts`)를 async로 갱신**: `expect(() => run(...)).toThrow()` → `await expect(run(...)).rejects.toThrow()`, `const res = run(...)` → `await run(...)`.
- `sharp`는 **이미 devDependency**(`^0.35.2`, generate-icons.mjs가 사용 중)다. 추가 설치 불필요 — `import sharp from 'sharp'`만.

### 앱 렌더 (`src/pages/ReviewSession.tsx`)

- `import { imageUrlTransform } from '@/lib/markdown'`.
- `<Markdown rehypePlugins={[rehypeHighlight]} urlTransform={imageUrlTransform}>` (line 137).
- 이미지 가독성: `components={{ img: (props) => <img {...props} className="max-w-full rounded-md my-2" /> }}` 또는 CSS로 답변 영역 `img { max-width:100%; }`. (간단히 components img 래퍼 권장.)

## 데이터 흐름

1. 작성: Obsidian 노트 답변에 `![[diagram.png]]`.
2. `parseVault` → card.answer에 `![[diagram.png]]` 텍스트 그대로.
3. CLI 인라인: vault 이미지 인덱스에서 `diagram.png` 해석 → sharp 최적화 → `![도식](data:image/webp;base64,…)`로 치환.
4. cards.json 작성 → 배포 → 앱 fetch → IndexedDB.
5. ReviewSession: react-markdown이 `urlTransform` 통과한 data URI를 `<img>`로 렌더.

## 에러 / 엣지

| 상황 | 동작 |
|------|------|
| 참조 이미지 파일 없음 | 경고(파일명) + 원본 ref 유지(빌드 실패 아님) |
| 미지원 확장자 | 경고 + 원본 유지 |
| http(s)·data: target | 인라인 안 함(그대로) — 외부/이미 인라인 |
| 동일 basename 이미지 다수 | 첫 매치 사용 + 경고(파서 중복 basename 경고와 동형) |
| 최적화 결과 큼(>200KB) | 경고 + 인라인 진행 |
| sharp 처리 실패 | 경고 + 원본 유지 |

미해석 ref가 남은 답변: 앱에서 `![[...]]`는 react-markdown이 리터럴 텍스트로 렌더(깨진 이미지 아님). 표준 `![](상대경로)`는 깨진 `<img>`. → CLI 인라인이 정상 경로. (플러그인/인앱 미지원은 문서화.)

## 테스트

- `images.test.ts`(순수): `![[x.png]]`·`![[x.png|도식]]`·`![alt](x.png)` 탐지; 다중; 없음; http/data target은 ref에서 제외; resolver null→원본 유지; resolver 값→치환.
- `markdown.test.ts`(순수): `imageUrlTransform` — `data:image/png;base64,..`통과, `javascript:alert(1)` 차단(빈/안전값), `https://..` 통과.
- `scripts/parse-vault.test.ts` 통합: 임시 vault + 1×1 PNG + `![[px.png]]` 답변 노트 → CLI 인라인 → 답변에 `data:image/webp;base64,` 포함. 미존재 이미지 → 경고+원본 유지. (sharp 실제 인코딩.)
- 앱 이미지 렌더: 수동 확인(`npm run dev`).

## 영향 범위 (파일별)

| 파일 | 변경 |
|------|------|
| `src/lib/images.ts` (+test) | 신규 (순수 탐지/치환) |
| `src/lib/markdown.ts` (+test) | 신규 (imageUrlTransform) |
| `scripts/parse-vault.ts` | 이미지 인덱싱·sharp 최적화·run() async |
| `scripts/parse-vault.test.ts` | 이미지 인라인 통합 테스트 |
| `src/pages/ReviewSession.tsx` | urlTransform + img 스타일 |
| `package.json` | 변경 없음 (`sharp` 이미 존재) |
| `docs/obsidian-guide.md` | 이미지 작성법(`![[img]]`) + CLI 필요 명시 |
| `ROADMAP.md` | 5-4 갱신 |
| `src/lib/obsidian.ts`(parseVault) | 변경 없음 |

## 작업 진행 방식

feature 브랜치 `feat/image-cards` → PR → merge. Conventional commits. TS strict, TDD(순수 모듈 우선).
