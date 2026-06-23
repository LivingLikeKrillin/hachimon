import type { Tier } from '@/types';

// === 디자인 토큰 SSOT (인라인 스타일/SVG용) — 채도 낮춘 팔레트 ===

/** 티어 점/막대 색 (muted) */
export const TIER_COLORS: Record<Tier, string> = {
  foundation: '#6E8BC9',
  mechanism: '#CFA24E',
  diagnosis: '#CD746C',
};

/** 티어 텍스트 색 (살짝 밝게) */
export const TIER_TEXT: Record<Tier, string> = {
  foundation: '#93A8DC',
  mechanism: '#DDB868',
  diagnosis: '#DD8C85',
};

export interface AccuracyColor {
  /** Tailwind 텍스트 클래스 */
  text: string;
  /** 인라인/SVG용 hex */
  hex: string;
}

/** 정답률(0~100) → 임계 색상 (80 이상 green / 60 이상 gold / 그 외 red) */
export function accuracyColor(pct: number): AccuracyColor {
  if (pct >= 80) return { text: 'text-[#6FC4A0]', hex: '#5FB991' };
  if (pct >= 60) return { text: 'text-[#DDB868]', hex: '#CFA24E' };
  return { text: 'text-[#DD8C85]', hex: '#CD746C' };
}
