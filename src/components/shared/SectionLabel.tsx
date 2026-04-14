interface SectionLabelProps {
  children: React.ReactNode;
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return (
    <p className="text-[12px] font-semibold text-zinc-400 mb-3">
      {children}
    </p>
  );
}
