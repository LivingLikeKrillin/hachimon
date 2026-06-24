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

/** 백틱 인라인코드 밖의 `::` 구분자 개수. parseVault.firstDelimiter와 동일 규칙. */
function delimiterCount(line: string): number {
  let inCode = false;
  let n = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === '`') inCode = !inCode;
    else if (!inCode && ch === ':' && line[i + 1] === ':') {
      n++;
      i++;
    }
  }
  return n;
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

export interface DraftValidation {
  ok: boolean;
  cardCount: number;
  reason?: string;
}

/** 강한 검증 게이트: 조립 결과를 단일 진실원천 파서로 라운드트립해, 의도한 카드가
 *  그대로(개수·질문·답변) 추출되는지 확인한다. 답변 내 `::`/`###`/`#flashcard` 등 구조
 *  문자로 인한 묵시적 손상(카드 수 변화·질문 변형·답변 절단)을 잡는다.
 *  - 카드 수: 의도한 개수와 일치해야 한다.
 *  - 질문: parseVault가 추출한 질문이 의도와 동일해야 한다(질문 내 `::`로 인한 변형 차단).
 *  - 답변: 라운드트립 답변이 의도(트림)와 동일해야 한다(답변 내 `###`/`#`로 인한 절단 차단).
 *  - 구분자: 카드 라인의 `::`(백틱 밖)는 정확히 1개여야 한다(답변 내 `::`로 인한 모호성 차단).
 *  count만 보는 게이트로는 못 잡던 묵시적 손상 케이스를 모두 거부한다. */
export function validateDraft(
  content: string,
  quiz: QuizResult,
  version = 'forge-validate',
): DraftValidation {
  const expected: { q: string; a: string }[] = [];
  for (const { cards } of TIER_ORDER) {
    for (const c of cards(quiz)) {
      expected.push({ q: ensureQuestionMark(c.q), a: c.a.replace(/^\s+|\s+$/g, '') });
    }
  }
  const parsed = parseVault([{ name: 'draft.md', content }], version).cards;
  if (parsed.length === 0) return { ok: false, cardCount: 0, reason: '카드 0개' };
  if (parsed.length !== expected.length) {
    return {
      ok: false,
      cardCount: parsed.length,
      reason: `카드 수 불일치(기대 ${expected.length}, 실제 ${parsed.length})`,
    };
  }

  // 카드 라인에 구분자 `::`(백틱 밖)가 정확히 1개인지 — 질문/답변 내 `::`로 인한 모호성 차단.
  for (const e of expected) {
    if (delimiterCount(`${e.q}::${e.a}`) !== 1) {
      return {
        ok: false,
        cardCount: parsed.length,
        reason: '구분자 모호성 감지(질문/답변 내 `::` 다중 출현)',
      };
    }
  }

  const parsedQs = parsed.map((c) => c.question).sort();
  const expectedQs = expected.map((e) => e.q).sort();
  for (let i = 0; i < parsedQs.length; i++) {
    if (parsedQs[i] !== expectedQs[i]) {
      return {
        ok: false,
        cardCount: parsed.length,
        reason: '질문 변형 감지(질문 내 `::` 등 구조 문자 가능성)',
      };
    }
  }

  const parsedAs = parsed.map((c) => c.answer).sort();
  const expectedAs = expected.map((e) => e.a).sort();
  for (let i = 0; i < parsedAs.length; i++) {
    if (parsedAs[i] !== expectedAs[i]) {
      return {
        ok: false,
        cardCount: parsed.length,
        reason: '답변 절단/변형 감지(답변 내 `###`/`#flashcard` 등 구조 문자 가능성)',
      };
    }
  }

  return { ok: true, cardCount: parsed.length };
}
