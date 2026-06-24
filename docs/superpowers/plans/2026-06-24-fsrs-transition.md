# FSRS 완전 전환 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SM-2 스케줄링 엔진을 폐기하고 `ts-fsrs`(FSRS-6) 기반으로 완전 전환하며, 기존 학습 기록을 reviewLog 리플레이로 마이그레이션한다.

**Architecture:** `Schedule` 타입을 FSRS 상태(stability/difficulty/state 등)로 교체하되 앱이 광범위하게 쿼리하는 `nextReviewAt`/`lastReviewedAt` 날짜 필드명은 유지한다. 순수 함수 모듈 `fsrs.ts`(sm2.ts 대체)가 ts-fsrs를 래핑하고, DB 쓰기는 호출부에 남긴다. `migrate.ts`가 앱 init 시 1회 reviewLog를 리플레이해 FSRS 상태를 재구성한다.

**Tech Stack:** React 19 + TypeScript(strict) + Vite, IndexedDB(idb), `ts-fsrs@^5.4.1`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-24-fsrs-transition-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `src/lib/fsrs.ts` | ts-fsrs 래핑: 초기 스케줄·평가 적용·간격 미리보기·스케줄러 생성·Schedule↔Card 변환 | 신규 (sm2.ts 대체) |
| `src/lib/fsrs.test.ts` | fsrs.ts 단위 테스트 | 신규 |
| `src/lib/migrate.ts` | reviewLog 리플레이 마이그레이션 (1회 가드) | 신규 |
| `src/lib/migrate.test.ts` | migrate.ts 단위 테스트 | 신규 |
| `src/lib/sm2.ts` | — | 삭제 |
| `src/types/index.ts` | `Schedule` 인터페이스 | FSRS 필드로 교체 |
| `src/lib/db.ts` | IndexedDB 스키마/버전 | 버전 1→2 |
| `src/lib/merge.ts` | cards.json↔IndexedDB 머지 | import 교체 |
| `src/lib/data.ts` | 쿼리 레이어: 마스터 정의·Forge 약점·초기 스케줄 import | FSRS 필드로 교체 |
| `src/lib/backup.ts` | 백업 직렬화 | EXPORT_VERSION 1→2 |
| `src/hooks/useReviewSession.ts` | 세션 상태·평가 적용 | import 교체 + previewIntervals + getNextInterval 래퍼 |
| `src/hooks/useCards.ts` | 카드 초기화 훅 | migrateToFsrs 호출 추가 |
| `src/hooks/useSettings.ts` | 설정 영속화 | initialEF/minEF 제거, requestRetention 추가 |
| `src/pages/Settings.tsx` | 설정 UI | EF 슬라이더 → retention 슬라이더 |
| `src/lib/newcards.test.ts` | (픽스처) | Schedule 헬퍼 갱신 |
| `src/lib/backup.test.ts` | (픽스처) | Schedule 헬퍼 갱신 |
| `package.json` | 의존성 | ts-fsrs 추가 |

**참고 — TypeScript 캐스케이드:** `Schedule` 타입 교체는 `easeFactor`/`interval`/`repetitions`를 참조하는 모든 곳(sm2.ts, data.ts, useReviewSession, 두 테스트 픽스처)을 동시에 깨뜨린다. 따라서 **Task 3(코어 엔진 교체)는 하나의 원자적 컴파일 단위**다 — 타입 교체·fsrs.ts 생성·sm2 삭제·소비처 수정·픽스처 수정이 한 커밋에서 함께 그린이 되어야 한다. Task 3 내부 스텝은 잘게 나누되, 최종 게이트(typecheck + test + build)에서 한 번에 통과시킨다.

---

## Chunk 1: 의존성 · DB · 코어 엔진

### Task 1: ts-fsrs 의존성 추가

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 설치**

Run: `npm install ts-fsrs@^5.4.1`
Expected: `package.json`의 dependencies에 `"ts-fsrs": "^5.4.1"` 추가, 설치 성공.

- [ ] **Step 2: 설치 확인**

