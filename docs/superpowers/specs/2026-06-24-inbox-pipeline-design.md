# 인박스 → 노트 → 분류 → 퀴즈 생성 파이프라인 설계

> 상태: 설계 승인됨(2026-06-24). 구현 계획 작성 전 단계.

## 1. 목적

Obsidian 인박스의 raw 캡처(.md)를 Claude로 **정리된 노트 + 분류 + 3-tier 퀴즈 카드**가 담긴 draft로 변환하는 CLI 도구. Hachimon 카드 저작의 상류(upstream) 단계를 자동화한다. 생성물은 draft 폴더에 쌓이고, 사용자가 Obsidian에서 검토·수정 후 vault로 옮기면(승격) 기존 `parse-vault`/플러그인이 `cards.json`으로 빌드한다.

비목표:
- 완전 자동 vault 반영(품질 게이트로 draft→승격 사람 검수 단계 유지).
- 앱 런타임 인라인/생성(앱은 정적 `cards.json`만 소비).
- 인박스 캡처 자체의 작성(사용자가 평소처럼 Obsidian으로 캡처).

## 2. 배경 / 기존 자산

- 노트 포맷(단일 진실원천 파서 `src/lib/obsidian.ts` `parseVault`): `## Self-Test Anchors` 아래 `#flashcard/<deck>` 덱 태그 → `### Foundation|Mechanism|Diagnosis` 티어 → `질문?::답변`(멀티라인 지원).
- 빌드 경로: `scripts/parse-vault.ts`(Node/TS CLI, sharp 이미지 인라인), `obsidian-plugin/`(Canvas 인라인). 둘 다 `parseVault` 재사용.
- 덱은 **태그로 결정**된다(폴더 무관). 따라서 draft를 vault 어디로 옮겨도 덱 분류가 보존된다.
- 기존 CLI 패턴: `scripts/*.ts`를 `tsx`로 실행, `tsconfig.scripts.json`으로 타입체크, `vitest`로 순수 로직 테스트.

## 3. 결정 사항(승인됨)

| 항목 | 결정 |
|------|------|
| 실행 형태 | Node/TS CLI (`scripts/inbox.ts`, `npm run inbox`) |
| 생성 엔진 | Claude API (`@anthropic-ai/sdk`), 기본 모델 `claude-opus-4-8` |
| 인박스 입력 | 지정 폴더의 raw `.md` 파일들(각 1건 = 1 노트) |
| 검수 | draft → 사람이 Obsidian에서 검토 후 승격(이동) |
| LLM 호출 구조 | **하이브리드 2회/노트**: ①노트정리+분류 한 호출, ②퀴즈 생성 전용 호출(adaptive thinking) |

## 4. 아키텍처

```
inbox/*.md (raw 캡처)
  → [1 수집]    인박스 폴더 .md 읽기
  → [2+3 호출]  structure+classify → { title, body, deck, rationale }
  → [4 호출]    quiz-gen(adaptive) → { foundation[], mechanism[], diagnosis[] }
  → [조립]      노트 본문 + `## Self-Test Anchors`(#flashcard/<deck> + 3-tier 질문?::답변)
  → [검증]      parseVault(draft) 로 ≥1 카드 파싱 확인
  → _forge-drafts/<deck>/<slug>.md 저장(draft frontmatter)
  → 사용자 검토·승격(이동) → parse-vault/플러그인 → cards.json
```

### 4.1 모듈 경계

| 모듈 | 책임 | 의존 | 테스트 |
|------|------|------|--------|
| `src/lib/forge/schema.ts` | zod 스키마 2종(`StructureResult`, `QuizResult`) + TS 타입 | zod | 단위(파싱·거부) |
| `src/lib/forge/prompts.ts` | 프롬프트 빌더 2종(structure+classify, quiz). 기존 덱 목록·티어 루브릭을 문자열로 주입 | 없음(순수) | 단위(주요 토큰 포함 여부) |
| `src/lib/forge/decks.ts` | 기존 덱 목록 추출: `cards.json` 또는 vault `parseVault` 결과에서 유니크 덱 경로 수집 | obsidian.ts | 단위 |
| `src/lib/forge/assemble.ts` | 노트 조립: 본문 + `## Self-Test Anchors` 블록 생성, slug 생성, draft frontmatter | 없음(순수) | 단위(라운드트립: 조립→parseVault→카드≥1) |
| `scripts/inbox.ts` | CLI: 인자 파싱, fs I/O, Claude 호출, 오케스트레이션, draft 쓰기 | 위 전부 + sdk | 인자 파서 단위 테스트 |

