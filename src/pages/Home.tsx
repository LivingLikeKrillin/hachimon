import { Flame, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import StatRow from '@/components/shared/StatRow';
import ProgressBar from '@/components/shared/ProgressBar';

export default function Home() {
  return (
    <PageLayout>
      {/* Stats summary */}
      <div className="animate-up stagger-1">
        <StatRow
          items={[
            { value: 23, label: '오늘 복습', color: 'text-blue-400' },
            { value: 47, label: '연속 일수', color: 'text-amber-400' },
            { value: '1,235', label: '전체 카드' },
          ]}
        />
      </div>

      {/* Daily goal */}
      <Card className="animate-up stagger-2">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[13px] text-zinc-400">오늘의 목표</p>
            <p className="font-display text-[14px] font-semibold tabular-nums">
              <span className="text-blue-400">0</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span>15</span>
            </p>
          </div>
          <ProgressBar value={0} max={15} color="#60a5fa" h="h-2" />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-2.5 animate-up stagger-3">
        <button className="w-full h-[52px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.97] bg-gradient-to-r from-blue-600 to-blue-500 text-white relative overflow-hidden group">
          <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/20 to-blue-400/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <Sparkles size={18} />
          오늘의 복습 시작
        </button>
        <button className="w-full h-[52px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.97] bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-amber-500/30 hover:text-amber-400 group">
          <Flame size={18} className="text-amber-500 group-hover:text-amber-400 transition-colors" />
          면접 훈련 모드
        </button>
      </div>

      {/* Due decks */}
      <div className="animate-up stagger-4">
        <SectionLabel>Due Top 3</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {[
              { name: 'Spring Core', count: 8, gate: 'var(--gate-1)' },
              { name: 'JPA Core', count: 5, gate: 'var(--gate-5)' },
              { name: 'Java Concurrency', count: 4, gate: 'var(--gate-7)' },
            ].map((deck, i) => (
              <div
                key={deck.name}
                className={`flex justify-between items-center px-4 py-3.5 group cursor-pointer transition-colors hover:bg-zinc-800/30 ${
                  i < 2 ? 'border-b border-zinc-800/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-1 h-6 rounded-full"
                    style={{ background: deck.gate }}
                  />
                  <span className="text-[14px]">{deck.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-[14px] font-semibold tabular-nums" style={{ color: deck.gate }}>
                    {deck.count}
                  </span>
                  <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Leech warning */}
      <div className="animate-up stagger-5">
        <SectionLabel>약한 카드</SectionLabel>
        <Card className="glow-amber">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-[14px]">
                3회 이상 틀린 카드가 <span className="text-amber-400 font-semibold">7장</span> 있습니다
              </p>
              <p className="text-[12px] text-zinc-500">집중 복습이 필요합니다</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
