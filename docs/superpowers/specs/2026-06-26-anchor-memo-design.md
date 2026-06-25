# anchor 데스크톱 메모 인박스 (`memo` kind) — 설계

> 상태: 설계 승인됨(2026-06-26, content model·픽업·원본 생애주기 사용자 승인 / 구현까지 자율 위임).
> LogOS의 한 증분 — 데스크톱 허브 `anchor`에 **세 번째 입력 종류(`memo`)**인 윈도우 메모장 `.txt` deep-capture를 더한다.
> 선행: `2026-06-25-anchor-reflection-design.md`(reflection kind — 텍스트-모드 변환·노트 골격). 본 증분은 그 골격 위에 폴더-인입 입구 + memo kind를 얹는다.

## 1. 목적

데스크톱에서 메모장에 **러프하게 친 .txt 메모**(생각·아이디어·노트)를 anchor가 인박스 폴더에서 당겨 Claude로 **정리(제목+본문 정리+태그)**하고, 사람이 1초 확인 후 승격하면 Obsidian vault에 일반 노트로 안착시킨다. LogOS 2층 구조의 **데스크톱 deep-capture 면**(폰=빠른 캡처, 데스크톱=깊은 정리).

해결하려는 통증:
1. **데스크톱 마찰** — Obsidian에 격식대로 쓰긴 부담스러워 안 쓴다(시스템 1원칙). 메모장은 마찰 0이지만 그 .txt가 흩어져 죽는다. anchor가 그걸 정리해 vault로 잇는다.
2. **입구 단일성** — anchor는 지금 폰 캡처(릴레이)와 데스크톱 감상(폼) 두 입구뿐. 데스크톱의 가장 자연스러운 쓰기 표면(메모장)이 빠져 있다. 이 증분이 그 입구를 흡수한다.

### 비목표 (v1 아님)

- **.md·기타 확장자** — `.txt`만(메모장 기본). 후속.
- **파일 분할** — 1 `.txt` = 1 메모(파일 전체가 한 노트). 한 파일에 여러 생각을 적어도 한 노트. 분할은 후속.
- **영속 폴더 watch** — fs.watch/chokidar 없음. 앱 열림/포커스 스캔(제로터치 `auto()`)으로 픽업.
- **작품 허브(MOC)** — memo는 작품 묶음이 아니라 자유형 노트. 허브 없음(reflection과 다른 점).
- **사실 보강** — Claude는 정리·태깅만. 외부 사실 생성 금지(환각 방지, reflection과 동일 가드).
- **Hachimon 플래시카드 inbox와 수렴** — 별개 도구(Hachimon repo `scripts/inbox.ts`: `.md`→3-tier 퀴즈). destination이 다르다(퀴즈 vs 일반 지식 노트). 본 증분과 무관.

## 2. 더 큰 그림 — LogOS에서의 위치

LogOS 공통 골격: `캡처(마찰0) → 인박스(staging) → 변환(AI) → Obsidian 안착 → 재소환`. **다각화 = 하나의 관에 여러 입력 타입.** anchor는 이미 capture(이미지)·reflection(감상) 두 kind를 같은 staging·변환·승격 파이프에 태운다. memo는 **세 번째 kind**(자유형 텍스트 노트)이며 입구는 **로컬 폴더 인입**이다.

| kind | 입구 | 매체 | 변환 | 승격 |
|---|---|---|---|---|
| `capture` | 폰 캡처 PWA → 릴레이 | 이미지 | Claude vision(OCR+추출) | 노트+이미지 |
| `reflection` | 데스크톱 폼 입력 | 텍스트(감상) | Claude 텍스트(정리+태깅) | 노트 + **작품 허브** |
| **`memo` (본 증분)** | **데스크톱 메모장 `.txt` 폴더 인입** | **텍스트(자유형)** | **Claude 텍스트(정리+태깅)** | **노트만(허브 없음)** |

