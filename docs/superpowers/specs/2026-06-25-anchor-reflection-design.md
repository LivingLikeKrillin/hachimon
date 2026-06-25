# anchor 감상 기록 (reflection kind) — 텍스트 우선 감상 로깅 설계

> 상태: 설계 승인됨(2026-06-25, 입력모델·세션단위·추적면·AI역할·아키텍처 사용자 승인 / 구현까지 자율 위임).
> 이 문서는 LogOS(개인 지식 OS)의 한 증분 — 데스크톱 허브 `anchor`에 **두 번째 입력 종류(kind)**인 책·영화·애니·만화 **감상 기록**을 더한다.
> 선행 문서: `2026-06-25-desktop-hub-design.md`(anchor v1, capture kind). 본 증분은 그 골격(staging·변환·승격) 위에 reflection kind를 얹는다.

## 1. 목적

데스크톱에서 **러프하게 친 감상 세션 메모**(책 일부 읽고 든 생각, 영화·애니 본 소감)를 받아 Claude가 **타입별 규격으로 정리**하고, 사람이 **1초 확인 후 한 번의 승격**으로 Obsidian vault에 안착시킨다. 독립 세션 노트이되 **같은 작품의 세션들이 자동 허브(MOC)로 모인다.**

해결하려는 통증:
1. **감상의 휘발** — 책·영화·애니를 보며 든 생각은 그 순간 안 적으면 사라진다. Obsidian에 격식대로 쓰긴 부담스러워 안 쓴다(시스템 1원칙). 마찰 0 데스크톱 입력 표면이 필요.
2. **전체 회고의 농도 저하** — 다 본 뒤 한 번에 회고하면 per-moment 통찰이 옅어진다. **점진 세션 로그**(일부 보고 바로 기록)로 농도를 보존해야 한다.
3. **흩어진 세션의 재결합** — 세션이 독립 노트로 흩어지면 "이 작품에 대해 내가 뭘 느꼈나"를 한눈에 못 본다. 작품 단위 **추적 면**이 필요.

### 비목표 (v1 아님)

- **이미지 첨부** — 감상은 텍스트 전용. 표지·페이지·스크린샷 첨부는 후속(capture kind의 이미지 경로와 합류 가능).
- **폰 캡처 PWA 확장** — 입력은 데스크톱 직접 입력만. capture repo·릴레이는 **건드리지 않음**.
- **작품 사실 보강** — Claude는 사용자 메모를 정리·태깅만. 저자·연도·줄거리 등 작품 사실은 **지어내지 않음**(환각 방지).
- **작품 누적 노트** — 세션을 한 노트에 append하지 않음(promote-once 모델 보존). 모음은 허브 노트가 담당.
- **평점·원메모 이중저장** — v1 미포함(후속 검토).
- **재소환 루프** — 안착된 감상의 주기적 다시보기는 후속(LogOS 모듈 5).

## 2. 더 큰 그림 — LogOS에서의 위치

LogOS 공통 골격: `캡처(마찰0) → 인박스(staging) → 변환(타입별 규격, AI) → Obsidian 안착 → 재소환`. 핵심 원칙: **다각화 = 여러 기능이 아니라 하나의 관에 여러 입력 타입.** 짤·인사이트(capture kind)와 감상(reflection kind)이 **같은 staging·변환·승격 파이프**를 탄다.

| 입력 종류(kind) | 입구 | 매체 | 변환 |
|---|---|---|---|
| `capture` (anchor v1) | 폰 캡처 PWA → 릴레이 | 이미지(짤) | Claude **vision**(OCR+추출) |
| **`reflection` (본 증분)** | **데스크톱 직접 입력** | **텍스트(감상 세션)** | Claude **텍스트 정리**(정리+태깅) |

reflection은 anchor의 **2층 구조 데스크톱 면**을 텍스트 deep-capture로 확장한다(폰=빠른 캡처, 데스크톱=깊은 정리). 후속의 윈도우 메모장 .txt 인박스(LogOS 모듈 4)도 같은 reflection 골격의 또 다른 입구로 합류 예정.

## 3. 결정 사항 (승인됨)

