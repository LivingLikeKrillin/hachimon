import { describe, it, expect } from 'vitest';
import { findImageRefs, replaceImageRefs } from './images.ts';

describe('findImageRefs', () => {
  it('Obsidian 임베드 ![[t]] / ![[t|alt]]', () => {
    const refs = findImageRefs('a ![[diagram.png]] b ![[x.png|도식]] c');
    expect(refs.map((r) => [r.target, r.alt])).toEqual([['diagram.png', ''], ['x.png', '도식']]);
  });
  it('표준 ![alt](t)', () => {
    const refs = findImageRefs('![cap](sub/p.png)');
    expect(refs[0].target).toBe('sub/p.png');
    expect(refs[0].alt).toBe('cap');
  });
  it('http(s)·data: target은 제외', () => {
    const refs = findImageRefs('![](https://e.com/a.png) ![](data:image/png;base64,xx)');
    expect(refs).toHaveLength(0);
  });
  it('이미지 없으면 빈 배열', () => {
    expect(findImageRefs('그냥 텍스트')).toEqual([]);
  });
});

describe('replaceImageRefs', () => {
  it('resolver 값으로 치환, null이면 원본 유지', async () => {
    const out = await replaceImageRefs('![[a.png]] 그리고 ![[b.png]]', async (ref) =>
      ref.target === 'a.png' ? `![](data:image/webp;base64,QQ==)` : null,
    );
    expect(out).toBe('![](data:image/webp;base64,QQ==) 그리고 ![[b.png]]');
  });
  it('치환 문자열의 $는 특수처리되지 않는다', async () => {
    const out = await replaceImageRefs('![[a.png]]', async () => '![x](u) $& $1 가격$5');
    expect(out).toBe('![x](u) $& $1 가격$5');
  });
});
