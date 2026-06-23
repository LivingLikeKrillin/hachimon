import { describe, it, expect } from 'vitest';
import { resolveSwipe } from './gesture';

describe('resolveSwipe', () => {
  it('임계치 이상 오른쪽 이동 → right', () => {
    expect(resolveSwipe(80, 10)).toBe('right');
  });

  it('임계치 이상 왼쪽 이동 → left', () => {
    expect(resolveSwipe(-80, -10)).toBe('left');
  });

  it('임계치 미만이면 null', () => {
    expect(resolveSwipe(40, 0)).toBeNull();
    expect(resolveSwipe(-40, 0)).toBeNull();
  });

  it('수직 이동이 더 크면(스크롤) null', () => {
    expect(resolveSwipe(70, 120)).toBeNull();
    expect(resolveSwipe(-70, -120)).toBeNull();
  });

  it('threshold를 조절할 수 있다', () => {
    expect(resolveSwipe(30, 0, 20)).toBe('right');
    expect(resolveSwipe(30, 0, 50)).toBeNull();
  });
});