`src/lib/forge/*`는 **부수효과 없음**(파일/네트워크 접근 없음). 모든 I/O와 Claude 호출은 `scripts/inbox.ts`에 격리한다. Claude 호출은 `inbox.ts` 내부에서 resolver 형태의 두 async 함수(`structureAndClassify`, `generateQuiz`)로 두고, 오케스트레이션은 순수 데이터 변환과 분리한다.

### 4.2 데이터 흐름 타입

```ts
// schema.ts (zod)
StructureResult = { title: string; body: string; deck: string; rationale: string }
QuizResult = {
  foundation: { q: string; a: string }[];
  mechanism:  { q: string; a: string }[];
  diagnosis:  { q: string; a: string }[];
}
```

- `deck`은 슬래시 구분 경로(예: `spring/core`). 프롬프트가 기존 덱 목록을 주고 "가장 적합한 기존 덱을 고르되, 명백히 새 주제면 새 경로 제안" 지시. 최종 태그는 `#flashcard/<deck>`.
- 각 티어 카드는 1개 이상(프롬프트가 티어당 1~3개 권장, 본문이 빈약하면 일부 티어 0개 허용). `q`는 `?`로 끝나는 질문, `a`는 멀티라인 마크다운 가능.

### 4.3 노트 조립 포맷(`assemble.ts`)

```markdown
---
hachimon: draft
deck: <deck>
created: <ISO>
---
# <title>

<body>

## Self-Test Anchors
#flashcard/<deck>

### Foundation
<q>?::<a>
...

### Mechanism
...

### Diagnosis
...
```

- `q`에 이미 `?`가 있으면 중복 추가 금지(끝이 `?`가 아니면 1개 부여). `::` 앞뒤 공백은 파서 규칙에 맞춤.
- 답변이 멀티라인이면 다음 카드/티어/헤딩 전까지 그대로 둔다(파서의 멀티라인 규칙과 호환).
- 빈 티어는 해당 `### Tier` 헤딩을 생략한다(빈 헤딩으로 인한 파싱 노이즈 방지).
- **slug/카드ID 유일성 범위**: draft 파일 `<slug>.md`의 유일성은 `<drafts-dir>` 내부 한정(§7의 `-2`/`-3` 회피). 한편 `parseVault`는 카드 ID를 **파일 basename 기준**으로 생성하므로(`obsidian.ts` slugify), 서로 다른 덱이라도 제목이 동일 slug로 떨어지면 vault 빌드 시점에 카드 ID 접두가 충돌할 수 있다. 이는 기존 `parse-vault.ts`의 `warnDuplicateBasenames` 경고 범위이며 본 도구가 새로 만드는 문제는 아니다(범위 외, 메모만).

### 4.4 검증 게이트

조립된 draft 문자열을 `parseVault([{name, content}], version)`에 통과시켜 **카드 ≥1**을 확인한다. 0개면 draft를 쓰지 않고 경고 + 해당 인박스 파일 보존. 이는 앱·CLI·플러그인과 동일한 단일 진실원천 파서로 "실제로 카드가 추출되는가"를 보증한다.

### 4.5 승격(staging) 모델

- draft 저장 위치: `<drafts-dir>/<deck>/<slug>.md` (기본 `_forge-drafts/`).
- `parse-vault.ts`의 `EXCLUDE_DIRS`에 `_forge-drafts`와 `inbox`(기본 인박스명)를 추가 → raw·draft가 카드로 빌드되지 않음.
- 사용자는 Obsidian에서 draft를 검토·수정 후 vault의 적절한 위치로 **이동**(승격). 덱은 태그로 결정되므로 이동 위치 무관. (선택) 승격 시 `hachimon: draft` frontmatter 제거는 사용자 몫이며 파싱에는 영향 없음.

## 5. CLI 인터페이스(`scripts/inbox.ts`)

```
Usage: inbox <inbox-dir> [options]
  -o, --out <dir>         draft 출력 폴더 (기본: _forge-drafts)
  --deck-source <path>    기존 덱 목록 소스: cards.json 경로 또는 vault 디렉토리 (기본: public/cards.json)
  --model <id>            Claude 모델 (기본: claude-opus-4-8)
  --dry-run               파일을 쓰지 않고 생성 결과를 콘솔에 출력
  --keep                  처리 성공 후에도 인박스 원본 파일 보존(기본: 성공 시 삭제)
```

- `ANTHROPIC_API_KEY` 환경변수 필수. 없으면 명확한 에러 후 종료(코드 1).
- 인박스 디렉토리/파일 없음, 빈 디렉토리 → usage 에러.
- 처리 결과 요약 출력: `✓ N개 처리 / M개 draft 생성 / K개 보류(파싱 0)`.

## 6. Claude API 사용(claude-api 스킬 준거)

