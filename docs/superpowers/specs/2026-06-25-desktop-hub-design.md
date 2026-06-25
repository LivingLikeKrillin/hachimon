# 데스크톱 허브 (v1) — 캡처 변환·검수·안착 데스크톱 앱 설계

> 상태: 설계 승인됨(2026-06-25, 골격·staging·노트포맷 사용자 승인 / 잔여 섹션 자율 위임). 구현 계획 작성 전 단계.
> 이 문서는 "개인 지식 OS"의 데스크톱 반쪽 — 폰 캡처 PWA가 떨군 raw 캡처를 **AI로 변환**하고 **사람이 1초 확인**해 Obsidian에 안착시키는 데스크톱 앱 v1을 다룬다.
> working name: **anchor** (capture↔anchor 페어. 브랜딩은 추후 변경 가능).

## 1. 목적

폰 캡처 PWA가 릴레이에 올린 짤·인사이트(이미지+한 줄 메모)를 데스크톱으로 끌어와 **Claude vision으로 변환(OCR+인사이트 추출+타입별 규격)** 하고, 사람이 **스침·수정 후 한 번의 승격**으로 Obsidian vault에 정식 노트로 안착시키는 **Electron 데스크톱 앱**.

해결하려는 통증:
1. **변환 부재** — 캡처 PWA v1은 이미지를 `status: raw`로만 안착시킨다. 그대로면 검색·연결 안 되는 죽은 이미지 더미. 이 앱이 raw를 구조화된 텍스트 노트로 만든다.
2. **이중 인박스** — 현재 raw가 vault *내부* 인박스에 들어와 정본을 오염시킨다("저절로 나타남"). 이 앱이 **vault-외 staging 단일 인박스**를 도입해 정본을 청결하게 유지한다.
3. **접근성** — 이전 변환 시제품(`inbox.ts` CLI / MCP 배치)은 매번 터미널을 쳐야 해 죽었다. 이 앱은 **열기만 하면 pull+변환이 자동**으로 돌아 검토 대기 상태로 차려진다.

### 비목표 (v1 아님 — 후속 증분, 같은 앱)

- **책·영화·애니 감상 기록 타입** — 같은 staging·변환·승격 골격에 *타입만* 추가(fast-follow). v1은 짤·인사이트 한 타입.
- **윈도우 메모장 .txt 인박스 흡수** — 데스크톱 deep-capture(메모장 → staging)는 후속. v1은 폰 캡처(릴레이)만 입구.
- **재소환 루프** — 안착된 노트의 주기적 다시보기·자가평가는 후속.
- **자동 승격** — 사람 1초 확인을 의도적으로 보존(완전 자동 정착 금지).
- **새 릴레이/Worker** — 캡처 PWA의 기존 Cloudflare 릴레이를 그대로 소비한다. 릴레이 변경 없음.

## 2. 더 큰 그림 — 이 앱이 사는 시스템

개인 지식 OS의 공통 골격: `캡처(마찰0) → 인박스(staging) → 변환(타입별 규격, AI) → Obsidian 안착 → 재소환`.

| 표면 | 역할 | 모듈 |
|---|---|---|
| 폰 캡처 PWA | 짤·인사이트 마찰0 캡처 → 릴레이 | capture (완성, 별도 repo) |
| Cloudflare 릴레이 | 폰↔PC 임시 보관(토큰 인증, R2+D1) | capture/worker (완성) |
| **데스크톱 허브(본 문서)** | **릴레이 pull → vault-외 staging → AI 변환 → 검수·편집 → Obsidian 승격** | **anchor (신규, 별도 repo)** |
| Obsidian vault | 정착된(curated) 정본 지식베이스 | (사용자 소유) |
| Hachimon | 기술노트 플래시카드 복습(폰) | hachimon (완성) |

핵심 원칙(시스템 합의):
1. **Obsidian은 쓰는 곳이 아니라 읽고 정착하는 곳.** 모든 raw는 vault 밖 staging에. 정본엔 승격된 것만.
2. **AI 잡일 + 사람 1초 확인.** 변환은 제로터치 자동, 정본화는 사람 손가락 하나. 그 접촉이 최소한의 재소환.
3. **다각화 = 하나의 관에 여러 입력 타입.** v1은 짤 한 타입이되, staging·변환·승격은 타입 확장을 전제로 설계.
4. **순수/부수효과 분리.** Hachimon `src/lib/forge/*`(순수) ↔ `scripts/inbox.ts`(부수효과) 패턴 계승.

