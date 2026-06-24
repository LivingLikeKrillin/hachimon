import { describe, it, expect } from 'vitest';
import { StructureSchema, QuizSchema } from './schema.ts';

describe('StructureSchema', () => {
  it('유효한 객체를 파싱한다', () => {
    const r = StructureSchema.safeParse({
      title: 'React Hooks',
      body: '본문...',
      deck: 'react/core',
      rationale: '이유',
    });
    expect(r.success).toBe(true);
  });

  it('필드 누락을 거부한다', () => {
    expect(StructureSchema.safeParse({ title: 'x', body: 'y', deck: 'z' }).success).toBe(false);
  });

  it('타입 오류를 거부한다', () => {
    expect(
      StructureSchema.safeParse({ title: 1, body: 'y', deck: 'z', rationale: 'r' }).success,
    ).toBe(false);
  });
});

describe('QuizSchema', () => {
  it('3티어 카드 배열을 파싱한다', () => {
    const r = QuizSchema.safeParse({
      foundation: [{ q: 'Q1?', a: 'A1' }],
      mechanism: [],
      diagnosis: [{ q: 'Q3?', a: 'A3' }],
    });
    expect(r.success).toBe(true);
  });

  it('카드 필드(q/a) 누락을 거부한다', () => {
    expect(
      QuizSchema.safeParse({ foundation: [{ q: 'Q?' }], mechanism: [], diagnosis: [] }).success,
    ).toBe(false);
  });

  it('티어 키 누락을 거부한다', () => {
    expect(QuizSchema.safeParse({ foundation: [], mechanism: [] }).success).toBe(false);
  });
});
