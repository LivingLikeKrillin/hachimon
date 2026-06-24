import type { Card, Schedule, CardsData, Tier } from '@/types';
import { getDB } from './db';
import { mergeCards } from './merge';
import { parseVault, type VaultFile } from './obsidian';
import {
  summarizeReviews,
  buildHeatmap,
  buildDailyVolume,
  tierAccuracy,
  findLeeches,
  type ReviewSummary,
  type TierStat,
  type Leech,
} from './stats';
import { countIntroducedToday, selectNewCards } from './newcards';
import { buildExport, type BackupData } from './backup';
import { createInitialSchedule } from './fsrs';
import { State } from 'ts-fsrs';

const DEFAULT_DAILY_NEW = 10;

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
    // 미복습(새) 카드는 due 풀에서 제외 — 새 카드 학습 플로우로만 도입
    .filter((s) => s.nextReviewAt <= now && s.lastReviewedAt !== null)
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

/**
 * 새 카드 학습 큐 — 미복습 카드를 F→M→D 순으로,
 * 남은 일일 신규 할당량(dailyNew − 오늘 도입분)만큼 반환한다.
 */
export async function getNewCards(): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const [cards, schedules, logs] = await Promise.all([
    db.getAll('cards'),
    db.getAll('schedules'),
    db.getAll('reviewLog'),
  ]);
  const appSettings = await getSetting<{ dailyNew?: number }>('appSettings', {});
  const dailyNew = appSettings.dailyNew ?? DEFAULT_DAILY_NEW;
  const remaining = Math.max(0, dailyNew - countIntroducedToday(logs, new Date()));

  const selected = selectNewCards(cards, schedules, remaining);
  const schedById = new Map(schedules.map((s) => [s.cardId, s]));
  return selected.map((c) => ({ ...c, schedule: schedById.get(c.id)! }));
}

export async function getNewCardCount(): Promise<number> {
  return (await getNewCards()).length;
}

export async function getTotalCardCount(): Promise<number> {
  const db = await getDB();
  return db.count('cards');
}

export async function getDueCount(): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const all = await db.getAll('schedules');
  return all.filter((s) => s.nextReviewAt <= now && s.lastReviewedAt !== null).length;
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
    schedules.filter((s) => s.nextReviewAt <= now && s.lastReviewedAt !== null).map((s) => s.cardId)
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

/** 학습 기록 백업 객체 — 스케줄·복습 로그·설정을 모아 반환 */
export async function exportLearningData(): Promise<BackupData> {
  const db = await getDB();
  const [schedules, reviewLog, settings] = await Promise.all([
    db.getAll('schedules'),
    db.getAll('reviewLog'),
    db.getAll('settings'),
  ]);
  return buildExport(schedules, reviewLog, settings, new Date().toISOString());
}

/**
 * 학습 기록 초기화 — 복습 로그를 전부 지우고 모든 카드의 스케줄을 초기 상태로
 * 되돌린다 (카드 자체는 유지). 이후 모든 카드가 다시 '새 카드'가 된다.
 */
export async function resetLearningData(): Promise<void> {
  const db = await getDB();
  const cards = await db.getAll('cards');
  const tx = db.transaction(['schedules', 'reviewLog'], 'readwrite');
  await tx.objectStore('reviewLog').clear();
  const schedStore = tx.objectStore('schedules');
  await schedStore.clear();
  for (const c of cards) {
    await schedStore.put(createInitialSchedule(c.id));
  }
  await tx.done;
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

// 마스터 기준: Review 상태 && stability ≥ 30일
const MASTERY_STABILITY = 30;

export interface MasteryStats {
  mastered: number;
  total: number;
}

function isMastered(s: Schedule): boolean {
  return s.state === State.Review && s.stability >= MASTERY_STABILITY;
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
 * 카드 ID 목록으로 카드 + 현재 스케줄을 조회한다 (due 여부 무관).
 * 재복습("틀린 카드만 다시")처럼 방금 평가해 미래로 밀린 카드를 다시 꺼낼 때 쓴다.
 */
export async function getCardsByIds(ids: string[]): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const out: (Card & { schedule: Schedule })[] = [];
  for (const id of ids) {
    const [card, schedule] = await Promise.all([db.get('cards', id), db.get('schedules', id)]);
    if (card && schedule) out.push({ ...card, schedule });
  }
  return out;
}

/**
 * 단련(Forge) 카드 — 선택한 덱/티어에 맞는 카드를 due 여부와 무관하게 뽑되,
 * **약한 카드부터** 우선 출제한다 (약점을 거듭 벼리는 모드의 정체성).
 * 약점 = Again/Hard 횟수(reviewLog) + EF 부족 + 미학습. 동점은 살짝 흔든다.
 */
export async function getForgeCards(
  deckIds: Set<string>,
  tiers: Set<Tier>,
  limit: number,
): Promise<(Card & { schedule: Schedule })[]> {
  const db = await getDB();
  const [cards, schedules, logs] = await Promise.all([
    db.getAll('cards'),
    db.getAll('schedules'),
    db.getAll('reviewLog'),
  ]);
  const schedMap = new Map(schedules.map((s) => [s.cardId, s]));

  // 카드별 stumble 수 (Again/Hard = quality < 3)
  const stumbles = new Map<string, number>();
  for (const log of logs) {
    if (log.quality < 3) stumbles.set(log.cardId, (stumbles.get(log.cardId) || 0) + 1);
  }

  const weakness = (c: Card): number => {
    const s = schedMap.get(c.id);
    const difficulty = s?.difficulty ?? 5; // 1~10, 높을수록 약함
    const reps = s?.reps ?? 0;
    return (
      (stumbles.get(c.id) || 0) +
      (difficulty - 1) / 9 +
      (reps === 0 ? 0.5 : 0) +
      Math.random() * 0.3
    );
  };

  const matched = cards
    .filter((c) => deckIds.has(c.deck) && tiers.has(c.tier))
    .map((c) => ({ c, w: weakness(c) }))
    .sort((a, b) => b.w - a.w) // 약한 카드부터
    .slice(0, limit)
    .map((x) => x.c);

  const out: (Card & { schedule: Schedule })[] = [];
  for (const c of matched) {
    const s = schedMap.get(c.id);
    if (s) out.push({ ...c, schedule: s });
  }
  return out;
}

export interface ReviewStats {
  summary: ReviewSummary; // 총 복습 수 + 정답률
  heatmap: number[]; // 20주 × 7일 = 140 셀 (column-major)
  daily: number[]; // 최근 30일 일별 복습량
  tierStats: TierStat[]; // 티어별 정답률 (F/M/D 순)
}

/** Stats 화면용 집계 — reviewLog·cards를 한 번 읽어 히트맵·바차트·총계·티어 정답률을 계산 */
export async function getReviewStats(): Promise<ReviewStats> {
  const db = await getDB();
  const [logs, cards] = await Promise.all([db.getAll('reviewLog'), db.getAll('cards')]);
  const now = new Date();
  const tierByCard = new Map(cards.map((c) => [c.id, c.tier]));
  return {
    summary: summarizeReviews(logs),
    heatmap: buildHeatmap(logs, now, 20),
    daily: buildDailyVolume(logs, now, 30),
    tierStats: tierAccuracy(logs, tierByCard),
  };
}

/** 약한 카드(Leech) — Again이 누적된 카드를 reviewLog·cards에서 집계 */
export async function getLeeches(threshold = 3): Promise<Leech[]> {
  const db = await getDB();
  const [logs, cards] = await Promise.all([db.getAll('reviewLog'), db.getAll('cards')]);
  return findLeeches(logs, cards, threshold);
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
