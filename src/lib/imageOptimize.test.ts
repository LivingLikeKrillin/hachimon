import { describe, it, expect } from 'vitest';
import {
  isSvgName,
  computeTargetWidth,
  bytesToBase64,
  toDataUri,
  MAX_WIDTH,
} from './imageOptimize.ts';

describe('isSvgName', () => {
  it('확장자 .svg 대소문자 무관', () => {
    expect(isSvgName('a.svg')).toBe(true);
    expect(isSvgName('A.SVG')).toBe(true);
    expect(isSvgName('a.png')).toBe(false);
    expect(isSvgName('svg.png')).toBe(false);
  });
});

describe('computeTargetWidth', () => {
  it('max 초과는 max로 축소', () => {
    expect(computeTargetWidth(1600)).toBe(MAX_WIDTH);
    expect(computeTargetWidth(1600, 800)).toBe(800);
  });
  it('max 이하는 원본 유지(확대 금지)', () => {
    expect(computeTargetWidth(400)).toBe(400);
    expect(computeTargetWidth(800)).toBe(800);
  });
});

describe('bytesToBase64', () => {
  it('빈 배열은 빈 문자열', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });
  it('알려진 바이트 인코딩', () => {
    // "Aa" → base64
    expect(bytesToBase64(new Uint8Array([0x41, 0x61]))).toBe('QWE=');
  });
  it('청크 경계(32KB 초과)에서도 정확', () => {
    const big = new Uint8Array(0x8000 + 10).fill(0x41);
    const b64 = bytesToBase64(big);
    // round-trip 검증
    const back = atob(b64);
    expect(back.length).toBe(big.length);
    expect(back.charCodeAt(0)).toBe(0x41);
    expect(back.charCodeAt(back.length - 1)).toBe(0x41);
  });
});

describe('toDataUri', () => {
  it('mime + base64 조립', () => {
    expect(toDataUri('image/webp', new Uint8Array([0x41, 0x61]))).toBe('data:image/webp;base64,QWE=');
  });
  it('svg mime', () => {
    expect(toDataUri('image/svg+xml', new Uint8Array([0x41]))).toBe('data:image/svg+xml;base64,QQ==');
  });
});
