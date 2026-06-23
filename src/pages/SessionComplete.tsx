import { CheckCircle, RotateCcw, Home, Clock, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import SectionLabel from '@/components/shared/SectionLabel';
import TierBadge from '@/components/shared/TierBadge';
import GateMeter from '@/components/shared/GateMeter';
import ActionButton from '@/components/shared/ActionButton';
import ScreenContainer from '@/components/layout/ScreenContainer';
import { accuracyColor } from '@/lib/tokens';
import type { SessionSummary } from '@/hooks/useReviewSession';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
}

interface SessionCompleteProps {
  summary: SessionSummary;
  onRetry: () => void;
  onHome: () => void;
}

export default function SessionComplete({ summary, onRetry, onHome }: SessionCompleteProps) {
  const { accuracy, totalCards, correctCount, duration, tierBreakdown, wrongCards } = summary;

  const acc = accuracyColor(accuracy);

  return (
    <ScreenContainer className="px-4 pb-24">
      {/* Result header */}
      <div className="text-center pt-8 pb-6 animate-up">
        {/* Accuracy ring */}
        <div className="relative w-28 h-28 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={acc.hex}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${accuracy * 2.64} ${264 - accuracy * 2.64}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-display text-[28px] font-bold ${acc.text}`}>
              {accuracy}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle size={18} className={acc.text} />
          <p className="text-[18px] font-semibold text-zinc-100">세션 완료</p>
        </div>
        <p className="text-[13px] text-zinc-500">
          {totalCards}장 중 {correctCount}장 정답
        </p>

        {/* 八門 개방 — 세션 완주 페이오프 */}
        <div className="mt-5 px-2">
          <GateMeter value={1} max={1} size={24} />
          <p className="text-[11px] text-zinc-500 mt-2 tracking-[0.15em]">팔문 개방 · 八門遁甲</p>
        </div>
      </div>

      {/* Quick stats */}
      <Card className="animate-up stagger-1">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 divide-x divide-zinc-800/60">
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target size={14} className="text-zinc-500" />
              </div>
              <p className="font-display text-[18px] font-bold text-zinc-100">{totalCards}</p>
              <p className="text-[11px] text-zinc-500">전체</p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle size={14} className="text-emerald-400" />
              </div>
              <p className="font-display text-[18px] font-bold text-emerald-400">{correctCount}</p>
              <p className="text-[11px] text-zinc-500">정답</p>
            </div>
            <div className="text-center px-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock size={14} className="text-zinc-500" />
              </div>
              <p className="font-display text-[18px] font-bold text-zinc-100">{formatDuration(duration)}</p>
              <p className="text-[11px] text-zinc-500">소요</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier breakdown */}
      {tierBreakdown.length > 0 && (
        <div className="mt-4 animate-up stagger-2">
          <SectionLabel>티어별 결과</SectionLabel>
          <Card>
            <CardContent className="p-4 space-y-3">
              {tierBreakdown.map((t) => (
                <div key={t.tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={t.tier} full />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-zinc-500">
                      {t.correct}/{t.total}
                    </span>
                    <span className={`font-display text-[14px] font-bold tabular-nums ${accuracyColor(t.accuracy).text}`}>
                      {t.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wrong cards */}
      {wrongCards.length > 0 && (
        <div className="mt-4 animate-up stagger-3">
          <SectionLabel>틀린 카드 ({wrongCards.length})</SectionLabel>
          <Card>
            <CardContent className="p-0">
              {wrongCards.map((card, i) => (
                <div
                  key={card.cardId}
                  className={`px-4 py-3 ${i < wrongCards.length - 1 ? 'border-b border-zinc-800/60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <TierBadge tier={card.tier} />
                    <p className="text-[13px] text-zinc-300 leading-relaxed">{card.question}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-2.5 animate-up stagger-4">
        {wrongCards.length > 0 && (
          <ActionButton variant="warning" icon={<RotateCcw size={18} />} onClick={onRetry}>
            틀린 카드 재복습 ({wrongCards.length}장)
          </ActionButton>
        )}
        <ActionButton variant="secondary" icon={<Home size={18} />} onClick={onHome}>
          홈으로
        </ActionButton>
      </div>
    </ScreenContainer>
  );
}