| 항목 | 결정 |
|---|---|
| 입력 모델 | **데스크톱 직접 입력(텍스트 우선)**. anchor repo만 변경. 릴레이·capture repo 불변 |
| 세션 단위 | **세션 = 독립 노트 1개**(기존 anchor "1항목=1노트=1승격" 모델 보존) |
| 추적 면 | **자동 허브 노트(MOC)** — 작품당 1개, 승격 시 anchor가 없으면 생성/있으면 세션 링크 멱등 append |
| 작품 동일성 | `workKey = ${medium}-${slug(workTitle)}` 결정적 slug. 입력 UI의 "최근 작품" 픽커로 안정 공유 |
| AI 역할 | **정리 + 태깅**. 작품 사실 보강 안 함(환각 방지), 사용자 voice 보존 |
| 아키텍처 | **별도 `reflection` kind, 골격 공유**. `kind` 판별자 도입. `CaptureMeta`(릴레이 미러) 불변 |
| 변환 엔진 | Claude API 텍스트(`messages.parse`+`zodOutputFormat`), 모델 `claude-opus-4-8`. **이미지 블록 없음** |
| v1 매체 | `책 / 영화 / 애니 / 만화`(4종). 유튜브·팟캐스트 등은 리스트 한 줄 추가로 후속 |
| 레코드 발급 | 로컬 생성 — `id=randomUUID`, `createdAt=now()`(main에서 발급, 릴레이 무관) |

## 4. 아키텍처

```
[PC] anchor (Electron)
  ┌──────────────────────── main 프로세스 (Node) ─────────────────────────┐
  │ 기존 capture kind: 릴레이 pull → staging(이미지+raw) → vision 변환       │
  │ ── 신규 reflection kind ──────────────────────────────────────────────│
  │ A. reflection:create — 사용자 입력(매체·작품·진행·메모) → id·createdAt   │
  │    발급 → staging에 raw 노트(.md, 이미지 없음) 기록                      │
  │ B. transform:run — staging의 raw reflection 자동: 텍스트 정리(규격)      │
  │    → 노트를 transformed로 갱신                                          │
  │ C. item:promote — staging .md → vault 이동(status 제거) + 작품 허브 upsert│
  └───────────────────────────────────────────────────────────────────────┘
              ▲ IPC (contextBridge preload: reflection:create, reflection:works)
  ┌──────────────────────── renderer (React) ────────────┴─────────────────┐
  │ 새 감상 폼(매체 칩·최근작품 픽커·진행·세션 메모) · 트리아지(kind 분기)     │
  │ · 에디터(reflection 필드) · "변환 다시"/"승격"/"버리기"                   │
  └─────────────────────────────────────────────────────────────────────────┘
              │ 승격
              ▼
[Obsidian vault] 세션 노트(정본) + 작품 허브 노트(MOC, 세션 링크 목록)
```

흐름: 데스크톱 입력 → staging raw(reflection) → 자동 텍스트 변환 → 트리아지 1초 확인·수정 → 승격 → vault 세션 노트 + 허브 노트 갱신.

### 4.1 kind 판별자 — 골격 공유 원칙

staging의 한 항목은 `frontmatter.kind`로 종류가 갈린다. `kind` 부재 또는 `capture` = 기존 이미지 캡처, `reflection` = 신규 감상.

- **공유**(분기 없이 재사용): staging 폴더 구조, frontmatter `status`(raw/transformed) 생애주기, `parseNote`의 frontmatter 라인 파서 골격, `stripStagingFrontmatter`(status만 제거), 트리아지 목록·에디터 셸, 자동 변환 트리거(`auto()`), promote→removeItem 흐름.
- **분기**(kind별 구현): 메타 타입(`CaptureMeta` ↔ `ReflectionMeta`), 노트 조립(`assembleTransformed` ↔ `assembleReflection`), 변환(`transformCapture` vision ↔ `transformReflection` 텍스트), 승격 부수효과(이미지 이동 유무 + 허브 upsert), 입력 표면(릴레이 pull ↔ reflection:create), 에디터 필드, 목록 행 렌더(썸네일 유무).

### 4.2 모듈 경계 (신규/변경)

