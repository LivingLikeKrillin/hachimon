import { describe, it, expect } from 'vitest';
import type { CardsData } from '@/types';
import { uniqueDeckPaths, decksFromVault } from './decks.ts';

const cardsData: CardsData = {
  version: 'V1',
  decks: [
    { id: 'flashcard/spring/core', name: 'core', path: ['flashcard', 'spring', 'core'], cardCount: 2 },
    { id: 'flashcard/react/hooks', name: 'hooks', path: ['flashcard', 'react', 'hooks'], cardCount: 1 },
  ],
  cards: [],
};

describe('uniqueDeckPaths', () => {
  it('flashcard/ 접두를 제거하고 정렬한다', () => {
    expect(uniqueDeckPaths(cardsData)).toEqual(['react/hooks', 'spring/core']);
  });

  it('빈 덱이면 빈 배열', () => {
    expect(uniqueDeckPaths({ version: 'V', decks: [], cards: [] })).toEqual([]);
  });
});

describe('decksFromVault', () => {
  it('vault 파일을 parseVault로 파싱해 덱 경로를 추출한다', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/spring/tx',
      '### Foundation',
      '전파란?::규칙.',
    ].join('\n');
    expect(decksFromVault([{ name: 'Spring.md', content }])).toEqual(['spring/tx']);
  });
});
