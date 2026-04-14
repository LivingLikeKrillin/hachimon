interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="w-full max-w-[393px] mx-auto px-4 pb-24 min-h-svh space-y-4 pt-safe bg-gate-aura">
      <header className="flex items-center gap-3.5 pt-3 animate-up">
        <img
          src="/logo.png"
          alt="Hachimon"
          className="w-12 h-12 rounded-xl"
          style={{ filter: 'drop-shadow(0 0 8px rgba(96, 165, 250, 0.3))' }}
        />
        <span className="font-display text-[22px] font-bold tracking-[0.2em] bg-gradient-to-r from-blue-400 via-amber-400 to-red-400 bg-clip-text text-transparent">
          HACHIMON
        </span>
      </header>
      {children}
    </div>
  );
}
