import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { State } from 'ts-fsrs';
import type { Card, CardsData } from '@/types';
import { getDB } from './db';
import { createInitialSchedule, applyRating } from './fsrs';
import { migrateToFsrs } from './migrate';
import { mergeCards } from './merge';
import { getDueCards, getNewCards, getSetting } from './data';

// IndexedDB 실제 동작 검증 (fake-indexeddb). 순수 단위 테스트로는 못 잡는
// DB I/O 경계(마이그레이션 멱등성·due/new 풀 분리·merge 분기)를 다룬다.

const now = new Date(2026, 5, 24, 12, 0, 0);

function card(id: string, tier: Card['tier'] = 'foundation'): Card {
  return { id, deck: 'flashcard/x', tier, question: 'Q', answer: 'A', sourceFile: 'f.md', sourceHash: 'h' };
}
function reviewLog(cardId: string, quality: number, reviewedAt: string) {
  return { cardId, quality, reviewedAt, sessionId: 's' };
}

beforeEach(async () => {
  const db = await getDB();
  await Promise.all([
    db.clear('cards'),
    db.clear('schedules'),
    db.clear('reviewLog'),
    db.clear('settings'),
  ]);
});

describe('migrateToFsrs (integration)', () => {
  it('reviewLog를 리플레이해 schedules를 채우고 schedulerVersion 플래그를 세운다', async () => {
    const db = await getDB();
    await db.put('cards', card('c1'));
    await db.put('reviewLog', reviewLog('c1', 4, new Date(2026, 5, 20).toISOString()));

    await migrateToFsrs(now);

    const s = await db.get('schedules', 'c1');
    expect(s).toBeTruthy();
    expect(s!.reps).toBe(1);
    expect(s!.lastReviewedAt).not.toBeNull();
    expect(await getSetting<string | null>('schedulerVersion', null)).toBe('fsrs');
  });

  it('로그 없는 카드는 New 초기 상태로 마이그레이션된다', async () => {
    const db = await getDB();
    await db.put('cards', card('c2'));

    await migrateToFsrs(now);

    const s = await db.get('schedules', 'c2');
    expect(s!.state).toBe(State.New);
    expect(s!.lastReviewedAt).toBeNull();
  });

  it('멱등: 플래그가 세워지면 두 번째 실행은 아무 것도 바꾸지 않는다', async () => {
    const db = await getDB();
    await db.put('cards', card('c1'));
    await db.put('reviewLog', reviewLog('c1', 4, new Date(2026, 5, 20).toISOString()));

    await migrateToFsrs(now);
    const first = await db.get('schedules', 'c1');

    // 두 번째 카드를 추가해도, 이미 fsrs 플래그가 있으므로 마이그레이션은 no-op
    await db.put('cards', card('c3'));
    await migrateToFsrs(new Date(2026, 5, 25));

    expect(await db.get('schedules', 'c1')).toEqual(first); // 기존 카드 불변
    expect(await db.get('schedules', 'c3')).toBeUndefined(); // 신규는 마이그레이션이 건드리지 않음
  });
});

describe('due 풀 / 새 카드 분리 (integration)', () => {
  it('갓 생성된 초기 스케줄(미복습)은 due 풀에서 제외되고 새 카드 풀에 포함된다', async () => {
    const db = await getDB();
    await db.put('cards', card('n1'));
    await db.put('schedules', createInitialSchedule('n1', now));

    const due = await getDueCards(50);
    expect(due.some((c) => c.id === 'n1')).toBe(false); // lastReviewedAt===null → due 제외

    const fresh = await getNewCards();
    expect(fresh.some((c) => c.id === 'n1')).toBe(true); // 새 카드 풀에는 포함
  });

  it('복습된 카드(due 지남)는 due 풀에 포함되고 새 카드 풀에서는 빠진다', async () => {
    const db = await getDB();
    await db.put('cards', card('r1'));
    // 과거에 복습해 nextReviewAt이 과거가 되도록
    const reviewed = applyRating(createInitialSchedule('r1', new Date(2026, 4, 1)), 4, new Date(2026, 4, 1));
    await db.put('schedules', reviewed);

    const due = await getDueCards(50);
    expect(due.some((c) => c.id === 'r1')).toBe(true);

    const fresh = await getNewCards();
    expect(fresh.some((c) => c.id === 'r1')).toBe(false); // lastReviewedAt !== null → 새 카드 아님
  });
});

describe('mergeCards (integration)', () => {
  it('새 카드는 초기 스케줄 생성, 내용 변경은 스케줄 보존, 서버에서 빠진 카드는 삭제', async () => {
    const db = await getDB();

    const data1: CardsData = { version: 'v1', decks: [], cards: [card('a'), card('b')] };
    await mergeCards(data1);
    expect(await db.get('schedules', 'a')).toBeTruthy();
    expect(await db.get('schedules', 'b')).toBeTruthy();

    // a를 복습한 상태로 만든다 → 내용 변경 시 보존되어야 함
    const reviewed = applyRating(createInitialSchedule('a', now), 4, now);
    await db.put('schedules', reviewed);

    // b 제거, a는 sourceHash 변경(내용 갱신)
    const data2: CardsData = {
      version: 'v2',
      decks: [],
      cards: [{ ...card('a'), sourceHash: 'h2', question: 'Q-new' }],
    };
    await mergeCards(data2);

    const a = await db.get('schedules', 'a');
    expect(a!.reps).toBe(reviewed.reps); // 스케줄 보존
    expect((await db.get('cards', 'a'))!.question).toBe('Q-new'); // 본문 갱신
    expect(await db.get('cards', 'b')).toBeUndefined(); // 삭제
    expect(await db.get('schedules', 'b')).toBeUndefined(); // 스케줄도 삭제
  });
});