### 캡처 PWA와의 통합 — `sync-captures.ts` 역할 흡수

캡처 PWA repo의 `scripts/sync-captures.ts`는 릴레이를 폴링해 raw 노트를 **vault 내부 인박스**에 떨구는 스케줄러 CLI다. 이 앱이 그 **릴레이-pull 역할을 흡수**한다 — 앱이 직접 릴레이에서 당겨 **vault-외 staging**에 쓰고 consume한다. 즉:

- 데스크톱 동기 도구가 둘(스케줄러 CLI + 앱)일 필요 없음 → 앱 하나로 수렴.
- `sync-captures.ts`는 **이 앱 배포 후 capture repo에서 비활성/은퇴**(별도 작업, 본 v1 범위 밖이나 명시). v1 기간 중복 실행을 피하려면 둘 중 하나만 가동.
- 릴레이 계약(엔드포인트·`CaptureMeta`)은 변경 없이 그대로 소비.

## 3. 결정 사항 (승인됨)

| 항목 | 결정 |
|---|---|
| 표면 | 새 **Electron 데스크톱 앱**(React/Vite/Tailwind/shadcn). Hachimon/capture 스택 시드 재사용 |
| 저장소(repo) | 별도 repo `anchor`(독립). 디자인 토큰·`imageOptimize`·`tsconfig`·`forge` 패턴은 Hachimon/capture에서 가져와 재사용 |
| 중간 지대 | **vault-외 staging 폴더** 하나(앱이 소유). 정본 100% 청결, 가짜 중간지대 제거 |
| 변환 트리거 | **제로터치 자동** — 앱 실행/포커스 시 릴레이 pull + 미변환 raw 자동 변환. 수동 "새로고침"·"변환 다시"는 폴백 |
| 변환 엔진 | Claude API(`@anthropic-ai/sdk`) vision, 모델 `claude-opus-4-8`. `messages.parse()`+`zodOutputFormat` 구조화 출력 |
| 승격 | 사람 1초 확인(스침·수정) 후 "승격" → vault에 노트+이미지 기록. 자동 승격은 비목표 |
| 상태 표현 | staging 노트 **frontmatter `status`**(raw/transformed). 별도 인덱스 DB 없음(투명·기존 파서 재사용) |
| v1 타입 | 짤·인사이트 한 타입(`insight/quote/lesson/misc`, 캡처 PWA와 동일 택소노미) |
| 입구 | 폰 캡처(릴레이)만. 데스크톱 메모장은 후속 |

## 4. 아키텍처

```
[폰] 캡처 PWA ──(이미지+메모)──▶ Cloudflare 릴레이 (R2+D1)   ← 기존, 변경 없음
                                          │
[PC] anchor (Electron, 열림 = 트리거)      │
  ┌───────────────────── main 프로세스 (Node) ─────────────────────┐
  │ 1. 릴레이 pull: GET /captures?consumed=0 + 이미지 다운로드        │
  │ 2. vault-외 staging 폴더에 raw 노트(.md)+이미지 기록 → consume    │
  │ 3. [Claude vision 변환] 미변환 raw 자동: OCR+추출+규격           │
  │    → staging 노트를 transformed로 갱신                           │
  │ 4. (renderer 요청) 승격: staging .md+이미지 → vault 대상 폴더 이동 │
  └───────────────────────────────────────────────────────────────┘
              ▲ IPC (contextBridge preload)         │
  ┌───────────────────── renderer (React) ──────────┴──────────────┐
  │ 트리아지 목록(transformed 위, raw 아래) · 항목 뷰어/에디터        │
  │ · 이미지 뷰 · 필드 편집 · "변환 다시"/"승격"/"버리기" · 설정      │
  └────────────────────────────────────────────────────────────────┘
              │ 승격                                  
              ▼                                       
[Obsidian vault] 정본 노트 + 이미지 (status 제거됨)
```

흐름 요약: 폰 캡처 → 릴레이 → (앱 열림) 자동 pull→staging→자동 변환 → 사람이 뷰어에서 스침·수정 → "승격" → Obsidian 정본.

### 4.1 프로세스 모델 (Electron 보안)

