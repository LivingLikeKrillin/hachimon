import { describe, it, expect } from 'vitest';
import { extractCodeMeta, formatLang, type HastNode } from './codeblock.ts';

/** rehype-highlight 변환 후의 `<pre><code class="hljs language-x">텍스트</code></pre>` 모사. */
function pre(className: string[], text: string): HastNode {
  return {
    tagName: 'pre',
    children: [
      {
        tagName: 'code',
        properties: { className },
        children: [{ type: 'text', value: text }],
      },
    ],
  };
}

describe('formatLang', () => {
  it('등록 언어는 표시 라벨로', () => {
    expect(formatLang('java')).toBe('Java');
    expect(formatLang('sql')).toBe('SQL');
    expect(formatLang('yaml')).toBe('YAML');
    expect(formatLang('kt')).toBe('Kotlin');
  });
  it('대소문자 무관', () => {
    expect(formatLang('Java')).toBe('Java');
  });
  it('미등록 언어는 대문자 fallback', () => {
    expect(formatLang('rust')).toBe('RUST');
  });
  it('빈 값은 빈 문자열', () => {
    expect(formatLang('')).toBe('');
  });
});

describe('extractCodeMeta', () => {
  it('language- 클래스에서 언어 추출', () => {
    const node = pre(['hljs', 'language-java'], 'class A {}');
    expect(extractCodeMeta(node).lang).toBe('java');
  });
  it('언어 없으면 빈 문자열', () => {
    const node = pre(['hljs'], 'plain');
    expect(extractCodeMeta(node).lang).toBe('');
  });
  it('줄 수 = 개행 기준 줄 개수', () => {
    const node = pre(['language-sql'], 'SELECT 1\nFROM dual');
    expect(extractCodeMeta(node).lineCount).toBe(2);
  });
  it('후행 개행 1개는 무시', () => {
    const node = pre(['language-yaml'], 'a: 1\nb: 2\n');
    expect(extractCodeMeta(node).lineCount).toBe(2);
  });
  it('단일 줄은 1', () => {
    const node = pre(['language-java'], 'int x = 1;');
    expect(extractCodeMeta(node).lineCount).toBe(1);
  });
  it('빈 코드는 0', () => {
    const node = pre(['language-java'], '');
    expect(extractCodeMeta(node).lineCount).toBe(0);
  });
  it('중첩된 하이라이트 span 텍스트도 합산', () => {
    const node: HastNode = {
      tagName: 'pre',
      children: [
        {
          tagName: 'code',
          properties: { className: ['hljs', 'language-java'] },
          children: [
            { tagName: 'span', properties: { className: ['hljs-keyword'] }, children: [{ type: 'text', value: 'int' }] },
            { type: 'text', value: ' x;\nint y;' },
          ],
        },
      ],
    };
    expect(extractCodeMeta(node).lineCount).toBe(2);
  });
  it('className 이 문자열이어도 처리', () => {
    const node: HastNode = {
      tagName: 'pre',
      children: [
        { tagName: 'code', properties: { className: 'hljs language-sql' }, children: [{ type: 'text', value: 'x' }] },
      ],
    };
    expect(extractCodeMeta(node).lang).toBe('sql');
  });
  it('undefined 안전', () => {
    expect(extractCodeMeta(undefined)).toEqual({ lang: '', lineCount: 0 });
  });
});
