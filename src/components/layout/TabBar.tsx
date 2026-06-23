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
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] bg-[#0C0D11]/85 backdrop-blur-xl border-t border-white/[0.07] z-50"
      style={{ paddingTop: 10, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex justify-around items-center">
        {tabs.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center justify-center min-w-[64px] gap-1.5"
              style={{ color: on ? '#E9A94C' : '#5D636F' }}
            >
              <Icon
                size={23}
                strokeWidth={on ? 1.9 : 1.7}
                style={on ? { filter: 'drop-shadow(0 0 8px rgba(233,169,76,0.5))' } : undefined}
              />
              <span className="text-[11px]" style={{ fontWeight: on ? 600 : 500 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