memo는 reflection의 텍스트-모드 변환·텍스트 노트 포맷을 재사용하되, **입구(폴더 인입)**와 **work/허브 부재**가 다르다. 후속 LogOS 모듈(재소환 루프 등)이 이 위에 쌓인다.

## 3. 결정 사항 (승인됨)

| 항목 | 결정 |
|---|---|
| content model | **새 `kind: 'memo'`** — 자유형 일반 노트. Claude → 제목+정리 본문+태그. work/medium/허브 없음 |
| 입력 모델 | **데스크톱 메모장 `.txt` 폴더 인입**. anchor repo만 변경(릴레이·capture·reflection 불변) |
| 픽업 트리거 | **앱 열림/포커스 스캔** — 기존 제로터치 `auto()`에 인박스 스캔 추가. 영속 watcher 없음 |
| 원본 `.txt` 생애주기 | 픽업 성공 시 `<inboxDir>/_processed/`로 **이동**(멱등·복구 가능) |
| 변환 엔진 | Claude 텍스트 `messages.parse`+`zodOutputFormat`, 모델 `claude-opus-4-8`, 이미지 블록 없음 |
| 레코드 발급 | 로컬 — `id=randomUUID`, `createdAt`=.txt mtime(작성 근사, fallback now) |
| 아키텍처 | **완전한 3번째 kind**(MemoMeta/transform/note/promote 자체). reflection 골격 재사용, StagingItem 유니온 확장 |

## 4. 아키텍처

```
[데스크톱] 메모장 → <inboxDir>/*.txt
  ┌──────────────────────── anchor main 프로세스 (Node) ─────────────────────┐
  │ A. ingestInbox()  — <inboxDir> 최상위 *.txt 스캔(_processed 제외)         │
  │    각 파일: 본문 읽기 → MemoMeta(uuid·mtime·note·source) → writeMemoRaw   │
  │    → 원본 .txt를 <inboxDir>/_processed/ 로 이동(멱등)                      │
  │ B. transform:run — staging의 raw memo → transformMemo(텍스트, 이미지 없음)│
  │    → transformed memo 노트로 갱신                                         │
  │ C. item:promote — staging .md → vault(memoSubdir) 이동(status 제거)        │
  │    허브 upsert 없음                                                       │
  │ auto() = 릴레이 pull + ingestInbox + transform:run (제로터치)             │
  └───────────────────────────────────────────────────────────────────────────┘
              ▲ IPC (기존 items:list/transform/promote/discard kind 분기)
  ┌──────────────────────── renderer (React) ────────────┴────────────────────┐
  │ 트리아지(memo 행 kind 분기) · MemoEditor(제목·본문·태그) · 설정(inboxDir)   │
  └─────────────────────────────────────────────────────────────────────────────┘
              │ 승격
              ▼
[Obsidian vault] vaultNotesDir/<memoSubdir>/메모-….md (정본, status 제거)
```

흐름: 메모장 `.txt` 저장 → (앱 포커스) 자동 인입 → staging raw memo → 자동 텍스트 정리 → 트리아지 1초 확인·수정 → 승격 → vault 일반 노트.

### 4.1 kind 판별자 재사용

memo는 staging frontmatter `kind: memo`로 식별. `noteKind`(현 `capture`/`reflection` 판별)를 memo까지 확장. 공유(분기 없이 재사용): staging 폴더·`status` 생애주기·`stripStagingFrontmatter`·트리아지/에디터 셸·`auto()`·promote→removeItem. 분기(kind별): 메타 타입·노트 조립·변환·입구(폴더 인입)·에디터 필드·목록 행.

### 4.2 모듈 경계 (신규/변경, anchor repo)

