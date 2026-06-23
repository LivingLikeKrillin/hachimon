import { Sparkles, Flame, CreditCard, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Screen } from '@/types';
import PageLayout from '@/components/layout/PageLayout';
import SectionLabel from '@/components/shared/SectionLabel';
import { useHomeStats } from '@/hooks/useDueCards';
import { useSettings } from '@/hooks/useSettings';

interface HomeProps {
  onNavigate: (screen: Screen) => void;
  onStartDeckReview?: (deckId: string) => void;
}

export default function Home({ onNavigate, onStartDeckReview }: HomeProps) {
  const { stats, loading } = useHomeStats();
  const { settings } = useSettings();

  if (loading) return <PageLayout><div /></PageLayout>;

  const gauges = [
    { v: stats.dueCount, l: '복습 대기' },
    { v: stats.streak, l: '연속 일수' },
    { v: stats.totalCards.toLocaleString(), l: '전체 카드' },
  ];
  const pct = Math.min((stats.todayReviewed / settings.sessionSize) * 100, 100);

  return (
    <PageLayout>
      {/* Stat row */}
      <div className="flex items-center pt-1 animate-up">
        {gauges.map((g, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? 'pl-[22px] border-l border-white/[0.08]' : ''}`}>
            <div
              className="font-num text-[30px] font-semibold leading-none"
              style={{ color: g.v === 0 ? '#5D636F' : '#ECEEF2' }}
            >
              {g.v}
            </div>
            <div className="text-[12.5px] text-[#969BA6] mt-[7px]">{g.l}</div>
          </div>
        ))}
      </div>

      {/* Daily goal */}
      <Card className="animate-up stagger-1">
        <CardContent className="p-[18px]">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[14.5px] font-medium text-[#C7CCD4]">오늘의 목표</span>
            <span className="font-num text-[15px] text-[#5D636F]">
              <span className="text-[18px] font-semibold text-[#E9A94C]">{stats.todayReviewed}</span> / {settings.sessionSize}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#0E1015] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#E9A94C] shadow-[0_0_8px_rgba(233,169,76,0.6)] transition-[width] duration-500"
              style={{ width: `max(4px, ${pct}%)` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-[11px] animate-up stagger-2">
        <button
          onClick={() => onNavigate('review')}
          className="btn-gold h-[54px] rounded-[15px] text-[16px] font-semibold flex items-center justify-center gap-2.5 transition-transform duration-150 active:scale-[0.98]"
        >
          <Sparkles size={18} />
          오늘의 복습 시작
        </button>
        <button
          onClick={() => onNavigate('forge')}
          className="btn-tile h-[54px] rounded-[15px] text-[15.5px] font-semibold flex items-center justify-center gap-2.5 transition-transform duration-150 active:scale-[0.98]"
        >
          <Flame size={18} className="text-[#E9A94C]" />
          단련
        </button>
      </div>

      {/* Review queue */}
      {stats.dueByDeck.length > 0 && (
        <div className="animate-up stagger-3">
          <SectionLabel>복습 대기</SectionLabel>
          <Card>
            <CardContent className="p-0">
              {stats.dueByDeck.map((deck, i) => (
                <button
                  key={deck.deckId}
                  onClick={() => onStartDeckReview?.(deck.deckId)}
                  className={`w-full flex items-center gap-3 px-4 py-[15px] transition-colors active:bg-white/[0.03] ${
                    i < stats.dueByDeck.length - 1 ? 'border-b border-white/[0.06]' : ''
                  }`}
                >
                  <CreditCard size={17} className="text-[#5D636F]" strokeWidth={1.6} />
                  <span className="text-[15px] font-medium text-[#ECEEF2] flex-1 text-left">{deck.name}</span>
                  <span className="font-num text-[14px] text-[#969BA6]">{deck.count}</span>
                  <ChevronRight size={16} className="text-[#4A505B]" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weak cards */}
      <div className="animate-up stagger-4">
        <SectionLabel>약한 카드</SectionLabel>
        <Card>
          {stats.leeches.length > 0 ? (
            <CardContent className="p-0">
              {stats.leeches.slice(0, 5).map((leech, i) => (
                <div
                  key={leech.cardId}
                  className={`flex items-center gap-3 px-4 py-[13px] ${
                    i < Math.min(stats.leeches.length, 5) - 1 ? 'border-b border-white/[0.06]' : ''
                  }`}
                >
                  <Flame size={16} className="text-[#CD746C] shrink-0" strokeWidth={1.8} />
                  <span className="text-[14px] text-[#C7CCD4] flex-1 leading-snug line-clamp-2">{leech.question}</span>
                  <span className="font-num text-[12px] text-[#CD746C] shrink-0">
                    {leech.againCount}회 모름
                  </span>
                </div>
              ))}
            </CardContent>
          ) : (
            <CardContent className="p-6 flex flex-col items-center text-center gap-1.5">
              <span className="w-[38px] h-[38px] rounded-[11px] bg-[#181B21] border border-white/[0.07] flex items-center justify-center mb-1.5">
                <Flame size={19} className="text-[#5D636F]" strokeWidth={1.7} />
              </span>
              <p className="text-[14.5px] font-medium text-[#C7CCD4]">아직 약한 카드가 없어요</p>
              <p className="text-[13px] text-[#5D636F] leading-snug">복습을 시작하면 자주 틀리는 카드가 모여요</p>
            </CardContent>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
