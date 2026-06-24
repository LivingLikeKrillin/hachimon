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

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectMarkdownFiles } from './parse-vault.ts';

describe('collectMarkdownFiles', () => {
  it('하위폴더 .md만 재귀 수집, 숨김/제외 디렉토리·비-md 무시, basename 사용', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'a.md'), 'A');
      mkdirSync(path.join(root, 'sub'));
      writeFileSync(path.join(root, 'sub', 'b.md'), 'B');
      writeFileSync(path.join(root, 'note.txt'), 'X');
      writeFileSync(path.join(root, '.hidden.md'), 'H');
      mkdirSync(path.join(root, '.obsidian'));
      writeFileSync(path.join(root, '.obsidian', 'c.md'), 'C');

      const files = collectMarkdownFiles(root);
      const names = files.map((f) => f.name).sort();
      expect(names).toEqual(['a.md', 'b.md']);
      expect(files.find((f) => f.name === 'b.md')!.content).toBe('B');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
