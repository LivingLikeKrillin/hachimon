import { describe, it, expect } from 'vitest';
import { parseVault } from '../src/lib/obsidian.ts';
import { serializeCards } from './serialize.ts';

const note = (deck: string, tier: string, qa: string) =>
  ['## Self-Test Anchors', `#flashcard/${deck}`, `### ${tier}`, qa].join('\n');

describe('serializeCards', () => {
  it('유효 노트 → json/decks/cards 카운트', () => {
    const files = [{ name: 'Spring.md', content: note('spring/core', 'Foundation', '전파란?::규칙.') }];
    const r = serializeCards(files, 'V1');
    expect(r.decks).toBe(1);
    expect(r.cards).toBe(1);
    const data = JSON.parse(r.json);
    expect(data.version).toBe('V1');
    expect(data.cards[0].deck).toBe('flashcard/spring/core');
    expect(r.warnings).toEqual([]);
  });

  it('카드 0장이면 throw', () => {
    const files = [{ name: 'empty.md', content: '# 본문만' }];
    expect(() => serializeCards(files, 'V1')).toThrow();
  });

  it('동일 basename은 warnings에 수집 (throw 아님)', () => {
    const files = [
      { name: 'Dup.md', content: note('a/x', 'Foundation', 'q1?::a1') },
      { name: 'Dup.md', content: note('b/y', 'Foundation', 'q2?::a2') },
    ];
    const r = serializeCards(files, 'V1');
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain('Dup.md');
  });

  it('출력이 CLI와 동일 (parseVault + JSON.stringify(,2)+\\n)', () => {
    const files = [{ name: 'Spring.md', content: note('spring/core', 'Foundation', '전파란?::규칙.') }];
    expect(serializeCards(files, 'V1').json).toBe(
      JSON.stringify(parseVault(files, 'V1'), null, 2) + '\n',
    );
  });
});
