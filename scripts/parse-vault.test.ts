import { describe, it, expect } from 'vitest';
import { parseArgs } from './parse-vault.ts';

describe('parseArgs', () => {
  it('positional vault-dir와 기본 outPath/version', () => {
    const a = parseArgs(['/my/vault']);
    expect(a.vaultDir).toBe('/my/vault');
    expect(a.outPath).toBe('public/cards.json');
    expect(a.version).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('-o / --out 로 출력 경로 지정', () => {
    expect(parseArgs(['/v', '-o', 'out/x.json']).outPath).toBe('out/x.json');
    expect(parseArgs(['/v', '--out', 'y.json']).outPath).toBe('y.json');
  });
  it('--version 으로 버전 문자열 지정', () => {
    expect(parseArgs(['/v', '--version', 'V1']).version).toBe('V1');
  });
  it('vault-dir 누락 시 throw', () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(['-o', 'x.json'])).toThrow();
  });
});
