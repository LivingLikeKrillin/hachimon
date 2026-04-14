import { useState, useCallback, useRef } from 'react';
import type { Card, Schedule, Quality } from '@/types';
import { applyRating } from '@/lib/sm2';
import { getDB } from '@/lib/db';

export interface ReviewResult {
  cardId: string;
  question: string;
  tier: Card['tier'];
  quality: Quality;
}

export interface SessionSummary {
  results: ReviewResult[];
  totalCards: number;
  correctCount: number;
  accuracy: number;
  duration: number;
  tierBreakdown: {
    tier: Card['tier'];
    total: number;
    correct: number;
    accuracy: number;
  }[];
  wrongCards: ReviewResult[];
}

export function useReviewSession(initialCards: (Card & { schedule: Schedule })[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [finished, setFinished] = useState(false);
  const startTime = useRef(Date.now());
  const sessionId = useRef(crypto.randomUUID());

  const currentCard = initialCards[currentIndex] ?? null;
  const progress = initialCards.length > 0 ? (currentIndex / initialCards.length) : 0;

  const flip = useCallback(() => {
    setFlipped(true);
  }, []);

  const rate = useCallback(async (quality: Quality) => {
    if (!currentCard) return;

    const db = await getDB();

    // Apply SM-2
    const updated = applyRating(currentCard.schedule, quality);
    await db.put('schedules', updated);

    // Log review
    await db.put('reviewLog', {
      cardId: currentCard.id,
      quality,
      reviewedAt: new Date().toISOString(),
      sessionId: sessionId.current,
    });

    // Record result
    const result: ReviewResult = {
      cardId: currentCard.id,
      question: currentCard.question,
      tier: currentCard.tier,
      quality,
    };
    const nextResults = [...results, result];
    setResults(nextResults);

    // Next card or finish
    if (currentIndex + 1 >= initialCards.length) {
      setFinished(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  }, [currentCard, currentIndex, initialCards.length, results]);

  const getSummary = useCallback((): SessionSummary => {
    const duration = Math.round((Date.now() - startTime.current) / 1000);
    const correctCount = results.filter((r) => r.quality >= 4).length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    const tierMap = new Map<Card['tier'], { total: number; correct: number }>();
    for (const r of results) {
      const entry = tierMap.get(r.tier) || { total: 0, correct: 0 };
      entry.total++;
      if (r.quality >= 4) entry.correct++;
      tierMap.set(r.tier, entry);
    }

    const tierBreakdown = (['foundation', 'mechanism', 'diagnosis'] as const)
      .filter((t) => tierMap.has(t))
      .map((tier) => {
        const { total, correct } = tierMap.get(tier)!;
        return { tier, total, correct, accuracy: Math.round((correct / total) * 100) };
      });

    const wrongCards = results.filter((r) => r.quality < 4);

    return { results, totalCards: results.length, correctCount, accuracy, duration, tierBreakdown, wrongCards };
  }, [results]);

  // Interval preview for rating buttons
  const getNextInterval = useCallback((quality: Quality): string => {
    if (!currentCard) return '';
    const preview = applyRating(currentCard.schedule, quality);
    if (preview.interval === 1) return '1일';
    if (preview.interval < 30) return `${preview.interval}일`;
    if (preview.interval < 365) return `${Math.round(preview.interval / 30)}개월`;
    return `${(preview.interval / 365).toFixed(1)}년`;
  }, [currentCard]);

  return {
    currentCard,
    currentIndex,
    totalCards: initialCards.length,
    progress,
    flipped,
    finished,
    flip,
    rate,
    getSummary,
    getNextInterval,
  };
}
