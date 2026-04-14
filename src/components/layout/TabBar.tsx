import { Home, Layers, BarChart3, Settings } from 'lucide-react';
import type { Tab } from '@/types';

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'decks', label: '덱', icon: Layers },
  { id: 'stats', label: '통계', icon: BarChart3 },
  { id: 'settings', label: '설정', icon: Settings },
];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/40 z-50">
      <div className="flex justify-around h-12">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[44px] gap-0.5 transition-all duration-200 ${
              active === id ? 'text-blue-400' : 'text-zinc-600'
            }`}
          >
            {active === id && (
              <span
                className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
              />
            )}
            <Icon size={20} strokeWidth={active === id ? 2.2 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
      <div className="pb-safe" />
    </nav>
  );
}
