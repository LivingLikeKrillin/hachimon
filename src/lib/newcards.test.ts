import { describe, it, expect } from 'vitest';
import type { Card, Schedule, ReviewLog, Tier } from '@/types';
import { countIntroducedToday, selectNewCards } from './newcards';

const now = new Date(2026, 5, 24, 12, 0, 0);

function isoDaysAgo(days: number): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0, 0).toISOString();
}

function card(id: string, tier: Tier, deck = 'd'): Card {
  return { id, deck, tier, question: `Q-${id}`, answer: 'A', sourceFile: 'f.md', sourceHash: 'h' };
}

function sched(cardId: string, lastReviewedAt: string | null): Schedule {
  return {
    cardId, stability: 0, difficulty: 5, state: 0, reps: 0, lapses: 0,
    elapsedDays: 0, scheduledDays: 0, nextReviewAt: now.toISOString(), lastReviewedAt,
  };
}

function rl(cardId: string, reviewedAt: string): ReviewLog {
  return { cardId, quality: 4, reviewedAt, sessionId: 's' };
}

describe('countIntroducedToday', () => {
  it('빈 로그 → 0', () => {
    expect(countIntroducedToday([], now)).toBe(0);
  });

  it('첫 복습이 오늘인 카드를 센다', () => {
    expect(countIntroducedToday([rl('a', isoDaysAgo(0))], now)).toBe(1);
  });

  it('첫 복습이 어제면 오늘 또 복습해도 세지 않는다', () => {
    const logs = [rl('a', isoDaysAgo(1)), rl('a', isoDaysAgo(0))];
    expect(countIntroducedToday(logs, now)).toBe(0);
  });

  it('오늘 처음 도입된 서로 다른 카드 수만큼 센다', () => {
    const logs = [rl('a', isoDaysAgo(0)), rl('b', isoDaysAgo(0)), rl('c', isoDaysAgo(2))];
    expect(countIntroducedToday(logs, now)).toBe(2);
  });
});

describe('selectNewCards', () => {
  const cards = [
    card('d1', 'diagnosis'),
    card('f1', 'foundation'),
    card('m1', 'mechanism'),
    card('f2', 'foundation'),
  ];
  const allNew = cards.map((c) => sched(c.id, null));

  it('limit 0 → 빈 배열', () => {
    expect(selectNewCards(cards, allNew, 0)).toEqual([]);
  });

  it('미복습 카드만 (lastReviewedAt !== null 제외)', () => {
    const schedules = [sched('f1', null), sched('m1', isoDaysAgo(1)), sched('d1', null), sched('f2', null)];
    const ids = selectNewCards(cards, schedules, 10).map((c) => c.id);
    expect(ids).not.toContain('m1');
    expect(ids).toContain('f1');
  });

  it('F→M→D 순, 동순위는 id 안정 정렬', () => {
    const ids = selectNewCards(cards, allNew, 10).map((c) => c.id);
    expect(ids).toEqual(['f1', 'f2', 'm1', 'd1']);
  });

  it('limit 만큼만 반환', () => {
    expect(selectNewCards(cards, allNew, 2).map((c) => c.id)).toEqual(['f1', 'f2']);
  });

  it('스케줄 없는 카드는 제외', () => {
    const ids = selectNewCards(cards, [sched('f1', null)], 10).map((c) => c.id);
    expect(ids).toEqual(['f1']);
  });
});
