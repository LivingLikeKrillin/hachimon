import { describe, it, expect } from 'vitest';
import { parseArgs } from './inbox.ts';

describe('parseArgs', () => {
  it('positional inbox-dir와 기본값', () => {
    const a = parseArgs(['./inbox']);
    expect(a.inboxDir).toBe('./inbox');
    expect(a.outDir).toBe('_forge-drafts');
    expect(a.deckSource).toBe('public/cards.json');
    expect(a.model).toBe('claude-opus-4-8');
    expect(a.dryRun).toBe(false);
    expect(a.keep).toBe(false);
  });

  it('-o / --out, --deck-source, --model 값 지정', () => {
    const a = parseArgs(['./in', '-o', 'drafts', '--deck-source', '/v', '--model', 'claude-opus-4-7']);
    expect(a.outDir).toBe('drafts');
    expect(a.deckSource).toBe('/v');
    expect(a.model).toBe('claude-opus-4-7');
  });

  it('--dry-run, --keep 플래그', () => {
    const a = parseArgs(['./in', '--dry-run', '--keep']);
    expect(a.dryRun).toBe(true);
    expect(a.keep).toBe(true);
  });

  it('inbox-dir 누락 시 throw', () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(['--dry-run'])).toThrow();
  });

  it('값 요구 플래그에 값이 없으면 throw', () => {
    expect(() => parseArgs(['./in', '-o'])).toThrow();
    expect(() => parseArgs(['./in', '--model'])).toThrow();
  });
});