| 모듈 | 변경 | 책임 |
|---|---|---|
| `src/shared/types.ts` | 추가 | `REFLECTION_MEDIA`, `ReflectionMedium`, `ReflectionMeta`, `ReflectionTransform`, `StagingKind`. `StagingItem`을 **판별 유니온**으로 전환 |
| `core/note.ts` | 추가 | `reflectionBaseName`, `workKey`/`slug`, `assembleReflectionRaw`/`assembleReflectionTransformed`, `parseNote`에 reflection 분기. `union`(태그 합집합) 재사용 |
| `core/reflection-schema.ts` | 신규 | `ReflectionSchema`(zod): `{title, reflection, takeaway, tags}` |
| `core/hub.ts` | 신규 | `hubBaseName(meta)`, `assembleHub`, **`upsertHub(existingMd\|null, session)`**(순수: 생성/멱등 append) |
| `core/promote.ts` | 추가 | `reflectionPromoteTargets`(노트만, 이미지 없음). `stripStagingFrontmatter` 재사용 |
| `main/transform.ts` | 추가 | `buildReflectionPrompt(meta)`, `transformReflection(client, meta, model)`(이미지 블록 없음) |
| `main/staging-store.ts` | 추가 | reflection 분기: `writeReflectionRaw`/`writeReflectionTransformed`, `scan`이 kind 판별해 union 항목 반환, `removeItem`(이미지 없으면 노트만), **`upsertHubFile(vaultDir, session)`**(fs 래퍼) |
| `main/ipc.ts` | 추가 | `reflection:create`, `reflection:works`(픽커 소스), `transform:run`·`item:promote`에 kind 분기 |
| `main/settings.ts` | 추가(선택) | `reflectionSubdir`(기본 `감상`) — 세션·허브 노트 하위폴더 |
| `preload`, `renderer/api.d.ts` | 추가 | `createReflection`, `listWorks` 노출 |
| `renderer/components/*` | 추가/변경 | `ReflectionForm`(신규), `TriageList`·`ItemEditor` kind 분기 |

순수/부수효과 분리 유지: `core/*`(note·reflection-schema·hub·promote)는 fs·네트워크·DOM 없이 단위 테스트. `upsertHub`는 순수(문자열 in/out), fs 래핑은 main.

> 구현 노트(기존 `core/note.ts` 사실 확인 반영):
> - `union`·`frontmatter`·`embed`·`memoBlock`은 `core/note.ts` **모듈 비공개**다. reflection 조립을 **같은 `note.ts` 파일에 추가**하므로 직접 호출 가능(export 불필요). 다른 모듈로 빼낼 경우에만 export 필요.
> - 세션 노트 frontmatter는 reflection의 로컬 `id`를 **기존 `captureId` 키에 실어** 라운드트립한다(`parseNote`의 captureId 추출 재사용). 즉 `captureId`는 kind 무관 "레코드 id" 슬롯으로 본다(새 키 추가 안 함).
> - `StagingItem` 유니온 전환 시 기존 `scan`(`main/staging-store.ts`)의 capture 경로가 만드는 객체 리터럴에 **`kind:'capture'`를 명시 스탬프**해야 한다(기존 29 테스트 회귀 게이트 유지).

### 4.3 데이터 모델

```ts
// src/shared/types.ts (추가)
export const REFLECTION_MEDIA = ['book', 'movie', 'anime', 'manga'] as const;
export type ReflectionMedium = (typeof REFLECTION_MEDIA)[number];

/** 데스크톱 로컬 생성(릴레이 무관). CaptureMeta와 별개 — 미러 계약 오염 금지. */
export interface ReflectionMeta {
  id: string;          // 로컬 randomUUID
  createdAt: string;   // 로컬 ISO 8601(+09:00)
  medium: ReflectionMedium;
  workTitle: string;   // "사피엔스"
  workKey: string;     // `${medium}-${slug(workTitle)}` — 같은 작품 세션이 공유(추적 키)
  progress: string;    // 자유 텍스트 "p.40-60" / "S1E3" / "" (선택)
  note: string;        // 러프 세션 메모(사용자 원문 입력)
  source: string;      // 선택(링크 등)
  tags: string[];      // 사용자 입력 태그(선택)
}

/** Claude 텍스트 정리 출력(zod 강제). OCR 없음. */
export interface ReflectionTransform {
  title: string;       // 노트 제목
  reflection: string;  // 정리된 감상 본문
  takeaway: string;    // 핵심 한두 문장(빈 가능)
  tags: string[];      // AI 제안 태그(원본). 합집합은 core/note 조립이 수행
}

export type StagingKind = 'capture' | 'reflection';

// StagingItem을 판별 유니온으로 전환(기존 capture 경로는 kind:'capture' 분기)
export type StagingItem =
  | { kind: 'capture';    base: string; meta: CaptureMeta;    status: StagingStatus; transform?: TransformResult;    notePath: string; imagePath: string; error?: string }
  | { kind: 'reflection'; base: string; meta: ReflectionMeta; status: StagingStatus; transform?: ReflectionTransform; notePath: string; error?: string };
```

