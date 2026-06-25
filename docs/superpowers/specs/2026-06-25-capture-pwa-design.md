# 캡처 PWA (v1) — 모바일 짤·인사이트 캡처 → Obsidian 안착 설계

> 상태: 설계 승인됨(2026-06-25). 구현 계획 작성 전 단계.
> 이 문서는 더 큰 "개인 지식 OS"의 **첫 하위 프로젝트**인 캡처 PWA v1만 다룬다. 형제 모듈(변환 서비스·윈도우 인박스 분류기·데스크톱 deep-capture·재소환 루프)은 각자 별도 스펙을 가진다.

## 1. 목적

폰에서 마주친 짤·인사이트(쇼츠·게시글·교훈 스크린샷)를 **마찰 없이 캡처**해서, 갤러리에서 죽지 않고 **Obsidian vault 인박스에 안착**시키는 모바일 PWA. 캡처는 Cloudflare 릴레이를 거쳐 데스크톱 동기 도구가 vault로 떨군다.

해결하려는 통증: 통찰을 스크린샷으로 쌓아두지만 **소급(재방문) 과정이 없어 금방 빛을 잃는** 문제. v1은 그 통찰을 *Obsidian 안에 들여놓는 것*까지 책임진다 — 들어가 있어야 이후 변환·재소환이 가능해진다.

### 비목표 (v1 아님 — 후속 모듈)

- **변환 서비스**: 이미지→텍스트(OCR·인사이트 추출·규격 적용)는 별도 공유 모듈. v1은 이미지를 **러프하게** 안착시킬 뿐(변환 전 `status: raw`).
- **재소환 루프**: 주기적 다시보기/자가평가는 fast-follow.
- **책·영화 등 다른 입력 타입**: 같은 파이프에 *나중에* 타입만 추가(fast-follow). v1은 짤·인사이트 한 타입.
- **iOS 공유시트/단축어 자동화**: v1은 갤러리 수동 업로드(피커). 자동화는 후속.
- **데스크톱 본격 분류 UI**: 윈도우 인박스 분류기는 별도 모듈.

## 2. 더 큰 그림 — 이 모듈이 사는 시스템

캡처 PWA는 **개인 지식 OS**의 한 조각이다. 형제 모듈을 이해해야 v1 경계가 분명해진다.

핵심 원칙(시스템 전체 합의):

1. **Obsidian은 *쓰는 곳*이 아니라 *읽고 정착하는 곳*이다.** 사용자는 Obsidian에 직접·격식대로 작성하는 데 심리적 거부감이 있고, 실제로 거의 하지 않는다. 그래서 모든 쓰기는 **마찰 0의 표면**(모바일=캡처 PWA, 데스크톱=메모장→윈도우 인박스)에서 일어나고, 시스템이 그것을 Obsidian으로 잇는다.
2. **공통 골격**: `캡처(마찰0) → 인박스(staging) → 변환(타입별 규격 적용) → Obsidian 안착 → 재소환`. 모든 모듈이 이 골격을 공유한다.
3. **다각화 = "여러 기능"이 아니라 "하나의 관에 여러 입력 타입"**. 짤·책로그·감상로그가 같은 캡처→핸드오프 파이프를 탄다.
4. **AI는 잡일을, 사람은 1초의 확인을.** 변환은 자동화하되 가벼운 사람 확인 단계를 의도적으로 보존한다(그 접촉이 최소한의 재소환). — v1 범위 밖이나 설계 방향으로 기록.

디바이스 매트릭스(시스템 차원, 합의됨):

| 스트림 | 캡처(생성) | 소비·정리 | 담당 모듈 |
|---|---|---|---|
| 기술 노트 | PC · Obsidian | 폰 · Hachimon(리뷰) | Hachimon(완성) |
| **짤·인사이트** | **폰 100%**(갤러리) | 폰 빠른 분류 → Obsidian | **캡처 PWA(본 문서)** |
| 책 점진 세션 로그 | 폰(빠른) + 데스크톱(메모장) | PC · Obsidian | 캡처 PWA(타입 추가) + 윈도우 인박스 분류기 |
| 영화·만화·유튜브 감상 | 데스크톱(메모장) + 폰(빠른) | PC · Obsidian | 동상 |
| 윈도우/vault 인박스 | PC · 메모장/Obsidian | PC · Obsidian | 윈도우 인박스 분류기 |

