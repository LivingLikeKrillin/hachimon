interface SectionLabelProps {
  children: React.ReactNode;
  /** 카드 내부 미니 라벨용 — 하단 여백을 줄인다 */
  tight?: boolean;
}

export default function SectionLabel({ children, tight = false }: SectionLabelProps) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-widest text-zinc-500 ${
        tight ? 'mb-2' : 'mb-3'
      }`}
    >
      {children}
    </p>
  );
}
