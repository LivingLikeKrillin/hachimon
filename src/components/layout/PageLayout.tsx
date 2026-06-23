import ScreenContainer from '@/components/layout/ScreenContainer';

interface PageLayoutProps {
  children: React.ReactNode;
}

// 골드 토리이(문) 마크 — 브랜드 로고
export function ToriiMark({ size = 40 }: { size?: number }) {
  const g = Math.round(size * 0.45);
  return (
    <span
      className="rounded-xl bg-[#181B21] border border-white/[0.08] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{ width: size, height: size }}
    >
      <svg width={g * 0.9} height={g} viewBox="0 0 28 32" fill="none" stroke="#E9A94C" strokeWidth={2.4} strokeLinecap="round">
        <line x1="2" y1="6" x2="26" y2="6" strokeWidth={3.2} />
        <line x1="5.5" y1="11.5" x2="22.5" y2="11.5" />
        <line x1="8.5" y1="6" x2="8.5" y2="30" />
        <line x1="19.5" y1="6" x2="19.5" y2="30" />
      </svg>
    </span>
  );
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <ScreenContainer className="px-[22px] pb-28 space-y-5">
      <header className="flex items-center gap-3 pt-4 pb-1">
        <ToriiMark />
        <span className="font-display text-[21px] font-semibold text-[#F4F5F7] tracking-tight">Hachimon</span>
      </header>
      {children}
    </ScreenContainer>
  );
}
