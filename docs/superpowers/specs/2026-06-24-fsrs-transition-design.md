# FSRS 완전 전환 — 설계 문서

> 작성일: 2026-06-24
> 상태: 승인됨
> ROADMAP 항목: 5-1 (FSRS 전환 검토)

## 배경 / 목적

Hachimon은 현재 SM-2 알고리즘(`src/lib/sm2.ts`)으로 간격 반복 스케줄링을 수행한다. SM-2는 단순하지만 정확도가 낮다. FSRS(Free Spaced Repetition Scheduler)는 머신러닝으로 도출된 가중치 기반 모델로, 동일 복습량 대비 더 높은 기억 유지율을 제공한다.

이 작업은 SM-2를 **완전히 폐기**하고 FSRS-6로 전환한다. 두 알고리즘을 공존시키지 않는다(이중 엔진 유지 복잡도 회피). 기존 스케줄은 `reviewLog` 리플레이로 정확히 마이그레이션한다.

### 비목표 (Non-goals)
- SM-2 / FSRS 토글(이중 알고리즘) — 명시적으로 배제.
- FSRS 가중치(w[0..18]) 사용자 튜닝 UI — 기본 가중치 사용.
- 가중치 자동 최적화(optimizer) — 향후 과제.

## 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 전환 성격 | 완전 전환 (SM-2 폐기) |
| 구현 방식 | `ts-fsrs@5.4.1` 라이브러리 (FSRS-6) |
| 마이그레이션 | `reviewLog` 시간순 리플레이 |
| 평가 매핑 | Again(0)→`Rating.Again`, Hard(2)→`Rating.Hard`, Good(4)→`Rating.Good`, Easy(5)→`Rating.Easy` |
| 새 카드 감지 | `state === New` (기존 `lastReviewedAt === null`과 동치 유지) |
| 마스터 기준 | `state === Review && stability >= 30`(일) |
| 노출 설정 | 목표 기억 유지율(retention) 슬라이더만 |

## 라이브러리

- **`ts-fsrs@5.4.1`** (npm latest, FSRS-6 구현). 번들 ~20KB.
- 사용 API: `fsrs()`, `generatorParameters()`, `createEmptyCard()`, `Rating`, `State`, `f.next(card, now, rating)`, `f.repeat(card, now)`.
- CLAUDE.md "의존성 최소화" 원칙과 충돌하지 않음 — idb/react-markdown처럼 검증된 핵심 라이브러리를 채택하는 동일 맥락. FSRS의 가치(검증된 스케줄링 정확도)는 정밀한 가중치/공식에서 나오므로 직접 구현은 가치를 훼손함.

## 데이터 모델

### `Schedule` 타입 교체 (`src/types/index.ts`)

SM-2 필드(`easeFactor`, `interval`, `repetitions`)를 FSRS 상태로 교체한다. 단, 앱이 이미 광범위하게 쿼리하는 날짜 필드명 `nextReviewAt` / `lastReviewedAt`는 **유지**하여 due/new/streak 로직 변경을 최소화한다.

```ts
export interface Schedule {
  cardId: string;
  stability: number;        // FSRS stability (S)
  difficulty: number;       // FSRS difficulty (D)
  state: number;            // 0 New · 1 Learning · 2 Review · 3 Relearning
  reps: number;             // 누적 복습 횟수
  lapses: number;           // 누적 lapse 횟수
  elapsedDays: number;      // 직전 복습 이후 경과일
  scheduledDays: number;    // 직전에 부여된 간격
  nextReviewAt: string;     // = FSRS due (ISO)
  lastReviewedAt: string | null; // = FSRS last_review (ISO), New이면 null
}
```

- `state`는 숫자(ts-fsrs `State` enum 값)로 저장한다. 0=New, 1=Learning, 2=Review, 3=Relearning.
- ts-fsrs `Card`는 `due` / `last_review`를 `Date` 객체로 다루므로, `fsrs.ts` 경계에서 ISO string ↔ Date 변환을 수행한다.

### `Quality` 타입

기존 `Quality = 0 | 2 | 4 | 5` 유지 (UI 버튼은 그대로). `fsrs.ts` 내부에서 ts-fsrs `Rating` **enum 멤버**로 매핑한다:

