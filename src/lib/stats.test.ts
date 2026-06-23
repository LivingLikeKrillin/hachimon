import { describe, it, expect } from 'vitest';
import type { ReviewLog } from '@/types';
import { summarizeReviews, buildHeatmap, buildDailyVolume } from './stats';

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
