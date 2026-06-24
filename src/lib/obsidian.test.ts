import { describe, it, expect } from 'vitest';
import { parseVault } from './obsidian';

const VERSION = '2026-06-23T00:00:00.000Z';

describe('parseVault', () => {
  it('parses cards under each tier with deck and tier mapped', () => {
    const content = [
      '# Spring Transaction',
      '본문 노트는 무시된다.',
      '',
      '## Self-Test Anchors',
      '#flashcard/spring/core',
      '',
      '### Foundation',
      '트랜잭션 전파란?::경계가 만났을 때 동작을 정하는 규칙.',
      '',
      '### Mechanism',
      'REQUIRES_NEW와 NESTED 차이는?::REQUIRES_NEW는 독립 트랜잭션.',
      '',
      '### Diagnosis',
      '롤백이 전파 안 되는 원인은?::별도 트랜잭션이라 전파되지 않는다.',
    ].join('\n');

    const data = parseVault([{ name: 'Spring-Transaction.md', content }], VERSION);

    expect(data.version).toBe(VERSION);
    expect(data.cards).toHaveLength(3);

    const f = data.cards[0];
    expect(f.deck).toBe('flashcard/spring/core');
    expect(f.tier).toBe('foundation');
    expect(f.question).toBe('트랜잭션 전파란?');
    expect(f.answer).toBe('경계가 만났을 때 동작을 정하는 규칙.');

    expect(data.cards[1].tier).toBe('mechanism');
    expect(data.cards[2].tier).toBe('diagnosis');
  });

  it('ignores everything above the Self-Test Anchors heading', () => {
    const content = [
      '#flashcard/should/ignore',
      '위쪽 질문?::이건 무시되어야 한다.',
      '',
      '## Self-Test Anchors',
      '#flashcard/spring/core',
      '### Foundation',
      '진짜 질문?::진짜 답변.',
    ].join('\n');

    const data = parseVault([{ name: 'note.md', content }], VERSION);

    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].question).toBe('진짜 질문?');
    expect(data.cards[0].deck).toBe('flashcard/spring/core');
  });

  it('produces no cards when there is no Self-Test Anchors section', () => {
    const content = '#flashcard/x\n### Foundation\nq?::a';
    const data = parseVault([{ name: 'note.md', content }], VERSION);
    expect(data.cards).toHaveLength(0);
  });

  it('generates ids from filename slug, tier abbr, and per-tier sequence', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/java/concurrency',
      '### Foundation',
      '질문 1?::답 1',
      '질문 2?::답 2',
      '### Mechanism',
      '질문 3?::답 3',
    ].join('\n');

    const data = parseVault([{ name: 'Java Memory Model.md', content }], VERSION);

    expect(data.cards.map((c) => c.id)).toEqual([
      'java-memory-model-f1',
      'java-memory-model-f2',
      'java-memory-model-m1',
    ]);
    expect(data.cards[0].sourceFile).toBe('Java Memory Model.md');
  });

  it('splits only on the first :: so answers may contain ::', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/x',
      '### Foundation',
      '맵 리터럴은?::`Map.of("a", 1)` 형태로 key::value 가 아니다.',
    ].join('\n');

    const data = parseVault([{ name: 'n.md', content }], VERSION);
    expect(data.cards[0].question).toBe('맵 리터럴은?');
    expect(data.cards[0].answer).toBe('`Map.of("a", 1)` 형태로 key::value 가 아니다.');
  });

  it('skips lines without :: and is case-insensitive for tier headings', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/x',
      '### foundation',
      '이건 그냥 메모 라인 (구분자 없음)',
      '유효한 질문?::유효한 답.',
    ].join('\n');

    const data = parseVault([{ name: 'n.md', content }], VERSION);
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].tier).toBe('foundation');
  });

  it('aggregates decks across files with cardCount', () => {
    const a = '## Self-Test Anchors\n#flashcard/spring/core\n### Foundation\nq1?::a1';
    const b = '## Self-Test Anchors\n#flashcard/spring/core\n### Mechanism\nq2?::a2';
    const c = '## Self-Test Anchors\n#flashcard/jpa/basics\n### Foundation\nq3?::a3';

    const data = parseVault(
      [
        { name: 'a.md', content: a },
        { name: 'b.md', content: b },
        { name: 'c.md', content: c },
      ],
      VERSION,
    );

    const core = data.decks.find((d) => d.id === 'flashcard/spring/core');
    expect(core).toBeDefined();
    expect(core!.cardCount).toBe(2);
    expect(core!.path).toEqual(['flashcard', 'spring', 'core']);
    expect(core!.name).toBe('core');

    const jpa = data.decks.find((d) => d.id === 'flashcard/jpa/basics');
    expect(jpa!.cardCount).toBe(1);
  });

  it('gives identical content a stable hash and different content a different hash', () => {
    const mk = (a: string) =>
      `## Self-Test Anchors\n#flashcard/x\n### Foundation\nq?::${a}`;

    const h1 = parseVault([{ name: 'n.md', content: mk('답변 A') }], VERSION).cards[0].sourceHash;
    const h2 = parseVault([{ name: 'n.md', content: mk('답변 A') }], VERSION).cards[0].sourceHash;
    const h3 = parseVault([{ name: 'n.md', content: mk('답변 B') }], VERSION).cards[0].sourceHash;

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('skips cards that have no #flashcard deck tag in the section', () => {
    const content = '## Self-Test Anchors\n### Foundation\nq?::a';
    const data = parseVault([{ name: 'n.md', content }], VERSION);
    expect(data.cards).toHaveLength(0);
  });
});

