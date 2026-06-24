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
  it('값이 필요한 플래그 뒤에 값이 없으면 usage 에러', () => {
    expect(() => parseArgs(['/v', '-o'])).toThrow(/Usage/);
    expect(() => parseArgs(['/v', '--version'])).toThrow(/Usage/);
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

import { readFileSync } from 'node:fs';
import { run } from './parse-vault.ts';

describe('run', () => {
  const VALID = [
    '## Self-Test Anchors',
    '#flashcard/spring/core',
    '### Foundation',
    '트랜잭션 전파란?::경계 동작 규칙.',
  ].join('\n');

  it('vault를 파싱해 cards.json을 쓰고 카운트를 반환한다', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'Spring.md'), VALID);
      const outPath = path.join(root, 'out', 'cards.json');
      const res = run({ vaultDir: root, outPath, version: 'V1' });
      expect(res).toEqual({ decks: 1, cards: 1 });
      const data = JSON.parse(readFileSync(outPath, 'utf-8'));
      expect(data.version).toBe('V1');
      expect(data.cards).toHaveLength(1);
      expect(data.cards[0].deck).toBe('flashcard/spring/core');
      expect(data.decks[0].cardCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('vault 디렉토리가 없으면 throw', () => {
    expect(() => run({ vaultDir: '/no/such/dir', outPath: 'x.json', version: 'V' })).toThrow();
  });

  it('카드가 0장이면 throw', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
    try {
      writeFileSync(path.join(root, 'empty.md'), '# 본문만 있고 카드 없음');
      expect(() => run({ vaultDir: root, outPath: path.join(root, 'o.json'), version: 'V' })).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
