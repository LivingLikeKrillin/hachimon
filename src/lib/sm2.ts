import type { Schedule, Quality } from '@/types';

export function createInitialSchedule(cardId: string): Schedule {
  return {
    cardId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: new Date().toISOString(),
    lastReviewedAt: null,
  };
}

export function applyRating(schedule: Schedule, quality: Quality): Schedule {
  const now = new Date().toISOString();
  let { easeFactor, interval, repetitions } = schedule;

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  if (quality < 3) {
    // Reset
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    cardId: schedule.cardId,
    easeFactor,
    interval,
    repetitions,
    nextReviewAt: nextReview.toISOString(),
    lastReviewedAt: now,
  };
}