## 3. 결정 사항 (승인됨)

| 항목 | 결정 |
|------|------|
| Surface | 새 **PWA**(React/Vite/Tailwind/shadcn), Hachimon 스택을 시드로 재사용. Hachimon과 **별개 앱** |
| 저장소(repo) | 별도 repo(독립 배포: PWA + Worker 한 세트). 디자인 시스템·`imageOptimize` 등은 Hachimon에서 가져와 재사용 |
| 핸드오프 전송 | **Cloudflare Worker + R2 릴레이**(이미 Cloudflare 사용 중, 저렴·저유지보수) |
| iOS 캡처 | 갤러리 수동 업로드(피커). 공유시트/단축어는 후속 |
| 안착 형태 | 캡처 1건 = **노트 1개**(이미지 임베드 + frontmatter + 메모). 각 통찰을 *주소 가능한 단위*로 |
| v1 타입 택소노미 | `인사이트 / 인용 / 레슨 / 기타` 4종(의도적으로 최소·확장 가능) |
| 변환 시점 | v1은 **변환 안 함**(러프 안착, `status: raw`). 변환은 후속 공유 모듈 |

## 4. 아키텍처

3개 컴포넌트. 폰에서 캡처 → 릴레이 임시 보관 → 데스크톱이 당겨 Obsidian에 안착.

```
[폰] 캡처 PWA
  갤러리 스샷 선택 + 메모·타입·태그
  → IndexedDB 큐 (오프라인 대비)
  → POST /captures        (이미지 Canvas 최적화 후 업로드)
                                │   [Cloudflare Worker 릴레이]
                                │     이미지 → R2,  메타 → D1
[PC] 데스크톱 동기 CLI ── GET /captures?consumed=0 ──┘
  → 이미지 다운로드 + 마크다운 노트를 vault 인박스에 기록
  → POST /captures/:id/consume   (소비 표시)
  → 이후 사용자가 Obsidian에서 분류·재소환 / (후속) 변환 서비스가 처리
```

### 4.1 모듈 경계

| 모듈 | 책임 | 의존 | 테스트 |
|------|------|------|--------|
| `pwa: src/lib/capture.ts` | 캡처 도메인: 타입 정의, 메타 직렬화, 큐 리듀서(추가/제거/재시도 상태) | 없음(순수) | 단위 |
| `pwa: src/lib/queue-db.ts` | IndexedDB 큐 래퍼(idb): 대기 캡처 영속화 | idb | 얇음(수동/통합) |
| `pwa: src/lib/upload.ts` | 릴레이 업로드 클라이언트: 멀티파트 POST, 재시도, 인증 헤더 | fetch | 얇음(모킹) |
| `pwa: src/lib/imageOptimize.ts` | 업로드 전 Canvas 리사이즈/WebP (**Hachimon에서 재사용**) | Canvas | 기존 테스트 재사용 |
| `pwa: 컴포넌트/페이지` | 캡처 폼 + 대기 큐 화면(디자인 시스템 재사용) | 위 lib | 수동(UI) |
| `worker: src/relay.ts` | 엔드포인트 4종, 토큰 인증, R2/D1 바인딩 | R2·D1 | `@cloudflare/vitest-pool-workers` |
| `worker: src/schema.ts` | 캡처 메타 검증(zod) + D1 row 매핑 | zod | 단위 |
| `desktop: scripts/sync-captures.ts` | 미소비 당겨오기, 이미지·노트 기록, consume 호출, 멱등 | 위 + fs·fetch | 인자/순수 로직 단위 |
| `desktop: src/note.ts` | 캡처 메타 → 안착 마크다운 노트 문자열(frontmatter+임베드) | 없음(순수) | 단위 |

순수 로직(`capture.ts`·`note.ts`·`schema.ts`)은 부수효과 없음. 모든 I/O(IndexedDB·fetch·R2·D1·fs)는 얇은 어댑터로 격리한다 — Hachimon의 `src/lib/forge/*`(순수) ↔ `scripts/inbox.ts`(부수효과) 분리 패턴을 그대로 따른다.

### 4.2 데이터 모델

