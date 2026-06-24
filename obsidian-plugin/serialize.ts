import { parseVault, type VaultFile } from '../src/lib/obsidian.ts';
import type { CardsData } from '@/types';

export interface SerializeResult {
  json: string;
  decks: number;
  cards: number;
  warnings: string[];
}

export interface ParsedVault {
  data: CardsData;
  warnings: string[];
}

/**
 * 볼트 파일을 파싱해 카드 데이터와 경고를 반환한다(JSON 직렬화 전 단계).
 * 이미지 인라인 등 후처리를 data.cards 에 적용한 뒤 finalizeJson 으로 직렬화한다.
 */
export function parseVaultFiles(files: VaultFile[], version: string): ParsedVault {
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
  return { data, warnings };
}

/** CLI와 동일한 직렬화 포맷(2-space + 후행 개행). */
export function finalizeJson(data: CardsData): string {
  return JSON.stringify(data, null, 2) + '\n';
}

/** 이미지 인라인 없이 파싱→직렬화하는 합성 헬퍼(테스트/하위호환용). */
export function serializeCards(files: VaultFile[], version: string): SerializeResult {
  const { data, warnings } = parseVaultFiles(files, version);
  return { json: finalizeJson(data), decks: data.decks.length, cards: data.cards.length, warnings };
}
