import type { Card, Schedule, ReviewLog, Tier } from '@/types';
import { localDateKey } from './reminder';

const TIER_ORDER: Record<Tier, number> = { foundation: 0, mechanism: 1, diagnosis: 2 };

/**
 * 오늘 소진한 신규 학습 할당량 — 각 카드의 '첫 복습일'이 오늘인 카드 수.
 * (한 번도 복습 안 한 카드가 오늘 처음 복습되면 +1)
 */
export function countIntroducedToday(logs: ReviewLog[], now: Date): number {
  const firstByCard = new Map<string, string>();
  for (const log of logs) {
    const prev = firstByCard.get(log.cardId);
    if (prev === undefined || log.reviewedAt < prev) firstByCard.set(log.cardId, log.reviewedAt);
  }
  const today = localDateKey(now);
  let count = 0;
  for (const first of firstByCard.values()) {
    if (localDateKey(new Date(first)) === today) count++;
  }
  return count;
}

/**
 * 미복습 카드(lastReviewedAt === null)를 F→M→D 순으로 limit장 선택.
 * 동순위는 deck → id 안정 정렬. 스케줄이 없는 카드는 제외.
 */
export function selectNewCards(cards: Card[], schedules: Schedule[], limit: number): Card[] {
  if (limit <= 0) return [];
  const schedById = new Map(schedules.map((s) => [s.cardId, s]));
  const news = cards.filter((c) => {
    const s = schedById.get(c.id);
    return s !== undefined && s.lastReviewedAt === null;
  });
  news.sort((a, b) => {
    const t = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (t !== 0) return t;
    if (a.deck !== b.deck) return a.deck < b.deck ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return news.slice(0, limit);
}

export { TIER_ORDER };