Run: `node -e "const f=require('ts-fsrs'); console.log(typeof f.fsrs, typeof f.createEmptyCard, f.Rating.Again, f.State.Review)"`
Expected: `function function 1 2` (Rating.Again=1, State.Review=2)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ts-fsrs dependency"
```

---

### Task 2: DB 버전 1→2 상향

DB 버전만 올리고 schedules 스토어 스키마는 그대로 둔다(값은 schema-less). 실제 데이터 변환은 Task 4의 앱 레이어 리플레이가 담당한다.

**Files:**
- Modify: `src/lib/db.ts:30-46`

- [ ] **Step 1: 버전 상향 + upgrade 시그니처**

`db.ts`의 `openDB<HachimonDB>('hachimon', 1, { upgrade(db) {` 를 다음으로 교체:

```ts
  dbInstance = await openDB<HachimonDB>('hachimon', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('by-deck', 'deck');

        db.createObjectStore('schedules', { keyPath: 'cardId' });

        const logStore = db.createObjectStore('reviewLog', {
          keyPath: 'id',
          autoIncrement: true,
        });
        logStore.createIndex('by-card', 'cardId');
        logStore.createIndex('by-session', 'sessionId');

        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v1 → v2: 스토어 스키마 변경 없음. schedules 값(Schedule)은 schema-less이며
      // SM-2 → FSRS 데이터 변환은 앱 레이어 migrateToFsrs()가 수행한다.
    },
  });
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b`
Expected: 통과 (이 시점엔 Schedule 미변경이라 에러 없음).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: bump IndexedDB version to 2 for FSRS migration"
```

---

### Task 3: 코어 엔진 교체 (Schedule 타입 + fsrs.ts + sm2 삭제 + 소비처)

> **원자적 컴파일 단위.** 아래 스텝은 순서대로 작성하되, 중간에는 컴파일이 깨질 수 있다. 최종 게이트(Step 13~15)에서 typecheck·test·build를 한 번에 통과시킨 뒤 1커밋한다.

**Files:**
- Create: `src/lib/fsrs.ts`, `src/lib/fsrs.test.ts`
- Modify: `src/types/index.ts:26-33`, `src/lib/merge.ts:3`, `src/hooks/useReviewSession.ts`, `src/lib/data.ts`, `src/lib/newcards.test.ts:15-17`, `src/lib/backup.test.ts`
- Delete: `src/lib/sm2.ts`

- [ ] **Step 1: Schedule 타입 교체**

`src/types/index.ts`의 `Schedule` 인터페이스를 교체:

```ts
export interface Schedule {
  cardId: string;
  stability: number;       // FSRS stability (S)
  difficulty: number;      // FSRS difficulty (D), 1~10
  state: number;           // 0 New · 1 Learning · 2 Review · 3 Relearning
  reps: number;            // 누적 복습 횟수
  lapses: number;          // 누적 lapse 횟수
  elapsedDays: number;     // 직전 복습 이후 경과일
  scheduledDays: number;   // 직전에 부여된 간격(일)
  nextReviewAt: string;    // = FSRS due (ISO)
  lastReviewedAt: string | null; // = FSRS last_review (ISO), New이면 null
}
```

- [ ] **Step 2: fsrs.test.ts 작성 (실패하는 테스트)**

`src/lib/fsrs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { State } from 'ts-fsrs';
import { createInitialSchedule, applyRating, previewIntervals } from './fsrs';

const now = new Date(2026, 5, 24, 12, 0, 0);

describe('createInitialSchedule', () => {
  it('New 상태로 초기화한다', () => {
    const s = createInitialSchedule('c1', now);
    expect(s.cardId).toBe('c1');
    expect(s.state).toBe(State.New);
    expect(s.reps).toBe(0);
    expect(s.lastReviewedAt).toBeNull();
  });
});

describe('applyRating', () => {
  it('Good 평가 시 복습이 기록되고 다음 복습이 미래로 잡힌다', () => {
    const s0 = createInitialSchedule('c1', now);
    const s1 = applyRating(s0, 4, now); // Good
    expect(s1.lastReviewedAt).not.toBeNull();
    expect(s1.reps).toBe(1);
    expect(new Date(s1.nextReviewAt).getTime()).toBeGreaterThan(now.getTime());
    expect(s1.state).not.toBe(State.New);
  });

  it('Again은 lapse/relearning 쪽으로, Easy는 가장 긴 간격으로 간다', () => {
    const s0 = createInitialSchedule('c1', now);
    const again = applyRating(s0, 0, now);
    const easy = applyRating(s0, 5, now);
    expect(new Date(easy.nextReviewAt).getTime())
      .toBeGreaterThan(new Date(again.nextReviewAt).getTime());
  });
});

describe('previewIntervals', () => {
  it('간격 단조성: Again ≤ Hard ≤ Good ≤ Easy', () => {
    const s0 = createInitialSchedule('c1', now);
    const p = previewIntervals(s0, now);
    expect(p[0]).toBeLessThanOrEqual(p[2]);
    expect(p[2]).toBeLessThanOrEqual(p[4]);
    expect(p[4]).toBeGreaterThanOrEqual(p[5]); // Good(4) ≤ Easy(5)
  });

  it('네 평가 키(0/2/4/5)를 모두 반환한다', () => {
    const p = previewIntervals(createInitialSchedule('c1', now), now);
    expect(Object.keys(p).map(Number).sort((a, b) => a - b)).toEqual([0, 2, 4, 5]);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/lib/fsrs.test.ts`
Expected: FAIL — `fsrs.ts` / 함수 미존재.

- [ ] **Step 4: fsrs.ts 구현**

`src/lib/fsrs.ts`:

```ts
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type FSRS,
  type Grade,
  type Card as FsrsCard,
} from 'ts-fsrs';
import type { Schedule, Quality } from '@/types';

// Grade = Exclude<Rating, Rating.Manual>. f.next/f.repeat는 Grade만 받으므로
// Rating이 아닌 Grade로 타이핑해야 strict 모드 타입체크를 통과한다.
const RATING_MAP: Record<Quality, Grade> = {
  0: Rating.Again, // 1
  2: Rating.Hard,  // 2
  4: Rating.Good,  // 3
  5: Rating.Easy,  // 4
};

const QUALITIES: Quality[] = [0, 2, 4, 5];

export interface SchedulerOptions {
  requestRetention: number;
  maximumInterval?: number;
}

export function getScheduler(opts: SchedulerOptions): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: opts.requestRetention,
      maximum_interval: opts.maximumInterval ?? 36500,
      enable_fuzz: true,
    }),
  );
}

// 기본 스케줄러 (설정 미주입 시 retention 0.9)
const DEFAULT_RETENTION = 0.9;
let defaultScheduler: FSRS | null = null;
function scheduler(opts?: SchedulerOptions): FSRS {
  if (opts) return getScheduler(opts);
  if (!defaultScheduler) defaultScheduler = getScheduler({ requestRetention: DEFAULT_RETENTION });
  return defaultScheduler;
}

// --- 경계 변환 (Schedule ↔ ts-fsrs Card) ---

function toFsrsCard(s: Schedule): FsrsCard {
  return {
    due: new Date(s.nextReviewAt),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
    learning_steps: 0,
  };
}

function fromFsrsCard(cardId: string, c: FsrsCard): Schedule {
  return {
    cardId,
    stability: c.stability,
    difficulty: c.difficulty,
    state: c.state,
    reps: c.reps,
    lapses: c.lapses,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    nextReviewAt: c.due.toISOString(),
    lastReviewedAt: c.last_review ? c.last_review.toISOString() : null,
  };
}

// --- 공개 API ---

export function createInitialSchedule(cardId: string, now: Date = new Date()): Schedule {
  return fromFsrsCard(cardId, createEmptyCard(now));
}

/** 순수 함수: Schedule + quality → 갱신된 Schedule (DB 쓰기는 호출부 책임) */
export function applyRating(schedule: Schedule, quality: Quality, now: Date = new Date(), opts?: SchedulerOptions): Schedule {
  const f = scheduler(opts);
  const item = f.next(toFsrsCard(schedule), now, RATING_MAP[quality]); // RecordLogItem
  return fromFsrsCard(schedule.cardId, item.card);
}

/** 각 평가의 다음 간격(scheduled_days, 일)을 반환 */
export function previewIntervals(schedule: Schedule, now: Date = new Date(), opts?: SchedulerOptions): Record<Quality, number> {
  const f = scheduler(opts);
  const rec = f.repeat(toFsrsCard(schedule), now); // Rating별 RecordLogItem
  const out = {} as Record<Quality, number>;
  for (const q of QUALITIES) {
    out[q] = rec[RATING_MAP[q]].card.scheduled_days;
  }
  return out;
}
```

> **주의:** `f.next()`는 `RecordLogItem`(`{ card, log }`)을 반환하므로 `.card`를 꺼낸다. `f.repeat()`은 `Grade`별로 키된 객체이며 각 값이 `RecordLogItem`이므로 `rec[grade].card.scheduled_days`를 읽는다. `FsrsCard`의 `learning_steps`는 ts-fsrs 5.4.1에서 **필수**이므로 `toFsrsCard`에 반드시 포함한다(위 코드 반영됨).

- [ ] **Step 5: fsrs 테스트 통과 확인**

Run: `npx vitest run src/lib/fsrs.test.ts`
Expected: PASS (전부 그린).

- [ ] **Step 6: sm2.ts 삭제**

Run: `git rm src/lib/sm2.ts`
(만약 `src/lib/sm2.test.ts`가 있으면 함께 `git rm`.)

- [ ] **Step 7: merge.ts import 교체**

`src/lib/merge.ts:3` 의 `import { createInitialSchedule } from './sm2';` → `import { createInitialSchedule } from './fsrs';`

- [ ] **Step 8: useReviewSession.ts 교체**

`src/hooks/useReviewSession.ts`:
- `import { applyRating } from '@/lib/sm2';` → `import { applyRating, previewIntervals } from '@/lib/fsrs';`
- `getNextInterval`를 `previewIntervals` 기반 문자열 래퍼로 교체:

```ts
  // Interval preview for rating buttons (문자열 포맷 유지 — UI 계약 보존)
  const getNextInterval = useCallback((quality: Quality): string => {
    if (!currentCard) return '';
    const days = previewIntervals(currentCard.schedule)[quality];
    if (days <= 1) return '1일';
    if (days < 30) return `${days}일`;
    if (days < 365) return `${Math.round(days / 30)}개월`;
    return `${(days / 365).toFixed(1)}년`;
  }, [currentCard]);
```

(`rate()` 내부의 `applyRating(currentCard.schedule, quality)` 호출은 그대로 유지 — 시그니처 호환.)

- [ ] **Step 9: data.ts — 초기 스케줄 import 교체**

`src/lib/data.ts:17` 의 `import { createInitialSchedule } from './sm2';` → `from './fsrs';`

- [ ] **Step 10: data.ts — 마스터 정의 교체**

`src/lib/data.ts:237-248` 교체:

```ts
import { State } from 'ts-fsrs';
// ...
// 마스터 기준: Review 상태 && stability ≥ 30일
const MASTERY_STABILITY = 30;

export interface MasteryStats {
  mastered: number;
  total: number;
}

function isMastered(s: Schedule): boolean {
  return s.state === State.Review && s.stability >= MASTERY_STABILITY;
}
```

(`import { State } from 'ts-fsrs';`는 파일 상단 import 블록에 추가.)

- [ ] **Step 11: data.ts — getForgeCards 약점 점수 교체**

`src/lib/data.ts:312-322` 의 `weakness` 함수 교체:

```ts
  const weakness = (c: Card): number => {
    const s = schedMap.get(c.id);
    const difficulty = s?.difficulty ?? 5; // 1~10, 높을수록 약함
    const reps = s?.reps ?? 0;
    return (
      (stumbles.get(c.id) || 0) + // 가장 강한 약점 신호 (reviewLog 기반)
      (difficulty - 1) / 9 +      // difficulty 정규화(0~1)
      (reps === 0 ? 0.5 : 0) +    // 미학습 보정
      Math.random() * 0.3         // 동점 흔들기
    );
  };
```

- [ ] **Step 12: 테스트 픽스처 갱신**

`src/lib/newcards.test.ts:15-17`의 `sched` 헬퍼 교체:

```ts
function sched(cardId: string, lastReviewedAt: string | null): Schedule {
  return {
    cardId, stability: 0, difficulty: 5, state: 0, reps: 0, lapses: 0,
    elapsedDays: 0, scheduledDays: 0, nextReviewAt: now.toISOString(), lastReviewedAt,
  };
}
```

`src/lib/backup.test.ts`에서 Schedule을 생성하는 픽스처도 동일한 새 형태로 갱신한다(파일을 열어 `easeFactor`/`interval`/`repetitions`를 쓰는 객체 리터럴을 위 형태로 교체).

- [ ] **Step 13: 타입체크**

Run: `npx tsc -b`
Expected: 통과. 자주 나오는 두 가지 타입 에러와 대처:
- `Rating` vs `Grade` 위닝: `f.next`/`f.repeat`는 `Grade`만 받으므로 `RATING_MAP`은 `Record<Quality, Grade>`여야 한다(위 코드 반영됨).
- `learning_steps` 누락: ts-fsrs 5.4.1 `Card`에 필수 필드이므로 `toFsrsCard`에 포함(위 코드 반영됨).

- [ ] **Step 14: 전체 테스트**

Run: `npx vitest run`
Expected: 전부 PASS.

- [ ] **Step 15: 빌드**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: replace SM-2 engine with FSRS (ts-fsrs)

- Schedule 타입을 FSRS 상태로 교체 (nextReviewAt/lastReviewedAt 유지)
- src/lib/fsrs.ts 신규 (sm2.ts 대체)
- 마스터 정의·Forge 약점 점수를 FSRS 필드 기반으로 재정의
- useReviewSession은 previewIntervals 사용, getNextInterval 문자열 래퍼 유지"
```

---

## Chunk 2: 마이그레이션 · 설정 · 백업 · 마무리

### Task 4: reviewLog 리플레이 마이그레이션

> **테스트 전략:** 기존 테스트는 전부 순수 함수 테스트이며 IndexedDB를 건드리는 테스트가 없다(`fake-indexeddb` 미설치, vitest 환경 설정 없음). 이 컨벤션(예: 순수 `selectNewCards` ↔ DB 래퍼 `getNewCards`)을 따라, **순수 리플레이 함수 `replaySchedule`를 분리해 단위 테스트**하고, `migrateToFsrs`는 DB I/O만 담당하는 얇은 래퍼로 둔다(단위 테스트 없음 — 수동 검증). 이렇게 하면 fake-indexeddb 도입이 불필요하다.

**Files:**
- Create: `src/lib/migrate.ts`, `src/lib/migrate.test.ts`
- Modify: `src/hooks/useCards.ts`

- [ ] **Step 1: migrate.test.ts 작성 (실패하는 테스트, 순수 함수)**

`src/lib/migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { State } from 'ts-fsrs';
import type { ReviewLog } from '@/types';
import { replaySchedule } from './migrate';

const now = new Date(2026, 5, 24, 12, 0, 0);
function rl(quality: number, daysAgo: number): ReviewLog {
  return { cardId: 'c1', quality, reviewedAt: new Date(2026, 5, 24 - daysAgo).toISOString(), sessionId: 's' };
}

describe('replaySchedule', () => {
  it('로그가 없으면 New 초기 상태', () => {
    const s = replaySchedule('c1', [], now);
    expect(s.state).toBe(State.New);
    expect(s.lastReviewedAt).toBeNull();
    expect(s.reps).toBe(0);
  });

  it('Good 평가들을 리플레이하면 Review 상태·stability>0로 재구성', () => {
    const logs = [rl(4, 3), rl(4, 2), rl(4, 1)];
    const s = replaySchedule('c1', logs, now);
    expect(s.reps).toBe(3);
    expect(s.stability).toBeGreaterThan(0);
    expect(s.lastReviewedAt).not.toBeNull();
  });

  it('정렬되지 않은 로그도 시간순으로 리플레이한다', () => {
    const ordered = replaySchedule('c1', [rl(4, 3), rl(4, 2), rl(4, 1)], now);
    const shuffled = replaySchedule('c1', [rl(4, 1), rl(4, 3), rl(4, 2)], now);
    expect(shuffled.nextReviewAt).toBe(ordered.nextReviewAt);
    expect(shuffled.stability).toBeCloseTo(ordered.stability, 5);
  });

  it('알 수 없는 quality는 Good으로 보정한다', () => {
    const s = replaySchedule('c1', [{ cardId: 'c1', quality: 99, reviewedAt: now.toISOString(), sessionId: 's' }], now);
    expect(s.reps).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/migrate.test.ts`
Expected: FAIL — `migrate.ts` / `replaySchedule` 미존재.

- [ ] **Step 3: migrate.ts 구현 (순수 replaySchedule + DB 래퍼)**

`src/lib/migrate.ts`:

```ts
import type { Quality, Schedule, ReviewLog } from '@/types';
import { getDB } from './db';
import { createInitialSchedule, applyRating } from './fsrs';
import { getSetting, setSetting } from './data';

const VALID_QUALITIES: Quality[] = [0, 2, 4, 5];
function toQuality(q: number): Quality {
  return (VALID_QUALITIES.includes(q as Quality) ? q : 4) as Quality;
}

/**
 * 순수: 한 카드의 reviewLog를 시간순으로 FSRS에 리플레이해 Schedule을 재구성한다.
 * 로그가 비어 있으면 New 초기 상태를 반환한다.
 */
export function replaySchedule(cardId: string, logs: ReviewLog[], now: Date = new Date()): Schedule {
  const sorted = logs.slice().sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  let schedule = createInitialSchedule(cardId, now);
  for (const log of sorted) {
    schedule = applyRating(schedule, toQuality(log.quality), new Date(log.reviewedAt));
  }
  return schedule;
}

/**
 * SM-2 시절 스케줄을 FSRS로 1회 마이그레이션한다(DB I/O 래퍼).
 * schedulerVersion 플래그로 멱등 보장. 실패 시 플래그를 세우지 않아 다음 실행에서 재시도.
 */
export async function migrateToFsrs(now: Date = new Date()): Promise<void> {
  if ((await getSetting<string | null>('schedulerVersion', null)) === 'fsrs') return;

  try {
    const db = await getDB();
    const cards = await db.getAll('cards');
    for (const c of cards) {
      const logs = await db.getAllFromIndex('reviewLog', 'by-card', c.id);
      await db.put('schedules', replaySchedule(c.id, logs, now));
    }
    await setSetting<string>('schedulerVersion', 'fsrs');
  } catch (e) {
    console.error('FSRS migration failed:', e);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: useCards 배선**

`src/hooks/useCards.ts`:
- `import { initializeCards } from '@/lib/data';` 아래에 `import { migrateToFsrs } from '@/lib/migrate';` 추가.
- `useEffect` 내부의 체인을 교체:

```ts
    initializeCards()
      .then(() => migrateToFsrs())
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load cards');
        setLoading(false);
      });
```

- [ ] **Step 6: 타입체크 + 테스트**

Run: `npx tsc -b && npx vitest run`
Expected: 전부 통과.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate existing schedules to FSRS via reviewLog replay"
```

---

### Task 5: Settings — retention 슬라이더

**Files:**
- Modify: `src/hooks/useSettings.ts`, `src/pages/Settings.tsx`

- [ ] **Step 1: useSettings 필드 교체**

`src/hooks/useSettings.ts`:
- `AppSettings`에서 `initialEF: number; minEF: number;` 제거, `requestRetention: number;` 추가.
- `DEFAULTS`에서 `initialEF: 2.5, minEF: 1.3` 제거, `requestRetention: 0.9` 추가.

(저장된 blob의 기존 `initialEF`/`minEF` 키는 무시됨 — 정리 마이그레이션 불필요.)

- [ ] **Step 2: SliderSetting에 step/format 옵션 추가**

`src/pages/Settings.tsx`의 `SliderProps`에 `step?: number;`와 `format?: (v: number) => string;` 추가. `SliderSetting`에서:
- `step={step ?? (max <= 3 ? 0.1 : 1)}`
- 값 표시부의 `{value % 1 !== 0 ? value.toFixed(1) : value}`를 `{format ? format(value) : (value % 1 !== 0 ? value.toFixed(1) : value)}`로.
- min/max 라벨도 `format`이 있으면 `format(min)`/`format(max)` 사용.

- [ ] **Step 3: SM-2 섹션을 retention으로 교체**

`src/pages/Settings.tsx:139-152` 교체:

```tsx
      {/* FSRS params */}
      <div className="animate-up stagger-1">
        <SectionLabel upper>FSRS 파라미터</SectionLabel>
        <Card>
          <CardContent className="p-5">
            <SliderSetting
              label="목표 기억 유지율"
              value={settings.requestRetention}
              min={0.8} max={0.97} step={0.01}
              unit="" accent="#9A90D4" fill={PURPLE_FILL}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ requestRetention: v })}
            />
          </CardContent>
        </Card>
        <div className="flex items-start gap-2 mt-2.5 px-1">
          <Info size={13} className="text-[#5D636F] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#5D636F] leading-relaxed">목표 기억 유지율이 높을수록 복습 간격이 짧아지고 더 자주 복습합니다. 기본값 90%를 권장합니다.</p>
        </div>
      </div>
```

- [ ] **Step 4: 타입체크 + 빌드**

Run: `npx tsc -b && npm run build`
Expected: 성공. (`settings.initialEF`/`minEF`를 참조하는 다른 곳이 없는지 확인 — 있으면 제거.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace EF sliders with FSRS retention setting"
```

---

### Task 6: 백업 EXPORT_VERSION 상향

**Files:**
- Modify: `src/lib/backup.ts:4`

- [ ] **Step 1: 버전 상향**

`src/lib/backup.ts`의 `export const EXPORT_VERSION = 1;` → `export const EXPORT_VERSION = 2;`
주석의 "SM-2 스케줄" 문구를 "FSRS 스케줄"로 갱신.

- [ ] **Step 2: backup 테스트 갱신/통과**

`src/lib/backup.test.ts`가 `version: 1`을 단언하면 `2`로 갱신.
Run: `npx vitest run src/lib/backup.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: bump backup EXPORT_VERSION to 2 (FSRS schema)"
```

---

### Task 7: 최종 검증 · ROADMAP · PR

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: 전체 검증**

Run: `npx tsc -b && npm run lint && npx vitest run && npm run build`
Expected: 전부 통과. (실패 시 해당 Task로 돌아가 수정.)

- [ ] **Step 2: 수동 동작 확인**

Run: `npm run dev` 후 브라우저에서:
- 복습 세션 진입 → 4버튼에 다음 간격이 표시되는지(예: "1일", "4일")
- 평가 후 다음 카드로 진행되는지
- Settings에서 "목표 기억 유지율" 슬라이더가 % 단위로 동작하는지
- Stats 마스터 수치가 깨지지 않는지
- due 풀이 미복습(새) 카드를 제외하는지(`lastReviewedAt === null`은 새 카드 학습 플로우로만)

- [ ] **Step 3: ROADMAP 갱신**

`ROADMAP.md`의 5-1 항목 체크박스를 `[x]`로 표시:
```
- [x] FSRS 알고리즘 구현 (ts-fsrs)
- [x] SM-2 → FSRS 마이그레이션 로직 (reviewLog 리플레이)
- [ ] 설정에서 알고리즘 선택 (SM-2 / FSRS) — 완전 전환으로 대체, 미진행
```
(3번째 항목은 "완전 전환" 결정으로 비목표가 되었음을 명시.)

또한 `ROADMAP.md:134`의 "마스터 카드 수: easeFactor >= 2.5 && repetitions >= 5" 문구를 "state===Review && stability>=30"으로 갱신(stale 제거).

- [ ] **Step 4: Commit + PR**

```bash
git add ROADMAP.md
git commit -m "docs: mark FSRS transition complete in ROADMAP"
git push -u origin feat/fsrs-transition
gh pr create --title "feat: FSRS 완전 전환 (SM-2 폐기)" --body "..."
```

PR 본문에 전환 요약·마이그레이션 방식·테스트 결과를 적는다.

---

## 검증 게이트 요약

각 Task 종료 시: `npx tsc -b` (타입) + `npx vitest run` (테스트). Task 3·5·7은 추가로 `npm run build`. 최종 Task 7은 `npm run lint`까지.