`slug(title)`: 소문자화, 공백→`-`, 구두점 제거, 한글 보존(예: `"The Matrix"`→`the-matrix`, `"사피엔스"`→`사피엔스`). 결정적이므로 같은 제목은 같은 key를 낳고, 픽커가 오타로 인한 key 분기를 막는다.

## 5. Staging 구조 & 생애주기

기존 staging 폴더 공유. reflection 항목 = 노트 1개(.md), **이미지 없음**. 결정적 베이스명 `reflectionBaseName(meta)` = `${접두사}-YYYY-MM-DD-<shortid>` (매체별 한글 접두사 `{book:'책', movie:'영화', anime:'애니', manga:'만화'}`).

```
<staging-dir>/
├── 짤-2026-06-25-a3f2....md + .webp     ← capture kind(기존)
├── 책-2026-06-25-b4c3....md             ← reflection kind(이미지 없음)
└── ...
```

상태 생애주기(공유): `raw`(입력 직후, 변환 전) → `transformed`(정리 끝, 검토 대기) → 승격(vault 이동 + 허브 upsert, staging에서 제거).

### 5.1 멱등 & 부분 실패

- **입력→변환**: `reflection:create`가 raw 노트를 staging에 쓴 직후 `auto()`가 텍스트 변환. 실패 시 raw 유지 + `transformError` frontmatter(capture kind와 동일 기전, `setTransformError` 재사용) → 다음 트리거 재시도.
- **승격 멱등**: 세션 노트 vault 대상에 같은 베이스명 있으면 경고(중복 안착 방지). **허브 upsert는 멱등** — 같은 세션 링크가 이미 있으면 재추가 안 함(`upsertHub`가 링크 존재 판정). 승격 성공 후에만 staging에서 제거.
- **허브 동시성**: v1 개인용·단일 인스턴스 전제로 허브 파일 read-modify-write 직렬. (동시 승격 락은 비목표.)

## 6. 변환 (Claude 텍스트) — claude-api 스킬 준거

`main/transform.ts`의 신규 `transformReflection`:

- **입력**: 텍스트만. **이미지 블록 없음**.
  ```ts
  messages: [{ role: 'user', content: [{ type: 'text', text: buildReflectionPrompt(meta) }] }]
  ```
- **프롬프트**(`buildReflectionPrompt`): 매체별 정리 관점 + 작품/진행/러프 메모 주입 + 출력 규격(title·reflection·takeaway·tags) + **명시 가드**: "사용자 메모 범위 내에서만 정리하라. 작품의 저자·연도·줄거리 등 외부 사실을 지어내지 마라. 사용자의 표현과 관점(voice)을 보존하라."
  - 매체별 관점(예): 책=논지·인상 구절·자기 생각 구분 / 영화·애니=감상·인상 장면·주제 / 만화=전개·연출·감상. (사실 단정 금지는 공통.)
- **구조화 출력**: `client.messages.parse({ output_config: { format: zodOutputFormat(ReflectionSchema) } })` → `parsed_output`. `!parsed_output`이면 throw(capture와 동일).
- **추론/모델**: `thinking: { type: 'adaptive' }`, `max_tokens` ~8000, 모델 `claude-opus-4-8`(설정 override). 텍스트-only라 vision보다 저렴.
- **에러 분기**: capture kind와 동일(키 없음=비활성+안내, API 에러=raw 유지+error, 노트 단위 격리).

## 7. 노트 / 허브 포맷

### 7.1 세션 노트 (`core/note.ts`)