- **main 프로세스(Node)**: fs(staging 읽기·쓰기, vault 쓰기), 릴레이 클라이언트(fetch), Claude vision 호출(`@anthropic-ai/sdk`), 설정 영속. IPC 핸들러로만 노출.
- **renderer(React/Vite)**: UI 전용. `window.api.*` (preload)로 main 호출. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **preload(contextBridge)**: 타입드 API 표면만 노출(`listItems`, `pull`, `transform`, `promote`, `discard`, `getSettings`, `setSettings`). renderer에 Node·fs 직접 노출 금지.
- **순수 코어(`core/*`)**: main이 import하는 순수 로직(노트 조립·파싱, 파일명, 변환 결과 매핑, zod 스키마, 승격 경로 결정). 네트워크·fs·DOM 없이 단위 테스트.

### 4.2 모듈 경계

| 모듈 | 책임 | 의존 | 테스트 |
|---|---|---|---|
| `src/shared/types.ts` | `CaptureMeta`(capture repo 미러) + `StagingItem` + `TransformResult` | 없음 | 단위 |
| `core/note.ts` | staging 노트 조립/파싱(frontmatter read/write), `baseName`(재사용), status 전이 | 없음(순수) | 단위(라운드트립) |
| `core/transform-schema.ts` | Claude vision 출력 zod 스키마(`TransformResult`) | zod | 단위(파싱·거부) |
| `core/promote.ts` | staging→vault 경로 결정, 승격 시 frontmatter 정리 | 없음(순수) | 단위 |
| `main/relay-client.ts` | 릴레이 클라이언트: list/image/consume(fetch). (capture repo `worker/relay.ts`와 이름 충돌 회피 위해 `-client` 접미) | fetch | 얇음(모킹) |
| `main/staging-store.ts` | fs: staging 스캔/읽기/쓰기/이동 | fs | 얇음(통합/임시디렉토리) |
| `main/transform.ts` | Claude vision 호출(이미지 base64+컨텍스트) → `TransformResult` | sdk | 얇음(모킹) |
| `main/ipc.ts` | IPC 핸들러 오케스트레이션(pull→store→transform, promote) | 위 전부 | 수동/통합 |
| `main/settings.ts` | 설정 영속(릴레이 URL·토큰, Claude 키, staging·vault 경로) | electron-store/fs | 얇음 |
| `renderer/*` | UI(트리아지·에디터·설정) | preload api | 수동(UI) |

순수 코어(`note`·`transform-schema`·`promote`)는 부수효과 없음. 모든 I/O(fs·fetch·SDK)는 얇은 어댑터로 격리 — Hachimon `forge` 패턴 그대로.

### 4.3 데이터 모델

```ts
// capture repo와 공유(미러). 릴레이가 GET /captures?consumed=0 으로 반환.
interface CaptureMeta {
  id: string;          // UUID(멱등 키)
  createdAt: string;   // ISO 8601
  type: 'insight' | 'quote' | 'lesson' | 'misc';
  note: string;        // 캡처 시 한 줄 메모(빈 문자열 허용)
  source: string;      // 출처(빈 문자열 허용)
  tags: string[];
  imageExt: string;    // 'webp' | 'svg' ... (릴레이가 imageKey도 함께 반환)
}

// Claude vision 변환 출력 (zod 강제)
interface TransformResult {
  title: string;       // 제안 제목
  insight: string;     // 핵심 1~3문장(추출)
  ocr: string;         // 원문(이미지 텍스트, 없으면 '')
  tags: string[];      // AI 제안 태그(원본). 사용자 태그와의 합집합·중복제거는 core/note 조립이 수행(소유권 단일화)
}

// 앱 내부 표현(staging 파일에서 파생)
interface StagingItem {
  base: string;             // 짤-YYYY-MM-DD-<shortid>
  meta: CaptureMeta;        // frontmatter에서 파싱
  status: 'raw' | 'transformed';
  transform?: TransformResult; // transformed면 본문/frontmatter에서 파생
  notePath: string;
  imagePath: string;
  error?: string;           // 변환 실패 표식(재시도 대상)
}
```

## 5. Staging 구조 & 상태 생애주기

vault-외 staging 폴더 하나. 항목 1건 = 노트 1개 + 이미지 1개. 결정적 베이스명 `짤-YYYY-MM-DD-<shortid>`(캡처 PWA `baseName` 그대로 재사용)을 노트·이미지가 공유.

