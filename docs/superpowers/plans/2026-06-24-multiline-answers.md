# 멀티라인 답변 파서 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `parseVault`가 `질문?::` 답변을 다음 카드/헤딩/EOF까지 여러 줄(코드펜스·문단·리스트)로 누적하도록 강화한다 — 코드펜스·인라인코드 인식으로 `::` 오인 없이, 기존 단일 줄 호환 유지.

**Architecture:** `src/lib/obsidian.ts`의 `parseVault` 내부 루프를 라인별 즉시 방출 → 상태 기반 블록 누적으로 재작성. 내부 헬퍼 `firstDelimiter`(인라인코드 밖 첫 `::` 위치)로 카드-시작 판정과 분리를 통일. 다른 모듈·타입·집계·hash 규칙 불변. in-app·CLI·플러그인 3진입점이 자동 수혜.

**Tech Stack:** TypeScript(strict), Vitest. 단일 파일 변경(+테스트).

**Spec:** `docs/superpowers/specs/2026-06-24-multiline-answers-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/obsidian.ts` | `parseVault` 내부 루프 재작성 + 내부 `firstDelimiter` 헬퍼 | 수정 |
| `src/lib/obsidian.test.ts` | 멀티라인 케이스 추가(기존 9개 유지) | 수정 |
| `docs/obsidian-guide.md` | 멀티라인 작성법 + `::` 제약 | 수정 |
| `ROADMAP.md` | 파서 강화 항목 기록 | 수정 |
| 그 외(serialize/CLI/plugin/merge/types) | 변경 없음 (자동 수혜) | — |

**핵심 구현 주의:**
- **누적은 `raw`(원본 줄), 판정은 `line = raw.trim()`.** 코드펜스 내부 들여쓰기를 보존해야 하므로 answer 버퍼에는 `raw`를 넣는다. 카드-시작/헤딩/펜스 토글 판정은 `line`(trim)으로 한다.
- **hashContent 호출 줄의 NUL 구분자(0x00)는 그대로 둔다.** 현재 `sourceHash: hashContent(\`${question}\0${answer}\`)`의 `\0`는 리터럴 NUL이며 파일이 binary로 인식된다. 공백 등으로 바꾸면 전 카드 sourceHash가 바뀌어 머지가 오작동한다. question 변수명만 바뀌므로(`curQuestion`) 그에 맞춰 쓰되 **구분자 NUL은 유지**.
- **`firstDelimiter(line)`**: 백틱 인라인코드 밖의 첫 `::` 인덱스(없으면 -1). 판정과 분리 둘 다 이걸 쓴다 → `` `key::value` ``의 `::`는 무시.

---

## Chunk 1: 파서 강화

### Task 1: parseVault 멀티라인 재작성

**Files:**
- Modify: `src/lib/obsidian.ts` (parseVault 본문 + 헬퍼 추가)
- Modify: `src/lib/obsidian.test.ts` (멀티라인 케이스 추가)

- [ ] **Step 1: 멀티라인 실패 테스트 추가**

`src/lib/obsidian.test.ts` 끝에 추가(기존 케이스는 그대로 둔다):

```ts
describe('parseVault — multi-line answers', () => {
  const wrap = (body: string) =>
    ['## Self-Test Anchors', '#flashcard/spring/core', '### Mechanism', body].join('\n');

  it('답변이 다음 카드 전까지 여러 줄로 이어진다', () => {
    const content = wrap(
      ['DI란?::의존성을 외부에서 주입.', '추가 설명 문단.', '', 'AOP란?::횡단 관심사 분리.'].join('\n'),
    );
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(2);
    expect(cards[0].question).toBe('DI란?');
    expect(cards[0].answer).toBe('의존성을 외부에서 주입.\n추가 설명 문단.');
    expect(cards[1].question).toBe('AOP란?');
    expect(cards[1].answer).toBe('횡단 관심사 분리.');
  });

  it('코드펜스를 답변에 보존하고 펜스 안 ::는 새 카드가 아니다', () => {
    const content = wrap(
      ['빈 생성자 주입?::', '```java', 'class A {', '  Map<String,Integer> m = Map.of("a", 1);', '}', '```'].join('\n'),
    );
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(1);
    expect(cards[0].answer).toBe(
      ['```java', 'class A {', '  Map<String,Integer> m = Map.of("a", 1);', '}', '```'].join('\n'),
    );
  });

  it('인라인 코드 안 ::는 새 카드로 오인되지 않는다', () => {
    const content = wrap(['질문?::설명.', '리스트의 `std::vector`를 쓴다.'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(1);
    expect(cards[0].answer).toBe('설명.\n리스트의 `std::vector`를 쓴다.');
  });

  it('티어 헤딩이 답변을 종료하고 티어를 전환한다', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/x',
      '### Foundation',
      'q1?::a1 여러 줄',
      '둘째 줄',
      '### Diagnosis',
      'q2?::a2',
    ].join('\n');
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(2);
    expect(cards[0].tier).toBe('foundation');
    expect(cards[0].answer).toBe('a1 여러 줄\n둘째 줄');
    expect(cards[1].tier).toBe('diagnosis');
  });

  it('파일 끝의 멀티라인 답변이 flush된다', () => {
    const content = wrap(['q?::첫 줄', '둘째 줄', '셋째 줄'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards[0].answer).toBe('첫 줄\n둘째 줄\n셋째 줄');
  });

  it('정확한 sourceHash 회귀 가드 (NUL 구분자 유지)', () => {
    // question="q?" answer="a" → hashContent(`q?\0a`) 의 고정 결과
    const content = wrap(['q?::a'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    // hashContent(`q?\0a`) = '0ff541' (NUL 구분자). 공백 구분자면 '104360' → 구분자 변경을 잡는 가드.
    expect(cards[0].sourceHash).toBe('0ff541');
  });
});
```

