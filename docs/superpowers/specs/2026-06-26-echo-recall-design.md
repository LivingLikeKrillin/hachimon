# 재소환 PWA (echo, v1) — 안착 노트 폰 재소환 설계

> 상태: 설계 승인됨(2026-06-26, 핵심 상호작용·표면·아키텍처·소비범위 사용자 승인 / 구현까지 자율 위임).
> LogOS의 마지막 루프 — 안착된 prose 노트를 폰에서 **주기적으로 다시 읽고 가벼운 신호**를 줘 체화시키는 모바일 PWA. working name **echo**(메아리·기억이 되울림; 브랜딩 잠정).
> 형제 모듈: capture(폰 캡처)·anchor(데스크톱 허브)·Hachimon(기술 플래시카드 복습). echo는 **비-기술 prose 노트의 재소환**을 담당.

## 1. 목적

LogOS는 "더 쌓기가 아니라 이미 가진 것을 체화·자가평가하는 개인 지식 OS"다. capture/anchor가 통찰을 Obsidian에 **안착**시키지만, **소급(재방문)이 없으면 안착된 노트도 금방 빛을 잃는다.** echo가 그 루프를 닫는다 — 안착된 감상·메모·짤 인사이트를 폰에서 자투리 시간에 다시 읽고, **울림/흐릿/졸업** 한 탭으로 가벼운 자가평가를 남겨 점진적으로 체화한다.

해결하려는 통증:
1. **안착 후 방치** — vault에 정착한 노트는 검색하지 않으면 다시 안 본다. echo가 주기적으로 떠올려 재접촉을 강제한다.
2. **lean-back 재소환** — 재읽기는 자투리 시간 폰 활동(Hachimon 복습처럼). 데스크톱 앞이 아니어도 체화가 이어지게.

### 비목표 (v1 아님)

- **등급·회상 테스트(SRS)** — Hachimon식 0~5 등급/회상 시험 아님. **재읽기 + 신호 1탭**만(저마찰).
- **write-back / 후속 생각 재캡처** — echo는 **순수 소비**. 재소환 중 떠오른 후속 생각은 기존 capture PWA로 따로 캡처(별개 파이프). vault·릴레이 쓰기 0.
- **기술 플래시카드** — Hachimon이 담당(`## Self-Test Anchors` Q&A). echo는 prose 노트만(`kind:` frontmatter 보유분).
- **데스크톱 재소환 면 / Obsidian 플러그인** — v1은 폰 PWA 한 표면.
- **풍부한 통계·소셜** — 최소 통계(연속일·재소환 수)만 선택적.

## 2. 더 큰 그림 — LogOS에서의 위치

LogOS 공통 골격: `캡처(마찰0) → 인박스(staging) → 변환(AI) → Obsidian 안착 → **재소환**`. echo는 그 골격의 **마지막 단계**다.

| 모듈 | 역할 | repo |
|---|---|---|
| capture | 폰 짤·인사이트 캡처 → 릴레이 | capture(완성) |
| anchor | 릴레이 pull → AI 변환 → vault 안착(capture/reflection/memo 3 kind) | anchor(완성) |
| Hachimon | 기술 플래시카드 SRS 복습(폰) | hachimon(완성) |
| **echo(본 문서)** | **안착 prose 노트 폰 재소환(재읽기 + 신호)** | **echo(신규, 별도 repo)** |

핵심 원칙(시스템 합의): ① 정적 + 클라이언트-로컬(서버 상태 최소 — Hachimon이 cards.json+IndexedDB로 그렇게 하듯). ② 사적 콘텐츠는 토큰 게이트(capture 릴레이 패턴). ③ 저마찰(1탭). ④ 순수/부수효과 분리.

## 3. 결정 사항 (승인됨)

