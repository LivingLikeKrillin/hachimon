import { parseVault } from '../obsidian.ts';
import type { QuizCard, QuizResult } from './schema.ts';
import type { Tier } from '@/types';

export interface AssembleInput {
  title: string;
  body: string;
  deck: string;
  quiz: QuizResult;
}

/** 제목 → 파일시스템 안전 slug. 한글 등 유니코드는 보존, 경로/특수문자는 제거. */
export function toSlug(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[\\/:*?"<>|#]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'note';
}

/** drafts 디렉토리 내 유일성 보장: 충돌 시 -2, -3 … 접미사. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const TIER_ORDER: { tier: Tier; heading: string; cards: (q: QuizResult) => QuizCard[] }[] = [
  { tier: 'foundation', heading: 'Foundation', cards: (q) => q.foundation },
  { tier: 'mechanism', heading: 'Mechanism', cards: (q) => q.mechanism },
  { tier: 'diagnosis', heading: 'Diagnosis', cards: (q) => q.diagnosis },
];

/** 질문 끝에 '?'가 없으면 1개 부여(중복 추가 금지). */
function ensureQuestionMark(q: string): string {
  const t = q.trimEnd();
  return t.endsWith('?') ? t : `${t}?`;
}

/** 정리된 노트 + 3-tier 퀴즈를 draft 마크다운으로 조립한다. created는 결정성을 위해 주입. */
export function assembleNote(input: AssembleInput, created: string): string {
  const lines: string[] = [
    '---',
    'hachimon: draft',
    `deck: ${input.deck}`,
    `created: ${created}`,
    '---',
    `# ${input.title}`,
    '',
    input.body.trim(),
    '',
    '## Self-Test Anchors',
    `#flashcard/${input.deck}`,
  ];

  for (const { heading, cards } of TIER_ORDER) {
    const list = cards(input.quiz);
    if (list.length === 0) continue; // 빈 티어 헤딩 생략(파싱 노이즈 방지)
    lines.push('', `### ${heading}`);
    for (const c of list) {
      lines.push(`${ensureQuestionMark(c.q)}::${c.a}`);
    }
  }

  return lines.join('\n') + '\n';
}

/** 조립 문자열을 단일 진실원천 파서로 라운드트립해 추출되는 카드 수를 센다(검증 게이트). */
export function countParsedCards(content: string, version = 'forge-validate'): number {
  return parseVault([{ name: 'draft.md', content }], version).cards.length;
}