| 모듈 | 변경 | 책임 |
|---|---|---|
| `src/shared/types.ts` | 추가 | `MemoMeta`, `MemoTransform`; `StagingKind`에 `'memo'`; `StagingItem` 유니온에 memo 멤버 |
| `core/note.ts` | 추가 | `memoBaseName`, `assembleMemoRaw`/`assembleMemoTransformed`, `parseMemoNote`; `noteKind`에 memo 분기 |
| `core/memo-schema.ts` | 신규 | zod `MemoSchema` `{title, body, tags}` |
| `core/promote.ts` | 추가 | `memoPromoteTargets(base, {notesDir})`(노트만) |
| `main/transform.ts` | 추가 | `buildMemoPrompt(meta)`, `transformMemo(client, meta, model)`(이미지 블록 없음) |
| `main/staging-store.ts` | 추가 | `writeMemoRaw`/`writeMemoTransformed`, `scan` memo 분기 |
| `main/inbox.ts` | 신규 | `ingestInbox(inboxDir, stagingDir)` — `.txt` 스캔·MemoMeta 발급·`_processed` 이동(fs) |
| `main/ipc.ts` | 추가 | `auto()`에 ingest 추가; `transform:run`·`item:promote`·`item:save`에 memo 분기 |
| `main/settings.ts` | 추가 | `inboxDir`(메모장 폴더), `memoSubdir`(기본 `메모`) |
| `renderer/api.d.ts`(→`shared/api.ts`) | 추가 | `AppSettings`에 `inboxDir`/`memoSubdir` |
| `renderer/components/*` | 추가/변경 | `MemoBadge`(신규), `MemoEditor`(신규), `TriageList`·`SettingsSheet` memo 분기 |

순수/부수효과 분리 유지: `core/*`(note·memo-schema·promote)는 fs·네트워크·DOM 없이 단위 테스트. `inbox.ts`는 얇은 fs 어댑터.

### 4.3 데이터 모델

```ts
// src/shared/types.ts (추가)
/** 데스크톱 메모장 .txt에서 로컬 생성. work/medium/이미지 없음. */
export interface MemoMeta {
  id: string;        // 로컬 randomUUID
  createdAt: string; // .txt mtime 기반 ISO(fallback now)
  note: string;      // .txt 원문 본문
  source: string;    // 원본 파일명(출처 추적)
  tags: string[];    // v1 입력 시 빈 배열(메모장엔 태그 없음); AI 제안이 합집합
}

/** Claude 텍스트 정리 출력(zod 강제). */
export interface MemoTransform {
  title: string;     // 노트 제목
  body: string;      // 정리된 마크다운 본문
  tags: string[];    // AI 제안 태그(원본). 합집합은 core/note 조립이 수행
}

// StagingItem 유니온에 3번째 멤버 추가(capture·reflection은 불변)
| { kind: 'memo'; base: string; meta: MemoMeta; status: StagingStatus; transform?: MemoTransform; notePath: string; error?: string }
```

`memoBaseName(meta)` = `메모-YYYY-MM-DD-<shortId(id)>` (접두사 `메모`, 날짜=createdAt 앞 10자). work·medium·imageExt·imagePath 없음.

## 5. 입력 · 픽업 (`main/inbox.ts`, `main/ipc.ts`)

- 설정: `inboxDir`(메모장 .txt 폴더), `memoSubdir`(vault 하위, 기본 `메모`).
- `ingestInbox(inboxDir, stagingDir)`(fs 어댑터):
  1. `inboxDir`이 빈 문자열/미존재면 no-op(카운트 0).
  2. `inboxDir` **최상위**의 `*.txt` 나열(`_processed/` 하위는 제외 — 최상위만 스캔).
  3. 각 파일: 본문(utf-8) 읽기 → `MemoMeta` 발급(`id=randomUUID`, `createdAt`=파일 mtime ISO, `note`=본문, `source`=파일명, `tags=[]`) → `writeMemoRaw(stagingDir, meta)` → 원본을 `<inboxDir>/_processed/<파일명>`로 이동(이름 충돌 시 `-2`/`-3` 접미).
  4. 결과 카운트 `{ ingested, failed }` 반환. 파일 단위 try/catch(한 건 실패가 전체 중단 안 함).