| 항목 | 결정 |
|---|---|
| 핵심 상호작용 | **재읽기 + 가벼운 신호**(울림/흐릿/졸업 1탭). 등급·테스트 없음 |
| 표면 | 새 **폰 PWA**(React/Vite/Tailwind/shadcn — Hachimon 스택 시드 재사용). Hachimon과 별개 앱 |
| 저장소 | 별도 repo `echo`(독립 배포). 디자인 토큰·idb·PWA 설정은 Hachimon/capture에서 가져와 재사용 |
| 소비 범위 | **순수 소비** — 신호·스케줄은 폰 IndexedDB. vault·릴레이 write-back 없음 |
| 콘텐츠 피드 | vault 스캔 → 정적 `notes.json`(LogOS `kind` 보유 안착 노트). publish CLI |
| 호스팅·보안 | **토큰-게이트**(사적 감상) — capture식 **Cloudflare Worker + Bearer 토큰**으로 notes.json 서빙 |
| 스케줄 | **Leitner류 stage**(2d→5d→12d→30d→90d…). 신호가 stage 전이(SM-2 등급 아님) |
| 콘텐츠 선택 | `kind: reflection/memo/capture` frontmatter 보유 vault 노트 전체(`recall: false` opt-out은 후속) |

## 4. 아키텍처 (Hachimon/capture 미러)

```
[PC] Obsidian vault (kind: reflection/memo/capture 노트)
  → [publish CLI]  vault 스캔 → notes.json 생성 + 토큰 게이트 호스팅에 배포
        │   [Cloudflare Worker]  GET /notes  (Bearer 토큰) → notes.json(R2 또는 KV)
[폰] echo PWA  ── GET /notes (Bearer) ──┘
  → IndexedDB merge(notes 풀 + recall 스케줄)
  → 재소환 세션: due 노트 재읽기 → 울림/흐릿/졸업 1탭 → 스케줄 stage 갱신(IndexedDB)
```

흐름: vault 안착 노트 → (publish) notes.json → 폰 fetch·merge → 자투리 시간 재소환 세션 → 신호로 다음 등장 시점 조정.

### 4.1 컴포넌트 / 모듈 경계

| 모듈 | 책임 | 의존 | 테스트 |
|---|---|---|---|
| `pwa: src/lib/schedule.ts` | 재소환 스케줄 도메인: stage 전이(울림/흐릿/졸업)·다음 due 계산·due 선별 | 없음(순수) | 단위 |
| `pwa: src/lib/merge.ts` | notes.json ↔ IndexedDB 머지(신규/내용변경/삭제, recall 상태 보존) | 없음(순수) | 단위 |
| `pwa: src/lib/db.ts` | IndexedDB 래퍼(idb): `notes`·`recall`·`settings` 스토어 | idb | 얇음(통합) |
| `pwa: src/lib/fetch-notes.ts` | 토큰 헤더로 `/notes` fetch | fetch | 얇음(모킹) |
| `pwa: src/lib/markdown.ts` | 본문 마크다운 렌더(react-markdown, Hachimon 재사용) | react-markdown | 단위 |
| `pwa: src/pages/*` | Home·RecallSession·Settings(+선택 Stats) | 위 + idb | 수동(UI) |
| `worker: src/relay.ts` | `GET /notes`(Bearer 검증) → notes.json 반환; `PUT /notes`(publish 업로드, 토큰) | R2/KV | 얇음(miniflare) |
| `scripts: publish-notes.ts` | vault 스캔 → notes.json 조립 → Worker로 PUT(또는 Pages 배포) | fs | 단위(vault 픽스처) |

순수 코어(`schedule`·`merge`·`markdown`)는 부수효과 없음. I/O(idb·fetch·fs·Worker)는 얇은 어댑터로 격리(Hachimon/capture 패턴).

### 4.2 데이터 모델

```ts
// notes.json (정적 피드)
interface NotesFeed {
  version: string;        // 배포 타임스탬프
  notes: FeedNote[];
}
interface FeedNote {
  id: string;             // captureId(안정 키)
  kind: 'reflection' | 'memo' | 'capture';
  title: string;
  body: string;           // 노트 본문 마크다운(frontmatter·임베드 제거된 prose)
  source: string;         // 출처/원본 파일명
  tags: string[];
  createdAt: string;      // ISO
  sourceHash: string;     // 내용 해시(머지 갱신 판정)
}

// IndexedDB 스토어
// notes:    { id, kind, title, body, source, tags, createdAt, sourceHash }
// recall:   { id, stage, nextRecallAt, lastRecalledAt, signalLog, retiredAt? }
// settings: { key, value }   // feedUrl, token, sessionSize

interface RecallState {
  id: string;
  stage: number;          // Leitner stage(0부터)
  nextRecallAt: string;   // ISO
  lastRecalledAt: string | null;
  retiredAt: string | null; // 졸업 시각(있으면 풀에서 제외)
}
```

