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
    const s1 = applyRating(s0, 4, now);
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
    expect(p[4]).toBeLessThanOrEqual(p[5]); // Good(4) ≤ Easy(5)
  });

  it('네 평가 키(0/2/4/5)를 모두 반환한다', () => {
    const p = previewIntervals(createInitialSchedule('c1', now), now);
    expect(Object.keys(p).map(Number).sort((a, b) => a - b)).toEqual([0, 2, 4, 5]);
  });
});