```
<staging-dir>/                         (vault 밖, 앱이 소유, 설정값)
├── 짤-2026-06-25-a3f2c1d40000.md      ← 작업 노트(frontmatter + 본문)
├── 짤-2026-06-25-a3f2c1d40000.webp    ← 이미지
└── ...
```

상태는 frontmatter `status` 필드:

| status | 의미 | 다음 |
|---|---|---|
| `raw` | 릴레이에서 막 당겨옴(이미지+메모만, 변환 전) | 자동 변환 → transformed (실패 시 raw 유지 + error) |
| `transformed` | AI OCR+추출 끝남, 검토 대기 | 사람 승격 → vault로 이동(staging에서 제거) |

앱은 staging 폴더를 스캔해 목록을 만들고 `transformed`(검토대기)를 위로, `raw`(처리중/실패)를 아래로 정렬. 편집은 `.md`에 직접 기록. **별도 인덱스 DB 없음** — staging은 사람이 직접 열어봐도 투명하고, frontmatter 파서가 단일 진실원천.

### 5.1 멱등 & 부분 실패

- **릴레이 consume 시점**: staging에 이미지+노트를 안전히 쓴 **직후** consume(캡처 PWA "둘 다 성공 시 consume" 그대로). staging이 내구성 보관소, 릴레이는 전송 버퍼.
- **pull 멱등**: staging에 같은 베이스명 `.md`가 이미 있으면 다운로드·쓰기 건너뛰고 consume만 보장(캡처 PWA `sync-captures.ts`의 `shouldSkip` = `<base>.md` 존재 판정과 **동일 술어 재사용** → dedup 의미 일치). 재실행·부분실패 복구 안전.
- 릴레이 `GET /captures?consumed=0`은 이미 서버에서 `status='ready'`만 반환(반쪽 업로드 제외) → 앱은 클라이언트측 status 체크 불필요.
- **변환 멱등**: 변환은 `status: raw`인 항목만 대상. 실패 시 raw 유지 + `error` 표식 → 다음 자동/수동 트리거가 재시도. 노트 단위 격리(한 건 실패가 전체 중단 안 함).
- **승격 멱등**: vault 대상에 같은 베이스명이 있으면 덮어쓰지 않고 경고(중복 안착 방지). 승격 성공 후에만 staging에서 제거.

## 6. 변환 (Claude vision) — claude-api 스킬 준거

`main/transform.ts`가 staging의 raw 항목을 변환:

- **입력**: 이미지(staging에서 읽어 base64) + 컨텍스트(type·메모·source). 이미지 블록을 텍스트 블록 앞에 배치.
  ```ts
  content: [
    { type: 'image', source: { type: 'base64', media_type: mimeFor(ext), data: b64 } },
    { type: 'text', text: buildTransformPrompt(meta) }, // 규격 지시 + 메모/타입/출처 주입
  ]
  ```
  > 주의: 릴레이는 이미지를 `content-type: application/octet-stream`으로 서빙(실제 mime 아님). 앱은 staging에 저장된 파일의 **확장자(`imageExt`)에서 mime을 도출**(`mimeFor(ext)`)해 vision 블록을 만든다 — HTTP `content-type`을 신뢰하지 말 것.
- **구조화 출력**: `client.messages.parse({ ... output_config: { format: zodOutputFormat(TransformSchema) } })` → `parsed_output`이 `TransformResult`. `inbox.ts`의 `messages.parse`+zod 패턴 계승.
- **추론**: 추출·요약 추론이 필요하므로 `thinking: { type: 'adaptive' }`. `max_tokens` ~8000(비스트리밍, 출력 작음). `stop_reason === 'max_tokens'` 시 경고.
- **모델**: `claude-opus-4-8`(정확 문자열, 날짜접미 금지). 설정에서 override 가능.
- **타입별 규격(v1)**: 짤·인사이트 한 규격 — `제목 / 핵심(추출) / 원문(OCR) / 태그`. 프롬프트가 type에 맞춰 추출 관점을 지시(insight=교훈/통찰, quote=인용 정확 전사, lesson=실천 항목, misc=요약). 후속 타입은 자기 규격 추가.
- **SVG/디코드 불가**: 변환 불가 이미지는 raw 유지 + `error`(사용자에게 표시), 메모+이미지만으로 수동 승격 가능.
- **에러 분기**: SDK 타입 예외(`RateLimitError` 등 재시도 안내), 키 없음은 변환 비활성 + 명확 안내(raw는 여전히 보기·수동편집·승격 가능).