## 5. 콘텐츠 선택 + publish + notes.json

- **선택:** vault 노트 중 frontmatter `kind`가 `reflection`/`memo`/`capture`인 안착 노트(= LogOS 캡처들). Hachimon 기술노트는 `kind:` 없어 자동 제외. (후속 `recall: false` opt-out.)
- **publish CLI**(`scripts/publish-notes.ts`, capture `sync-captures`·Hachimon `parse-vault` 패턴): vault 디렉토리 스캔 → 각 노트 frontmatter+본문 파싱 → `FeedNote` 조립(본문은 frontmatter·임베드 라인 제거한 prose, `sourceHash`=본문 해시) → `notes.json` → **Worker `PUT /notes`**(토큰)로 업로드. 수동 + 윈도우 작업 스케줄러(capture 미러).
- `id`=frontmatter `captureId`(없으면 파일 경로 해시). 안정 키라 폰 recall 상태가 재배포 간 보존.

## 6. 재소환 스케줄 (`lib/schedule.ts`, 순수)

저마찰 Leitner류. **등급(0~5) 아님 — 신호 3개가 stage를 움직인다.**

```ts
const INTERVALS_DAYS = [2, 5, 12, 30, 90, 180]; // stage별 간격(상한 후 유지)

// 신호 전이
// 울림(resonates): stage = min(stage+1, max)  → 간격 늘림(잘 체화됨)
// 흐릿(faded):     stage = max(stage-1, 0)     → 곧 재등장(덜 체화)
// 졸업(done):      retiredAt 설정              → 풀에서 영구 제외
function applySignal(s: RecallState, signal: 'resonates'|'faded'|'done', now: string): RecallState
function nextRecallAt(stage: number, from: string): string  // from + INTERVALS_DAYS[stage]
function selectDue(states: RecallState[], now: string, n: number): string[] // 미은퇴 due, overdue·오래된 우선 + 약간 serendipity
```

- 신규 노트(merge로 추가): stage 0, `nextRecallAt`=now(즉시 풀 진입).
- 세션 크기 N(기본 ~10): `selectDue`가 due(미은퇴) 중 overdue·오래된 우선으로 N개. due 부족 시 그만큼만.
- 결정성: `selectDue`의 serendipity는 seed 주입(테스트 가능).

## 7. merge (notes.json → IndexedDB) — Hachimon 미러

| 상태 | 동작 |
|---|---|
| 피드에 있고 로컬에 없음 | `notes` 추가 + `recall` 초기 상태(stage 0, 즉시 due) |
| 같은 id, `sourceHash` 다름 | `notes` 본문/제목/태그 갱신, **`recall` 스케줄 유지** |
| 같은 id, `sourceHash` 동일 | 무시 |
| 로컬에 있고 피드에 없음 | `notes`+`recall` 제거(vault에서 삭제된 노트) |

`merge(feed, localNotes, localRecall, now)` → `{ notesUpserts, notesDeletes, recallInits }`(순수, 부수효과는 db 어댑터).

## 8. 보안 / 프라이버시

안착 prose = 사적 감상이라 **공개 정적 URL 금지**. capture 릴레이 패턴 재사용:
- **Cloudflare Worker**가 `GET /notes`를 **Bearer 토큰** 검증 후 서빙(notes.json은 R2 또는 Worker KV). publish CLI는 `PUT /notes`(같은 토큰)로 업로드.
- echo PWA 설정에 피드 URL·토큰 1회 입력 → fetch 후 **IndexedDB 캐시**(오프라인 재소환 가능, 토큰은 fetch에만).
- 강한 토큰(capture와 동급), 토큰 미설정 시 fetch 비활성+안내.

