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