transformed 상태:
```markdown
---
created: 2026-06-25T14:30:00+09:00
kind: reflection
medium: book
work: 사피엔스
workKey: book-사피엔스
progress: p.40-60
source: 
tags: [역사, 협력]
captureId: <uuid>
title: 허구가 협력을 낳는다
status: transformed
---
[[책-사피엔스 (감상)]]

## 감상
<AI가 정리한 감상 본문>

## 핵심
<takeaway 한두 문장>
```
- 첫 본문 줄에 허브 링크 `[[hubBaseName]]`(Obsidian 백링크로 작품↔세션 연결).
- `## 핵심`은 takeaway 비면 생략. 태그 합집합 `meta.tags ∪ transform.tags`(순서보존·중복제거, `union` 재사용).
- raw 상태 노트는 `## 감상`/`## 핵심` 없이 frontmatter(status:raw) + 허브링크 + `> 메모: <러프 메모>`.
- `parseNote`는 `kind: reflection` 감지 시 reflection 분기로 `ReflectionMeta`·`ReflectionTransform` 복원(라운드트립).

### 7.2 작품 허브 노트 (MOC) (`core/hub.ts`)

`hubBaseName(meta)` = `${접두사}-${workTitle} (감상)` (예: `책-사피엔스 (감상)`). 작품당 1개:
```markdown
---
kind: reflection-hub
medium: book
work: 사피엔스
workKey: book-사피엔스
tags: [감상허브]
---
# 사피엔스 — 감상 로그

## 세션
- [[책-2026-06-25-b4c3....]]
- [[책-2026-06-26-e5f6....]]
```
- **`upsertHub(existingMd | null, session)`**(순수): `null`이면 헤더+첫 세션 링크로 새 허브 생성. 존재하면 `## 세션` 목록에 `- [[sessionBase]]` 추가하되 이미 있으면 그대로 반환(멱등).
- 허브는 vault 정본(정본 청결 원칙에 부합 — 사람이 보는 모음 노트). `main/staging-store.upsertHubFile`이 fs read-modify-write로 래핑.

### 7.3 승격 (`core/promote.ts`)

- `reflectionPromoteTargets(base, { notesDir })` = `{ notePath: join(notesDir, base+'.md') }`(이미지 없음).
- `stripStagingFrontmatter` 재사용: `status:`만 제거. `kind`·`work`·`workKey`·`medium`·`progress`·`tags`·`title`은 **보존**(Obsidian Dataview/검색·허브 백링크 근거).
- 승격 순서: 세션 노트 vault 이동 → 허브 upsert → staging 제거(부분 실패 시 staging 유지, 재시도 안전).

## 8. 앱 화면 (renderer)

기존 anchor 셸·Hachimon 토큰 재사용. kind로 분기.

| 화면 | reflection 분기 내용 |
|---|---|
| **새 감상 폼**(신규, 시트/모달) | 매체 칩(책/영화/애니/만화) + **최근 작품 픽커**(자동완성, 기존 선택 시 workTitle·workKey 재사용 / 새 작품 직접 입력) + 진행(선택) + 세션 메모(textarea, 핵심) + source·tags(선택). 저장 → `createReflection` → 자동 변환 → 트리아지 등장 |
| **트리아지 목록** | reflection 행: 썸네일 없음. 매체 뱃지 + 작품 + 제목/메모 + status. capture 행과 한 목록에 공존(`transformed` 위, `raw` 아래) |
| **항목 에디터** | reflection: 이미지 뷰 대신 텍스트. 필드(제목·감상·핵심·태그·진행·작품·source). "변환 다시"/"승격"/"버리기" 공유 |

- 최근 작품 픽커 소스: `listWorks`(IPC `reflection:works`) — staging + vault 세션/허브 노트를 스캔해 distinct `{workKey, workTitle, medium}` 반환.
- 제로터치: `createReflection` 직후 자동 변환. 사람은 트리아지에서 스치고 승격만.

## 9. 에러 처리