- SDK: `@anthropic-ai/sdk`(TypeScript). 클라이언트는 env에서 키 자동 해석.
- **호출①(structure+classify)**: `client.messages.parse()` + `zodOutputFormat(StructureResult)`. 기본 효율 위해 thinking 미설정 가능(단순 추출/분류). `max_tokens` ~16000.
- **호출②(quiz)**: `client.messages.parse()` + `zodOutputFormat(QuizResult)`, `thinking: { type: "adaptive" }`, `max_tokens` ~16000(비스트리밍). 멀티 카드·티어 루브릭 추론이 필요해 호출①보다 무겁다. `parse()`는 스트리밍과 결합하지 않으므로, 출력이 16000을 넘쳐 `stop_reason: "max_tokens"`가 나오면 `max_tokens`를 올리거나 노트를 분할한다(현재 범위에선 16000 고정으로 시작, 후속 튜닝).
- 모델 ID는 `claude-opus-4-8` 정확 문자열(날짜 접미사 금지). `--model`로 override.
- 에러: SDK 타입 예외 분기(`RateLimitError` 등은 재시도 가능 안내, 그 외 노트 단위 실패 처리). 노트별 try/catch로 한 건 실패가 전체를 막지 않게.

## 7. 에러 핸들링 / 엣지 케이스

| 상황 | 동작 |
|------|------|
| `ANTHROPIC_API_KEY` 없음 | 즉시 에러 종료(코드 1) |
| 인박스 디렉토리 없음/빈 폴더 | usage 에러 종료 |
| 덱 소스(cards.json) 없음 | 경고 + 빈 덱 목록으로 진행(모든 노트가 새 덱 제안 대상) |
| Claude 호출①/② 실패(노트 단위) | 경고 로그 + 인박스 파일 보존 + 다음 노트 진행 |
| 검증 게이트 0 카드 | draft 미작성 + 보류 카운트 + 인박스 파일 보존 |
| slug 충돌(동일 파일명) | `-2`,`-3` 접미사로 회피 |
| `--dry-run` | 파일 미작성, 생성 노트/카드 콘솔 출력, 인박스 파일 미삭제 |
| 부분 성공 | 성공분만 draft 작성·인박스 삭제(`--keep` 아니면), 실패분 보존 |

## 8. 의존성 변경

- 추가: `zod`는 **dependencies**(런타임 — `src/lib/forge/schema.ts`가 임포트, app tsconfig가 컴파일 대상에 포함). `@anthropic-ai/sdk`는 **devDependencies**(CLI 전용 — `scripts/inbox.ts`만 `tsx`로 사용, 앱 번들 미포함).
- `package.json` scripts: `"inbox": "tsx scripts/inbox.ts"`.
- `tsconfig.scripts.json` include는 이미 `scripts/**/*.ts` + 임포트되는 `src/lib/forge/*`를 커버(임포트 그래프로 포함). DOM lib 불필요(순수 Node).
- `scripts/parse-vault.ts` `EXCLUDE_DIRS`에 `_forge-drafts`, `inbox` 추가.

## 9. 테스트 전략

순수 로직 위주(`vitest`, 네트워크/Claude 호출은 테스트하지 않음):
- `schema.test.ts` — zod 파싱 성공/실패(필드 누락·타입 오류 거부).
- `prompts.test.ts` — 빌더가 덱 목록·티어 루브릭·노트 본문을 프롬프트에 포함.
- `decks.test.ts` — cards.json/vault에서 유니크 덱 경로 추출, 중복 제거, 정렬.
- `assemble.test.ts` — 조립 결과가 **실제 `parseVault`(스텁 아님)** 로 **라운드트립**되어 카드가 추출됨(핵심 게이트); `?` 중복 방지; 빈 티어 헤딩 생략; slug 생성.
- `inbox.args.test.ts` — CLI 인자 파서(기본값, 플래그, 값 누락 시 usage 에러). 기존 `scripts/parse-vault.ts`의 `parseArgs`(값 요구 플래그는 USAGE throw) 형태를 그대로 재사용해 일관성 유지.

수동 검증: 샘플 인박스 파일 1~2개로 `--dry-run` 실행해 실제 Claude 출력이 게이트를 통과하는지 확인(키 필요, 사용자 환경).

## 10. 미해결/후속(YAGNI로 현재 범위 제외)

- 플러그인/인앱에서의 인박스 처리 UI — 후속(키 관리·비동기 호출 복잡). 현재 CLI만.
- 중복 노트 감지/병합 — 후속.
- 배치/비용 최적화(Batches API) — 인박스는 보통 소량이므로 현재 불필요.
- 자동 승격 — 의도적으로 사람 검수 유지(비목표).
