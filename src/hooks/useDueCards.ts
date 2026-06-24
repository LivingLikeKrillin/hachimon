import { useState, useEffect, useCallback } from 'react';
import type { Card, Schedule } from '@/types';
import { getDueCards, getDueCount, getTotalCardCount, getTodayReviewCount, getStreak, getDueByDeck, getLeeches, getNewCardCount } from '@/lib/data';
import type { Leech } from '@/lib/stats';

interface HomeStats {
  dueCount: number;
  streak: number;
  totalCards: number;
  todayReviewed: number;
  dueByDeck: { deckId: string; name: string; count: number }[];
  leeches: Leech[];
  newCardCount: number;
}

export function useDueCards(limit: number = 15) {
  const [cards, setCards] = useState<(Card & { schedule: Schedule })[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getDueCards(limit);
    setCards(result);
    setLoading(false);
  }, [limit]);

  // 마운트 시 1회 데이터 로드 — 의도된 fetch-on-mount 패턴.
  // (set-state-in-effect는 async 로더의 await 이후 setState까지 전이적으로 막아 false positive)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  return { cards, loading, refresh };
}

export function useHomeStats() {
  const [stats, setStats] = useState<HomeStats>({
    dueCount: 0,
    streak: 0,
    totalCards: 0,
    todayReviewed: 0,
    dueByDeck: [],
    leeches: [],
    newCardCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [dueCount, streak, totalCards, todayReviewed, dueByDeck, leeches, newCardCount] = await Promise.all([
      getDueCount(),
      getStreak(),
      getTotalCardCount(),
      getTodayReviewCount(),
      getDueByDeck(),
      getLeeches(),
      getNewCardCount(),
    ]);
    setStats({ dueCount, streak, totalCards, todayReviewed, dueByDeck, leeches, newCardCount });
    setLoading(false);
  }, []);

  // 마운트 시 1회 집계 로드 — 의도된 fetch-on-mount 패턴 (위 주석 참고).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}