- `auto()`에 ingest 삽입: `runPull()` → `ingestInbox()` → `runTransform()`. 앱 `whenReady`/`browser-window-focus`에서 트리거(기존 디바운스 재사용).
- **멱등**: `_processed` 이동으로 같은 .txt 재스캔 차단 + `writeMemoRaw`는 `memoBaseName`(uuid 기반)이라 매 인입이 새 항목(상류 dedup은 `_processed`가 담당). 인입 실패 시 원본 `.txt`는 인박스에 남아 다음 포커스가 재시도.

## 6. 변환 — 텍스트 모드 (`main/transform.ts`)

`transformMemo(client, meta, model)`: 텍스트 블록만(**이미지 없음**). `messages.parse` + `zodOutputFormat(MemoSchema)` + `thinking:{type:'adaptive'}` + `claude-opus-4-8`. `!parsed_output`이면 throw(capture/reflection과 동일 격리 기전).

`buildMemoPrompt(meta)`: "아래는 사용자가 메모장에 친 러프 메모다. Obsidian 노트용으로 정리하라(제목·정리 본문·태그). **제약: 사용자 메모 범위 안에서만 정리하라. 외부 사실을 지어내지 마라. 사용자의 표현과 관점(voice)을 보존하라.**" + 원문 주입 + 출력 규격(title·body·tags). `MemoSchema`(zod): `{ title: z.string().min(1), body: z.string(), tags: z.array(z.string()) }`.

`transform:run` kind 분기: memo → `transformMemo` + `writeMemoTransformed`. 실패는 raw 유지 + `transformError`(기존 `setTransformError` 재사용).

## 7. 노트 포맷 (`core/note.ts`) — reflection보다 단순(섹션·허브링크 없음)

**raw**:
```markdown
---
created: 2026-06-26T14:30:00+09:00
kind: memo
source: 아이디어.txt
tags: []
captureId: <uuid>
status: raw
---
<원문 .txt 본문 그대로>
```
**transformed**:
```markdown
---
created: 2026-06-26T14:30:00+09:00
kind: memo
source: 아이디어.txt
tags: [아이디어, 설계]
captureId: <uuid>
title: 복리적 학습 루프
status: transformed
---
<Claude가 정리한 마크다운 본문>
```
- 일반 노트라 **섹션 헤딩·임베드·허브링크 없음** — 본문은 frontmatter 다음 전체.
- 태그 합집합 `meta.tags ∪ transform.tags`(transformed에서, `union` 재사용; v1 `meta.tags=[]`이라 사실상 AI 태그).
- `parseMemoNote(md)`: frontmatter(`parseFrontmatter` 재사용) + body=frontmatter 이후 전체(trim). transformed면 `title`(frontmatter)·`tags`로 `MemoTransform` 파생, body=본문. raw면 transform 없음.
- `noteKind`에 memo 분기 추가(`kind: memo` → `'memo'`).

## 8. 승격 (`core/promote.ts` + `main`)

- `memoPromoteTargets(base, { notesDir })` = `{ notePath: joinPosix(notesDir, base+'.md') }`(이미지·허브 없음).
- `item:promote` memo 분기: `notesDir = vaultNotesDir/memoSubdir` → 대상 중복 검사 → `stripStagingFrontmatter`(status만 제거, kind/source/tags/title 보존) → `moveNoteOnly` → `removeItem`. **허브 upsert 없음** → reflection 승격에서 허브 단계만 뺀 형태.

## 9. UI (renderer)

