import type { Tier } from '@/types';

// === 디자인 토큰 SSOT (인라인 스타일/SVG용) ===
// CSS의 --gate-* 변수와 값이 일치해야 한다 (index.css).

/** 티어 시맨틱 컬러 (= gate-1 / gate-5 / gate-7) */
export const TIER_COLORS: Record<Tier, string> = {
  foundation: '#60a5fa',
  mechanism: '#fbbf24',
  diagnosis: '#f87171',
};

/** 8게이트 컬러 (1문 blue → 8문 crimson) */
export const GATE_COLORS = [
  '#60a5fa', // 1문 開門 blue
  '#38bdf8', // 2문 休門 cyan
  '#34d399', // 3문 生門 green
  '#a3e635', // 4문 傷門 lime
  '#fbbf24', // 5문 杜門 amber
  '#fb923c', // 6문 景門 orange
  '#f87171', // 7문 驚門 red
  '#e11d48', // 8문 死門 crimson
];

export interface AccuracyColor {
  /** Tailwind 텍스트 클래스 */
  text: string;
  /** 인라인/SVG용 hex */
  hex: string;
}

/** 정답률(0~100) → 임계 색상 (80 이상 emerald / 60 이상 amber / 그 외 red) */
export function accuracyColor(pct: number): AccuracyColor {
  if (pct >= 80) return { text: 'text-emerald-400', hex: '#34d399' };
  if (pct >= 60) return { text: 'text-amber-400', hex: '#fbbf24' };
  return { text: 'text-red-400', hex: '#f87171' };
}