describe('parseVault — multi-line answers', () => {
  const wrap = (body: string) =>
    ['## Self-Test Anchors', '#flashcard/spring/core', '### Mechanism', body].join('\n');

  it('답변이 다음 카드 전까지 여러 줄로 이어진다', () => {
    const content = wrap(
      ['DI란?::의존성을 외부에서 주입.', '추가 설명 문단.', '', 'AOP란?::횡단 관심사 분리.'].join('\n'),
    );
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(2);
    expect(cards[0].question).toBe('DI란?');
    expect(cards[0].answer).toBe('의존성을 외부에서 주입.\n추가 설명 문단.');
    expect(cards[1].question).toBe('AOP란?');
    expect(cards[1].answer).toBe('횡단 관심사 분리.');
  });

  it('코드펜스를 답변에 보존하고 펜스 안 ::는 새 카드가 아니다', () => {
    const content = wrap(
      ['빈 생성자 주입?::', '```java', 'class A {', '  Map<String,Integer> m = Map.of("a", 1);', '}', '```'].join('\n'),
    );
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(1);
    expect(cards[0].answer).toBe(
      ['```java', 'class A {', '  Map<String,Integer> m = Map.of("a", 1);', '}', '```'].join('\n'),
    );
  });

  it('인라인 코드 안 ::는 새 카드로 오인되지 않는다', () => {
    const content = wrap(['질문?::설명.', '리스트의 `std::vector`를 쓴다.'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(1);
    expect(cards[0].answer).toBe('설명.\n리스트의 `std::vector`를 쓴다.');
  });

  it('티어 헤딩이 답변을 종료하고 티어를 전환한다', () => {
    const content = [
      '## Self-Test Anchors',
      '#flashcard/x',
      '### Foundation',
      'q1?::a1 여러 줄',
      '둘째 줄',
      '### Diagnosis',
      'q2?::a2',
    ].join('\n');
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards).toHaveLength(2);
    expect(cards[0].tier).toBe('foundation');
    expect(cards[0].answer).toBe('a1 여러 줄\n둘째 줄');
    expect(cards[1].tier).toBe('diagnosis');
  });

  it('파일 끝의 멀티라인 답변이 flush된다', () => {
    const content = wrap(['q?::첫 줄', '둘째 줄', '셋째 줄'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards[0].answer).toBe('첫 줄\n둘째 줄\n셋째 줄');
  });

  it('정확한 sourceHash 회귀 가드 (NUL 구분자 유지)', () => {
    const content = wrap(['q?::a'].join('\n'));
    const { cards } = parseVault([{ name: 'n.md', content }], VERSION);
    expect(cards[0].sourceHash).toBe('0ff541');
  });
});
