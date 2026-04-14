import type { Card, Schedule, CardsData } from '@/types';
import { getDB } from './db';
import { mergeCards } from './merge';

export async function initializeCards(): Promise<void> {
  const res = await fetch('/cards.json');
  const data: CardsData = await res.json();
  await mergeCards(data);
}

export async function getDueCards(limit: number = 15): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const now = new Date().toISOString();

  const allSchedules = await db.getAll('schedules');
  const due = allSchedules
    .filter((s) => s.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));

  const limited = due.slice(0, limit);
  const results: (Card & { schedule: Schedule })[] = [];

  for (const schedule of limited) {
    const card = await db.get('cards', schedule.cardId);
    if (card) {
      results.push({ ...card, schedule });
    }
  }

  return results;
}

export async function getTotalCardCount(): Promise<number> {
  const db = await getDB();
  return db.count('cards');
}

export async function getDueCount(): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const all = await db.getAll('schedules');
  return all.filter((s) => s.nextReviewAt <= now).length;
}

export async function getTodayReviewCount(): Promise<number> {
  const db = await getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const all = await db.getAll('reviewLog');
  return all.filter((r) => r.reviewedAt >= todayStr).length;
}

export async function getStreak(): Promise<number> {
  const db = await getDB();
  const logs = await db.getAll('reviewLog');
  if (logs.length === 0) return 0;

  const days = new Set(
    logs.map((r) => r.reviewedAt.slice(0, 10))
  );

  let streak = 0;
  const d = new Date();
  const todayStr = d.toISOString().slice(0, 10);
  if (!days.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

export async function getDueByDeck(): Promise<{ deckId: string; name: string; count: number }[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  const schedules = await db.getAll('schedules');
  const dueCardIds = new Set(
    schedules.filter((s) => s.nextReviewAt <= now).map((s) => s.cardId)
  );

  const cards = await db.getAll('cards');
  const deckCounts = new Map<string, number>();

  for (const card of cards) {
    if (dueCardIds.has(card.id)) {
      deckCounts.set(card.deck, (deckCounts.get(card.deck) || 0) + 1);
    }
  }

  return Array.from(deckCounts.entries())
    .map(([deckId, count]) => ({
      deckId,
      name: deckId.split('/').pop() || deckId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const row = await db.get('settings', key);
  if (!row) return defaultValue;
  return JSON.parse(row.value) as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value: JSON.stringify(value) });
}

export async function getAllCardsByDeck(): Promise<Map<string, Card[]>> {
  const db = await getDB();
  const cards = await db.getAll('cards');
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    const list = map.get(card.deck) || [];
    list.push(card);
    map.set(card.deck, list);
  }
  return map;
}