## 7. 변환 출력 노트 포맷

`core/note.ts`가 조립. transformed 상태의 staging 노트:

```markdown
---
created: 2026-06-25T14:30:00+09:00
type: insight
source: <url 또는 앱>
tags: [투자, 복리]
captureId: <uuid>
status: transformed
title: 복리는 시간의 함수다
---
![[짤-2026-06-25-a3f2c1d40000.webp]]

> 메모: <사용자가 캡처 때 적은 한 줄>

## 핵심
<AI가 뽑은 인사이트 1~3문장>

## 원문(OCR)
<이미지에서 읽어낸 텍스트>
```

- `## 핵심`/`## 원문`은 type별 규격(v1 짤 한 규격). 빈 섹션은 생략(OCR 없으면 `## 원문` 생략).
- **태그 합집합**: `core/note.ts` 조립이 `meta.tags ∪ transform.tags`를 순서보존·중복제거로 frontmatter에 기록(합집합 소유권은 조립부에만).
- 비어도 안전: 추출 실패해도 메모+이미지(raw 포맷)로 보존.
- **승격 시**: 이 `.md`+이미지를 vault 대상 폴더로 이동(임베드 `![[...]]` 유지). `status` 등 staging 전용 frontmatter는 `core/promote.ts`가 정리(`captureId`·`created`·`type`·`tags`·`title`은 보존).
- raw 상태 노트는 캡처 PWA의 `assembleNote`와 동일 포맷(frontmatter + 임베드 + 메모, `status: raw`).

## 8. 앱 화면 (renderer)

디자인 시스템: Hachimon 토큰(zinc-950 배경, gold accent, shadcn/ui) 재사용. 단 모바일 393px이 아닌 **데스크톱 창** — 마스터-디테일 2-pane, 마우스/키보드. 터치타깃 제약 없음.

| 화면 | 내용 |
|---|---|
| **트리아지 목록(메인)** | staging 항목 리스트. `transformed`(검토대기) 위, `raw`(처리중/실패) 아래. 행: 썸네일·제목/메모·타입 뱃지·status·source. 상단 동기 인디케이터 + 수동 "새로고침". 빈 상태 안내 |
| **항목 디테일/에디터** | 좌: 큰 이미지 뷰. 우: 편집 필드(제목·핵심·원문·태그·source·type). 버튼: "변환 다시"(AI 재실행)·"승격"·"버리기" |
| **설정** | 릴레이 URL·토큰, Claude API 키, staging 폴더 경로, vault 노트 폴더·첨부 폴더 경로 |

- **제로터치**: 앱 실행/포커스 시 자동 pull + 미변환 raw 자동 변환 → 검토 대기로 차려짐. 사람은 목록을 훑고 승격만.
- **승격 제스처**: 디테일에서 "승격" 1클릭(또는 목록에서 키보드 단축). 이게 유일한 정본화 게이트 = 최소 재소환.
- (후속) 키보드 빠른 트리아지·일괄 승격.

## 9. 에러 처리 · 오프라인

| 지점 | 실패 | 처리 |
|---|---|---|
| 릴레이 pull | 오프라인/네트워크 | 기존 staging 목록은 그대로 표시. 다음 포커스/수동 새로고침에 재시도. 사용자에게 비침습 표시 |
| 이미지 다운로드 | 실패 | consume 보류 → 다음 pull이 복구(손상 안착 방지, 캡처 PWA `imgRes.ok` 가드 계승) |
| 변환 | API 에러/레이트리밋/디코드 불가 | 항목 raw 유지 + `error` 표식. 노트 단위 격리. 수동 "변환 다시"로 재시도 |
| Claude 키 없음 | — | 변환 비활성 + 안내. raw 보기·수동편집·승격은 가능 |
| 승격 | fs 쓰기/대상 폴더 없음 | staging 유지(제거 안 함), 재시도 안전. 대상 중복은 경고 |
| consume | 실패 | 다음 pull이 재시도(중복은 베이스명 dedup가 막음) |