## 9. 앱 화면 (Hachimon 토큰 재사용)

| 화면 | 내용 |
|---|---|
| **Home** | due 카운트 + "재소환 시작" 원탭. (선택) 연속일·총 재소환 수 |
| **RecallSession** | 노트 카드(제목 + 렌더 본문, 출처·kind 뱃지) → **울림 / 흐릿 / 졸업** 3버튼(하단 고정) → 다음. 진행 바 |
| **Settings** | 피드 URL·토큰, 세션 크기 슬라이더, 수동 새로고침(fetch+merge), 데이터 리셋 |

모바일 최적화·디자인 토큰은 Hachimon 그대로(zinc/gold, 393px, 탭바, 하단 고정 버튼).

## 10. 에러 처리 · 오프라인

| 지점 | 실패 | 처리 |
|---|---|---|
| fetch `/notes` | 오프라인/토큰 오류 | 기존 IndexedDB 캐시로 재소환 계속(오프라인 우선). 비침습 표시, 다음 새로고침 재시도 |
| 토큰 미설정 | — | fetch 비활성 + 안내. 캐시 있으면 재소환은 가능 |
| 빈 풀 / due 0 | — | "오늘 재소환할 노트가 없습니다" 빈 상태 |
| merge 충돌 | — | id 기준 멱등, recall 상태 보존(내용만 갱신) |
| publish | vault 없음/Worker 오류 | CLI 에러 종료(코드 1), 기존 notes.json 유지 |

## 11. 테스트 전략

- **단위(vitest, 순수)**: `schedule`(stage 전이 울림/흐릿/졸업·nextRecallAt·selectDue 결정성[seed]), `merge`(4상태 + recall 보존), `markdown`(렌더), `publish-notes` 조립(vault 픽스처 → FeedNote, frontmatter/임베드 제거·sourceHash).
- **얇은 어댑터**: `fetch-notes`(Bearer 헤더·비2xx throw 모킹), `db`(idb 통합), `worker/relay`(miniflare: 토큰 검증·GET/PUT).
- **PWA 런타임 스모크**: Playwright 모바일(렌더+세션 1회+IndexedDB 영속), Hachimon 패턴.
- **수동 e2e(사용자)**: publish(vault→notes.json→Worker) → 폰 PWA fetch → 재소환 세션 → 신호 후 due 변화·재방문 확인.

## 12. 완료 기준 (v1 DoD)

- [ ] publish CLI가 vault의 `kind` 보유 안착 노트를 notes.json으로 조립해 토큰 게이트 호스팅에 배포.
- [ ] echo PWA가 토큰으로 fetch → IndexedDB merge(신규 추가·내용갱신·삭제, recall 보존).
- [ ] 재소환 세션에서 due 노트를 재읽기하고 울림/흐릿/졸업 1탭 → stage 전이로 다음 등장 시점이 바뀐다(울림=멀리, 흐릿=가까이, 졸업=은퇴).
- [ ] 오프라인에서 캐시로 재소환 지속.
- [ ] 순수 코어(schedule·merge·markdown·publish 조립) 단위 테스트 + 어댑터(fetch·db·worker) + PWA 스모크 green. lint·tsc·build 통과.
- [ ] 사적 콘텐츠가 토큰 없이는 노출 안 됨(Worker Bearer 게이트).

## 13. 비고

- 스케줄은 Leitner stage로 시작 — 저마찰 3신호엔 충분. FSRS-lite 전환은 후속(데이터 쌓인 뒤).
- write-back(후속 생각 재캡처)·데스크톱 면·opt-out frontmatter·풍부한 통계는 후속.
- 콘텐츠 선택은 `kind` frontmatter 기준 — anchor가 승격 시 `kind`를 보존하므로(stripStagingFrontmatter가 status만 제거) 그대로 잡힌다.
- working name `echo`는 잠정. 브랜딩(capture↔anchor↔echo 일관성)은 사용자 몫.
