import type { StructureResult } from './schema.ts';

/** 호출①: raw 캡처를 정리된 노트 + 덱 분류로 변환하는 프롬프트. */
export function buildStructurePrompt(rawNote: string, decks: string[]): string {
  const deckList =
    decks.length > 0
      ? decks.map((d) => `- ${d}`).join('\n')
      : '(기존 덱 없음)';
  return `당신은 개인 지식관리 시스템의 노트 정리 도우미다. 아래 raw 캡처를 정리된 노트로 변환하고 가장 적합한 덱을 고른다.

# 기존 덱 목록 (슬래시 경로)
${deckList}

# 지시
- title: 노트의 핵심을 담은 간결한 제목.
- body: 캡처 내용을 정돈한 마크다운 본문(코드블록·강조 보존). 사실을 추가 날조하지 말 것.
- deck: 위 목록에서 **가장 적합한 기존 덱**을 슬래시 경로(예: spring/core)로 고른다. 명백히 새 주제면 같은 스타일의 새 경로를 제안한다.
- rationale: 덱 선택 이유 한 문장.

# raw 캡처
${rawNote}`;
}

const TIER_RUBRIC = `- Foundation: 개념 확인 — 정의·용어. (예: "X란 무엇인가?")
- Mechanism: 동작 원리 — 내부 구현·비교. (예: "X는 내부적으로 어떻게 동작하는가?")
- Diagnosis: 실전 진단 — 트러블슈팅·설계 판단. (예: "X 상황에서 무엇을 의심하고 어떻게 해결하는가?")`;

/** 호출②: 정리된 노트로 3-tier 퀴즈 카드를 생성하는 프롬프트. */
export function buildQuizPrompt(structure: StructureResult): string {
  return `당신은 간격 반복 학습용 플래시카드 저자다. 아래 노트로 3-tier 퀴즈 카드를 만든다.

# 3-tier 난이도 루브릭
${TIER_RUBRIC}

# 지시
- 티어별 1~3개 카드를 권장한다. 본문이 빈약한 티어는 0개여도 된다.
- q: '?'로 끝나는 질문. a: 멀티라인 마크다운 가능, 노트 근거에 충실할 것.
- 노트에 없는 사실을 날조하지 말 것.

# 노트 제목
${structure.title}

# 노트 본문
${structure.body}`;
}
