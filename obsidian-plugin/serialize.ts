import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';

export interface SerializeResult {
  json: string;
  decks: number;
  cards: number;
  warnings: string[];
}

export function serializeCards(files: VaultFile[], version: string): SerializeResult {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.name)) warnings.push(`중복 파일명 — id 충돌 가능: ${f.name}`);
    seen.add(f.name);
  }

  const data = parseVault(files, version);
  if (data.cards.length === 0) {
    throw new Error('카드를 찾지 못했습니다. ## Self-Test Anchors / #flashcard/… / ### Tier / 질문?::답변 포맷을 확인하세요.');
  }

  return {
    json: JSON.stringify(data, null, 2) + '\n',
    decks: data.decks.length,
    cards: data.cards.length,
    warnings,
  };
}
