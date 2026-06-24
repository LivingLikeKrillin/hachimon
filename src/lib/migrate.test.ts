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