```ts
// 캡처 메타데이터 (PWA·릴레이·데스크톱 공유 형태)
interface CaptureMeta {
  id: string;            // 클라이언트 생성 UUID (멱등 키)
  createdAt: string;     // ISO 8601 (캡처 시각)
  type: 'insight' | 'quote' | 'lesson' | 'misc';
  note: string;          // 사용자 한 줄 메모(빈 문자열 허용)
  source: string;        // 출처 URL/앱 이름(선택, 빈 문자열 허용)
  tags: string[];        // 사용자 태그(선택)
  imageExt: string;      // 'webp' | 'png' | 'jpg' ... (최적화 후 통상 'webp')
}

// 릴레이 D1 row = CaptureMeta + 상태
//   status: 'pending' | 'ready'   (업로드 원자성: row(pending)→R2 put→ready)
//   consumed: 0 | 1, consumedAt: string | null
//   imageKey: string              (R2 객체 키, = `${id}.${imageExt}`)

// PWA IndexedDB 큐 항목 = CaptureMeta + 로컬 상태
//   imageBlob: Blob               (최적화된 이미지)
//   uploadState: 'queued' | 'uploading' | 'failed' | 'sent'
//   attempts: number
```

## 5. 릴레이 (Cloudflare Worker + R2 + D1)

폰↔PC 사이 임시 보관소. 단일 사용자.

- **인증**: 단일 시크릿 베어러 토큰(`Authorization: Bearer <token>`). 토큰은 Worker secret. R2 버킷은 **비공개** — 이미지는 인증된 Worker 엔드포인트로만 서빙(공개 URL 없음).
- **저장**: 이미지 blob → R2, 메타 → D1(SQLite). D1로 `WHERE consumed=0 AND status='ready'` 깔끔 조회·정렬.
- **엔드포인트**:

  | 메서드·경로 | 동작 | 비고 |
  |---|---|---|
  | `POST /captures` | 멀티파트(이미지 파트 + 메타 JSON 파트). D1 row(`pending`) 생성 → R2 put → row `ready` 갱신. `{id}` 반환 | 이미 존재하는 `id`면 멱등 무시(중복 전송 안전) |
  | `GET /captures?consumed=0` | `ready` & 미소비 메타 목록(JSON) | 데스크톱이 폴링 |
  | `GET /captures/:id/image` | R2에서 이미지 스트림 | 인증 필요 |
  | `POST /captures/:id/consume` | `consumed=1, consumedAt=now` (멱등) | 데스크톱이 안착 성공 후 호출 |

- **업로드 원자성**: row(`pending`)→R2 put→row `ready` 순서. `GET ?consumed=0`은 `ready`만 반환 → 반쪽 업로드를 데스크톱이 가져가지 않는다. `pending`인 채 일정 시간(예: 1h) 경과한 고아 row는 cron이 정리.
- **수명/정리**: 스케줄드 Worker(cron)가 `consumed=1 AND consumedAt < now-7d`인 R2 객체+D1 row를 purge(안전 창 7일). 미소비분은 절대 자동 삭제하지 않는다.
- **한도**: 단일 사용자·저volume 전제. 요청 크기 상한(예: 이미지 10MB) 초과 시 413. 인증 실패 401, 미존재 404.

## 6. 데스크톱 동기 CLI (`scripts/sync-captures.ts`)

Hachimon `scripts/*.ts` + `tsx` 패턴. 설정: 릴레이 URL·토큰·vault 인박스 경로·첨부 폴더(환경변수 또는 설정 파일).

처리 루프:

```
GET /captures?consumed=0
 → 각 캡처:
     1. 이미지 다운로드 (GET /captures/:id/image)
     2. 첨부 폴더에 이미지 파일 기록  (짤-YYYY-MM-DD-<shortid>.<ext>)
     3. vault 인박스에 노트(.md) 기록  (note.ts 가 생성)
     4. 둘 다 성공 시에만 POST /captures/:id/consume
```

안착 노트(v1 = 러프 안착, 변환 전):

```markdown
---
created: 2026-06-25T14:30:00+09:00
type: insight
source: <url 또는 앱>
tags: []
captureId: <uuid>
status: raw          # 후속 변환 서비스가 처리할 표식
---
![[짤-2026-06-25-a3f2.webp]]

<있으면 사용자 메모 한 줄>
```

