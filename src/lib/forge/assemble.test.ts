import { describe, it, expect } from 'vitest';
import { parseVault } from '../obsidian.ts';
import { toSlug, uniqueSlug, assembleNote, countParsedCards } from './assemble.ts';
import type { QuizResult } from './schema.ts';

const CREATED = '2026-06-25T00:00:00.000Z';

const quiz: QuizResult = {
  foundation: [{ q: '트랜잭션 전파란', a: '경계 동작 규칙.' }], // '?' 없음 → 자동 부여 확인
  mechanism: [{ q: 'PROPAGATION_REQUIRED는 어떻게 동작하는가?', a: '기존 트랜잭션에 참여.' }],
  diagnosis: [],
};

describe('toSlug', () => {
  it('공백/언더스코어를 하이픈으로, 소문자화', () => {
    expect(toSlug('Spring Transaction')).toBe('spring-transaction');
  });
  it('파일시스템 위험 문자를 제거하고 한글은 보존', () => {
    expect(toSlug('리액트: 훅/상태?')).toBe('리액트-훅상태');
  });
  it('전부 제거되면 fallback', () => {
    expect(toSlug('  /  ')).toBe('note');
  });
});

describe('uniqueSlug', () => {
  it('충돌 시 -2, -3 접미사', () => {
    const taken = new Set(['x', 'x-2']);
    expect(uniqueSlug('x', taken)).toBe('x-3');
    expect(uniqueSlug('y', taken)).toBe('y');
  });
});

describe('assembleNote', () => {
  const md = assembleNote(
    { title: 'Spring Transaction', body: '본문 텍스트.', deck: 'spring/core', quiz },
    CREATED,
  );

  it('draft frontmatter와 Self-Test Anchors 블록을 포함한다', () => {
    expect(md).toContain('hachimon: draft');
    expect(md).toContain('deck: spring/core');
    expect(md).toContain(`created: ${CREATED}`);
    expect(md).toContain('## Self-Test Anchors');
    expect(md).toContain('#flashcard/spring/core');
  });

  it("질문에 '?'가 없으면 1개 부여하고, 있으면 중복 추가 안 함", () => {
    expect(md).toContain('트랜잭션 전파란?::경계 동작 규칙.');
    expect(md).toContain('PROPAGATION_REQUIRED는 어떻게 동작하는가?::기존 트랜잭션에 참여.');
    expect(md).not.toContain('??');
  });

  it('빈 티어(diagnosis) 헤딩을 생략한다', () => {
    expect(md).toContain('### Foundation');
    expect(md).toContain('### Mechanism');
    expect(md).not.toContain('### Diagnosis');
  });

  it('parseVault 라운드트립으로 카드가 추출된다 (핵심 게이트)', () => {
    const data = parseVault([{ name: 'Spring-Transaction.md', content: md }]);
    expect(data.cards.length).toBe(2);
    expect(data.cards[0].deck).toBe('flashcard/spring/core');
    expect(data.cards.map((c) => c.tier).sort()).toEqual(['foundation', 'mechanism']);
  });
});

describe('countParsedCards', () => {
  it('조립 문자열에서 카드 수를 센다', () => {
    const md = assembleNote(
      { title: 'T', body: 'b', deck: 'd/e', quiz: { foundation: [{ q: 'Q?', a: 'A' }], mechanism: [], diagnosis: [] } },
      CREATED,
    );
    expect(countParsedCards(md)).toBe(1);
  });

  it('카드가 없으면 0', () => {
    const md = assembleNote(
      { title: 'T', body: 'b', deck: 'd/e', quiz: { foundation: [], mechanism: [], diagnosis: [] } },
      CREATED,
    );
    expect(countParsedCards(md)).toBe(0);
  });
});
