import { useState, useEffect, useCallback } from 'react';
import type { Card, Schedule } from '@/types';
import { getDueCards, getDueCount, getTotalCardCount, getTodayReviewCount, getStreak, getDueByDeck } from '@/lib/data';

interface HomeStats {
  dueCount: number;
  streak: number;
  totalCards: number;
  todayReviewed: number;
  dueByDeck: { deckId: string; name: string; count: number }[];
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
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [dueCount, streak, totalCards, todayReviewed, dueByDeck] = await Promise.all([
      getDueCount(),
      getStreak(),
      getTotalCardCount(),
      getTodayReviewCount(),
      getDueByDeck(),
    ]);
    setStats({ dueCount, streak, totalCards, todayReviewed, dueByDeck });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}