- **멱등**: 노트 frontmatter `captureId`와 결정적 파일명으로 중복 판단. 이미 존재하면 기록 건너뛰고 consume만 보장 → 재실행·부분실패 복구 안전.
- **부분 실패**: 디스크 기록 실패 또는 네트워크 실패 시 consume **안 함** → 다음 실행이 dedup로 안전하게 복구. consume 실패해도 다음 실행이 재시도(중복 안착은 dedup가 막음).
- **운용(마찰 0)**: 기본은 **Windows 작업 스케줄러**(로그온/주기 실행)로 등록 → 캡처가 Obsidian에 *저절로 나타남*. `npm run sync` 수동 실행은 폴백. (스케줄러 등록 절차는 구현 계획에서 문서화.)
- **안착 위치**: vault 인박스 하위 짤 전용 폴더(설정값). 이 폴더는 Hachimon `cards.json` 빌드와 무관(플래시카드 아님) — 충돌 없음.

## 7. 에러 처리 · 오프라인

| 지점 | 실패 | 처리 |
|---|---|---|
| PWA 캡처 | 오프라인/업로드 실패 | IndexedDB 큐 잔류, `uploadState=failed`, 재시도 버튼/자동 재시도. 데이터 유실 없음 |
| PWA 이미지 | 과대 용량 | 업로드 전 Canvas 리사이즈(가로 상한)+WebP. 그래도 초과면 사용자 경고 |
| 릴레이 업로드 | R2 put 실패 | row `pending` 잔류 → cron 정리. 클라이언트는 재시도(같은 id로 멱등) |
| 릴레이 인증 | 토큰 불일치 | 401, PWA·CLI 모두 명확한 에러 표시 |
| 데스크톱 다운로드 | 네트워크/디스크 실패 | consume 안 함 → 재실행 복구 |
| 데스크톱 중복 | 같은 캡처 재처리 | `captureId` dedup로 무해 |

엣지 케이스: 메모·출처·태그는 모두 빈 값 허용(스샷만으로 캡처 가능). 메모 없는 캡처는 PWA에서 ⚠ 시각 표시(맥락 상실 경고)하되 전송은 허용.

## 8. 테스트 전략

Hachimon 분리 원칙(순수 로직 단위 테스트 + 부수효과 얇게)을 따른다.

- **단위(vitest)**: `capture.ts`(타입·메타 직렬화·큐 리듀서), `note.ts`(캡처→마크다운 라운드트립: 생성된 노트의 frontmatter·임베드·captureId 검증), `worker/schema.ts`(검증·거부), 슬러그/파일명 결정성·dedup 로직.
- **Worker**: `@cloudflare/vitest-pool-workers`로 엔드포인트 4종(인증, 업로드 원자성, 미소비 조회, 멱등 consume) 검증.
- **얇은 어댑터**(IndexedDB·fetch·fs·R2)는 모킹 또는 통합으로 최소 검증.
- **수동 e2e(1회)**: 실제 폰 캡처 → 릴레이 → `npm run sync` → Obsidian에 노트·이미지 안착 확인.

## 9. 보안 고려

- 릴레이는 **개인 스크린샷**을 보관 → 강한 시크릿 토큰, HTTPS(Cloudflare 기본), R2 비공개(공개 URL 금지, 인증 엔드포인트 경유만).
- 토큰은 PWA에 설정(로컬 저장)·CLI 환경변수. 유출 시 토큰 회전으로 차단.
- 보관은 임시(소비+7일 후 purge) — 장기 보존소가 아니라 전송 버퍼.

## 10. 로드맵 위치

```
v1 (본 문서)        : 짤 캡처 PWA + 릴레이 + 데스크톱 동기 → Obsidian 러프 안착
fast-follow         : 캡처 PWA에 책/감상 로그 타입 추가(같은 관)
공유 변환 서비스      : 타입별 규격 적용(Claude, 이미지는 vision OCR+추출) + 가벼운 트리아지 → 정식 노트
윈도우 인박스 분류기   : 메모장이 뱉은 윈도우 .txt 픽업·변환·정착(데스크톱 모듈)
재소환 루프          : 주기적 다시보기·자가평가
```

각 후속 항목은 자기 스펙→계획→구현 사이클을 가진다. v1은 "통찰을 폰에서 빼내 Obsidian에 안전히 들여놓기"라는 단일 책임에 집중한다.
