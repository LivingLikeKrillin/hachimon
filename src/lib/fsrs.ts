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

const DEFAULT_RETENTION = 0.9;
let defaultScheduler: FSRS | null = null;
function scheduler(opts?: SchedulerOptions): FSRS {
  if (opts) return getScheduler(opts);
  if (!defaultScheduler) defaultScheduler = getScheduler({ requestRetention: DEFAULT_RETENTION });
  return defaultScheduler;
}

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

export function createInitialSchedule(cardId: string, now: Date = new Date()): Schedule {
  return fromFsrsCard(cardId, createEmptyCard(now));
}

/** 순수 함수: Schedule + quality → 갱신된 Schedule (DB 쓰기는 호출부 책임) */
export function applyRating(schedule: Schedule, quality: Quality, now: Date = new Date(), opts?: SchedulerOptions): Schedule {
  const f = scheduler(opts);
  const item = f.next(toFsrsCard(schedule), now, RATING_MAP[quality]);
  return fromFsrsCard(schedule.cardId, item.card);
}

/** 각 평가의 다음 간격(scheduled_days, 일)을 반환 */
export function previewIntervals(schedule: Schedule, now: Date = new Date(), opts?: SchedulerOptions): Record<Quality, number> {
  const f = scheduler(opts);
  const rec = f.repeat(toFsrsCard(schedule), now);
  const out = {} as Record<Quality, number>;
  for (const q of QUALITIES) {
    out[q] = rec[RATING_MAP[q]].card.scheduled_days;
  }
  return out;
}