```ts
const RATING_MAP: Record<Quality, Rating> = {
  0: Rating.Again, // 1
  2: Rating.Hard,  // 2
  4: Rating.Good,  // 3
  5: Rating.Easy,  // 4
};
```

> ⚠️ `Rating.Manual = 0`이 존재하므로 절대 숫자 리터럴(앱 quality `0`)을 Rating에 그대로 넣지 않는다. 반드시 enum 멤버로 매핑한다.

## 신규 모듈: `src/lib/fsrs.ts` (sm2.ts 대체)

`sm2.ts`를 삭제하고 동일 인터페이스의 FSRS 구현으로 대체한다. import 경로(`merge.ts`, `useReviewSession.ts`)를 교체한다.

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `createInitialSchedule` | `(cardId: string, now?: Date) => Schedule` | `createEmptyCard` 래핑. state=New, lastReviewedAt=null. |
| `applyRating` | `(schedule: Schedule, quality: Quality, now?: Date) => Schedule` | quality→Rating 변환 후 `f.next()` 호출 → 새 Schedule 반환. |
| `previewIntervals` | `(schedule: Schedule, now?: Date) => Record<Quality, number>` | `f.repeat()`로 4개 평가 각각의 다음 간격(scheduledDays, 일)을 반환. |
| `getScheduler` | `(opts: { requestRetention: number; maximumInterval?: number }) => FSRS` | settings 기반 fsrs 인스턴스 생성. |

- `now?` 인자는 테스트 결정성을 위해 주입 가능하게 한다(기본값 `new Date()`).
- Schedule ↔ ts-fsrs `Card` 변환 헬퍼(`toFsrsCard`, `fromFsrsCard`)를 모듈 내부 private로 둔다.
- 스케줄러 파라미터는 호출 시 settings에서 읽어 주입한다. 기본 retention 0.90, maximum_interval 36500.

### ⚠️ ts-fsrs 반환 형태 주의 (API 정확성)

ts-fsrs는 `Card`를 직접 반환하지 않는다. 반드시 `.card`를 언랩한다:

- `f.next(card, now, rating)` → **`RecordLogItem`** `{ card, log }`. `applyRating`은 `.card`를 꺼내 `fromFsrsCard`로 변환한다(`.log`는 사용 안 함; reviewLog는 호출부가 별도 기록).
- `f.repeat(card, now)` → **Rating별로 키된 레코드**(`RecordLog`). 각 값이 `RecordLogItem`. `previewIntervals`는 각 Rating에 대해 `result[rating].card.scheduled_days`를 읽는다.
- ts-fsrs `Card` 필드는 snake_case(`due`, `last_review`, `stability`, `difficulty`, `state`, `reps`, `lapses`, `elapsed_days`, `scheduled_days`). 경계 헬퍼에서 우리 `Schedule`의 camelCase(`nextReviewAt`, `lastReviewedAt`, `elapsedDays`, `scheduledDays`)로 매핑한다.

### `applyRating`의 부수효과 경계

`useReviewSession.rate()`는 현재 `applyRating` 호출 + `db.put('schedules')` + `db.put('reviewLog')`를 수행한다. `fsrs.ts.applyRating`은 **순수 함수**(Schedule in → Schedule out)로 유지하고, DB 쓰기는 호출부(`useReviewSession`)에 남긴다. 이 경계는 SM-2와 동일하게 유지된다.

### `getNextInterval` UI 계약 유지

`useReviewSession`은 현재 `getNextInterval(quality): string`을 노출하고 `ReviewSession.tsx`(line 160 부근)가 이를 소비한다. `previewIntervals`는 숫자(일)를 반환하므로, **`useReviewSession` 내부에 기존 문자열 포매팅을 그대로 둔 얇은 `getNextInterval` 래퍼**를 유지한다(`previewIntervals(...)[quality]`를 받아 `1일`/`N일`/`N개월`/`N.N년`으로 포맷). UI 컴포넌트(`ReviewSession.tsx`)는 변경하지 않는다.

## 마이그레이션 — reviewLog 리플레이

### 모듈: `src/lib/migrate.ts`

```
migrateToFsrs(now?: Date): Promise<void>
```