| 지점 | 실패 | 처리 |
|---|---|---|
| reflection:create | 작품/메모 빈 값 | workTitle·note는 필수(폼 검증). progress·source·tags는 빈 값 허용 |
| 변환 | API 에러/키 없음 | raw 유지 + `transformError`(capture와 동일 기전). 키 없으면 비활성+안내, raw 수동편집·승격 가능 |
| 승격(노트) | fs 쓰기/대상 중복 | staging 유지, 재시도 안전. 대상 중복 경고 |
| 승격(허브) | fs 실패 | 세션 노트는 이미 vault에 있음 → 허브 upsert만 다음 승격/수동 트리거에 재시도(멱등이라 안전) |
| 작품 동일성 | 제목 오타로 key 분기 | 픽커가 1차 방어. 그래도 갈리면 Obsidian에서 frontmatter `workKey` 수정으로 병합 가능 |

## 10. 테스트 전략

분리 원칙(순수 단위 + 부수효과 얇게):

- **단위(vitest, core)**: `note.ts` reflection 조립↔파싱 라운드트립(frontmatter·허브링크·status·kind), `slug`/`workKey` 결정성, `reflection-schema`(파싱 성공/필드누락 거부), **`hub.upsertHub`**(null→생성 / 기존→append / 중복→멱등), `promote.reflectionPromoteTargets`+`stripStagingFrontmatter`(status만 제거, work 보존).
- **얇은 어댑터(main)**: `transformReflection`(SDK 모킹 — content에 **이미지 블록 없음**·텍스트만·스키마 강제·parsed 반환 검증), `staging-store` reflection write/scan(kind 판별)/remove(이미지 없음) + `upsertHubFile`(tmpdir: 생성·append·멱등).
- **회귀 게이트**: 기존 capture kind 29 테스트 + typecheck + lint + electron-vite build **전부 green 유지**(StagingItem 유니온 전환이 capture 경로를 깨지 않음).
- **수동 e2e(1회)**: 데스크톱에서 감상 세션 입력 → 자동 정리 → 트리아지 수정 → 승격 → vault에 세션 노트 + 작품 허브(세션 링크) 확인. 같은 작품 2세션으로 허브 append 확인.

## 11. 보안 고려

- 신규 외부 노출 없음(릴레이·네트워크 입구 추가 안 함). reflection은 로컬 입력→로컬 staging→Claude 텍스트 호출(기존 키 경로).
- Electron 보안(contextIsolation/sandbox/nodeIntegration off) 유지. preload 화이트리스트에 `createReflection`·`listWorks`만 추가.
- fs 경계: 세션·허브 쓰기는 설정된 vault 폴더(+`reflectionSubdir`) 안으로만. 경로 정규화로 이탈 방지.

## 12. 완료 기준 (Definition of Done)

- [ ] 데스크톱 새 감상 폼에서 매체·작품·진행·세션 메모를 입력하면 staging에 raw reflection 노트(이미지 없음)가 생기고 자동으로 텍스트 정리(transformed)된다.
- [ ] Claude는 사용자 메모를 정리·태깅만 하고 작품 외부 사실을 지어내지 않는다(프롬프트 가드 + 수동 확인).
- [ ] 트리아지·에디터에서 capture·reflection이 한 목록에 공존하고, reflection을 스치고 수정할 수 있다.
- [ ] "승격" 1회로 세션 노트가 vault 정본(status 제거)으로 안착하고, 작품 허브 노트가 없으면 생성/있으면 세션 링크가 멱등 append된다. staging에서 제거.
- [ ] 같은 작품의 여러 세션이 독립 노트로 남으면서 허브 하나로 모인다(추적).
- [ ] 순수 코어(note·reflection-schema·hub·promote) + 어댑터(transform·staging) 테스트 + 기존 capture 회귀 + typecheck·lint·build 전부 green.
- [ ] 수동 e2e 1회(입력→정리→승격→vault 세션+허브)로 파이프 관통 확인.

## 13. 비고

- v1 매체 4종은 `REFLECTION_MEDIA` 한 곳에서 관리 — 유튜브·팟캐스트 등 추가는 리스트 + 접두사 + 프롬프트 관점 한 줄씩.
- 이미지 첨부·평점·원메모 이중저장은 후속 폴리시 후보(YAGNI 컷).
- 윈도우 메모장 .txt 인박스(LogOS 모듈 4)는 같은 reflection 골격에 **또 다른 입구**(로컬 폴더 watch)를 더하는 후속 — 본 증분이 그 텍스트-모드 변환·노트 포맷을 미리 닦는다.
- 변환 비용: 세션당 텍스트 호출 1회(opus-4-8, vision 아님). 개인용 저volume.