> sourceHash 기대값 `0ff541`은 리뷰에서 실제 `hashContent(\`q?\0a\`)`로 검증된 값(미리 박음). 나머지 멀티라인 케이스는 구현 전 실패해야 한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/obsidian.test.ts`
Expected: 새 멀티라인 케이스 FAIL(현재 파서는 단일 줄만), 기존 9개는 PASS.

- [ ] **Step 3: parseVault 재작성**

`src/lib/obsidian.ts`의 `parseVault` 함수 본문을 아래로 교체(시그니처·import·헬퍼 `slugify`/`hashContent`/상수는 유지). 그리고 파일에 `firstDelimiter` 내부 헬퍼를 추가:

```ts
/** 백틱 인라인코드 밖의 첫 `::` 인덱스(없으면 -1). 판정·분리 공통 사용. */
function firstDelimiter(line: string): number {
  let inCode = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === '`') inCode = !inCode;
    else if (!inCode && ch === ':' && line[i + 1] === ':') return i;
  }
  return -1;
}

const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^(```|~~~)/;

export function parseVault(
  files: VaultFile[],
  version: string = new Date().toISOString(),
): CardsData {
  const cards: Card[] = [];

  for (const file of files) {
    const slug = slugify(file.name);
    const seq: Record<string, number> = {};
    let inSection = false;
    let deck: string | null = null;
    let tier: Tier | null = null;

    // 열린 카드 상태
    let curQuestion: string | null = null;
    let answerLines: string[] = [];
    let inFence = false;

    const flush = (): void => {
      if (curQuestion === null || !deck || !tier) {
        curQuestion = null;
        answerLines = [];
        return;
      }
      const answer = answerLines.join('\n').replace(/^\s+|\s+$/g, '');
      const abbr = TIER_ABBR[tier];
      seq[abbr] = (seq[abbr] || 0) + 1;
      cards.push({
        id: `${slug}-${abbr}${seq[abbr]}`,
        deck,
        tier,
        question: curQuestion,
        answer,
        sourceFile: file.name,
        sourceHash: hashContent(`${curQuestion}\0${answer}`),
      });
      curQuestion = null;
      answerLines = [];
    };

    for (const raw of file.content.split('\n')) {
      const line = raw.trim();

      if (!inSection) {
        if (ANCHOR_RE.test(line)) inSection = true;
        continue;
      }

      // 코드펜스: 토글 줄과 펜스 내부는 answer 본문(열린 카드 한정)
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        if (curQuestion !== null) answerLines.push(raw);
        continue;
      }
      if (inFence) {
        if (curQuestion !== null) answerLines.push(raw);
        continue;
      }

      // 덱 태그 (#flashcard/…) — 종결자
      if (line.startsWith('#flashcard/')) {
        flush();
        deck = line.slice(1).split(/\s+/)[0];
        continue;
      }

      // 티어 헤딩 (### Foundation|…) — 종결자 + 티어 갱신
      const tierMatch = line.match(TIER_RE);
      if (tierMatch) {
        flush();
        tier = TIER_BY_HEADING[tierMatch[1].toLowerCase()] ?? tier;
        continue;
      }

      // 기타 ATX 헤딩 — 섹션 경계 종결자
      if (HEADING_RE.test(line)) {
        flush();
        continue;
      }

      // 카드-시작: 인라인코드 밖 첫 :: + 비공백 질문
      const di = firstDelimiter(line);
      if (di !== -1 && line.slice(0, di).trim().length > 0 && deck && tier) {
        flush();
        curQuestion = line.slice(0, di).trim();
        answerLines = [line.slice(di + 2)];
        continue;
      }

      // 이어쓰기(카드 열림) 또는 무시
      if (curQuestion !== null) answerLines.push(raw);
    }

    flush(); // EOF
  }

  // 덱 집계 (변경 없음)
  const deckMap = new Map<string, Deck>();
  for (const card of cards) {
    let d = deckMap.get(card.deck);
    if (!d) {
      const path = card.deck.split('/');
      d = { id: card.deck, name: path[path.length - 1], path, cardCount: 0 };
      deckMap.set(card.deck, d);
    }
    d.cardCount++;
  }

  return { version, decks: Array.from(deckMap.values()), cards };
}
```

> 주의: `flush`가 `deck`/`tier` null이면 카드 폐기(카드-시작은 deck&tier 있을 때만 열리므로 정상 경로에선 항상 set). `sourceHash`의 `\0`는 **리터럴 NUL 유지**(절대 공백/문자로 변경 금지). `answerLines`에 `raw`를 넣어 들여쓰기 보존, 분리·질문 추출은 `line`(trim) 사용.

- [ ] **Step 4: sourceHash 가드 확인**

기대값 `0ff541`은 이미 테스트에 박혀 있다(리뷰 검증). 구현이 NUL 구분자를 유지하면 통과, 공백 등으로 바꿨으면 `104360`이 나와 실패한다. 만약 이 테스트가 실패하면 hashContent 줄의 구분자를 NUL로 되돌렸는지 확인.

- [ ] **Step 5: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: 기존 9개 + 신규 멀티라인 케이스 전부 PASS. **CLI(`scripts/parse-vault.test.ts`)·플러그인(`obsidian-plugin/serialize.test.ts`) parity 테스트도 그대로 통과**(parseVault 재사용).

- [ ] **Step 6: 타입체크 + 빌드 + lint**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: 전부 통과. (`firstDelimiter`/상수 미사용 경고 없게 — 모두 사용됨.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/obsidian.ts src/lib/obsidian.test.ts
git commit -m "feat(parser): multi-line answers (:: continuation, fence/inline-code aware)"
```

---

### Task 2: 문서 · ROADMAP · PR

**Files:**
- Modify: `docs/obsidian-guide.md`, `ROADMAP.md`

- [ ] **Step 1: obsidian-guide 멀티라인 작성법 추가**

`docs/obsidian-guide.md`의 "답변 마크다운" 절을 확장:
- `질문?::` 다음 줄들에 코드펜스/문단/리스트를 쓰면 다음 카드(또는 `### 티어`·`#flashcard`·다음 헤딩) 전까지 한 답변으로 묶인다는 설명 + 예시.
- 단일 제약 명시: 답변 줄에 날것 `::`가 있으면(코드/인라인코드 밖) 새 카드로 오인되니, `::`는 ```펜스``` 또는 `` `인라인` ``으로 감싸라.

- [ ] **Step 2: README 보정(해당 시)**

`README.md`에 `질문?::답변`을 단일 줄로만 묘사한 곳이 있으면 멀티라인 가능으로 한 줄 보정. (없으면 생략.)

- [ ] **Step 3: ROADMAP 기록**

`ROADMAP.md` Phase 5에 항목 추가/표시:
```
### 5-5. 노트→카드 파서 강화 (완료)
- [x] 멀티라인 답변 — 코드펜스·문단·리스트를 `::` 이어쓰기로(펜스/인라인코드 인식). in-app·CLI·플러그인 공통.
- 5-4 이미지 카드는 이 위에서 확장 예정.
```

- [ ] **Step 4: 최종 게이트 + Commit + PR**

Run: `npx tsc -b && npm run typecheck:scripts && npm run typecheck:plugin && npm run lint && npx vitest run && npm run build && npm run build:plugin`
Expected: 전부 통과.

```bash
git add docs/obsidian-guide.md README.md ROADMAP.md
git commit -m "docs(parser): multi-line answer authoring guide + ROADMAP"
git push -u origin feat/multiline-answers
gh pr create --title "feat: 멀티라인 답변 파서 (노트→카드 파이프라인 강화)" --body "..."
```

PR 본문에 요약·3진입점 공통 수혜·하위호환(기존 9테스트 유지)·`::` 제약 명시.

---

## 검증 게이트 요약

Task 1: `npx vitest run`(기존 9 + 신규 + CLI/plugin parity) + `tsc -b`·`lint`·`build`. Task 2: 전체 게이트(typecheck:scripts/plugin 포함) + PR. 회귀 1순위: 기존 9개 obsidian 테스트 유지.
