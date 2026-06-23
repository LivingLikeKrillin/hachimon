import type { Card, Schedule, CardsData, Tier } from '@/types';
import { getDB } from './db';
import { mergeCards } from './merge';
import { parseVault, type VaultFile } from './obsidian';

/** 카드 출처: 번들 데모 vs 사용자가 임포트한 Obsidian vault */
export type CardSource = 'demo' | 'vault';

export interface VaultMeta {
  importedAt: string;
  fileCount: number;
  deckCount: number;
  cardCount: number;
}

export async function getCardSource(): Promise<CardSource> {
  return getSetting<CardSource>('cardSource', 'demo');
}

export async function getVaultMeta(): Promise<VaultMeta | null> {
  return getSetting<VaultMeta | null>('vaultMeta', null);
}

export async function initializeCards(): Promise<void> {
  // vault 모드면 사용자 임포트 카드를 유지한다 (번들 데모를 fetch/merge 하지 않음)
  if ((await getCardSource()) === 'vault') return;

  const res = await fetch('/cards.json');
  const data: CardsData = await res.json();
  await mergeCards(data);
}

/** 파싱 미리보기 — 사이드이펙트 없음 */
export function previewVault(files: VaultFile[]): CardsData {
  return parseVault(files);
}

/** 미리보기 결과를 실제로 반영: merge + vault 모드 전환 */
export async function commitVaultImport(data: CardsData): Promise<VaultMeta> {
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. 노트 포맷을 확인하세요.');
  }
  await mergeCards(data);
  const meta: VaultMeta = {
    importedAt: new Date().toISOString(),
    fileCount: new Set(data.cards.map((c) => c.sourceFile)).size,
    deckCount: data.decks.length,
    cardCount: data.cards.length,
  };
  await setSetting<CardSource>('cardSource', 'vault');
  await setSetting<VaultMeta>('vaultMeta', meta);
  return meta;
}

/** 데모 카드로 되돌리기 — vault 임포트분을 비우고 번들 샘플 복원 */
export async function useDemoCards(): Promise<void> {
  await setSetting<CardSource>('cardSource', 'demo');
  await setSetting<VaultMeta | null>('vaultMeta', null);
  await initializeCards();
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

// 마스터 기준 (ROADMAP): EF ≥ 2.5 && repetitions ≥ 5
const MASTERY_EF = 2.5;
const MASTERY_REP = 5;

export interface MasteryStats {
  mastered: number;
  total: number;
}

function isMastered(s: Schedule): boolean {
  return s.easeFactor >= MASTERY_EF && s.repetitions >= MASTERY_REP;
}

/** 전체 마스터리 — 마스터한 카드 수 / 전체 카드 수 */
export async function getMasteryStats(): Promise<MasteryStats> {
  const db = await getDB();
  const [schedules, total] = await Promise.all([db.getAll('schedules'), db.count('cards')]);
  return { mastered: schedules.filter(isMastered).length, total };
}

/** 덱별 마스터리 — deckId → { mastered, total } */
export async function getDeckMastery(): Promise<Map<string, MasteryStats>> {
  const db = await getDB();
  const [cards, schedules] = await Promise.all([db.getAll('cards'), db.getAll('schedules')]);
  const schedMap = new Map(schedules.map((s) => [s.cardId, s]));

  const out = new Map<string, MasteryStats>();
  for (const card of cards) {
    const m = out.get(card.deck) ?? { mastered: 0, total: 0 };
    m.total++;
    const s = schedMap.get(card.id);
    if (s && isMastered(s)) m.mastered++;
    out.set(card.deck, m);
  }
  return out;
}

/**
 * 단련(Forge) 카드 — 선택한 덱/티어에 맞는 카드를 due 여부와 무관하게 뽑아
 * 무작위로 섞어 limit만큼 반환한다.
 */
export async function getForgeCards(
  deckIds: Set<string>,
  tiers: Set<Tier>,
  limit: number,
): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const [cards, schedules] = await Promise.all([db.getAll('cards'), db.getAll('schedules')]);
  const schedMap = new Map(schedules.map((s) => [s.cardId, s]));

  const matched = cards.filter((c) => deckIds.has(c.deck) && tiers.has(c.tier));
  // Fisher–Yates 셔플
  for (let i = matched.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matched[i], matched[j]] = [matched[j], matched[i]];
  }

  const out: (Card & { schedule: Schedule })[] = [];
  for (const c of matched.slice(0, limit)) {
    const s = schedMap.get(c.id);
    if (s) out.push({ ...c, schedule: s });
  }
  return out;
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