- **호출 지점**: `src/hooks/useCards.ts`에서 `initializeCards()` 완료 직후 체이닝(`initializeCards().then(() => migrateToFsrs()).then(...)`). `initializeCards`는 vault 모드면 fetch/merge 없이 early-return 하므로, 그 안에 두면 vault 경로에서 마이그레이션이 누락된다. 따라서 양쪽(vault/demo) 경로를 모두 커버하는 `useCards`의 `initializeCards` 직후가 정확한 단일 호출 지점이다. (vault·demo 모두 이 시점엔 카드가 DB에 존재한다.)
- settings 플래그 `schedulerVersion`로 **1회만 실행** 가드. 값이 `'fsrs'`이면 즉시 반환.
- 절차:
  1. 모든 카드 ID 수집.
  2. 각 카드에 대해 `reviewLog`(by-card 인덱스)를 `reviewedAt` 오름차순 정렬.
  3. `createEmptyCard()`에서 시작 → 각 로그를 `f.next(card, new Date(log.reviewedAt), mapRating(log.quality))`로 순차 적용. 과거 타임스탬프를 그대로 사용하여 elapsed_days가 정확히 계산되도록 함.
  4. 최종 ts-fsrs Card → `Schedule`로 변환하여 `db.put('schedules')`.
  5. 로그가 없는 카드 → `createInitialSchedule(cardId, now)`.
  6. 완료 후 settings에 `schedulerVersion='fsrs'` 기록.
- 리플레이는 settings의 현재 retention을 사용한다.

### 안전성
- `reviewLog`는 변경하지 않는다(읽기 전용 소스 오브 트루스). 실패 시 schedules만 영향, 로그는 보존.
- 마이그레이션 전체를 try-catch로 감싸고, 실패 시 플래그를 세우지 않아 다음 실행에서 재시도 가능하게 한다.

## DB 변경 (`src/lib/db.ts`)

- DB 버전 `1 → 2` 상향.
- schedules 스토어는 keyPath(`cardId`) 동일, 값은 schema-less이므로 `createObjectStore` 변경 불필요.
- `upgrade(db, oldVersion)`에서 oldVersion < 2 처리 블록을 추가하되, 실제 데이터 변환(리플레이)은 idb upgrade 트랜잭션 내에서 하지 않는다(비동기 reviewLog 읽기 + 외부 라이브러리 호출이 idb 트랜잭션 수명과 충돌). 대신 앱 레이어 `migrateToFsrs()`가 담당하고, idb upgrade는 버전만 올린다.
- 기존 IndexedDB(version 1)를 가진 사용자: upgrade가 호출되며 스토어는 보존됨. 그 후 `migrateToFsrs()`가 기존 SM-2 Schedule을 FSRS로 덮어쓴다.

## Settings (`src/pages/Settings.tsx`, `useSettings`)

- "초기 Ease Factor" / "최소 Ease Factor" 슬라이더 **제거**.
- **"목표 기억 유지율"** 슬라이더 추가: 범위 0.80~0.97, 기본 0.90, 1% 단위. 표시는 백분율(`90%`).
- `useSettings`의 설정 객체: `initialEF`, `minEF` 제거 → `requestRetention: number` 추가.
- 최대 간격은 노출하지 않고 기본값(36500일) 고정 (YAGNI).
- settings 기본값 마이그레이션: 기존 사용자에 `requestRetention`이 없으면 0.90으로 초기화.

## 통계 / 마스터 정의 (`src/lib/data.ts`)

- `isMastered(s)`: `s.easeFactor >= 2.5 && s.repetitions >= 5` → **`s.state === State.Review && s.stability >= 30`**.
- `MASTERY_EF` / `MASTERY_REP` 상수 → `MASTERY_STABILITY = 30` 등으로 교체.
- `getDueCards` / `getDueCount` / `getNewCardCount`의 `nextReviewAt <= now`, `lastReviewedAt !== null` 조건은 필드명을 유지하므로 **변경 없음**. (`nextReviewAt`는 ISO 문자열이고 FSRS `due`를 ISO로 매핑하므로 lexicographic 비교가 시간순과 일치함 — 의도된 동작.)

### `getForgeCards` 약점 점수 재정의 (`data.ts` 312-322)

`weakness(c)`가 `s.easeFactor`/`s.repetitions`를 직접 참조하므로 FSRS 필드로 교체한다. FSRS `difficulty`는 1~10 범위로 **높을수록 어려움(=약함)**, `reps`는 누적 복습 횟수, `state === New`는 미학습:

```ts
const weakness = (c: Card): number => {
  const s = schedMap.get(c.id);
  const difficulty = s?.difficulty ?? 5;       // 1~10, 높을수록 약함
  const reps = s?.reps ?? 0;
  return (
    (stumbles.get(c.id) || 0) +                // 가장 강한 약점 신호 (reviewLog 기반, 변경 없음)
    (difficulty - 1) / 9 +                      // EF 부족 → difficulty 정규화(0~1)
    (reps === 0 ? 0.5 : 0) +                    // 미학습 보정
    Math.random() * 0.3                         // 동점 흔들기
  );
};
```

> `tierAccuracy`(`src/lib/stats.ts`)는 schedules가 아닌 `reviewLog` 기반이므로 ef/rep를 참조하지 않는다 — **변경 없음**.

## 백업 (`src/lib/backup.ts`)

- `buildExport`는 schedules를 그대로 직렬화하므로 새 Schedule 형태가 자동 반영됨.
- export payload의 스키마 버전 문자열을 갱신(예: `schedulerVersion: 'fsrs'` 또는 export version bump)하여 SM-2 시절 백업과 구분 가능하게 함.

## 새 카드 감지 (`src/lib/newcards.ts`)

- 현재: `schedule.lastReviewedAt === null`.
- FSRS에서도 New 카드는 `lastReviewedAt === null`이므로 **로직 변경 없음**. (선택적으로 `state === State.New`로 명시화 가능하나 동치이므로 기존 유지.)

## 삭제 / 정리

- `src/lib/sm2.ts` 삭제.
- `src/lib/sm2.test.ts` (존재 시) 삭제.
- `createInitialSchedule` / `applyRating`를 import 하는 **모든** 곳의 경로를 `sm2` → `fsrs`로 교체:
  - `src/lib/merge.ts` (`createInitialSchedule`)
  - `src/lib/data.ts` (`createInitialSchedule` — `resetLearningData`에서 사용, line 17/220)
  - `src/hooks/useReviewSession.ts` (`applyRating`)

## 테스트 전략

### `src/lib/fsrs.test.ts`
- `createInitialSchedule`이 state=New, lastReviewedAt=null, reps=0을 반환.
- `applyRating`: New 카드에 Good 적용 시 state가 Learning/Review로 전이, nextReviewAt가 미래.
- `previewIntervals`: 동일 카드에서 간격 단조성 `Again <= Hard <= Good <= Easy`.
- 평가 매핑이 ts-fsrs Rating과 일치(Again→1 … Easy→4).
- `now` 주입으로 결정적 검증.

### `src/lib/migrate.test.ts`
- 주어진 `reviewLog` 시퀀스(고정 타임스탬프)를 리플레이하면 결정적 Schedule(state=Review, stability>0)을 생성.
- 로그 없는 카드는 초기 Schedule(New).
- `schedulerVersion` 플래그가 이미 `'fsrs'`이면 재실행하지 않음(멱등성).

## 영향 범위 요약 (파일별)

| 파일 | 변경 |
|------|------|
| `src/types/index.ts` | `Schedule` 인터페이스 교체 |
| `src/lib/fsrs.ts` | **신규** (sm2.ts 대체) |
| `src/lib/sm2.ts` | **삭제** |
| `src/lib/migrate.ts` | **신규** (리플레이) |
| `src/lib/db.ts` | 버전 1→2, upgrade 블록 |
| `src/lib/merge.ts` | import 교체 (`createInitialSchedule`) |
| `src/lib/data.ts` | 마스터 정의, `getForgeCards` 약점 점수, `createInitialSchedule` import 교체 |
| `src/lib/backup.ts` | 스키마 버전 갱신 |
| `src/hooks/useReviewSession.ts` | import 교체, `previewIntervals` 사용, `getNextInterval` 문자열 래퍼 유지 |
| `src/hooks/useCards.ts` | `migrateToFsrs()` 호출 추가 (`initializeCards` 직후) |
| `src/hooks/useSettings.ts` | requestRetention 추가, EF 제거 |
| `src/pages/Settings.tsx` | retention 슬라이더로 교체 |
| `package.json` | `ts-fsrs` 의존성 추가 |

## 작업 진행 방식

- 메모리 워크플로 준수: master 직접 커밋 금지. `feat/fsrs-transition` 브랜치 → PR → merge 커밋.
- Conventional commits.
- TypeScript strict, 기존 코딩 컨벤션 준수.
