import { describe, it, expect } from 'vitest';
import { imageUrlTransform } from './markdown.ts';

describe('imageUrlTransform', () => {
  it('data:image/* 는 통과', () => {
    const u = 'data:image/webp;base64,QQ==';
    expect(imageUrlTransform(u)).toBe(u);
  });
  it('https 는 통과', () => {
    expect(imageUrlTransform('https://e.com/a.png')).toBe('https://e.com/a.png');
  });
  it('javascript: 는 차단(빈 문자열)', () => {
    expect(imageUrlTransform('javascript:alert(1)')).toBe('');
  });
});
