interface SectionLabelProps {
  children: React.ReactNode;
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return (
    <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3">
      {children}
    </p>
  );
}