- **트리아지 목록**: memo 행 kind 분기 — 썸네일 없음(문서 아이콘), `MemoBadge` + 제목/본문 미리보기. capture·reflection과 한 목록 공존(`transformed` 위, `raw` 아래).
- **`MemoEditor`**: `ItemEditor`/`ReflectionEditor` 구조 미러, prop `MemoStagingItem`. 필드: 제목·본문(textarea)·태그. 버튼 변환다시/승격/버리기(공유 IPC). 저장 `window.api.save(base, { title, body, tags })`.
- **입력 폼 없음** — 메모는 폴더에서 온다(reflection의 "새 감상" 같은 폼 불필요).
- **설정 시트**: `inboxDir`(폴더 선택 다이얼로그)·`memoSubdir` 입력 추가.
- 인박스 폴더 열기 버튼은 YAGNI(보류).

## 10. 에러 처리

| 지점 | 실패 | 처리 |
|---|---|---|
| ingest | inboxDir 미설정/미존재 | no-op(카운트 0). 비침습 |
| ingest | 파일 읽기/이동 실패 | 파일 단위 격리(failed++), 원본 `.txt` 인박스 잔류 → 다음 포커스 재시도 |
| 변환 | API 에러/키 없음 | raw 유지 + `transformError`. 키 없으면 비활성+안내(raw 수동편집·승격 가능) |
| 승격 | fs/대상 중복 | staging 유지, 재시도 안전. 대상 중복 경고 |
| 빈 .txt | 본문 공백 | 빈 메모도 raw로 인입(사용자가 트리아지에서 버리기). 또는 공백-only는 인입 스킵(설계 선택: **공백-only는 스킵**, 노이즈 방지) |

## 11. 테스트 전략

- **단위(core)**: `note.ts` memo 조립↔파싱 라운드트립(frontmatter·body·status·kind), `memo-schema`(파싱·거부), `promote.memoPromoteTargets`, `noteKind` memo 판별.
- **얇은 어댑터(main)**: `transformMemo`(SDK 모킹 — content에 **이미지 블록 없음**·텍스트만·스키마 강제), `inbox.ingestInbox`(tmpdir: `.txt`→staging raw + `_processed` 이동·멱등·공백-only 스킵·이름 충돌 접미), `staging-store` memo write/scan.
- **회귀 게이트**: 기존 capture·reflection 테스트 + typecheck + lint + electron-vite build **전부 green 유지**(StagingItem 3-멤버 유니온이 기존 분기를 깨지 않음 — 기존 `kind === 'capture'`/`'reflection'` narrow는 그대로, memo는 새 분기).
- **수동 e2e(사용자)**: 메모장에 `.txt` 저장 → 앱 포커스(자동 인입+정리) → 트리아지 수정 → 승격 → vault `메모/메모-….md` 확인 + 인박스 `.txt`가 `_processed/`로 이동 확인.

## 12. 완료 기준 (DoD)

- [ ] `inboxDir`에 `.txt` 저장 후 앱 포커스 시 staging raw memo로 인입되고 원본은 `_processed/`로 이동(재픽업 0).
- [ ] raw memo가 자동 텍스트 정리(transformed)되고, Claude는 정리·태깅만(외부 사실 미생성).
- [ ] 트리아지·에디터에서 capture·reflection·memo가 한 목록에 공존, memo 스침·수정.
- [ ] "승격" 1회로 memo 노트가 vault(`memoSubdir`) 정본(status 제거)으로 안착·staging에서 제거(허브 없음).
- [ ] 순수 코어(note·memo-schema·promote) + 어댑터(transform·inbox·staging) 테스트 + **기존 capture·reflection 회귀 0** + typecheck·lint·build green.

## 13. 비고

- 매체/입구 확장(다른 폴더·.md·파일분할·영속watch)은 후속. v1은 `.txt` 단일 폴더 포커스-스캔.
- `createdAt`=mtime이라 메모장에서 쓴 시점이 노트에 반영(픽업 지연 무관). KST 오프셋 표기는 reflection과 동일 후속.
- memo는 reflection 승격에서 허브 단계만 제거한 형태 — 두 kind의 승격 분기가 평행 구조라, 향후 LogOS 입력 타입이 늘면 promote 공통화 검토(현재는 YAGNI, kind별 분기 유지).
