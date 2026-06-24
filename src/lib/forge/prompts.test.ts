import { describe, it, expect } from 'vitest';
import { buildStructurePrompt, buildQuizPrompt } from './prompts.ts';

describe('buildStructurePrompt', () => {
  it('덱 목록과 raw 노트를 프롬프트에 포함한다', () => {
    const p = buildStructurePrompt('raw 캡처 내용', ['spring/core', 'react/hooks']);
    expect(p).toContain('raw 캡처 내용');
    expect(p).toContain('spring/core');
    expect(p).toContain('react/hooks');
  });

  it('덱 목록이 비면 새 덱 제안 지시를 포함한다', () => {
    const p = buildStructurePrompt('내용', []);
    expect(p.toLowerCase()).toContain('deck');
  });
});

describe('buildQuizPrompt', () => {
  it('정리된 본문과 3티어 루브릭을 포함한다', () => {
    const p = buildQuizPrompt({
      title: 'T',
      body: '정리된 본문',
      deck: 'spring/core',
      rationale: 'r',
    });
    expect(p).toContain('정리된 본문');
    expect(p).toContain('Foundation');
    expect(p).toContain('Mechanism');
    expect(p).toContain('Diagnosis');
  });
});
