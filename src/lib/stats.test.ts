import { describe, it, expect } from 'vitest';
import type { ReviewLog, Card, Tier } from '@/types';
import { summarizeReviews, buildHeatmap, buildDailyVolume, tierAccuracy, findLeeches } from './stats';

function card(id: string, tier: Tier): Card {
  return { id, deck: 'd', tier, question: `Q-${id}`, answer: 'A', sourceFile: 'f.md', sourceHash: 'h' };
}

function rl(cardId: string, quality: number): ReviewLog {
  return { cardId, quality, reviewedAt: '2026-06-24T00:00:00.000Z', sessionId: 's' };
}

// 로컬 정오 기준 ISO 문자열 — 타임존과 무관하게 같은 로컬 날짜로 round-trip 된다.
function isoDaysAgo(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0, 0);
  return d.toISOString();
}

function log(reviewedAt: string, quality: number): ReviewLog {
  return { cardId: 'c1', quality, reviewedAt, sessionId: 's1' };
}

describe('summarizeReviews', () => {
  it('빈 로그는 total 0, accuracy 0', () => {
    expect(summarizeReviews([])).toEqual({ total: 0, accuracy: 0 });
  });

  it('total은 로그 수, accuracy는 quality>=4 비율 (Good/Easy만 정답)', () => {
    const now = new Date(2026, 5, 24, 12, 0, 0);
    const logs = [
      log(isoDaysAgo(now, 0), 5), // Easy  → 정답
      log(isoDaysAgo(now, 0), 4), // Good  → 정답
      log(isoDaysAgo(now, 1), 2), // Hard  → 오답
      log(isoDaysAgo(now, 1), 0), // Again → 오답
    ];
    const r = summarizeReviews(logs);
    expect(r.total).toBe(4);
    expect(r.accuracy).toBeCloseTo(0.5, 5);
  });
});

describe('buildHeatmap', () => {
  const now = new Date(2026, 5, 24, 12, 0, 0); // 2026-06-24 (수요일, getDay()=3)

  it('20주 × 7일 = 140 셀을 반환', () => {
    expect(buildHeatmap([], now, 20)).toHaveLength(140);
  });

  it('오늘 복습은 마지막 열·오늘 요일 행에 집계된다 (index 133 + 요일)', () => {
    const heat = buildHeatmap([log(isoDaysAgo(now, 0), 4), log(isoDaysAgo(now, 0), 0)], now, 20);
    const todayIdx = 19 * 7 + now.getDay(); // 133 + 3 = 136
    expect(heat[todayIdx]).toBe(2);
  });

  it('범위(140일) 밖의 오래된 로그는 제외된다', () => {
    const heat = buildHeatmap([log(isoDaysAgo(now, 200), 4)], now, 20);
    expect(heat.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('각 날짜의 복습 수가 해당 셀에 정확히 들어간다', () => {
    // 7일 전 = 오늘과 같은 요일, 한 열 왼쪽 (index 136 - 7 = 129)
    const heat = buildHeatmap([log(isoDaysAgo(now, 7), 4)], now, 20);
    const todayIdx = 19 * 7 + now.getDay();
    expect(heat[todayIdx - 7]).toBe(1);
  });
});

describe('buildDailyVolume', () => {
  const now = new Date(2026, 5, 24, 12, 0, 0);

  it('기본 30일 길이를 반환', () => {
    expect(buildDailyVolume([], now, 30)).toHaveLength(30);
  });

  it('마지막 원소가 오늘, 첫 원소가 (days-1)일 전', () => {
    const vol = buildDailyVolume(
      [log(isoDaysAgo(now, 0), 4), log(isoDaysAgo(now, 0), 4), log(isoDaysAgo(now, 29), 4)],
      now,
      30,
    );
    expect(vol[29]).toBe(2); // 오늘 2건
    expect(vol[0]).toBe(1); // 29일 전 1건
  });

  it('범위 밖(30일 초과) 로그는 제외', () => {
    const vol = buildDailyVolume([log(isoDaysAgo(now, 30), 4)], now, 30);
    expect(vol.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('tierAccuracy', () => {
  const tierByCard = new Map<string, Tier>([
    ['f1', 'foundation'],
    ['m1', 'mechanism'],
    ['d1', 'diagnosis'],
  ]);

  it('항상 foundation/mechanism/diagnosis 3개를 순서대로 반환', () => {
    const r = tierAccuracy([], tierByCard);
    expect(r.map((t) => t.tier)).toEqual(['foundation', 'mechanism', 'diagnosis']);
  });

  it('티어별 total과 정답률(quality>=4)을 집계', () => {
    const logs = [rl('f1', 5), rl('f1', 0), rl('m1', 4), rl('m1', 4)];
    const r = tierAccuracy(logs, tierByCard);
    const f = r.find((t) => t.tier === 'foundation')!;
    const m = r.find((t) => t.tier === 'mechanism')!;
    const d = r.find((t) => t.tier === 'diagnosis')!;
    expect(f.total).toBe(2);
    expect(f.accuracy).toBeCloseTo(0.5, 5);
    expect(m.total).toBe(2);
    expect(m.accuracy).toBeCloseTo(1, 5);
    expect(d.total).toBe(0);
    expect(d.accuracy).toBe(0);
  });

  it('티어 매핑이 없는 cardId 로그는 무시', () => {
    const r = tierAccuracy([rl('ghost', 5)], tierByCard);
    expect(r.every((t) => t.total === 0)).toBe(true);
  });
});

describe('findLeeches', () => {
  const cards = [card('a', 'foundation'), card('b', 'mechanism'), card('c', 'diagnosis')];

  it('Again(0)이 임계치(기본 3) 미만이면 제외', () => {
    const logs = [rl('a', 0), rl('a', 0)]; // 2회
    expect(findLeeches(logs, cards)).toEqual([]);
  });

  it('Again이 3회 이상인 카드만, againCount 내림차순', () => {
    const logs = [
      rl('a', 0), rl('a', 0), rl('a', 0), // a: 3
      rl('b', 0), rl('b', 0), rl('b', 0), rl('b', 0), // b: 4
      rl('c', 0), rl('c', 4), // c: 1 (제외)
    ];
    const leeches = findLeeches(logs, cards);
    expect(leeches.map((l) => l.cardId)).toEqual(['b', 'a']);
    expect(leeches[0].againCount).toBe(4);
    expect(leeches[0].question).toBe('Q-b');
    expect(leeches[0].tier).toBe('mechanism');
  });

  it('Again만 카운트 — Hard(2)는 leech가 아니다', () => {
    const logs = [rl('a', 2), rl('a', 2), rl('a', 2)];
    expect(findLeeches(logs, cards)).toEqual([]);
  });

  it('카드 메타가 없는 cardId는 제외', () => {
    const logs = [rl('ghost', 0), rl('ghost', 0), rl('ghost', 0)];
    expect(findLeeches(logs, cards)).toEqual([]);
  });
});
