import type { CardsData } from '@/types';
import { getDB } from './db';
import { createInitialSchedule } from './fsrs';

export async function mergeCards(data: CardsData): Promise<void> {
  const db = await getDB();

  const serverCardIds = new Set(data.cards.map((c) => c.id));
  const localCards = await db.getAll('cards');
  const localCardMap = new Map(localCards.map((c) => [c.id, c]));

  const tx = db.transaction(['cards', 'schedules'], 'readwrite');

  // Delete cards removed from server
  for (const local of localCards) {
    if (!serverCardIds.has(local.id)) {
      await tx.objectStore('cards').delete(local.id);
      await tx.objectStore('schedules').delete(local.id);
    }
  }

  // Add or update cards from server
  for (const serverCard of data.cards) {
    const local = localCardMap.get(serverCard.id);

    if (!local) {
      // New card
      await tx.objectStore('cards').put(serverCard);
      await tx.objectStore('schedules').put(createInitialSchedule(serverCard.id));
    } else if (local.sourceHash !== serverCard.sourceHash) {
      // Content changed — update Q/A, preserve schedule
      await tx.objectStore('cards').put(serverCard);
    }
    // Same hash → skip
  }

  await tx.done;
}
