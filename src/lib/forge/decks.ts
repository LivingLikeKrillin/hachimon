import type { CardsData } from '@/types';
import { parseVault, type VaultFile } from '../obsidian.ts';

/** 덱 id에서 `flashcard/` 접두를 제거(있으면). */
function stripFlashcardPrefix(deckId: string): string {
  return deckId.replace(/^flashcard\//, '');
}

/** CardsData에서 유니크 덱 경로(접두 제거·정렬)를 추출한다. */
export function uniqueDeckPaths(data: CardsData): string[] {
  const set = new Set<string>();
  for (const d of data.decks) set.add(stripFlashcardPrefix(d.id));
  return Array.from(set).sort();
}

/** vault 파일들을 parseVault로 파싱해 유니크 덱 경로를 추출한다. */
export function decksFromVault(files: VaultFile[]): string[] {
  return uniqueDeckPaths(parseVault(files));
}