엣지: 메모·출처·태그 빈 값 허용. 메모 없는 항목은 목록에서 약하게 표시(맥락 적음)하되 변환·승격 허용.

## 10. 테스트 전략

Hachimon 분리 원칙(순수 단위 + 부수효과 얇게):

- **단위(vitest)**: `core/note.ts`(조립→파싱 라운드트립: frontmatter·임베드·captureId·status 검증; raw↔transformed 포맷), `core/transform-schema.ts`(zod 파싱 성공/필드누락 거부), `core/promote.ts`(경로 결정·frontmatter 정리·중복 판단), `baseName` 결정성.
- **얇은 어댑터**: `relay-client.ts`(fetch 모킹: 인증 헤더·consume), `transform.ts`(SDK 모킹: 이미지 블록 구성·스키마 강제), `staging-store.ts`(임시 디렉토리 통합: 쓰기/스캔/이동 멱등).
- **Electron IPC/renderer**: 얇게 — 수동/통합. main IPC 핸들러는 코어 조합이라 코어 테스트가 대부분 커버.
- **수동 e2e(1회)**: 실폰 캡처 → 릴레이 → 앱 열기(자동 pull+변환) → 검토·수정 → 승격 → Obsidian에 정본 노트+이미지 확인.

## 11. 보안 고려

- **Claude API 키·릴레이 토큰**: main 프로세스 설정에 저장(렌더러 비노출). 키는 환경/electron-store, 렌더러는 IPC로만 변환 요청.
- **Electron**: `contextIsolation`/`sandbox` on, `nodeIntegration` off. preload 화이트리스트 API만.
- **fs 경계**: staging·vault 경로는 설정값. 승격 쓰기는 설정된 vault 폴더 안으로만. 경로 정규화로 이탈 방지.
- **개인 스크린샷**: staging은 로컬 디스크. 릴레이는 기존 정책(비공개 R2·강한 토큰·소비+7일 purge) 그대로.

## 12. 로드맵 위치

```
캡처 PWA v1 (완성)        : 폰 짤 캡처 → 릴레이 → (구) vault 인박스 러프 안착
데스크톱 허브 v1 (본 문서) : 릴레이 pull → vault-외 staging → AI 변환 → 검수 → Obsidian 안착
  fast-follow            : 책/영화/애니 감상 타입 추가(같은 staging·변환·승격)
  후속                   : 윈도우 메모장 .txt 인박스 흡수 / 재소환 루프 / 일괄 트리아지
```

각 후속은 자기 스펙→계획→구현 사이클. v1은 "짤 한 타입을 폰 캡처에서 AI 변환 거쳐 Obsidian 정본까지" 한 줄기 관통 + 앱 셸 확립에 집중.

## 13. 완료 기준 (v1 Definition of Done)

- [ ] 앱을 열면 릴레이에서 미소비 캡처를 자동 pull → vault-외 staging에 raw로 저장 → consume(터미널 0회).
- [ ] staging의 raw가 Claude vision으로 자동 변환(OCR+추출+규격)되어 transformed·검토대기로 차려진다(실패는 raw+error로 격리·재시도 가능).
- [ ] 트리아지 목록 + 디테일 에디터에서 변환 결과를 스치고 수정할 수 있다.
- [ ] "승격" 1회로 staging 노트+이미지가 Obsidian vault에 정본(status 제거)으로 안착하고 staging에서 빠진다. 재실행 멱등.
- [ ] vault 내부엔 정본만, raw는 vault 밖 staging에만(이중 인박스 해소).
- [ ] 순수 코어(`note`·`transform-schema`·`promote`) 단위 테스트 + 어댑터(relay·transform·staging) 테스트가 전부 green. lint·tsc·build 통과.
- [ ] 수동 e2e 1회(실폰 캡처 → 앱 변환 → 승격 → Obsidian)로 파이프 관통 확인.

## 14. 비고

- 캡처 PWA `sync-captures.ts`의 릴레이-pull 역할을 이 앱이 흡수 → v1 배포 후 capture repo에서 해당 스케줄러 은퇴(별도 작업, 중복 가동 회피).
- 변환 비용: 캡처당 vision 1회(opus-4-8). 개인용·저volume 전제. 배치/비용 최적화는 후속.
- working name `anchor`는 잠정. 브랜딩 확정은 사용자 몫.
