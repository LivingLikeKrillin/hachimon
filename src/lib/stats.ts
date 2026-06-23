import type { ReviewLog, Card, Tier } from '@/types';

export interface ReviewSummary {
  total: number;
  accuracy: number; // 0..1 — 정답(Good/Easy, quality>=4) 비율
}

export interface TierStat {
  tier: Tier;
  total: number; // 해당 티어 카드의 복습 횟수
  accuracy: number; // 0..1
}

export interface Leech {
  cardId: string;
  question: string;
  tier: Tier;
  againCount: number; // Again(quality 0) 누적 횟수
}

const TIER_ORDER: Tier[] = ['foundation', 'mechanism', 'diagnosis'];

/** 로컬 캘린더 날짜 키 (YYYY-MM-DD) */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 로그를 로컬 날짜별 건수로 집계 */
function countByDay(logs: ReviewLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const log of logs) {
    const k = dayKey(new Date(log.reviewedAt));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** 총 복습 횟수와 정답률 — 정답은 Good(4)/Easy(5) */
export function summarizeReviews(logs: ReviewLog[]): ReviewSummary {
  const total = logs.length;
  if (total === 0) return { total: 0, accuracy: 0 };
  const correct = logs.filter((l) => l.quality >= 4).length;
  return { total, accuracy: correct / total };
}

/**
 * 복습 히트맵 — `weeks`주 × 7일 셀 배열 (기본 140).
 * 그리드는 column-major(gridAutoFlow: column): 셀 i는 col=floor(i/7), row=i%7.
 * 현재 주가 마지막 열이 되도록 정렬하며, 오늘은 마지막 열의 (오늘 요일) 행에 위치한다.
 * 미래 셀(이번 주 남은 요일)은 0으로 채워진다.
 */
export function buildHeatmap(logs: ReviewLog[], now: Date, weeks = 20): number[] {
  const counts = countByDay(logs);
  const cells = weeks * 7;
  // col 0, row 0 의 날짜 = 이번 주 일요일에서 (weeks-1)주 전
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - now.getDay() - (weeks - 1) * 7);

  const out: number[] = [];
  for (let i = 0; i < cells; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i); // col*7 + row === i 이므로 단순 +i
    out.push(counts.get(dayKey(d)) ?? 0);
  }
  return out;
}

/**
 * 일별 복습량 — 최근 `days`일(기본 30) 건수 배열.
 * index 0 = (days-1)일 전, 마지막 = 오늘.
 */
export function buildDailyVolume(logs: ReviewLog[], now: Date, days = 30): number[] {
  const counts = countByDay(logs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(counts.get(dayKey(d)) ?? 0);
  }
  return out;
}

/**
 * 티어별 정답률 — foundation/mechanism/diagnosis 순으로 항상 3개 반환.
 * 복습 기록이 없는 티어는 total 0, accuracy 0.
 */
export function tierAccuracy(logs: ReviewLog[], tierByCard: Map<string, Tier>): TierStat[] {
  const agg = new Map<Tier, { total: number; correct: number }>(
    TIER_ORDER.map((t) => [t, { total: 0, correct: 0 }]),
  );
  for (const log of logs) {
    const tier = tierByCard.get(log.cardId);
    if (!tier) continue;
    const e = agg.get(tier)!;
    e.total++;
    if (log.quality >= 4) e.correct++;
  }
  return TIER_ORDER.map((tier) => {
    const { total, correct } = agg.get(tier)!;
    return { tier, total, accuracy: total > 0 ? correct / total : 0 };
  });
}

/**
 * 약한 카드(Leech) — Again(quality 0)이 `threshold`회 이상 누적된 카드.
 * againCount 내림차순 정렬.
 */
export function findLeeches(logs: ReviewLog[], cards: Card[], threshold = 3): Leech[] {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const againByCard = new Map<string, number>();
  for (const log of logs) {
    if (log.quality === 0) {
      againByCard.set(log.cardId, (againByCard.get(log.cardId) ?? 0) + 1);
    }
  }
  const out: Leech[] = [];
  for (const [cardId, againCount] of againByCard) {
    if (againCount < threshold) continue;
    const c = cardById.get(cardId);
    if (!c) continue;
    out.push({ cardId, question: c.question, tier: c.tier, againCount });
  }
  return out.sort((a, b) => b.againCount - a.againCount);
}
