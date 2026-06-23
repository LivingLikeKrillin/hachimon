import { Flame, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Screen } from '@/types';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import StatRow from '@/components/shared/StatRow';
import GateMeter from '@/components/shared/GateMeter';
import ActionButton from '@/components/shared/ActionButton';
import { GATE_COLORS } from '@/lib/tokens';
import { useHomeStats } from '@/hooks/useDueCards';
import { useSettings } from '@/hooks/useSettings';

// Home 덱 강조용 게이트 색상 순서 (1·5·7·3·6문)
const DECK_GATES = [GATE_COLORS[0], GATE_COLORS[4], GATE_COLORS[6], GATE_COLORS[2], GATE_COLORS[5]];

interface HomeProps {
  onNavigate: (screen: Screen) => void;
  onStartDeckReview?: (deckId: string) => void;
}

export default function Home({ onNavigate, onStartDeckReview }: HomeProps) {
  const { stats, loading } = useHomeStats();
  const { settings } = useSettings();

  if (loading) return <PageLayout><div /></PageLayout>;

  return (
    <PageLayout>
      {/* Stats summary */}
      <div className="animate-up stagger-1">
        <StatRow
          items={[
            { value: stats.dueCount, label: '오늘 복습', color: 'text-blue-400' },
            { value: stats.streak, label: '연속 일수', color: 'text-amber-400' },
            { value: stats.totalCards.toLocaleString(), label: '전체 카드' },
          ]}
        />
      </div>

      {/* Daily goal — 八門 gate hero */}
      <Card className="animate-up stagger-2">
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-baseline">
            <p className="text-[13px] font-medium text-zinc-300">오늘의 목표</p>
            <p className="font-display text-[16px] font-bold tabular-nums">
              <span className="text-blue-400">{stats.todayReviewed}</span>
              <span className="text-zinc-600 mx-1">/</span>
              <span className="text-zinc-200">{settings.sessionSize}</span>
              <span className="text-[12px] text-zinc-500 ml-0.5">장</span>
            </p>
          </div>
          <GateMeter value={stats.todayReviewed} max={settings.sessionSize} size={30} showCaption />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-2.5 animate-up stagger-3">
        <ActionButton variant="primary" icon={<Sparkles size={18} />} onClick={() => onNavigate('review')}>
          오늘의 복습 시작
        </ActionButton>
        <ActionButton
          variant="secondary"
          icon={<Flame size={18} className="text-amber-500" />}
          onClick={() => onNavigate('interview')}
        >
          면접 훈련 모드
        </ActionButton>
      </div>

      {/* Due decks */}
      {stats.dueByDeck.length > 0 && (
        <div className="animate-up stagger-4">
          <SectionLabel>복습 대기 Top 3</SectionLabel>
          <Card>
            <CardContent className="p-0">
              {stats.dueByDeck.map((deck, i) => (
                <div
                  key={deck.deckId}
                  onClick={() => onStartDeckReview?.(deck.deckId)}
                  className={`flex justify-between items-center px-4 py-3.5 group cursor-pointer transition-colors hover:bg-zinc-800/30 active:bg-zinc-800/50 ${
                    i < stats.dueByDeck.length - 1 ? 'border-b border-zinc-800/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-1 h-6 rounded-full"
                      style={{ background: DECK_GATES[i % DECK_GATES.length] }}
                    />
                    <span className="text-[14px] text-zinc-200">{deck.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-[14px] font-semibold tabular-nums" style={{ color: DECK_GATES[i % DECK_GATES.length] }}>
                      {deck.count}
                    </span>
                    <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leech warning */}
      <div className="animate-up stagger-5">
        <SectionLabel>약한 카드</SectionLabel>
        <Card className="glow-amber">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-[14px] text-zinc-200">
                거머리 카드 탐지는 복습 데이터 축적 후 활성화됩니다
              </p>
              <p className="text-[12px] text-zinc-400">복습을 시작하세요</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
