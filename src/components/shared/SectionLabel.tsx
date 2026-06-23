interface SectionLabelProps {
  children: React.ReactNode;
  /** 카드 내부 미니 라벨 — 하단 여백 축소 */
  tight?: boolean;
  /** 대문자 그룹 라벨 (설정/완료 섹션용) */
  upper?: boolean;
}

export default function SectionLabel({ children, tight = false, upper = false }: SectionLabelProps) {
  if (upper) {
    return (
      <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] text-[#5D636F] ${tight ? 'mb-2' : 'mb-3'}`}>
        {children}
      </p>
    );
  }
  return (
    <p className={`text-[13px] font-semibold tracking-[0.02em] text-[#969BA6] pl-0.5 ${tight ? 'mb-2' : 'mb-3'}`}>
      {children}
    </p>
  );
}
